import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useVoice } from '../hooks/useVoice';
import { getSpeakingPartnerResponse, getEvaluationResponse } from '../services/groqService';
import {
  buildCasualPrompt,
  buildProfessionalPrompt,
  buildInterviewPrompt,
  buildInterviewEvaluatorPrompt,
  buildSessionSummaryPrompt,
  buildHelpMeSayItPrompt,
} from '../prompts/systemPrompts';
import SessionSummary from './SessionSummary';
import HelpMeSayIt from './HelpMeSayIt';
import VoiceNoteBubble from './VoiceNoteBubble';
import './Conversation.css';

export default function Conversation({ mode, config, onExit }) {
  const [inputMode, setInputMode] = useState('voice');
  const [typedText, setTypedText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [messages, setMessages] = useState([]);
  const [questionNumber, setQuestionNumber] = useState(1);

  // Corrections are collected here as the conversation goes, but NOT rendered
  // live anymore - they only surface in the end-of-session summary, so the
  // conversation itself stays low-pressure instead of feeling graded turn by turn.
  const [collectedCorrections, setCollectedCorrections] = useState([]);

  const [showSummary, setShowSummary] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryResult, setSummaryResult] = useState(null);

  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const [helpLoading, setHelpLoading] = useState(false);
  const [helpResult, setHelpResult] = useState(null);

  const isCallActiveRef = useRef(false);
  useEffect(() => {
    isCallActiveRef.current = isCallActive;
  }, [isCallActive]);

  const {
    isSttSupported,
    isTtsSupported,
    isListening,
    isTranscribing,
    transcript,
    setTranscript,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  } = useVoice(({ text, audioUrl }) => {
    if (text) {
      handleUserTurn(text, audioUrl);
    } else if (isCallActiveRef.current) {
      startListening();
    }
  });

  const buildSystemPrompt = useCallback(() => {
    if (mode === 'casual') return buildCasualPrompt(config);
    if (mode === 'professional') return buildProfessionalPrompt(config);
    if (mode === 'interview') return buildInterviewPrompt({ ...config, questionNumber });
    throw new Error(`Unknown mode: ${mode}`);
  }, [mode, config, questionNumber]);

  const handleUserTurn = async (userText, audioUrl = null) => {
    if (!userText.trim()) return;
    setIsThinking(true);
    const userMsg = { role: 'user', content: userText, audioUrl };
    const historyForApi = messages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const systemPrompt = buildSystemPrompt();
      // Interview mode uses a lower temperature - focused, consistent question
      // quality matters more here than the natural variety wanted in casual chat.
      const temperature = mode === 'interview' ? 0.5 : 0.7;
      const result = await getSpeakingPartnerResponse(systemPrompt, historyForApi, userText, temperature);

      const assistantMsg = { role: 'assistant', content: result.reply };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      if (result.corrections?.length) {
        setCollectedCorrections((prev) => [...prev, ...result.corrections]);
      }
      setQuestionNumber((n) => n + 1);
      setIsThinking(false);
      setIsSpeaking(true);
      speak(result.reply, {
        onDone: () => {
          setIsSpeaking(false);
          if (isCallActiveRef.current) startListening();
        },
      });
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        userMsg,
        { role: 'assistant', content: `Something went wrong: ${err.message}` },
      ]);
      setIsThinking(false);
      if (isCallActiveRef.current) startListening();
    } finally {
      setTranscript('');
      setTypedText('');
    }
  };

  const handleRecordPress = () => {
    if (!isCallActive) {
      setIsCallActive(true);
      startListening();
      return;
    }
    if (isListening) {
      // Manual "I'm done talking, go ahead" - submits right now instead of
      // waiting for silence detection, which can't work in loud environments
      // (markets, stations, crowds) since background noise never quiets down
      // enough to register as "you stopped talking."
      stopListening();
      return;
    }
    // Not actively listening (thinking or speaking) - tapping here ends the call.
    setIsCallActive(false);
    stopListening();
    stopSpeaking();
    setIsSpeaking(false);
  };

  // Keeps the media-session button handler calling the CURRENT handleRecordPress
  // logic (which depends on isListening/isCallActive) rather than whatever
  // version was captured when the effect below last ran.
  const handleRecordPressRef = useRef(handleRecordPress);
  useEffect(() => {
    handleRecordPressRef.current = handleRecordPress;
  });

  // Earphone/headset hardware button support. The browser only routes a
  // physical media button (the click on a wired earphone's inline remote,
  // or a Bluetooth button) to the page while there's an active "media
  // session" - which normally means something is actively playing. A
  // silent, looping, inaudible track keeps that session alive for the
  // duration of the call so the hardware button has something to attach to.
  // This is IN ADDITION to the on-screen tap, not a replacement for it -
  // if this doesn't work on a given phone/earphone combo, the manual tap
  // still works exactly as before.
  useEffect(() => {
    if (!isCallActive) return undefined;
    if (typeof window === 'undefined' || !('AudioContext' in window || 'webkitAudioContext' in window)) {
      return undefined;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0; // silent - this track exists only to keep a media session alive
    oscillator.connect(gain);
    const destination = ctx.createMediaStreamDestination();
    gain.connect(destination);
    oscillator.start();

    const silentAudio = new Audio();
    silentAudio.srcObject = destination.stream;
    silentAudio.loop = true;
    silentAudio.play().catch(() => {
      // Autoplay can be blocked in some contexts - if so, the earphone button
      // simply won't work this session, but the on-screen tap is unaffected.
    });

    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Speaking Partner - live session',
          artist: mode,
        });
      } catch {
        // Non-fatal if MediaMetadata isn't supported.
      }
      navigator.mediaSession.setActionHandler('play', () => handleRecordPressRef.current());
      navigator.mediaSession.setActionHandler('pause', () => handleRecordPressRef.current());
    }

    return () => {
      oscillator.stop();
      ctx.close();
      silentAudio.pause();
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCallActive]);

  const handleModeSwitch = (next) => {
    if (next === 'text' && isCallActive) {
      setIsCallActive(false);
      stopListening();
      stopSpeaking();
      setIsSpeaking(false);
    }
    setInputMode(next);
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    handleUserTurn(typedText.trim());
  };

  const handleEndSession = async () => {
    setIsCallActive(false);
    stopListening();
    stopSpeaking();
    setShowSummary(true);
    setSummaryLoading(true);
    setSummaryResult(null);

    if (messages.length === 0) {
      setSummaryLoading(false);
      return;
    }

    const transcriptText = messages.map((m) => `${m.role === 'user' ? 'You' : 'Partner'}: ${m.content}`).join('\n');

    try {
      const prompt =
        mode === 'interview'
          ? buildInterviewEvaluatorPrompt({ skill: config.skill, level: config.level, transcriptText })
          : buildSessionSummaryPrompt({ mode, transcriptText });
      const result = await getEvaluationResponse(prompt);
      setSummaryResult(result);
    } catch (err) {
      console.error(err);
      setSummaryResult(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleHelpSubmit = async (roughText) => {
    setHelpLoading(true);
    setHelpResult(null);
    try {
      const prompt = buildHelpMeSayItPrompt({
        mode,
        context: config.scenario || config.topic || config.skill || '',
        roughAttempt: roughText,
      });
      const result = await getEvaluationResponse(prompt);
      setHelpResult(result);
    } catch (err) {
      console.error(err);
      setHelpResult({ cleanSentence: "Couldn't process that just now - try again in a moment.", alternatives: [], note: '' });
    } finally {
      setHelpLoading(false);
    }
  };

  const recordStatusLabel = !isCallActive
    ? 'tap to start conversation'
    : isListening
    ? 'listening — tap when done talking'
    : isTranscribing
    ? 'catching that — tap to end call'
    : isThinking
    ? 'thinking — tap to end call'
    : isSpeaking
    ? 'partner speaking — tap to end call'
    : 'tap to end call';

  return (
    <div className="conv">
      <div className="conv-header">
        <button className="back-btn" onClick={onExit}>← back</button>
        <span className="conv-mode-label">{mode}{config?.skill ? ` · ${config.skill}` : ''}</span>
        <button className="end-btn" onClick={handleEndSession} disabled={messages.length === 0}>end session</button>
      </div>

      <div className="conv-page">
        {messages.length === 0 && (
          <div className="conv-empty">
            {mode === 'interview'
              ? `Ready when you are — press record to start your ${config.skill} interview.`
              : 'Press record and say hello to get started. Feedback comes at the end, not mid-conversation.'}
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={msg.role === 'user' ? 'line line-you' : 'line line-ai'}>
            <div className="line-head">
              <span className="line-role">{msg.role === 'user' ? 'you' : 'partner'}</span>
              {!(msg.role === 'user' && msg.audioUrl) && (
                <button className="line-replay" onClick={() => speak(msg.content)} aria-label="Play this line">▸ play</button>
              )}
            </div>
            {msg.role === 'user' && msg.audioUrl ? (
              <>
                <VoiceNoteBubble audioUrl={msg.audioUrl} />
                <p className="line-caption">{msg.content}</p>
              </>
            ) : (
              <p className="line-text">{msg.content}</p>
            )}
          </div>
        ))}

        {isThinking && <div className="thinking">partner is thinking…</div>}
      </div>

      <div className="conv-deck">
        {isSttSupported && (
          <div className="mode-toggle">
            <button className={inputMode === 'voice' ? 'active' : ''} onClick={() => handleModeSwitch('voice')}>voice</button>
            <button className={inputMode === 'text' ? 'active' : ''} onClick={() => handleModeSwitch('text')}>text</button>
            <button className="help-toggle" onClick={() => setShowHelpPanel(true)}>stuck? help me say it</button>
          </div>
        )}
        {!isSttSupported && (
          <div className="deck-note">Voice input isn't supported on this browser — using text.</div>
        )}

        {inputMode === 'voice' && isSttSupported ? (
          <div className="record-area">
            {transcript && <div className="live-transcript">{transcript}</div>}
            <button
              className={`record-btn ${isCallActive ? 'is-live' : ''}`}
              onClick={handleRecordPress}
              aria-label={isCallActive ? 'End conversation' : 'Start conversation'}
            >
              <span className="record-dot" />
            </button>
            <span className="record-label">{recordStatusLabel}</span>
            {isListening && (
              <div className="waveform" aria-hidden="true">
                {Array.from({ length: 9 }).map((_, i) => (
                  <span key={i} style={{ animationDelay: `${i * 0.09}s` }} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <form className="text-form" onSubmit={handleTextSubmit}>
            <input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder="Type your response…"
              autoFocus
            />
            <button type="submit" disabled={!typedText.trim()}>send</button>
          </form>
        )}

        {!isTtsSupported && (
          <div className="deck-note">This browser can't read replies aloud — you'll read them instead.</div>
        )}
      </div>

      <HelpMeSayIt
        isOpen={showHelpPanel}
        isLoading={helpLoading}
        result={helpResult}
        onSubmit={handleHelpSubmit}
        onSpeak={(text) => speak(text)}
        onReset={() => setHelpResult(null)}
        onClose={() => { setShowHelpPanel(false); setHelpResult(null); }}
      />

      {showSummary && (
        <SessionSummary
          mode={mode}
          isLoading={summaryLoading}
          result={summaryResult}
          allCorrections={collectedCorrections}
          onRetry={() => {
            setShowSummary(false);
            setMessages([]);
            setCollectedCorrections([]);
            setQuestionNumber(1);
          }}
          onClose={onExit}
        />
      )}
    </div>
  );
}

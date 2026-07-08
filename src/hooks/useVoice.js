import { useState, useRef, useCallback, useEffect } from 'react';
import {
  isNativePlatform,
  requestNativeSttPermission,
  startNativeListening,
  stopNativeListening,
  speakNative,
  stopNativeSpeaking,
} from '../services/nativeVoice';
import { getSpeechRate, getSpeechVoiceName } from '../services/settingsStore';

// Web path uses the browser's own live speech recognition - zero-tap, natural
// conversation flow, at the cost of accuracy versus the batch Whisper approach
// tried earlier (which was more accurate in principle but required a manual tap
// per turn and had its own recurring audio-quality problems that couldn't be
// verified without a real device). This restores the natural flow; if accuracy
// becomes the priority again later, the Whisper path is a known alternative.
const SILENCE_TIMEOUT_MS = 3000;

/**
 * Voice input/output for the app.
 * - Native (installed Capacitor app): Android's own speech recognizer + TTS.
 * - Web (browser testing/use): the browser's live Web Speech API - continuous,
 *   zero-tap after the call starts, using the recognizer's own result timing
 *   (not raw audio volume) to decide when you've paused.
 *
 * The interface is identical either way, so screens don't need to know which
 * path is active.
 */
export function useVoice(onFinalTranscript) {
  const native = isNativePlatform();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const onFinalTranscriptRef = useRef(onFinalTranscript);

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  // ---------------- NATIVE PATH ----------------
  const isListeningRef = useRef(false);

  const startListeningNative = useCallback(async () => {
    const granted = await requestNativeSttPermission();
    if (!granted) return;
    setTranscript('');
    setIsListening(true);
    isListeningRef.current = true;
    try {
      const finalText = await startNativeListening({ onPartial: setTranscript });
      setIsListening(false);
      isListeningRef.current = false;
      if (onFinalTranscriptRef.current) onFinalTranscriptRef.current({ text: finalText, audioUrl: null });
    } catch {
      setIsListening(false);
      isListeningRef.current = false;
      if (onFinalTranscriptRef.current) onFinalTranscriptRef.current({ text: '', audioUrl: null });
    }
  }, []);

  const stopListeningNative = useCallback(async () => {
    if (isListeningRef.current) await stopNativeListening();
  }, []);

  const speakNativeFn = useCallback((text, opts) => speakNative(text, opts), []);
  const stopSpeakingNativeFn = useCallback(() => stopNativeSpeaking(), []);

  // ---------------- WEB PATH (live browser speech recognition) ----------------
  const recognitionRef = useRef(null);
  const accumulatedFinalRef = useRef('');
  const isManualStopRef = useRef(false);

  const SpeechRecognitionCtor =
    !native && typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const isWebSttSupported = Boolean(SpeechRecognitionCtor);
  const isWebTtsSupported = !native && typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (native || !isWebSttSupported) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-IN';
    recognition.interimResults = true;
    // continuous=true has a well-documented bug on Android Chrome where it
    // re-echoes earlier words into new results instead of cleanly separating
    // "already heard" from "hearing now" - that's what was producing repeated
    // phrases like "so I am not so I am not so I am not...". Using single-shot
    // mode and restarting it ourselves on every natural pause avoids that buggy
    // mode entirely, while still feeling continuous to the person talking.
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const text = last[0].transcript;
      if (last.isFinal) {
        accumulatedFinalRef.current = (accumulatedFinalRef.current + ' ' + text).trim();
        setTranscript(accumulatedFinalRef.current);
      } else {
        setTranscript((accumulatedFinalRef.current + ' ' + text).trim());
      }
    };

    recognition.onend = () => {
      if (isManualStopRef.current) {
        // The person tapped stop - this turn is actually over, submit it.
        isManualStopRef.current = false;
        setIsListening(false);
        const finalText = accumulatedFinalRef.current.trim();
        accumulatedFinalRef.current = '';
        if (onFinalTranscriptRef.current) onFinalTranscriptRef.current({ text: finalText, audioUrl: null });
      } else {
        // Ended on its own (a natural pause) - restart invisibly so it keeps
        // capturing the rest of what they're saying, without ever needing
        // continuous mode.
        try {
          recognition.start();
        } catch {
          setIsListening(false);
          const finalText = accumulatedFinalRef.current.trim();
          accumulatedFinalRef.current = '';
          if (onFinalTranscriptRef.current) onFinalTranscriptRef.current({ text: finalText, audioUrl: null });
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') {
        // Nothing heard in this chunk yet - not a real error, keep going.
        return;
      }
      isManualStopRef.current = false;
      setIsListening(false);
      accumulatedFinalRef.current = '';
      if (onFinalTranscriptRef.current) onFinalTranscriptRef.current({ text: '', audioUrl: null });
    };

    recognitionRef.current = recognition;
    return () => {
      isManualStopRef.current = true;
      recognition.stop();
    };
  }, [native, isWebSttSupported]);

  const startListeningWeb = useCallback(() => {
    if (!recognitionRef.current) return;
    accumulatedFinalRef.current = '';
    isManualStopRef.current = false;
    setTranscript('');
    setIsListening(true);
    recognitionRef.current.start();
  }, []);

  const stopListeningWeb = useCallback(() => {
    isManualStopRef.current = true;
    recognitionRef.current?.stop();
  }, []);

  const speakWeb = useCallback((text, { onDone } = {}) => {
    if (!isWebTtsSupported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    // Falls back to the exact same defaults as before if Settings hasn't been
    // touched - this is purely additive, nothing changes for someone who
    // never opens Settings.
    utterance.rate = getSpeechRate();
    utterance.pitch = 1.0;
    const voiceName = getSpeechVoiceName();
    if (voiceName) {
      const match = window.speechSynthesis.getVoices().find((v) => v.name === voiceName);
      if (match) utterance.voice = match;
    }
    if (onDone) utterance.onend = onDone;
    window.speechSynthesis.speak(utterance);
  }, [isWebTtsSupported]);

  const stopSpeakingWeb = useCallback(() => {
    if (isWebTtsSupported) window.speechSynthesis.cancel();
  }, [isWebTtsSupported]);

  // ---------------- EXPOSE THE ACTIVE PATH ----------------
  if (native) {
    return {
      isSttSupported: true,
      isTtsSupported: true,
      isListening,
      isTranscribing: false,
      transcript,
      setTranscript,
      startListening: startListeningNative,
      stopListening: stopListeningNative,
      speak: speakNativeFn,
      stopSpeaking: stopSpeakingNativeFn,
    };
  }

  return {
    isSttSupported: isWebSttSupported,
    isTtsSupported: isWebTtsSupported,
    isListening,
    isTranscribing: false,
    transcript,
    setTranscript,
    startListening: startListeningWeb,
    stopListening: stopListeningWeb,
    speak: speakWeb,
    stopSpeaking: stopSpeakingWeb,
  };
}

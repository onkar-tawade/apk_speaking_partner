import { useState, useRef, useCallback, useEffect } from 'react';
import {
  isNativePlatform,
  requestNativeSttPermission,
  startNativeListening,
  stopNativeListening,
  speakNative,
  stopNativeSpeaking,
} from '../services/nativeVoice';

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
  const transcriptRef = useRef('');
  const silenceTimerRef = useRef(null);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const SpeechRecognitionCtor =
    !native && typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const isWebSttSupported = Boolean(SpeechRecognitionCtor);
  const isWebTtsSupported = !native && typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (native || !isWebSttSupported) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((r) => r[0].transcript).join(' ');
      transcriptRef.current = text;
      setTranscript(text);
      // Every new bit of recognized speech pushes back the "are they done?"
      // decision - this is the recognizer's own result timing, not raw audio
      // volume, which is what made the earlier custom silence-detection attempt
      // unreliable.
      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => recognitionRef.current?.stop(), SILENCE_TIMEOUT_MS);
    };

    recognition.onend = () => {
      clearSilenceTimer();
      setIsListening(false);
      const finalText = transcriptRef.current.trim();
      transcriptRef.current = '';
      if (onFinalTranscriptRef.current) onFinalTranscriptRef.current({ text: finalText, audioUrl: null });
    };

    recognition.onerror = (event) => {
      clearSilenceTimer();
      setIsListening(false);
      transcriptRef.current = '';
      if (event.error === 'no-speech' && onFinalTranscriptRef.current) {
        onFinalTranscriptRef.current({ text: '', audioUrl: null });
      }
    };

    recognitionRef.current = recognition;
    return () => {
      clearSilenceTimer();
      recognition.stop();
    };
  }, [native, isWebSttSupported]);

  const startListeningWeb = useCallback(() => {
    if (!recognitionRef.current) return;
    clearSilenceTimer();
    transcriptRef.current = '';
    setTranscript('');
    setIsListening(true);
    recognitionRef.current.start();
  }, []);

  const stopListeningWeb = useCallback(() => {
    clearSilenceTimer();
    recognitionRef.current?.stop();
  }, []);

  const speakWeb = useCallback((text, { onDone } = {}) => {
    if (!isWebTtsSupported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
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

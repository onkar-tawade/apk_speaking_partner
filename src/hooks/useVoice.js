import { useState, useRef, useCallback, useEffect } from 'react';
import {
  isNativePlatform,
  requestNativeSttPermission,
  startNativeListening,
  stopNativeListening,
  speakNative,
  stopNativeSpeaking,
} from '../services/nativeVoice';
import { transcribeAudio } from '../services/groqService';

// Web path only. This is real-microphone-volume silence detection (not the browser's
// own speech-end guessing, which was the thing cutting people off / mishearing them).
// Instead of one fixed loudness number (which was a guess that didn't hold up across
// devices/rooms), each turn briefly measures the actual background noise level first,
// then sets the speech threshold relative to that - adapts per environment instead of
// needing a manually re-tuned constant.
const CALIBRATION_MS = 500;
const SPEECH_MARGIN = 14; // how much louder than the measured background counts as "talking"
const MIN_THRESHOLD = 6; // floor, in case the room is near-silent
const SILENCE_DURATION_MS = 3000;
const MAX_RECORDING_MS = 25000; // safety cap so a stuck recording can't run forever

/**
 * Voice input/output for the app.
 * - Native (installed Capacitor app): Android's own speech recognizer + TTS.
 * - Web (browser testing): records actual audio and sends it to Groq's Whisper
 *   endpoint for transcription - meaningfully more accurate than the browser's
 *   built-in engine, at the cost of a short delay after you finish talking
 *   instead of live word-by-word text.
 *
 * The interface is identical either way, so screens don't need to know which
 * path is active.
 */
export function useVoice(onFinalTranscript) {
  const native = isNativePlatform();

  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
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
      if (onFinalTranscriptRef.current) onFinalTranscriptRef.current(finalText);
    } catch {
      setIsListening(false);
      isListeningRef.current = false;
      if (onFinalTranscriptRef.current) onFinalTranscriptRef.current('');
    }
  }, []);

  const stopListeningNative = useCallback(async () => {
    if (isListeningRef.current) await stopNativeListening();
  }, []);

  const speakNativeFn = useCallback((text, opts) => speakNative(text, opts), []);
  const stopSpeakingNativeFn = useCallback(() => stopNativeSpeaking(), []);

  // ---------------- WEB PATH (record audio -> Groq Whisper) ----------------
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const maxTimerRef = useRef(null);
  const hasSpokenRef = useRef(false);
  const silenceStartRef = useRef(null);
  const calibrationStartRef = useRef(0);
  const ambientSamplesRef = useRef([]);
  const dynamicThresholdRef = useRef(null);

  const isWebSttSupported =
    !native && typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices) && typeof window.MediaRecorder !== 'undefined';
  const isWebTtsSupported = !native && typeof window !== 'undefined' && 'speechSynthesis' in window;

  const cleanupWebRecording = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    rafRef.current = null;
    maxTimerRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    audioContextRef.current = null;
    analyserRef.current = null;
  };

  const monitorSilence = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);

    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const v = data[i] - 128;
      sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / data.length);

    // First half-second of each turn: just measure the room, don't judge it yet.
    const elapsed = Date.now() - calibrationStartRef.current;
    if (elapsed < CALIBRATION_MS) {
      ambientSamplesRef.current.push(rms);
      rafRef.current = requestAnimationFrame(monitorSilence);
      return;
    }
    if (dynamicThresholdRef.current === null) {
      const samples = ambientSamplesRef.current;
      const avgAmbient = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
      dynamicThresholdRef.current = Math.max(avgAmbient + SPEECH_MARGIN, MIN_THRESHOLD);
    }
    const threshold = dynamicThresholdRef.current;

    if (rms > threshold) {
      hasSpokenRef.current = true;
      silenceStartRef.current = null;
    } else if (hasSpokenRef.current) {
      if (!silenceStartRef.current) {
        silenceStartRef.current = Date.now();
      } else if (Date.now() - silenceStartRef.current > SILENCE_DURATION_MS) {
        stopListeningWebRef.current();
        return;
      }
    }
    rafRef.current = requestAnimationFrame(monitorSilence);
  }, []);

  const handleRecordingStopped = useCallback(async () => {
    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    audioChunksRef.current = [];
    setIsListening(false);
    cleanupWebRecording();

    // Roughly "nothing was said" - a fraction-of-a-second clip of silence.
    if (blob.size < 2000) {
      if (onFinalTranscriptRef.current) onFinalTranscriptRef.current('');
      return;
    }

    setIsTranscribing(true);
    try {
      const text = await transcribeAudio(blob);
      setIsTranscribing(false);
      if (onFinalTranscriptRef.current) onFinalTranscriptRef.current(text);
    } catch (err) {
      console.error('Transcription failed:', err);
      setIsTranscribing(false);
      if (onFinalTranscriptRef.current) onFinalTranscriptRef.current('');
    }
  }, []);

  const startListeningWeb = useCallback(async () => {
    if (!isWebSttSupported) return;
    try {
      // autoGainControl is OFF on purpose - Chrome's default auto gain control is
      // built for video calls, and it constantly re-normalizes volume in ways that
      // both broke our pause detection (ambient vs speech levels kept shifting) and
      // likely degraded what Whisper actually heard. Keeping echo cancellation and
      // noise suppression on since those still help in real-world noisy conditions.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      hasSpokenRef.current = false;
      silenceStartRef.current = null;
      calibrationStartRef.current = Date.now();
      ambientSamplesRef.current = [];
      dynamicThresholdRef.current = null;
      setTranscript('');

      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextCtor();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
        audioBitsPerSecond: 128000,
      });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = handleRecordingStopped;
      mediaRecorderRef.current = recorder;
      recorder.start();

      setIsListening(true);
      rafRef.current = requestAnimationFrame(monitorSilence);
      maxTimerRef.current = setTimeout(() => stopListeningWebRef.current(), MAX_RECORDING_MS);
    } catch (err) {
      console.error('Microphone access failed:', err);
      setIsListening(false);
    }
  }, [isWebSttSupported, monitorSilence, handleRecordingStopped]);

  const stopListeningWeb = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop(); // triggers handleRecordingStopped via onstop
    } else {
      cleanupWebRecording();
      setIsListening(false);
    }
  }, []);

  // monitorSilence and the max-duration timer call stopListeningWeb before it's
  // necessarily been redefined on this render - a ref keeps them pointed at the
  // latest version without adding it to their own dependency arrays.
  const stopListeningWebRef = useRef(stopListeningWeb);
  useEffect(() => {
    stopListeningWebRef.current = stopListeningWeb;
  }, [stopListeningWeb]);

  useEffect(() => {
    return () => cleanupWebRecording();
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
    isTranscribing,
    transcript,
    setTranscript,
    startListening: startListeningWeb,
    stopListening: stopListeningWeb,
    speak: speakWeb,
    stopSpeaking: stopSpeakingWeb,
  };
}

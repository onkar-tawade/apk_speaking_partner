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

// Web path only. No automatic silence/pause detection anymore - that was tried
// (fixed threshold, then adaptive calibration) and kept producing unreliable
// results (cutting recordings short, near-empty clips, wrong transcriptions)
// that couldn't be verified or debugged without a real device in hand. This is
// now purely manual: tap starts recording, tap again stops it, and EXACTLY that
// raw clip - untouched, unanalyzed - gets sent to Whisper. Simpler and easier to
// reason about: if this is still wrong, it's not our stop-timing logic at fault.
const MAX_RECORDING_MS = 60000; // hard safety cap only, not a "guess when done" mechanism

/**
 * Voice input/output for the app.
 * - Native (installed Capacitor app): Android's own speech recognizer + TTS.
 * - Web (browser testing): records actual audio between two taps and sends it to
 *   Groq's Whisper endpoint for transcription.
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

  // ---------------- WEB PATH (manual record -> Groq Whisper) ----------------
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const maxTimerRef = useRef(null);
  const audioContextRef = useRef(null);

  const isWebSttSupported =
    !native && typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices) && typeof window.MediaRecorder !== 'undefined';
  const isWebTtsSupported = !native && typeof window !== 'undefined' && 'speechSynthesis' in window;

  const cleanupWebRecording = () => {
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    maxTimerRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    audioContextRef.current = null;
  };

  const handleRecordingStopped = useCallback(async () => {
    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    audioChunksRef.current = [];
    setIsListening(false);
    cleanupWebRecording();

    // Genuinely no audio at all (tapped start then immediately stop).
    if (blob.size < 2000) {
      if (onFinalTranscriptRef.current) onFinalTranscriptRef.current({ text: '', audioUrl: null });
      return;
    }

    // Kept so the actual recording can be played back in the chat (real waveform,
    // real audio) instead of only showing the transcribed text - also doubles as
    // a way to verify exactly what was captured versus what came back as text.
    const audioUrl = URL.createObjectURL(blob);

    setIsTranscribing(true);
    try {
      const text = await transcribeAudio(blob);
      setIsTranscribing(false);
      if (onFinalTranscriptRef.current) onFinalTranscriptRef.current({ text, audioUrl });
    } catch (err) {
      console.error('Transcription failed:', err);
      setIsTranscribing(false);
      if (onFinalTranscriptRef.current) onFinalTranscriptRef.current({ text: '', audioUrl });
    }
  }, []);

  const startListeningWeb = useCallback(async () => {
    if (!isWebSttSupported) return;
    try {
      // autoGainControl is back ON - it was turned off earlier only because it was
      // interfering with automatic silence-detection, which has since been removed
      // entirely in favor of manual tap-to-record. With no auto-detection left to
      // confuse, AGC helps boost quiet mics (like earphone mics) back up to a
      // usable level.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      setTranscript('');

      // Extra manual boost on top of AGC - earphone mics in particular tend to
      // record noticeably quieter than a phone's built-in mic, so this adds
      // headroom AGC alone doesn't always cover.
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioCtx();
      const source = audioContext.createMediaStreamSource(stream);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1.8;
      const destination = audioContext.createMediaStreamDestination();
      source.connect(gainNode);
      gainNode.connect(destination);
      audioContextRef.current = audioContext;

      const recorder = new MediaRecorder(destination.stream, {
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
      // Safety net only, in case someone forgets to tap stop - not meant to be hit
      // in normal use.
      maxTimerRef.current = setTimeout(() => stopListeningWebRef.current(), MAX_RECORDING_MS);
    } catch (err) {
      console.error('Microphone access failed:', err);
      setIsListening(false);
    }
  }, [isWebSttSupported, handleRecordingStopped]);

  const stopListeningWeb = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop(); // triggers handleRecordingStopped via onstop
    } else {
      cleanupWebRecording();
      setIsListening(false);
    }
  }, []);

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

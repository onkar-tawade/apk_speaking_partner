import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

export const isNativePlatform = () => Capacitor.isNativePlatform();

export async function requestNativeSttPermission() {
  const result = await SpeechRecognition.requestPermissions();
  return result.speechRecognition === 'granted' || result.speechRecognition === 'limited';
}

let partialListenerHandle = null;

/**
 * Starts one listening turn using Android's native speech recognizer.
 * Android's own end-of-speech detection is generally better-tuned than the
 * browser's, but the important part here is accuracy, not just timing.
 * Resolves with the final transcript once the recognizer decides you're done.
 */
export async function startNativeListening({ onPartial }) {
  if (partialListenerHandle) {
    await partialListenerHandle.remove();
    partialListenerHandle = null;
  }

  partialListenerHandle = await SpeechRecognition.addListener('partialResults', (data) => {
    const text = data.matches?.[0] || '';
    onPartial(text);
  });

  try {
    const result = await SpeechRecognition.start({
      language: 'en-IN',
      partialResults: true,
      popup: false,
    });
    return result?.matches?.[0]?.trim() || '';
  } finally {
    if (partialListenerHandle) {
      await partialListenerHandle.remove();
      partialListenerHandle = null;
    }
  }
}

export async function stopNativeListening() {
  try {
    await SpeechRecognition.stop();
  } catch {
    // already stopped - fine
  }
}

export async function speakNative(text, { onDone } = {}) {
  try {
    await TextToSpeech.speak({
      text,
      lang: 'en-US',
      rate: 0.95,
      pitch: 1.0,
      volume: 1.0,
    });
  } finally {
    if (onDone) onDone();
  }
}

export async function stopNativeSpeaking() {
  try {
    await TextToSpeech.stop();
  } catch {
    // already stopped - fine
  }
}

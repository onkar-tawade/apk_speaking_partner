const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MODEL = 'llama-3.3-70b-versatile';

function getApiKey() {
  const key = import.meta.env.VITE_GROQ_API_KEY;
  if (!key) {
    throw new Error(
      'Missing VITE_GROQ_API_KEY. Add it to a .env file (see .env.example) and restart the dev server.'
    );
  }
  return key;
}

export async function getSpeakingPartnerResponse(systemPrompt, history, userMessage, temperature = 0.7) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature,
      max_tokens: 700,
      messages,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  return safeParseJson(data.choices?.[0]?.message?.content ?? '{}');
}

export async function getEvaluationResponse(evaluatorPrompt) {
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.4,
      max_tokens: 800,
      messages: [{ role: 'user', content: evaluatorPrompt }],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  return safeParseJson(data.choices?.[0]?.message?.content ?? '{}');
}

/**
 * Sends a recorded audio clip to Groq's free Whisper endpoint for transcription.
 * Meaningfully more accurate than the browser's built-in speech recognition,
 * especially across accents - the trade-off is this only returns text after the
 * full clip is recorded and uploaded (no live word-by-word text while speaking).
 */
export async function transcribeAudio(audioBlob) {
  const formData = new FormData();
  formData.append('file', audioBlob, 'speech.webm');
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('language', 'en');
  formData.append('response_format', 'json');
  formData.append('temperature', '0');
  // Priming Whisper with expected context measurably reduces hallucinated/fabricated
  // sentences on unclear audio - it biases decoding toward plausible casual speech
  // instead of guessing at unrelated content when the signal is ambiguous.
  formData.append('prompt', 'This is a casual spoken English conversation practice session.');

  const response = await fetch(GROQ_TRANSCRIPTION_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Groq transcription error (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  return (data.text || '').trim();
}

function safeParseJson(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Failed to parse Groq JSON response:', cleaned, err);
    return {
      reply: "Sorry, could you say that again?",
      corrections: [],
      betterPhrasing: null,
      meta: { fillerWordsDetected: [], hesitationDetected: false, toneUsed: 'unknown', confidenceLevel: 'medium' },
    };
  }
}

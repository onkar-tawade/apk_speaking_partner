import React, { useState } from 'react';
import './HelpMeSayIt.css';

/**
 * The "I know what I mean but can't get it out" scaffold. User types (or pastes
 * from voice-to-text) a rough, fragmented attempt; Groq turns it into a clean,
 * speakable sentence close to their own words - something to read/repeat, not
 * a correction of a real answer they already gave.
 */
export default function HelpMeSayIt({ isOpen, isLoading, result, onSubmit, onSpeak, onReset, onClose }) {
  const [roughText, setRoughText] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!roughText.trim()) return;
    onSubmit(roughText.trim());
  };

  return (
    <div className="help-panel">
      <div className="help-head">
        <p className="help-title">Help me say it</p>
        <button className="help-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      {!result && (
        <form onSubmit={handleSubmit} className="help-form">
          <p className="help-hint">Type whatever comes to mind — broken English, fragments, even mixed language. Just get the idea down.</p>
          <textarea
            value={roughText}
            onChange={(e) => setRoughText(e.target.value)}
            placeholder="e.g. yesterday my manager... i want say deadline problem but..."
            rows={3}
            autoFocus
          />
          <button type="submit" disabled={!roughText.trim() || isLoading}>
            {isLoading ? 'thinking…' : 'turn this into a sentence'}
          </button>
        </form>
      )}

      {result && (
        <div className="help-result">
          <p className="help-clean">{result.cleanSentence}</p>
          <button className="help-play" onClick={() => onSpeak(result.cleanSentence)}>▸ hear it</button>

          {result.alternatives?.length > 0 && (
            <div className="help-alts">
              <p className="help-alts-title">or say it like this</p>
              {result.alternatives.map((alt, i) => (
                <p key={i} className="help-alt-line">{alt}</p>
              ))}
            </div>
          )}

          {result.note && <p className="help-note">{result.note}</p>}

          <button
            className="help-again"
            onClick={() => {
              setRoughText('');
              onReset();
            }}
          >
            try another one
          </button>
        </div>
      )}
    </div>
  );
}

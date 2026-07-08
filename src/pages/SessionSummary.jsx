import React, { useState, useEffect } from 'react';
import './SessionSummary.css';

/** Animates a number from 0 to target over ~800ms - used for the score reveal. */
function useCountUp(target, durationMs = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === null || target === undefined) return undefined;
    let start = null;
    let raf;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / durationMs, 1);
      setValue(target * progress);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

/** Small SVG radar chart over the 8 category scores - real data, not decorative. */
function RadarChart({ scores }) {
  const entries = Object.entries(scores);
  const n = entries.length;
  if (n < 3) return null; // a radar chart needs at least 3 axes to mean anything
  const size = 180;
  const center = size / 2;
  const radius = size / 2 - 28;

  const pointFor = (val, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (val / 10) * radius;
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
  };

  const polygonPoints = entries.map(([, val], i) => pointFor(val, i).join(',')).join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="radar-chart">
      {entries.map(([key], i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const x2 = center + radius * Math.cos(angle);
        const y2 = center + radius * Math.sin(angle);
        return <line key={key} x1={center} y1={center} x2={x2} y2={y2} style={{ stroke: 'var(--paper-line)' }} strokeWidth="1" />;
      })}
      <polygon points={polygonPoints} style={{ fill: 'var(--tape)', fillOpacity: 0.3, stroke: 'var(--tape)' }} strokeWidth="2" />
    </svg>
  );
}

/** Brief, one-shot celebration - only for genuinely good scores, not every session. */
function Confetti() {
  const pieces = Array.from({ length: 14 });
  return (
    <div className="confetti-burst" aria-hidden="true">
      {pieces.map((_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${(i / pieces.length) * 100}%`,
            animationDelay: `${(i % 4) * 0.08}s`,
            background: i % 3 === 0 ? 'var(--signal)' : i % 3 === 1 ? 'var(--tape)' : 'var(--reel)',
          }}
        />
      ))}
    </div>
  );
}

/**
 * Shown when a session ends. Since corrections are no longer shown live during
 * the conversation, this is where all the feedback actually lands - plus a
 * fluency-level read (patterns, not just individual mistakes).
 */
export default function SessionSummary({ mode, isLoading, result, allCorrections, onClose, onRetry, variant = 'overlay', sessionMeta = null }) {
  const scoreValue = result?.overallScore ?? result?.fluencyScore ?? null;
  const animatedScore = useCountUp(!isLoading ? scoreValue : null);
  const showConfetti = !isLoading && scoreValue !== null && scoreValue >= 8;

  return (
    <div className={variant === 'page' ? 'summary-page' : 'summary-overlay'}>
      <div className={variant === 'page' ? 'summary-sheet summary-sheet-page' : 'summary-sheet'}>
        {showConfetti && <Confetti />}
        <p className="summary-eyebrow">{variant === 'page' ? 'past session' : 'session log'}</p>

        {sessionMeta?.status === 'partial' && (
          <div className="summary-partial-note">
            Ended early — {sessionMeta.questionsAttempted} of {sessionMeta.totalQuestionsPlanned} questions answered.
            Feedback below only covers what was actually asked.
          </div>
        )}


        {isLoading && <p className="summary-loading">Reviewing the recording…</p>}

        {!isLoading && result && (
          <>
            {'overallScore' in result ? (
              <>
                <h2 className="summary-score">{Math.round(animatedScore * 10) / 10}<span>/10</span></h2>
                <p className="summary-sub">Interview performance</p>

                {result.categoryScores && (
                  <div className="summary-radar-wrap">
                    <RadarChart scores={result.categoryScores} />
                  </div>
                )}

                {result.strengths?.length > 0 && (
                  <div className="summary-block">
                    <p className="summary-block-title">What went well</p>
                    <ul>{result.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}

                {result.weakAreas?.length > 0 && (
                  <div className="summary-block">
                    <p className="summary-block-title">Worth revising</p>
                    <ul>{result.weakAreas.map((w, i) => <li key={i}>{w}</li>)}</ul>
                  </div>
                )}

                {result.mistakes?.length > 0 && (
                  <div className="summary-block">
                    <p className="summary-block-title">Specific mistakes to fix</p>
                    <ul>{result.mistakes.map((m, i) => <li key={i}>{m}</li>)}</ul>
                  </div>
                )}

                {result.categoryScores && (
                  <div className="summary-block">
                    <p className="summary-block-title">Category breakdown</p>
                    {Object.entries(result.categoryScores).map(([key, val]) => (
                      <div key={key} className="cat-score-row">
                        <span className="cat-score-label">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <div className="cat-score-bar">
                          <div className="cat-score-fill" style={{ width: `${(val / 10) * 100}%` }} />
                        </div>
                        <span className="cat-score-num">{val}</span>
                      </div>
                    ))}
                  </div>
                )}

                {result.communicationNotes && (
                  <p className="summary-note">{result.communicationNotes}</p>
                )}

                {result.learningRoadmap?.length > 0 && (
                  <div className="summary-block">
                    <p className="summary-block-title">Your next steps</p>
                    <ul>{result.learningRoadmap.map((step, i) => <li key={i}>{step}</li>)}</ul>
                  </div>
                )}

                {result.questionBreakdown?.length > 0 && (
                  <div className="summary-block">
                    <p className="summary-block-title">Question by question - how to land it</p>
                    {result.questionBreakdown.map((qa, i) => (
                      <div key={i} className="summary-qa">
                        <p className="summary-qa-question">Q{i + 1}. {qa.question}</p>
                        {qa.yourAnswerSummary && (
                          <p className="summary-qa-yours">You said: {qa.yourAnswerSummary}</p>
                        )}
                        <p className="summary-qa-model-label">Impressive way to answer</p>
                        <p className="summary-model-answer">{qa.modelAnswer}</p>
                        {qa.whyItWorks && <p className="summary-qa-why">{qa.whyItWorks}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="summary-score">{Math.round(animatedScore * 10) / 10}<span>/10</span></h2>
                <p className="summary-sub">Fluency for this session</p>

                {result.topMistakePatterns?.length > 0 && (
                  <div className="summary-block">
                    <p className="summary-block-title">Patterns to watch</p>
                    <ul>{result.topMistakePatterns.map((p, i) => <li key={i}>{p}</li>)}</ul>
                  </div>
                )}

                {result.vocabularyUpgrades?.length > 0 && (
                  <div className="summary-block">
                    <p className="summary-block-title">Try these upgrades</p>
                    {result.vocabularyUpgrades.map((v, i) => (
                      <p key={i} className="summary-upgrade-line">
                        <span className="was">{v.basic}</span> → <span className="fix">{v.upgrade}</span>
                      </p>
                    ))}
                  </div>
                )}

                {result.encouragingNote && <p className="summary-note">{result.encouragingNote}</p>}
              </>
            )}

            {allCorrections.length > 0 && (
              <div className="summary-block">
                <p className="summary-block-title">Every correction from this session</p>
                {allCorrections.map((c, i) => (
                  <div key={i} className="summary-redline">
                    <span className="was">{c.original}</span>
                    <span className="arrow">→</span>
                    <span className="fix">{c.corrected}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!isLoading && !result && (
          <p className="summary-note">Couldn't generate a summary this time - the session itself still counts as practice.</p>
        )}

        <div className="summary-actions">
          {variant === 'page' ? (
            <button className="summary-btn-primary" onClick={onClose}>← back to history</button>
          ) : (
            <>
              <button className="summary-btn-primary" onClick={onRetry}>practice again</button>
              <button className="summary-btn-secondary" onClick={onClose}>back home</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import './SessionSummary.css';

/**
 * Shown when a session ends. Since corrections are no longer shown live during
 * the conversation, this is where all the feedback actually lands - plus a
 * fluency-level read (patterns, not just individual mistakes).
 */
export default function SessionSummary({ mode, isLoading, result, allCorrections, onClose, onRetry }) {
  return (
    <div className="summary-overlay">
      <div className="summary-sheet">
        <p className="summary-eyebrow">session log</p>

        {isLoading && <p className="summary-loading">Reviewing the recording…</p>}

        {!isLoading && result && (
          <>
            {'overallScore' in result ? (
              <>
                <h2 className="summary-score">{result.overallScore}<span>/10</span></h2>
                <p className="summary-sub">Interview performance</p>

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

                {result.communicationNotes && (
                  <p className="summary-note">{result.communicationNotes}</p>
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
                <h2 className="summary-score">{result.fluencyScore}<span>/10</span></h2>
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
          <button className="summary-btn-primary" onClick={onRetry}>practice again</button>
          <button className="summary-btn-secondary" onClick={onClose}>back home</button>
        </div>
      </div>
    </div>
  );
}

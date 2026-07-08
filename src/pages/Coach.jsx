import React, { useState, useEffect } from 'react';
import { getProfile, getActiveProfileId } from '../services/profileStore';
import { getCoachData, categoryLabel } from '../services/practiceInsights';
import './Coach.css';

export default function Coach({ onBack, onStart }) {
  const [profile, setProfile] = useState(null);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const activeId = getActiveProfileId();
        if (!activeId) {
          setIsLoading(false);
          return;
        }
        const [profileData, coachData] = await Promise.all([
          getProfile(activeId),
          getCoachData(activeId),
        ]);
        setProfile(profileData);
        setData(coachData);
      } catch (err) {
        console.error('Failed to load coach data:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) {
    return (
      <div className="coach">
        <button className="coach-back" onClick={onBack}>← back</button>
        <p className="coach-loading">Reviewing your progress…</p>
      </div>
    );
  }

  if (!data || data.sessionCount === 0 || data.readiness === null) {
    return (
      <div className="coach">
        <button className="coach-back" onClick={onBack}>← back</button>
        <p className="coach-eyebrow">Coach · {profile?.targetRole}</p>
        <p className="coach-empty">
          Complete a mock interview and this screen will show your readiness, strong and weak
          areas, and a roadmap - all based on your real answers, not a guess.
        </p>
      </div>
    );
  }

  // Simple sparkline path from the score trend, 0-10 scale mapped to the chart height.
  const trendPoints = data.scoreTrend.map((score, i) => {
    const x = (i / Math.max(data.scoreTrend.length - 1, 1)) * 100;
    const y = 40 - (score / 10) * 40;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="coach">
      <button className="coach-back" onClick={onBack}>← back</button>
      <p className="coach-eyebrow">Coach · {profile?.targetRole}</p>

      <div className="coach-readiness-ring" style={{ '--progress': `${data.readiness}%` }}>
        <span>{data.readiness}%</span>
      </div>
      <p className="coach-readiness-label">Interview Readiness</p>

      {data.strongCategories.length > 0 && (
        <p className="coach-line">
          <span className="coach-strong">Strong:</span> {data.strongCategories.map(categoryLabel).join(', ')}
        </p>
      )}
      {data.weakCategories.length > 0 && (
        <p className="coach-line">
          <span className="coach-weak">Needs work:</span> {data.weakCategories.map(categoryLabel).join(', ')}
        </p>
      )}

      {data.weakCategories.length > 0 && (
        <button
          className="coach-recommendation-card"
          onClick={() => onStart('interview', { skill: profile?.technologies?.[0] || profile?.targetRole, level: 'fresher' })}
        >
          <span className="coach-recommendation-label">Today's recommendation</span>
          <span className="coach-recommendation-title">Practice {categoryLabel(data.weakCategories[0])}</span>
          <span className="coach-recommendation-go">start →</span>
        </button>
      )}

      {data.scoreTrend.length > 1 && (
        <div className="coach-trend-wrap">
          <p className="coach-block-title">Score trend</p>
          <svg viewBox="0 0 100 40" className="coach-trend-chart" preserveAspectRatio="none">
            <polyline points={trendPoints} style={{ fill: 'none', stroke: 'var(--tape)' }} strokeWidth="2" />
          </svg>
        </div>
      )}

      {data.roadmap.length > 0 && (
        <div className="coach-roadmap">
          <p className="coach-block-title">Your roadmap</p>
          <ul>{data.roadmap.map((step, i) => <li key={i}>{step}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

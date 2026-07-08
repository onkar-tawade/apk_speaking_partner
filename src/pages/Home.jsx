import React, { useState, useEffect } from 'react';
import { getProfile, getActiveProfileId } from '../services/profileStore';
import { getProfileInsights, pickDailyChallengeSkill, pickMotivationalLine } from '../services/practiceInsights';
import './Home.css';

const POPULAR_SKILLS = [
  'Java Collections', 'Java OOPs', 'Selenium', 'TestNG', 'SQL', 'JMeter',
  'API Testing', 'Cucumber/BDD', 'Docker', 'Jenkins', 'Git', 'Spring Boot',
];

const DAILY_GOAL_SECONDS = 15 * 60; // 15 min/day default - configurable later in Settings (Module 9)

function formatMinutes(seconds) {
  return Math.round(seconds / 60);
}

export default function Home({ onStart, onOpenHistory, onOpenProfileSwitcher, onResumeSession, onOpenSession, onOpenCoach, onOpenSettings }) {
  const [customSkill, setCustomSkill] = useState('');
  const [profile, setProfile] = useState(null);
  const [insights, setInsights] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadHomeData = async () => {
    try {
      const activeId = getActiveProfileId();
      if (!activeId) {
        setIsLoading(false);
        return;
      }
      const [profileData, insightData] = await Promise.all([
        getProfile(activeId),
        getProfileInsights(activeId),
      ]);
      setProfile(profileData);
      setInsights(insightData);
    } catch (err) {
      console.error('Failed to load home data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHomeData();
  }, []);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const goalProgress = insights ? Math.min(insights.todaysSeconds / DAILY_GOAL_SECONDS, 1) : 0;
  const dailyChallengeSkill = profile ? pickDailyChallengeSkill(profile) : null;
  const motivationalLine = pickMotivationalLine();

  const formatSessionDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };

  return (
    <div className="home">
      <div className="home-head">
        <button className="home-profile-row" onClick={onOpenProfileSwitcher}>
          <span className="home-eyebrow">
            {isLoading ? 'loading…' : profile ? profile.targetRole : 'no profile'}
          </span>
          {insights?.streak > 0 && <span className="home-streak">🔥 {insights.streak}</span>}
        </button>
        <h1 className="home-title">{greeting()}{profile ? '' : ', Onkar'}</h1>
        <p className="home-sub">Pick a session to start recording.</p>
      </div>

      {insights?.partialSession && (
        <button
          className="home-continue-card"
          onClick={() => onResumeSession(insights.partialSession)}
        >
          <span className="home-continue-label">▶ CONTINUE</span>
          <span className="home-continue-title">{insights.partialSession.title}</span>
          <span className="home-continue-meta">
            {insights.partialSession.questionsAttempted} of {insights.partialSession.totalQuestionsPlanned} questions answered
          </span>
        </button>
      )}

      {insights && insights.totalSessions > 0 && (
        <div className="home-goal-row">
          <div className="home-goal-ring" style={{ '--progress': `${goalProgress * 100}%` }}>
            <span>{formatMinutes(insights.todaysSeconds)}</span>
          </div>
          <div className="home-goal-text">
            <span className="home-goal-label">Today's goal</span>
            <span className="home-goal-value">{formatMinutes(insights.todaysSeconds)} / 15 min</span>
          </div>
        </div>
      )}

      {dailyChallengeSkill && (
        <button
          className="home-challenge-card"
          onClick={() => onStart('interview', { skill: dailyChallengeSkill, level: 'fresher' })}
        >
          <span className="home-challenge-label">⚡ TODAY'S CHALLENGE</span>
          <span className="home-challenge-title">Practice {dailyChallengeSkill}</span>
          <span className="home-challenge-go">start →</span>
        </button>
      )}

      <button className="track-card track-signal" onClick={() => onStart('casual', { topic: 'general daily life', level: 'intermediate' })}>
        <span className="track-tab">A</span>
        <span className="track-body">
          <span className="track-name">Casual talk</span>
          <span className="track-desc">Small talk, daily topics, free conversation</span>
        </span>
        <span className="track-go">start ▸</span>
      </button>

      <button className="track-card track-tape" onClick={() => onStart('professional', { scenario: 'daily standup update', level: 'intermediate' })}>
        <span className="track-tab">B</span>
        <span className="track-body">
          <span className="track-name">Professional talk</span>
          <span className="track-desc">Standups, client calls, presenting ideas</span>
        </span>
        <span className="track-go">start ▸</span>
      </button>

      <div className="home-divider">
        <span>mock interview — pick a track</span>
      </div>

      <div className="skill-rack">
        {POPULAR_SKILLS.map((skill) => (
          <button key={skill} className="skill-chip" onClick={() => onStart('interview', { skill, level: 'fresher' })}>
            {skill}
          </button>
        ))}
      </div>

      <div className="custom-track">
        <input
          className="custom-input"
          type="text"
          placeholder="or type any skill — Digital Marketing, Kubernetes..."
          value={customSkill}
          onChange={(e) => setCustomSkill(e.target.value)}
        />
        <button
          className="custom-go"
          disabled={!customSkill.trim()}
          onClick={() => onStart('interview', { skill: customSkill.trim(), level: 'fresher' })}
        >
          start ▸
        </button>
      </div>

      {insights?.weakestCategoryLabel && (
        <p className="home-recommendation">
          Recommended: practice {insights.weakestCategoryLabel} →
        </p>
      )}

      {insights?.recentSessions?.length > 0 && (
        <>
          <p className="home-recent-label">Recent</p>
          <div className="home-recent-strip">
            {insights.recentSessions.map((session) => (
              <button key={session.id} className="home-recent-card" onClick={() => onOpenSession(session)}>
                <span className="home-recent-title">{session.title}</span>
                <span className="home-recent-date">{formatSessionDate(session.date)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <p className="home-motivation">"{motivationalLine}"</p>

      <button className="home-history-link" onClick={onOpenCoach}>view your coach</button>
      <button className="home-history-link" onClick={onOpenHistory}>view practice history</button>
      <button className="home-history-link" onClick={onOpenSettings}>settings</button>
    </div>
  );
}

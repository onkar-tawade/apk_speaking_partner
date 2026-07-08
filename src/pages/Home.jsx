import React, { useState, useEffect } from 'react';
import { getAllSessions, computeStreak } from '../services/historyStore';
import './Home.css';

const POPULAR_SKILLS = [
  'Java Collections', 'Java OOPs', 'Selenium', 'TestNG', 'SQL', 'JMeter',
  'API Testing', 'Cucumber/BDD', 'Docker', 'Jenkins', 'Git', 'Spring Boot',
];

export default function Home({ onStart, onOpenHistory, onOpenProfileSwitcher }) {
  const [customSkill, setCustomSkill] = useState('');
  const [stats, setStats] = useState({ total: 0, streak: 0 });

  useEffect(() => {
    (async () => {
      try {
        const sessions = await getAllSessions();
        setStats({ total: sessions.length, streak: computeStreak(sessions) });
      } catch {
        // History not available yet (first ever use, or unsupported browser) -
        // stats just stay at zero, nothing to show yet.
      }
    })();
  }, []);

  return (
    <div className="home">
      <div className="home-head">
        <p className="home-eyebrow">practice log</p>
        {onOpenProfileSwitcher && (
          <button className="home-profile-link-temp" onClick={onOpenProfileSwitcher}>switch profile</button>
        )}
        <h1 className="home-title">Speaking Partner</h1>
        <p className="home-sub">Pick a session to start recording.</p>
      </div>

      {stats.total > 0 && (
        <button className="home-stats" onClick={onOpenHistory}>
          <span className="home-stat">
            <span className="home-stat-num">{stats.total}</span>
            <span className="home-stat-label">sessions</span>
          </span>
          <span className="home-stat">
            <span className="home-stat-num">{stats.streak}</span>
            <span className="home-stat-label">day streak</span>
          </span>
          <span className="home-stats-link">view history →</span>
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

      {stats.total === 0 && (
        <button className="home-history-link" onClick={onOpenHistory}>view practice history</button>
      )}
    </div>
  );
}

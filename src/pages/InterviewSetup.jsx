import React, { useState } from 'react';
import './InterviewSetup.css';

const EXPERIENCE_OPTIONS = [
  { label: 'Fresher (0-1 yrs)', years: 0, level: 'fresher' },
  { label: '1-3 years', years: 2, level: '1-3 years, junior' },
  { label: '3-5 years', years: 4, level: '3-5 years, mid-level' },
  { label: '5+ years', years: 6, level: '5+ years, senior' },
];

/**
 * Sits between picking a skill on Home and actually starting the interview.
 * Lets the candidate optionally paste a real job description and set their
 * experience level, both of which shape the actual questions asked.
 */
export default function InterviewSetup({ skill, onStart, onBack }) {
  const [jobDescription, setJobDescription] = useState('');
  const [experience, setExperience] = useState(EXPERIENCE_OPTIONS[0]);

  const handleStart = () => {
    onStart({
      skill,
      level: experience.level,
      experienceYears: experience.years,
      jobDescription: jobDescription.trim() || null,
    });
  };

  return (
    <div className="setup">
      <button className="setup-back" onClick={onBack}>← back</button>

      <p className="setup-eyebrow">interview setup</p>
      <h1 className="setup-title">{skill}</h1>
      <p className="setup-sub">A couple of quick things before we start - this shapes the actual questions.</p>

      <p className="setup-label">Your experience level</p>
      <div className="setup-experience-row">
        {EXPERIENCE_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            className={experience.label === opt.label ? 'exp-chip active' : 'exp-chip'}
            onClick={() => setExperience(opt)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <p className="setup-label">Job description (optional)</p>
      <p className="setup-hint">Paste the actual JD from Naukri, LinkedIn, or anywhere else - questions will lean toward what this specific posting actually asks for.</p>
      <textarea
        className="setup-jd"
        rows={8}
        placeholder="Paste the job description here..."
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
      />

      <button className="setup-start" onClick={handleStart}>
        Start interview ▸
      </button>
    </div>
  );
}

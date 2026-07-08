import React, { useState, useEffect } from 'react';
import { getProfile, getActiveProfileId } from '../services/profileStore';
import './InterviewSetup.css';

const EXPERIENCE_OPTIONS = [
  { label: 'Fresher (0-1 yrs)', years: 0, level: 'fresher' },
  { label: '1-3 years', years: 2, level: '1-3 years, junior' },
  { label: '3-5 years', years: 4, level: '3-5 years, mid-level' },
  { label: '5+ years', years: 6, level: '5+ years, senior' },
];

const INTERVIEW_STYLES = ['General', 'Product-Based', 'Service-Based', 'Startup'];

/** Rough parse of "1y 7m" / "6m" / "2y" into a whole-number year count for defaulting. */
function parseExperienceToYears(experienceStr) {
  if (!experienceStr) return 0;
  const yMatch = experienceStr.match(/(\d+)y/);
  return yMatch ? parseInt(yMatch[1], 10) : 0;
}

function closestExperienceOption(years) {
  if (years >= 5) return EXPERIENCE_OPTIONS[3];
  if (years >= 3) return EXPERIENCE_OPTIONS[2];
  if (years >= 1) return EXPERIENCE_OPTIONS[1];
  return EXPERIENCE_OPTIONS[0];
}

/**
 * Sits between picking a skill on Home and actually starting the interview.
 * Pre-fills experience from the active Preparation Profile (still fully
 * overridable here, same as before this change) and adds Interview Style,
 * which the previous version didn't have.
 */
export default function InterviewSetup({ skill, onStart, onBack }) {
  const [jobDescription, setJobDescription] = useState('');
  const [experience, setExperience] = useState(EXPERIENCE_OPTIONS[0]);
  const [interviewStyle, setInterviewStyle] = useState('General');

  useEffect(() => {
    (async () => {
      try {
        const activeId = getActiveProfileId();
        if (!activeId) return;
        const profile = await getProfile(activeId);
        if (profile?.experience) {
          setExperience(closestExperienceOption(parseExperienceToYears(profile.experience)));
        }
      } catch (err) {
        console.error('Could not load profile defaults for setup:', err);
        // Non-fatal - the screen still works with its original defaults.
      }
    })();
  }, []);

  const handleStart = () => {
    onStart({
      skill,
      level: experience.level,
      experienceYears: experience.years,
      jobDescription: jobDescription.trim() || null,
      interviewStyle,
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

      <p className="setup-label">Interview style</p>
      <div className="setup-experience-row">
        {INTERVIEW_STYLES.map((style) => (
          <button
            key={style}
            className={interviewStyle === style ? 'exp-chip active' : 'exp-chip'}
            onClick={() => setInterviewStyle(style)}
          >
            {style}
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

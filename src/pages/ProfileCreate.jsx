import React, { useState } from 'react';
import { createProfile, updateProfile, isValidExperienceFormat, setActiveProfileId } from '../services/profileStore';
import './ProfileCreate.css';

const COMMON_ROLES = [
  'Java Developer', 'Backend Developer', 'Frontend Developer', 'Full Stack Developer',
  'SDET', 'QA Engineer', 'DevOps Engineer', 'Android Developer', 'Cloud Engineer',
  'AI Engineer', 'Business Analyst', 'Product Manager',
];

const COMMON_TECH = [
  'Java', 'Python', 'JavaScript', 'React', 'Spring Boot', 'Selenium', 'SQL',
  'Docker', 'Kubernetes', 'AWS', 'Git', 'REST APIs',
];

/**
 * Handles both creating a new profile AND editing an existing one - pass
 * `editingProfile` to switch into edit mode, where Target Role is locked
 * (shown but disabled) since it can never be changed after creation.
 */
export default function ProfileCreate({ isFirstLaunch = false, editingProfile = null, onCreated, onCancel }) {
  const isEditing = Boolean(editingProfile);
  const [targetRole] = useState(editingProfile?.targetRole || '');
  const [newRole, setNewRole] = useState('');
  const [experience, setExperience] = useState(editingProfile?.experience || '');
  const [technologies, setTechnologies] = useState(editingProfile?.technologies || []);
  const [customTech, setCustomTech] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const toggleTech = (tech) => {
    setTechnologies((prev) => (prev.includes(tech) ? prev.filter((t) => t !== tech) : [...prev, tech]));
  };

  const addCustomTech = () => {
    const trimmed = customTech.trim();
    if (trimmed && !technologies.includes(trimmed)) {
      setTechnologies((prev) => [...prev, trimmed]);
    }
    setCustomTech('');
  };

  const handleSubmit = async () => {
    setError('');
    const roleToUse = isEditing ? targetRole : newRole;
    if (!roleToUse.trim()) {
      setError('Please enter or pick a target role.');
      return;
    }
    if (!isValidExperienceFormat(experience)) {
      setError('Experience should look like "1y 7m", "2y", or "6m".');
      return;
    }
    setIsSaving(true);
    try {
      if (isEditing) {
        await updateProfile(editingProfile.id, { experience, technologies });
        onCreated({ ...editingProfile, experience, technologies });
      } else {
        const profile = await createProfile({ targetRole: roleToUse, experience, technologies });
        setActiveProfileId(profile.id);
        onCreated(profile);
      }
    } catch (err) {
      setError(err.message || 'Could not save profile - try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="pc">
      {!isFirstLaunch && <button className="pc-back" onClick={onCancel}>← cancel</button>}

      <p className="pc-eyebrow">{isEditing ? 'edit profile' : isFirstLaunch ? 'welcome' : 'new profile'}</p>
      <h1 className="pc-title">
        {isEditing ? 'Edit Preparation Profile' : isFirstLaunch ? 'What are you preparing for?' : 'New Preparation Profile'}
      </h1>
      <p className="pc-sub">
        {isEditing
          ? "Target role can't be changed after creation - create a new profile instead if you're switching roles."
          : 'This shapes every interview and keeps your progress separate from any other role you practice for later.'}
      </p>

      <p className="pc-label">Target role{isEditing && ' (locked)'}</p>
      {isEditing ? (
        <div className="pc-locked-role">{targetRole}</div>
      ) : (
        <>
          <div className="pc-chip-row">
            {COMMON_ROLES.map((role) => (
              <button
                key={role}
                className={newRole === role ? 'pc-chip active' : 'pc-chip'}
                onClick={() => setNewRole(role)}
              >
                {role}
              </button>
            ))}
          </div>
          <input
            className="pc-input"
            type="text"
            placeholder="or type your own role"
            value={COMMON_ROLES.includes(newRole) ? '' : newRole}
            onChange={(e) => setNewRole(e.target.value)}
          />
        </>
      )}

      <p className="pc-label">Experience</p>
      <input
        className="pc-input"
        type="text"
        placeholder="e.g. 1y 7m"
        value={experience}
        onChange={(e) => setExperience(e.target.value)}
      />
      <p className="pc-hint">Accepted formats: 6m, 1y, 1y 6m, 2y, 3y 8m, 5y</p>

      <p className="pc-label">Preferred technologies</p>
      <div className="pc-chip-row">
        {COMMON_TECH.map((tech) => (
          <button
            key={tech}
            className={technologies.includes(tech) ? 'pc-chip active' : 'pc-chip'}
            onClick={() => toggleTech(tech)}
          >
            {tech}
          </button>
        ))}
      </div>
      <div className="pc-custom-tech-row">
        <input
          className="pc-input"
          type="text"
          placeholder="add another technology"
          value={customTech}
          onChange={(e) => setCustomTech(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustomTech()}
        />
        <button className="pc-add-btn" onClick={addCustomTech}>add</button>
      </div>

      {error && <p className="pc-error">{error}</p>}

      <button className="pc-submit" onClick={handleSubmit} disabled={isSaving}>
        {isSaving ? 'saving…' : isEditing ? 'Save Changes' : 'Create Profile'}
      </button>
    </div>
  );
}

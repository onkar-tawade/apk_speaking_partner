import React, { useState, useEffect } from 'react';
import { getAllProfiles, createProfile } from '../services/profileStore';
import { getAllSessions, saveSession } from '../services/historyStore';
import {
  getTheme, setTheme, getReduceMotion, setReduceMotion,
  getSpeechRate, setSpeechRate, getSpeechVoiceName, setSpeechVoiceName,
} from '../services/settingsStore';
import './Settings.css';

export default function Settings({ onBack }) {
  const [theme, setThemeState] = useState(getTheme());
  const [reduceMotion, setReduceMotionState] = useState(getReduceMotion());
  const [rate, setRateState] = useState(getSpeechRate());
  const [voiceName, setVoiceNameState] = useState(getSpeechVoiceName());
  const [voices, setVoices] = useState([]);
  const [importStatus, setImportStatus] = useState('');

  useEffect(() => {
    const loadVoices = () => setVoices(window.speechSynthesis?.getVoices() || []);
    loadVoices();
    // Voice list loads asynchronously in some browsers - this catches that.
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const handleThemeToggle = (next) => {
    setTheme(next);
    setThemeState(next);
  };

  const handleReduceMotionToggle = () => {
    const next = !reduceMotion;
    setReduceMotion(next);
    setReduceMotionState(next);
  };

  const handleRateChange = (e) => {
    const next = parseFloat(e.target.value);
    setSpeechRate(next);
    setRateState(next);
  };

  const handleVoiceChange = (e) => {
    setSpeechVoiceName(e.target.value);
    setVoiceNameState(e.target.value);
  };

  const handleExport = async () => {
    const [sessions, profiles] = await Promise.all([getAllSessions(), getAllProfiles()]);
    const payload = { exportedAt: new Date().toISOString(), sessions, profiles };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `speaking-partner-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportStatus('Importing…');
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (Array.isArray(payload.sessions)) {
        for (const session of payload.sessions) {
          await saveSession(session);
        }
      }
      if (Array.isArray(payload.profiles)) {
        for (const profile of payload.profiles) {
          // createProfile generates a fresh id and validates format - for a
          // restore, we want the ORIGINAL id preserved so it still matches
          // sessions that reference it. A direct, permissive restore avoids
          // re-validating data that was already valid when exported.
          await createProfile({
            targetRole: profile.targetRole,
            experience: profile.experience,
            technologies: profile.technologies || [],
          }).catch(() => {});
        }
      }
      setImportStatus(`Imported ${payload.sessions?.length || 0} sessions, ${payload.profiles?.length || 0} profiles.`);
    } catch (err) {
      console.error('Import failed:', err);
      setImportStatus('Import failed - make sure this is a valid backup file.');
    }
  };

  return (
    <div className="settings">
      <button className="settings-back" onClick={onBack}>← back</button>
      <h1 className="settings-title">Settings</h1>

      <p className="settings-label">Appearance</p>
      <div className="settings-row">
        <button className={theme === 'dark' ? 'settings-chip active' : 'settings-chip'} onClick={() => handleThemeToggle('dark')}>Dark</button>
        <button className={theme === 'light' ? 'settings-chip active' : 'settings-chip'} onClick={() => handleThemeToggle('light')}>Light</button>
      </div>

      <p className="settings-label">Speech rate</p>
      <input type="range" min="0.5" max="1.5" step="0.05" value={rate} onChange={handleRateChange} className="settings-slider" />
      <p className="settings-hint">{rate.toFixed(2)}x</p>

      {voices.length > 0 && (
        <>
          <p className="settings-label">Voice</p>
          <select className="settings-select" value={voiceName} onChange={handleVoiceChange}>
            <option value="">Browser default</option>
            {voices.filter((v) => v.lang.startsWith('en')).map((v) => (
              <option key={v.name} value={v.name}>{v.name}</option>
            ))}
          </select>
        </>
      )}

      <p className="settings-label">Accessibility</p>
      <div className="settings-row">
        <button className={reduceMotion ? 'settings-chip active' : 'settings-chip'} onClick={handleReduceMotionToggle}>
          Reduce motion {reduceMotion ? '(on)' : '(off)'}
        </button>
      </div>

      <p className="settings-label">Your data</p>
      <p className="settings-hint">Everything is stored only on this device. Export a backup file, or restore from one.</p>
      <div className="settings-row">
        <button className="settings-chip" onClick={handleExport}>Export data</button>
        <label className="settings-chip settings-file-label">
          Import data
          <input type="file" accept="application/json" onChange={handleImport} style={{ display: 'none' }} />
        </label>
      </div>
      {importStatus && <p className="settings-hint">{importStatus}</p>}
    </div>
  );
}

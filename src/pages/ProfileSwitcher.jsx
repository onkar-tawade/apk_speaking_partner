import React, { useState, useEffect } from 'react';
import { getAllProfiles, getActiveProfileId, setActiveProfileId, deleteProfile } from '../services/profileStore';
import './ProfileSwitcher.css';

export default function ProfileSwitcher({ onClose, onSwitched, onCreateNew, onEditProfile }) {
  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const load = async () => {
    const [all, active] = await Promise.all([getAllProfiles(), getActiveProfileId()]);
    setProfiles(all);
    setActiveId(active);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSwitch = (id) => {
    setActiveProfileId(id);
    onSwitched(id);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    await deleteProfile(id);
    setConfirmDeleteId(null);
    // Sessions belonging to a deleted profile are kept, not erased - they remain
    // visible under History's "All profiles" view. Only the profile record itself
    // (and the ability to switch to it) goes away.
    if (activeId === id) {
      const remaining = await getAllProfiles();
      if (remaining.length > 0) handleSwitch(remaining[0].id);
    }
    load();
  };

  return (
    <div className="ps-overlay" onClick={onClose}>
      <div className="ps-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ps-head">
          <p className="ps-title">Your profiles</p>
          <button className="ps-close" onClick={onClose}>×</button>
        </div>

        {profiles.map((p) => (
          <div
            key={p.id}
            className={p.id === activeId ? 'ps-row active' : 'ps-row'}
            onClick={() => handleSwitch(p.id)}
          >
            <span className="ps-dot">{p.id === activeId ? '●' : '○'}</span>
            <div className="ps-row-body">
              <span className="ps-role">{p.targetRole}</span>
              <span className="ps-meta">{p.experience}</span>
            </div>
            <button
              className="ps-edit"
              onClick={(e) => { e.stopPropagation(); onEditProfile(p); }}
            >
              edit
            </button>
            <button
              className={confirmDeleteId === p.id ? 'ps-delete confirm' : 'ps-delete'}
              onClick={(e) => handleDelete(p.id, e)}
            >
              {confirmDeleteId === p.id ? 'confirm?' : 'delete'}
            </button>
          </div>
        ))}

        <button className="ps-create" onClick={onCreateNew}>+ Create new profile</button>
      </div>
    </div>
  );
}

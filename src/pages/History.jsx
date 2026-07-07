import React, { useState, useEffect, useMemo } from 'react';
import { getAllSessions, deleteSession, updateSessionFields, getStorageEstimate } from '../services/historyStore';
import './History.css';

const MODE_LABELS = { casual: 'Casual', professional: 'Professional', interview: 'Interview' };

export default function History({ onBack, onOpenSession, onResumeSession, onRestartSession }) {
  const [sessions, setSessions] = useState([]);
  const [modeFilter, setModeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [storageInfo, setStorageInfo] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const loadSessions = async () => {
    try {
      const all = await getAllSessions();
      setSessions(all);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
    getStorageEstimate().then(setStorageInfo);
  }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    await deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleTogglePin = async (session, e) => {
    e.stopPropagation();
    await updateSessionFields(session.id, { pinned: !session.pinned });
    setSessions((prev) => prev.map((s) => (s.id === session.id ? { ...s, pinned: !s.pinned } : s)));
  };

  const startRename = (session, e) => {
    e.stopPropagation();
    setRenamingId(session.id);
    setRenameValue(session.title || '');
  };

  const commitRename = async (id, e) => {
    e.stopPropagation();
    await updateSessionFields(id, { title: renameValue.trim() || 'Untitled session' });
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title: renameValue.trim() || 'Untitled session' } : s)));
    setRenamingId(null);
  };

  const filtered = useMemo(() => {
    let list = sessions;
    if (modeFilter !== 'all') list = list.filter((s) => s.mode === modeFilter);
    if (statusFilter !== 'all') list = list.filter((s) => (s.status || 'completed') === statusFilter);
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter((s) => (s.title || '').toLowerCase().includes(q) || (s.skill || '').toLowerCase().includes(q));
    }

    const sorted = [...list].sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.date) - new Date(b.date);
      if (sortBy === 'highest') {
        const scoreA = a.summaryResult?.overallScore ?? a.summaryResult?.fluencyScore ?? -1;
        const scoreB = b.summaryResult?.overallScore ?? b.summaryResult?.fluencyScore ?? -1;
        return scoreB - scoreA;
      }
      return new Date(b.date) - new Date(a.date); // newest
    });

    // Pinned sessions always float to the top, regardless of sort choice.
    return [...sorted.filter((s) => s.pinned), ...sorted.filter((s) => !s.pinned)];
  }, [sessions, modeFilter, statusFilter, sortBy, searchText]);

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) +
      ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return null;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="history">
      <div className="history-header">
        <button className="history-back" onClick={onBack}>← back</button>
        <span className="history-title">Practice log</span>
      </div>

      <input
        className="history-search"
        type="text"
        placeholder="Search by title or skill…"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
      />

      <div className="history-filters">
        {['all', 'casual', 'professional', 'interview'].map((f) => (
          <button key={f} className={modeFilter === f ? 'hf-chip active' : 'hf-chip'} onClick={() => setModeFilter(f)}>
            {f === 'all' ? 'All' : MODE_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="history-controls-row">
        <select className="history-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Any status</option>
          <option value="completed">Completed</option>
          <option value="partial">Partial</option>
        </select>
        <select className="history-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="highest">Highest score</option>
        </select>
      </div>

      <div className="history-list">
        {isLoading && <p className="history-empty">Loading…</p>}

        {!isLoading && filtered.length === 0 && (
          <p className="history-empty">No sessions match this - finish a practice session and it'll show up.</p>
        )}

        {filtered.map((session) => {
          const score = session.summaryResult?.overallScore ?? session.summaryResult?.fluencyScore ?? null;
          const isPartial = session.status === 'partial';
          const duration = formatDuration(session.durationSeconds);

          return (
            <div key={session.id} className="history-card" onClick={() => onOpenSession(session)}>
              <div className="history-card-top">
                <span className="history-card-mode">{MODE_LABELS[session.mode] || session.mode}</span>
                {isPartial && <span className="history-card-status">partial</span>}
                {score !== null && <span className="history-card-score">{score}/10</span>}
              </div>

              {renamingId === session.id ? (
                <div className="history-rename-row" onClick={(e) => e.stopPropagation()}>
                  <input
                    className="history-rename-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    autoFocus
                  />
                  <button onClick={(e) => commitRename(session.id, e)}>save</button>
                </div>
              ) : (
                <div className="history-card-title">
                  {session.pinned && <span className="pin-star">★ </span>}
                  {session.title || session.skill || session.scenario || 'General conversation'}
                </div>
              )}

              <div className="history-card-meta">
                {formatDate(session.date)}
                {duration && ` · ${duration}`}
                {isPartial && ` · ${session.questionsAttempted}/${session.totalQuestionsPlanned} questions`}
              </div>

              <div className="history-card-actions">
                {isPartial && (
                  <>
                    <button className="hc-action" onClick={(e) => { e.stopPropagation(); onResumeSession(session); }}>resume</button>
                    <button className="hc-action" onClick={(e) => { e.stopPropagation(); onRestartSession(session); }}>restart</button>
                  </>
                )}
                <button className="hc-action" onClick={(e) => handleTogglePin(session, e)}>{session.pinned ? 'unpin' : 'pin'}</button>
                <button className="hc-action" onClick={(e) => startRename(session, e)}>rename</button>
                <button className="hc-action hc-action-danger" onClick={(e) => handleDelete(session.id, e)}>delete</button>
              </div>
            </div>
          );
        })}
      </div>

      {storageInfo && (
        <p className="history-storage-note">
          Using {formatBytes(storageInfo.usage)} on this device - all stored locally, nothing sent anywhere.
        </p>
      )}
    </div>
  );
}

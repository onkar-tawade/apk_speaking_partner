/**
 * Derives Home-screen insights (streak, today's practice time, weakest area,
 * daily challenge) purely from data that already exists in historyStore and
 * profileStore. No new storage, no AI calls - this is arithmetic over what's
 * already saved, scoped to whichever profile is active.
 */
import { getSessionsByProfile, computeStreak } from './historyStore.js';

const CATEGORY_LABELS = {
  technicalKnowledge: 'core concepts',
  communication: 'explaining answers clearly',
  confidence: 'speaking with confidence',
  problemSolving: 'scenario-based problems',
  clarityOfExplanation: 'explaining clearly',
  correctness: 'accuracy',
  depthOfUnderstanding: 'deeper understanding',
  realWorldExamples: 'using real-world examples',
};

export async function getProfileInsights(profileId) {
  const sessions = await getSessionsByProfile(profileId);

  // computeStreak already exists and is already tested - scoping it to just
  // this profile's sessions is the only change needed, no modification to
  // that function itself.
  const streak = computeStreak(sessions);

  const todayStr = new Date().toDateString();
  const todaysSeconds = sessions
    .filter((s) => new Date(s.date).toDateString() === todayStr)
    .reduce((sum, s) => sum + (s.durationSeconds || 0), 0);

  // sessions from getSessionsByProfile are already newest-first (inherited
  // from getAllSessions' existing sort), so the first partial found is the
  // most recent one.
  const partialSession = sessions.find((s) => s.status === 'partial') || null;
  const recentSessions = sessions.slice(0, 3);

  // Weakest category, averaged across the last 3 sessions that have category
  // scores (interview mode only - casual/professional use fluencyScore instead).
  const totals = {};
  const counts = {};
  sessions.slice(0, 3).forEach((s) => {
    const scores = s.summaryResult?.categoryScores;
    if (scores) {
      Object.entries(scores).forEach(([key, val]) => {
        totals[key] = (totals[key] || 0) + val;
        counts[key] = (counts[key] || 0) + 1;
      });
    }
  });
  let weakestCategory = null;
  let weakestAvg = Infinity;
  Object.keys(totals).forEach((key) => {
    const avg = totals[key] / counts[key];
    if (avg < weakestAvg) {
      weakestAvg = avg;
      weakestCategory = key;
    }
  });

  return {
    streak,
    todaysSeconds,
    partialSession,
    recentSessions,
    weakestCategoryLabel: weakestCategory ? CATEGORY_LABELS[weakestCategory] : null,
    totalSessions: sessions.length,
  };
}

/**
 * Deterministic per-day, per-profile pick from the profile's own preferred
 * technologies - same skill shows all day, changes tomorrow, no AI call and
 * no randomness that would make the choice feel arbitrary or inconsistent if
 * the screen re-renders.
 */
export function pickDailyChallengeSkill(profile) {
  if (!profile?.technologies?.length) return null;
  const seed = new Date().toDateString() + (profile.id || '');
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return profile.technologies[hash % profile.technologies.length];
}

const MOTIVATIONAL_LINES = [
  'Confidence is built one sentence at a time.',
  'Every question you answer out loud is practice your future interviewer will feel.',
  "Fluency isn't about perfect grammar - it's about not stopping.",
  'Small daily practice beats one long cram session.',
  'The interview you fear most is the one worth practicing first.',
];

/** Stable for the whole day, same reasoning as the daily challenge picker. */
export function pickMotivationalLine() {
  const seed = new Date().toDateString();
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return MOTIVATIONAL_LINES[hash % MOTIVATIONAL_LINES.length];
}

/**
 * Maps interview progress to a real senior-interviewer's question progression:
 * concept -> usage -> reasoning -> scenario -> debugging -> best practices ->
 * performance -> architecture -> edge cases -> senior judgment. Scales to any
 * totalQuestions count, not just exactly 10 - a 5-question interview still hits
 * a sensible spread across this progression rather than only the early stages.
 */
const STAGES = [
  { label: 'basic concept', instruction: 'Ask a fundamental, definitional question to confirm they know the basics.' },
  { label: 'real-world usage', instruction: 'Ask how this concept is actually used in real projects, not just its definition.' },
  { label: 'reasoning / why', instruction: 'Ask WHY this approach is used over alternatives - probe their reasoning, not recall.' },
  { label: 'scenario-based problem', instruction: 'Give a realistic scenario and ask how they would handle it.' },
  { label: 'debugging question', instruction: 'Describe a bug or failure scenario and ask how they would diagnose and fix it.' },
  { label: 'best practices', instruction: 'Ask about best practices or common mistakes people make with this topic.' },
  { label: 'performance / optimization', instruction: 'Ask about performance implications or how to optimize this area.' },
  { label: 'architecture / design', instruction: 'Ask a higher-level design or architecture question involving this topic.' },
  { label: 'tricky edge case', instruction: 'Ask about a tricky edge case or gotcha that even experienced people get wrong.' },
  { label: 'senior-level judgment', instruction: 'Ask a senior-level question about trade-offs or judgment calls involving this area.' },
];

export function getDifficultyStage(questionNumber, totalQuestions) {
  const safeTotal = Math.max(totalQuestions, 2);
  const ratio = (questionNumber - 1) / (safeTotal - 1);
  const index = Math.min(STAGES.length - 1, Math.max(0, Math.round(ratio * (STAGES.length - 1))));
  return STAGES[index];
}

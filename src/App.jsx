import React, { useState } from 'react';
import Home from './pages/Home';
import InterviewSetup from './pages/InterviewSetup';
import Conversation from './pages/Conversation';
import History from './pages/History';
import SessionSummary from './pages/SessionSummary';

export default function App() {
  const [screen, setScreen] = useState({ name: 'home' });

  if (screen.name === 'history') {
    return (
      <History
        onBack={() => setScreen({ name: 'home' })}
        onOpenSession={(session) => setScreen({ name: 'historyDetail', session })}
        onResumeSession={(session) =>
          setScreen({
            name: 'conversation',
            mode: 'interview',
            config: session.resumeState.config,
            initialMessages: session.messages,
            initialQuestionNumber: session.resumeState.questionNumber,
            resumingSessionId: session.id,
          })
        }
        onRestartSession={(session) =>
          setScreen({
            name: 'conversation',
            mode: 'interview',
            config: session.resumeState?.config || { skill: session.skill, level: session.level },
            initialMessages: [],
            initialQuestionNumber: 1,
            resumingSessionId: null,
          })
        }
      />
    );
  }

  if (screen.name === 'historyDetail') {
    const { session } = screen;
    return (
      <SessionSummary
        variant="page"
        mode={session.mode}
        isLoading={false}
        result={session.summaryResult}
        allCorrections={[]}
        sessionMeta={{
          status: session.status,
          questionsAttempted: session.questionsAttempted,
          totalQuestionsPlanned: session.totalQuestionsPlanned,
        }}
        onClose={() => setScreen({ name: 'history' })}
      />
    );
  }

  if (screen.name === 'interviewSetup') {
    return (
      <InterviewSetup
        skill={screen.skill}
        onBack={() => setScreen({ name: 'home' })}
        onStart={(config) => setScreen({ name: 'conversation', mode: 'interview', config })}
      />
    );
  }

  if (screen.name === 'conversation') {
    return (
      <Conversation
        mode={screen.mode}
        config={screen.config}
        initialMessages={screen.initialMessages || []}
        initialQuestionNumber={screen.initialQuestionNumber || 1}
        resumingSessionId={screen.resumingSessionId || null}
        onExit={() => setScreen({ name: 'home' })}
      />
    );
  }

  return (
    <Home
      onStart={(mode, config) => {
        if (mode === 'interview') {
          setScreen({ name: 'interviewSetup', skill: config.skill });
        } else {
          setScreen({ name: 'conversation', mode, config });
        }
      }}
      onOpenHistory={() => setScreen({ name: 'history' })}
    />
  );
}

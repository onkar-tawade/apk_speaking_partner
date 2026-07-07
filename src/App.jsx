import React, { useState } from 'react';
import Home from './pages/Home';
import InterviewSetup from './pages/InterviewSetup';
import Conversation from './pages/Conversation';

export default function App() {
  const [screen, setScreen] = useState({ name: 'home' });

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
        onExit={() => setScreen({ name: 'home' })}
      />
    );
  }

  return (
    <Home
      onStart={(mode, config) => {
        // Interview mode routes through the setup screen first (experience level,
        // optional job description) - casual/professional start immediately.
        if (mode === 'interview') {
          setScreen({ name: 'interviewSetup', skill: config.skill });
        } else {
          setScreen({ name: 'conversation', mode, config });
        }
      }}
    />
  );
}

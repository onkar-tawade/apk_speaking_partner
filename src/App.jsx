import React, { useState } from 'react';
import Home from './pages/Home';
import Conversation from './pages/Conversation';

export default function App() {
  const [screen, setScreen] = useState({ name: 'home' });

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
      onStart={(mode, config) => setScreen({ name: 'conversation', mode, config })}
    />
  );
}

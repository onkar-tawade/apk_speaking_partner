import React, { useState, useEffect } from 'react';
import Home from './pages/Home';
import InterviewSetup from './pages/InterviewSetup';
import Conversation from './pages/Conversation';
import History from './pages/History';
import SessionSummary from './pages/SessionSummary';
import ProfileCreate from './pages/ProfileCreate';
import ProfileSwitcher from './pages/ProfileSwitcher';
import { getAllProfiles, createProfile, setActiveProfileId } from './services/profileStore';
import { getAllSessions, tagUntaggedSessionsWithProfile } from './services/historyStore';

export default function App() {
  // 'checking' avoids a flash of the wrong screen while we determine whether
  // this is a genuinely new user or an existing one who simply predates the
  // Preparation Profile feature.
  const [screen, setScreen] = useState({ name: 'checking' });
  const [showSwitcher, setShowSwitcher] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const profiles = await getAllProfiles();
        if (profiles.length > 0) {
          setScreen({ name: 'home' });
          return;
        }

        // Zero profiles - but is this a brand-new user, or an existing user from
        // before profiles existed? Existing history means the latter: silently
        // create a "Default" profile instead of forcing them through setup,
        // so nobody's existing experience is disrupted by this new feature.
        const existingSessions = await getAllSessions();
        if (existingSessions.length > 0) {
          const defaultProfile = await createProfile({
            targetRole: 'General',
            experience: '1y',
            technologies: [],
          });
          setActiveProfileId(defaultProfile.id);
          // Without this, old sessions would have a "Default" profile created
          // for them but never actually linked to it - profile filtering would
          // then incorrectly show them as belonging to no profile at all.
          await tagUntaggedSessionsWithProfile(defaultProfile.id);
          setScreen({ name: 'home' });
        } else {
          setScreen({ name: 'profileCreate', isFirstLaunch: true });
        }
      } catch (err) {
        console.error('Profile check failed:', err);
        // If anything about the new profile system fails, fall back to Home
        // rather than blocking the app entirely - existing functionality must
        // keep working even if this new layer has a problem.
        setScreen({ name: 'home' });
      }
    })();
  }, []);

  if (screen.name === 'checking') {
    return null;
  }

  const goToResumedSession = (session) =>
    setScreen({
      name: 'conversation',
      mode: 'interview',
      config: session.resumeState.config,
      initialMessages: session.messages,
      initialQuestionNumber: session.resumeState.questionNumber,
      resumingSessionId: session.id,
      sessionProfileId: session.profileId || null,
    });

  const goToSessionDetail = (session) => setScreen({ name: 'historyDetail', session });

  if (screen.name === 'profileCreate') {
    return (
      <ProfileCreate
        isFirstLaunch={screen.isFirstLaunch}
        editingProfile={screen.editingProfile || null}
        onCreated={() => setScreen({ name: 'home' })}
        onCancel={() => setScreen({ name: 'home' })}
      />
    );
  }

  if (screen.name === 'history') {
    return (
      <History
        onBack={() => setScreen({ name: 'home' })}
        onOpenSession={goToSessionDetail}
        onResumeSession={goToResumedSession}
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
        sessionProfileId={screen.sessionProfileId || null}
        onExit={() => setScreen({ name: 'home' })}
      />
    );
  }

  return (
    <>
      <Home
        onStart={(mode, config) => {
          if (mode === 'interview') {
            setScreen({ name: 'interviewSetup', skill: config.skill });
          } else {
            setScreen({ name: 'conversation', mode, config });
          }
        }}
        onOpenHistory={() => setScreen({ name: 'history' })}
        onOpenProfileSwitcher={() => setShowSwitcher(true)}
        onResumeSession={goToResumedSession}
        onOpenSession={goToSessionDetail}
      />
      {showSwitcher && (
        <ProfileSwitcher
          onClose={() => setShowSwitcher(false)}
          onSwitched={() => setShowSwitcher(false)}
          onCreateNew={() => {
            setShowSwitcher(false);
            setScreen({ name: 'profileCreate', isFirstLaunch: false });
          }}
          onEditProfile={(profile) => {
            setShowSwitcher(false);
            setScreen({ name: 'profileCreate', isFirstLaunch: false, editingProfile: profile });
          }}
        />
      )}
    </>
  );
}

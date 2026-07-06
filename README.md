# Speaking Partner (PWA — Vite + React)

Practice English speaking — casual talk, professional talk, and skill-specific mock
interviews — with live AI correction. Works with **or without a microphone**: voice mode
uses the browser's built-in speech recognition, text mode lets you type instead (needed on
browsers/devices where voice input isn't supported, like iOS Safari).

## Stack (100% free)
- **App**: Vite + React (same shape as WordBloom, deploys to Vercel the same way)
- **Speech-to-Text**: browser-native Web Speech API (`SpeechRecognition`) — free, no key
  - Supported: Chrome/Edge on desktop and Android
  - Not supported: iOS Safari (most versions) — app automatically falls back to text input
- **Text-to-Speech**: browser-native (`speechSynthesis`) — free, works broadly including iOS
- **AI brain**: [Groq](https://console.groq.com) free tier, `llama-3.3-70b-versatile`

## Local testing (do this before any deployment)

1. Install dependencies:
   ```
   npm install
   ```

2. Get a free Groq API key at https://console.groq.com (no card needed).

3. Copy the env file and paste your key:
   ```
   cp .env.example .env
   ```
   Edit `.env`:
   ```
   VITE_GROQ_API_KEY=your_actual_key_here
   ```

4. Run the dev server:
   ```
   npm run dev
   ```
   Open the printed local URL (usually http://localhost:5173) in your browser.

5. **To test on your phone** on the same Wi-Fi network:
   ```
   npm run dev -- --host
   ```
   Vite will print a network URL (e.g. `http://192.168.x.x:5173`) — open that on your phone's
   browser. Chrome on Android gets full voice mode; Safari on iOS gets text mode automatically.

## Project structure

```
index.html
src/
  main.jsx                    -> React entry point
  App.jsx                     -> screen routing (home <-> conversation)
  hooks/useVoice.js           -> Web Speech API wrapper (STT + TTS + support detection)
  services/groqService.js     -> Groq API calls, structured JSON parsing
  prompts/systemPrompts.js    -> the "brain" - casual / professional / interview prompts
  pages/Home.jsx              -> mode + skill picker
  pages/Conversation.jsx      -> core loop: mic-or-text -> Groq -> speak reply -> correction cards
public/
  manifest.json                -> PWA manifest (installable)
  favicon.svg
```

## How the core loop works

1. User picks Voice or Text (Voice is default when supported)
2. **Voice**: tap mic, browser transcribes speech live → on stop, sends transcript
   **Text**: types a response, hits Send
3. Message + conversation history sent to Groq with a mode-specific system prompt
4. Groq returns structured JSON: `{ reply, corrections, betterPhrasing, meta }`
5. `reply` is spoken aloud via `speechSynthesis` (works even in text mode) and shown as a bubble
6. `corrections` / `betterPhrasing` render as small cards under the bubble — visible, not
   interruptive

## Testing checklist (bring findings back for fixes)

- [ ] Smoke test: mic captures speech correctly, text input works as fallback
- [ ] Casual mode: does conversation feel natural, are corrections accurate?
- [ ] Professional mode: does tone-fit correction trigger appropriately?
- [ ] Interview mode: does it stay on-topic for the chosen skill, ask sensible follow-ups?
- [ ] Test on both Chrome (Android/desktop) and Safari (iOS) to confirm the voice/text fallback
      switches correctly
- [ ] Note any UI issues, wrong corrections, or missing features

## Deploying to Vercel (only after you're happy with testing)

1. Push this project to a GitHub repo
2. Import the repo in Vercel
3. Add an environment variable in Vercel's project settings:
   `VITE_GROQ_API_KEY` = your Groq key
4. Deploy — Vercel auto-detects Vite

## Building the Android app (Capacitor)

This project is wrapped as a native Android app using Capacitor - same React code,
running inside a real Android shell with native speech recognition and text-to-speech
(not the browser's, which was the source of the accuracy problems).

**One-time setup on your machine:**
1. Install [Android Studio](https://developer.android.com/studio) (free)
2. Open the `android/` folder inside this project as an Android Studio project
   (File → Open → select the `android` folder, not the project root)
3. Let it sync Gradle the first time (can take a few minutes, downloads its own tools)

**Every time you change code:**
```
npm run build
npx cap sync android
```
This rebuilds the web app and copies it into the native project. Then in Android Studio,
just hit Run (▶) with your phone connected via USB (with USB debugging enabled in
Developer Options) or an emulator running.

**To get an installable APK file** (to share with friends without Play Store):
In Android Studio: Build → Build Bundle(s) / APK(s) → Build APK(s). The APK lands in
`android/app/build/outputs/apk/debug/app-debug.apk` - copy that file to any Android phone
and install it directly (may need to allow "install from unknown sources" once).

### What's native now vs. browser-only

- **Speech-to-text**: Android's native recognizer (`@capacitor-community/speech-recognition`)
  when running as the installed app - meaningfully more accurate than the browser's engine,
  and works reliably in the background/pocket use case
- **Text-to-speech**: Android's native TTS (`@capacitor-community/text-to-speech`)
- Testing with `npm run dev` in a regular browser still works exactly as before, using the
  Web Speech API fallback - the code automatically detects which environment it's in
  (`src/hooks/useVoice.js`)

### Not yet built (native-specific)
- [ ] Barge-in interrupt (talk over the AI mid-reply instead of ending the call)
- [ ] Voice command to end session hands-free (e.g. saying "end session")
- [ ] App icon / splash screen (currently using Capacitor's defaults)

## Not yet built (suggested next steps)

- [ ] End-of-session summary screen (prompts already exist:
      `buildSessionSummaryPrompt` / `buildInterviewEvaluatorPrompt` in `systemPrompts.js`,
      and `getEvaluationResponse` in `groqService.js` — just needs a results screen)
- [ ] Session history / skill progress tracking (would need a backend — Firebase free tier
      is a good fit, not wired up yet)
- [ ] Filler word / pace / hesitation analytics dashboard (the `meta` field already collects
      per-turn data — just needs aggregation + a chart)
- [ ] Daily streak tracking
- [ ] Custom topic/scenario free text for Casual & Professional modes (currently fixed
      defaults on the Home screen)

## Cost

**$0.** Groq's free tier is generous enough for personal use and sharing with friends —
only you need the one Groq key; your users/friends don't need any account or key at all.

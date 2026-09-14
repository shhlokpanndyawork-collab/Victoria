# VIC — Velmora Intelligence Commander (V1)

A landscape, Android-first digital companion: dark/violet cinematic UI, an
animated character with idle/listening/thinking/speaking/sleeping states,
continuous voice conversation (STT → LLM → TTS), persistent local memory,
and hidden double-tap controls.

This README is written for a beginner on Android. Almost everything below
is done in a web browser — no terminal required except where marked.

---

## 1. What this app actually does (honest scope)

**Implemented and working:**
- Character presence with breathing, glow, blinking, eye-gaze shift, and
  gesture animation per state (idle/listening/thinking/speaking/sleeping)
- Double-tap anywhere on the main screen to open the hidden control panel
  (Dashboard / Memory / Settings / History overlays)
- Continuous voice loop: listens, detects when you stop speaking, sends
  your words to an LLM, speaks the reply, and starts listening again —
  no push-to-talk button needed
- Two swappable LLM providers — **Groq** and **OpenRouter** — each with its
  own API key (stored in Android's encrypted Keystore via `expo-secure-store`,
  never in source code) and its own model picker
  ("Test connection" in Settings does a real live ping to confirm your key
  and model work)
- English / Hindi / Gujarati voice recognition and speech output, switchable
  in Settings
- Persistent memory: say "remember that…" and VIC stores it locally
  (`AsyncStorage`) and includes the 12 most recently saved items in future
  prompts (recency-based, not semantic search — see limitations below) —
  it never dumps your entire memory history into every request
- Settings, Dashboard, Memory, and History overlays are all functional,
  not mockups

**Known limitations — stated plainly, not hidden:**
- The character is a hand-built animated 2D/CSS-style figure (hair, face,
  eyes, gestures), not a rigged 3D model. A true 3D character (e.g. a
  Ready Player Me / Three.js avatar) is a separate, much larger project;
  the current architecture (a single `CharacterPresence` component driven
  by a `status` value) is intentionally structured so it could be swapped
  for a 3D renderer later without touching the conversation logic.
- Memory retrieval is recency-based (most recent 12 items), not a vector/
  semantic search. That's a reasonable V1 tradeoff, not a full memory engine.
- Voice is the device's/OS's built-in TTS and Google's on-device speech
  recognition — not a custom trained voice model.

---

## 2. One-time setup (do this once, all in a browser)

### A. Get your API keys
- Groq: create a free account at https://console.groq.com → API Keys → create one
- OpenRouter (second provider): https://openrouter.ai/keys → create one
  You only strictly need one of the two to talk to VIC, but having both lets
  you switch providers from Settings.

### B. Create your EAS project (required — this project has none yet)
This project was never previously connected to an Expo/EAS project, so
there is no existing project ID to preserve. You need to create one:

1. Go to https://expo.dev and sign in (or create a free account).
2. Click **Create a project**, name it (e.g. "vic-genesis").
3. Copy the **Project ID** shown on the project's page.
4. Open `app.json` in this project (GitHub's web editor works fine — no
   terminal needed) and replace:
   - `"projectId": "REPLACE_WITH_YOUR_EAS_PROJECT_ID"` → your real ID
   - `"owner": "REPLACE_WITH_YOUR_EXPO_USERNAME"` → your Expo username

### C. Push this project to GitHub
Upload/commit this whole folder to a GitHub repo (GitHub's website lets you
drag-and-drop a zip's contents via "Add file → Upload files" if you don't
want to use git commands).

### D. Connect the repo to EAS Build
This project includes `.github/workflows/eas-build.yml`, which triggers an
EAS cloud build automatically whenever you push to `main` (or manually from
the GitHub "Actions" tab). To activate it:

1. Get an Expo access token: https://expo.dev/accounts/[your-account]/settings/access-tokens
2. In your GitHub repo: **Settings → Secrets and variables → Actions →
   New repository secret**, name it `EXPO_TOKEN`, paste the token.
3. Make sure `app.json`'s `expo.extra.eas.projectId` is set to your real
   project ID from step B above — the workflow will fail without it.
4. Push to `main`, or go to the **Actions** tab and run the workflow
   manually, choosing the `preview` profile.

This produces an installable `.apk` file, not a Play Store bundle, which is
what you want for testing on your own phone. The whole thing runs in
Expo's cloud — nothing builds on your phone or computer.

---

## 3. Installing on your Android phone

1. When the EAS cloud build finishes, expo.dev gives you a download link
   (and a QR code) for the `.apk`.
2. Open that link on your phone, or scan the QR code.
3. Android will warn about installing from an unknown source the first
   time — allow it for this file.
4. Open the installed **VIC Genesis V1** app.

## 4. First run on the phone

1. Grant the microphone permission when prompted (required for voice).
2. Double-tap anywhere on the main screen → **Settings**.
3. Paste your Groq and/or OpenRouter API key, pick a model, tap
   **Test connection** to confirm it works.
4. Pick your language (English / Hindi / Gujarati / Auto).
5. Double-tap again to close, then tap the mic button and start talking.

---

## 5. Architecture overview

```
STT (expo-speech-recognition)
      ↓
VicContext (state machine: idle/listening/thinking/speaking/sleeping)
      ↓
LLM provider abstraction (Groq / OpenRouter — swappable, model-selectable)
      ↓
TTS (expo-speech)
```

- `app/index.tsx` — main screen, character rendering/animation, overlays,
  voice loop orchestration
- `context/VicContext.tsx` — settings, memory, conversation state,
  persistence, the actual LLM request/response and connection-test logic
- `lib/voice.ts` — STT/TTS helper functions, language→locale mapping,
  female-voice selection heuristics
- `app.json` / `eas.json` — Android/EAS build configuration

## 6. Build profiles (`eas.json`)

- `development` — dev client build
- `preview` — **use this one** for a quick installable `.apk` for your phone
- `production` — Play Store `.aab` bundle, for whenever you're ready to publish

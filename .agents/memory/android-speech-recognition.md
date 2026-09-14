---
name: Android speech recognition build
description: Native Expo speech recognition needs a config plugin and a rebuilt client; web preview only validates the JavaScript surface.
---

Native speech recognition is not available in the standard Expo Go client on Android. Keep the speech-recognition config plugin and test the microphone loop in a rebuilt native client; use the web preview for UI and bundle checks.

**Why:** The JavaScript bundle can compile and the web preview can render while the native module still requires Android manifest permissions and native code generation.

**How to apply:** When changing speech recognition, validate TypeScript and production bundles locally, then verify permissions, locale selection, silence detection, and recognizer restart on a real Android build.
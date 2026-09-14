import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionErrorEvent,
  type ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';

import type { Language } from '@/context/VicContext';

const localeByLanguage: Record<Language, string> = {
  Auto: 'en-IN',
  English: 'en-IN',
  Hindi: 'hi-IN',
  Gujarati: 'gu-IN',
};

const femaleVoiceHints = [
  'female',
  'samantha',
  'ava',
  'victoria',
  'karen',
  'moira',
  'tessa',
  'veena',
  'heera',
  'lekha',
  'zira',
  'google hindi',
  'google gujarati',
];

let femaleVoicePromise: Promise<Map<string, string>> | null = null;

export function localeForLanguage(language: Language) {
  return localeByLanguage[language];
}

async function getFemaleVoiceByLanguage() {
  if (!femaleVoicePromise) {
    femaleVoicePromise = Speech.getAvailableVoicesAsync()
      .then((voices) => {
        const selected = new Map<string, string>();
        for (const voice of voices) {
          const key = voice.language.split('-')[0].toLowerCase();
          const searchText = `${voice.name} ${voice.identifier}`.toLowerCase();
          if (
            femaleVoiceHints.some((hint) => searchText.includes(hint)) &&
            !selected.has(key)
          ) {
            selected.set(key, voice.identifier);
          }
        }
        return selected;
      })
      .catch(() => new Map<string, string>());
  }
  return femaleVoicePromise;
}

export async function requestVoicePermissions() {
  return ExpoSpeechRecognitionModule.requestPermissionsAsync();
}

export function startVicListening(language: Language) {
  ExpoSpeechRecognitionModule.start({
    lang: localeForLanguage(language),
    interimResults: true,
    maxAlternatives: 1,
    continuous: false,
    addsPunctuation: true,
    contextualStrings: ['VIC', 'Velmora'],
  });
}

export function stopVicListening(abort = true) {
  if (abort) {
    ExpoSpeechRecognitionModule.abort();
  } else {
    ExpoSpeechRecognitionModule.stop();
  }
}

export async function speakVic(
  text: string,
  options: { rate: number; volume: number; enabled: boolean; language?: Language },
) {
  if (!options.enabled || !text.trim()) return;

  await Speech.stop();
  const voices = await getFemaleVoiceByLanguage();
  const language = localeForLanguage(options.language ?? 'Auto');
  const voice = voices.get(language.split('-')[0].toLowerCase());

  await new Promise<void>((resolve, reject) => {
    Speech.speak(text, {
      language,
      voice,
      rate: options.rate,
      volume: options.volume,
      onDone: resolve,
      onStopped: resolve,
      onError: reject,
    });
  });
}

export async function stopVicVoice() {
  await Speech.stop();
}

export type { ExpoSpeechRecognitionErrorEvent, ExpoSpeechRecognitionResultEvent };
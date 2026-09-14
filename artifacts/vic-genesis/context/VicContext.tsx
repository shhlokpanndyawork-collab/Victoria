import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type VicStatus = 'idle' | 'listening' | 'thinking' | 'speaking' | 'sleeping';
export type Language = 'Auto' | 'English' | 'Hindi' | 'Gujarati';
export type BrainProvider = 'Groq' | 'OpenRouter';

export interface MemoryItem {
  id: string;
  category: string;
  title: string;
  detail: string;
  createdAt: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'vic';
  text: string;
  createdAt: string;
}

export interface VicSettings {
  provider: BrainProvider;
  groqModel: string;
  openRouterModel: string;
  language: Language;
  voice: string;
  speechRate: number;
  autoListen: boolean;
  memoryEnabled: boolean;
  soundEnabled: boolean;
}

export const GROQ_MODELS = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (versatile)' },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (fastest)' },
  { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B (long context)' },
] as const;

export const OPENROUTER_MODELS = [
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini' },
  { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku' },
  { id: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B (free)' },
] as const;

interface VicContextValue {
  status: VicStatus;
  setStatus: (status: VicStatus) => void;
  memory: MemoryItem[];
  conversation: ConversationMessage[];
  settings: VicSettings;
  ready: boolean;
  remember: (detail: string, category?: string) => void;
  forgetMemory: (id: string) => void;
  clearConversation: () => void;
  clearMemory: () => void;
  updateSetting: <K extends keyof VicSettings>(key: K, value: VicSettings[K]) => void;
  sendText: (text: string) => Promise<string>;
  testProviderConnection: (provider: BrainProvider, model: string) => Promise<{ ok: boolean; message: string }>;
  errorMessage: string | null;
  clearError: () => void;
}

const STORAGE_KEYS = {
  memory: '@vic/memory',
  conversation: '@vic/conversation',
  settings: '@vic/settings',
};

const defaultSettings: VicSettings = {
  provider: 'Groq',
  groqModel: GROQ_MODELS[0].id,
  openRouterModel: OPENROUTER_MODELS[0].id,
  language: 'Auto',
  voice: 'Female / System',
  speechRate: 0.96,
  autoListen: true,
  memoryEnabled: true,
  soundEnabled: true,
};

const initialGreeting: ConversationMessage = {
  id: 'vic-genesis-greeting',
  role: 'vic',
  text: "I'm here. Double tap anywhere when you want the controls.",
  createdAt: new Date().toISOString(),
};

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function languageInstruction(language: Language) {
  if (language === 'Hindi') return 'Reply in Hindi unless the user clearly asks for another language.';
  if (language === 'Gujarati') {
    return 'Reply in Gujarati unless the user clearly asks for another language.';
  }
  if (language === 'English') return 'Reply in English.';
  return 'Reply in the same language as the user when possible.';
}

class BrainRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrainRequestError';
  }
}

async function requestBrainResponse(
  text: string,
  settings: VicSettings,
  conversation: ConversationMessage[],
  memory: MemoryItem[],
) {
  const storageKey =
    settings.provider === 'Groq' ? 'vic.groq-api-key' : 'vic.openrouter-api-key';
  const apiKey = await SecureStore.getItemAsync(storageKey);
  if (!apiKey) {
    throw new BrainRequestError(
      `Add your ${settings.provider} API key in Settings before asking VIC a live question.`,
    );
  }

  const endpoint =
    settings.provider === 'Groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://openrouter.ai/api/v1/chat/completions';
  const model = settings.provider === 'Groq' ? settings.groqModel : settings.openRouterModel;
  const memoryContext =
    memory.length > 0
      ? `Known user memories (use only when relevant):\n${memory
          .slice(0, 12)
          .map((item) => `- ${item.detail}`)
          .join('\n')}`
      : 'No explicit user memories are available.';

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(settings.provider === 'OpenRouter'
          ? { 'HTTP-Referer': 'https://velmora.local', 'X-Title': 'VIC' }
          : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        max_tokens: 220,
        messages: [
          {
            role: 'system',
            content: [
              'You are VIC, a warm, direct digital companion in the Velmora system.',
              'Keep replies concise and natural for spoken conversation. Do not use markdown unless needed.',
              languageInstruction(settings.language),
              memoryContext,
            ].join('\n\n'),
          },
          ...conversation.slice(-10).map((message) => ({
            role: message.role === 'vic' ? ('assistant' as const) : ('user' as const),
            content: message.text,
          })),
          { role: 'user' as const, content: text },
        ],
      }),
    });
  } catch {
    throw new BrainRequestError(
      `Could not reach ${settings.provider}. Check your connection and try again.`,
    );
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // The status below is still useful when a provider returns a non-JSON error.
  }

  if (!response.ok) {
    const providerMessage =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      payload.error &&
      typeof payload.error === 'object' &&
      'message' in payload.error &&
      typeof payload.error.message === 'string'
        ? payload.error.message
        : `HTTP ${response.status}`;
    throw new BrainRequestError(`${settings.provider} could not answer: ${providerMessage}`);
  }

  const answer =
    payload &&
    typeof payload === 'object' &&
    'choices' in payload &&
    Array.isArray(payload.choices) &&
    payload.choices[0] &&
    typeof payload.choices[0] === 'object' &&
    'message' in payload.choices[0] &&
    payload.choices[0].message &&
    typeof payload.choices[0].message === 'object' &&
    'content' in payload.choices[0].message &&
    typeof payload.choices[0].message.content === 'string'
      ? payload.choices[0].message.content.trim()
      : '';

  if (!answer) {
    throw new BrainRequestError(`${settings.provider} returned an empty response. Try again.`);
  }
  return answer;
}

async function testConnection(
  provider: BrainProvider,
  model: string,
): Promise<{ ok: boolean; message: string }> {
  const storageKey = provider === 'Groq' ? 'vic.groq-api-key' : 'vic.openrouter-api-key';
  const apiKey = await SecureStore.getItemAsync(storageKey);
  if (!apiKey) {
    return { ok: false, message: `No ${provider} API key saved yet.` };
  }

  const endpoint =
    provider === 'Groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://openrouter.ai/api/v1/chat/completions';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(provider === 'OpenRouter'
          ? { 'HTTP-Referer': 'https://velmora.local', 'X-Title': 'VIC' }
          : {}),
      },
      body: JSON.stringify({
        model,
        max_tokens: 4,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });

    if (response.ok) {
      return { ok: true, message: `${provider} (${model}) connected and responding.` };
    }

    let detail = `HTTP ${response.status}`;
    try {
      const payload = await response.json();
      if (
        payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        payload.error &&
        typeof payload.error === 'object' &&
        'message' in payload.error &&
        typeof payload.error.message === 'string'
      ) {
        detail = payload.error.message;
      }
    } catch {
      // keep the HTTP status detail
    }
    return { ok: false, message: `${provider} rejected the request: ${detail}` };
  } catch {
    return { ok: false, message: `Could not reach ${provider}. Check your connection.` };
  }
}

const VicContext = createContext<VicContextValue | null>(null);

export function VicProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<VicStatus>('idle');
  const [memory, setMemory] = useState<MemoryItem[]>([]);
  const [conversation, setConversation] = useState<ConversationMessage[]>([
    initialGreeting,
  ]);
  const [settings, setSettings] = useState<VicSettings>(defaultSettings);
  const [ready, setReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [memoryValue, conversationValue, settingsValue] =
        await AsyncStorage.multiGet([
          STORAGE_KEYS.memory,
          STORAGE_KEYS.conversation,
          STORAGE_KEYS.settings,
        ]);

      try {
        if (memoryValue[1]) setMemory(JSON.parse(memoryValue[1]) as MemoryItem[]);
        if (conversationValue[1]) {
          setConversation(JSON.parse(conversationValue[1]) as ConversationMessage[]);
        }
        if (settingsValue[1]) {
          setSettings({
            ...defaultSettings,
            ...(JSON.parse(settingsValue[1]) as Partial<VicSettings>),
          });
        }
      } catch {
        // Corrupt local state should not block VIC from opening. The next
        // successful save replaces it with a valid shape.
      } finally {
        setReady(true);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    if (!ready) return;
    void AsyncStorage.multiSet([
      [STORAGE_KEYS.memory, JSON.stringify(memory)],
      [STORAGE_KEYS.conversation, JSON.stringify(conversation.slice(-40))],
      [STORAGE_KEYS.settings, JSON.stringify(settings)],
    ]);
  }, [conversation, memory, ready, settings]);

  const remember = useCallback(
    (detail: string, category = 'User fact') => {
      const cleanDetail = detail.trim();
      if (!cleanDetail || !settings.memoryEnabled) return;

      setMemory((current) => {
        const duplicate = current.some(
          (item) => normalize(item.detail) === normalize(cleanDetail),
        );
        if (duplicate) return current;

        return [
          {
            id: makeId('memory'),
            category,
            title: cleanDetail.split(/[.!?]/)[0].slice(0, 44),
            detail: cleanDetail,
            createdAt: new Date().toISOString(),
          },
          ...current,
        ];
      });
    },
    [settings.memoryEnabled],
  );

  const sendText = useCallback(
    async (text: string) => {
      const cleanText = text.trim();
      if (!cleanText) return '';
      setErrorMessage(null);

      const userMessage: ConversationMessage = {
        id: makeId('user'),
        role: 'user',
        text: cleanText,
        createdAt: new Date().toISOString(),
      };
      setConversation((current) => [...current, userMessage]);
      setStatus('thinking');

      const rememberMatch = cleanText.match(
        /^(?:please\s+)?remember(?:\s+that)?\s+(.+)$/i,
      );
      if (rememberMatch?.[1]) {
        remember(rememberMatch[1], 'User instruction');
      }

      const projectMemory = memory.find((item) =>
        normalize(cleanText).includes(normalize(item.title)),
      );
      let response = "Yeah? I'm listening.";

      if (rememberMatch?.[1]) {
        response = `Got it. I'll keep “${rememberMatch[1].trim()}” in mind.`;
      } else if (
        /main project|what am i building|my project/i.test(cleanText) &&
        memory.length > 0
      ) {
        response = projectMemory
          ? `Your memory says: ${projectMemory.detail}`
          : `I remember ${memory[0].detail}`;
      } else if (/who are you|what are you/i.test(cleanText)) {
        response =
          "I'm VIC — a persistent digital companion in the Velmora system. Not a customer-service bot.";
      } else if (/hello|hi|hey|vic\b/i.test(cleanText)) {
        response = ['Yeah?', "I'm here.", "What's up?"][
          Math.floor(Math.random() * 3)
        ];
      } else {
        try {
          response = await requestBrainResponse(
            cleanText,
            settings,
            conversation,
            memory,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'VIC could not reach her brain. Try again.';
          setErrorMessage(message);
          setStatus('idle');
          throw error;
        }
      }

      if (response === "Yeah? I'm listening.") {
        await new Promise((resolve) => setTimeout(resolve, 260));
      }
      const vicMessage: ConversationMessage = {
        id: makeId('vic'),
        role: 'vic',
        text: response,
        createdAt: new Date().toISOString(),
      };
      setConversation((current) => [...current, vicMessage]);
      setStatus('speaking');
      return response;
    },
    [conversation, memory, remember, settings],
  );

  const updateSetting = useCallback(
    <K extends keyof VicSettings>(key: K, value: VicSettings[K]) => {
      setSettings((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const value = useMemo<VicContextValue>(
    () => ({
      status,
      setStatus,
      memory,
      conversation,
      settings,
      ready,
      remember,
      forgetMemory: (id) =>
        setMemory((current) => current.filter((item) => item.id !== id)),
      clearConversation: () => setConversation([initialGreeting]),
      clearMemory: () => setMemory([]),
      updateSetting,
      sendText,
      testProviderConnection: testConnection,
      errorMessage,
      clearError: () => setErrorMessage(null),
    }),
    [
      conversation,
      errorMessage,
      memory,
      ready,
      remember,
      sendText,
      settings,
      status,
      updateSetting,
    ],
  );

  return <VicContext.Provider value={value}>{children}</VicContext.Provider>;
}

export function useVic() {
  const context = useContext(VicContext);
  if (!context) throw new Error('useVic must be used inside VicProvider');
  return context;
}
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { useSpeechRecognitionEvent } from 'expo-speech-recognition';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  type DimensionValue,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '@/constants/colors';
import {
  BrainProvider,
  GROQ_MODELS,
  Language,
  MemoryItem,
  OPENROUTER_MODELS,
  VicStatus,
  useVic,
} from '@/context/VicContext';
import {
  requestVoicePermissions,
  speakVic,
  startVicListening,
  stopVicListening,
  stopVicVoice,
} from '@/lib/voice';

type OverlayView = 'dashboard' | 'memory' | 'settings' | 'history';

const palette = colors.dark;

const statusCopy: Record<VicStatus, string> = {
  idle: 'Online',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
  sleeping: 'Resting',
};

function StatusDot({ status }: { status: VicStatus }) {
  return (
    <View style={[styles.statusDot, status === 'listening' && styles.statusDotHot]} />
  );
}

function CharacterPresence({ status }: { status: VicStatus }) {
  const { width, height } = useWindowDimensions();
  const breath = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const gesture = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const gaze = useRef(new Animated.Value(0)).current;
  const nativeDriver = Platform.OS !== 'web';
  const sceneScale = Math.min(Math.max(Math.min(width / 980, height / 640), 0.82), 1.14);

  useEffect(() => {
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: status === 'sleeping' ? 3200 : 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: nativeDriver,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: status === 'sleeping' ? 3200 : 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: nativeDriver,
        }),
      ]),
    );
    breathing.start();
    return () => breathing.stop();
  }, [breath, status]);

  useEffect(() => {
    pulse.setValue(0);
    const pulsing = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: status === 'thinking' ? 1050 : 1800,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: nativeDriver,
      }),
    );
    pulsing.start();
    return () => pulsing.stop();
  }, [pulse, status]);

  useEffect(() => {
    gesture.setValue(0);
    const moving = Animated.loop(
      Animated.sequence([
        Animated.timing(gesture, {
          toValue: 1,
          duration: status === 'speaking' ? 1200 : 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: nativeDriver,
        }),
        Animated.timing(gesture, {
          toValue: 0,
          duration: status === 'speaking' ? 1200 : 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: nativeDriver,
        }),
      ]),
    );
    moving.start();
    return () => moving.stop();
  }, [gesture, nativeDriver, status]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    function scheduleBlink() {
      const delay = status === 'sleeping' ? 5200 : 2400 + Math.random() * 2600;
      timer = setTimeout(() => {
        if (cancelled || status === 'sleeping') return;
        Animated.sequence([
          Animated.timing(blink, {
            toValue: 0,
            duration: 90,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: nativeDriver,
          }),
          Animated.timing(blink, {
            toValue: 1,
            duration: 110,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: nativeDriver,
          }),
        ]).start(() => {
          if (!cancelled) scheduleBlink();
        });
      }, delay);
    }

    blink.setValue(status === 'sleeping' ? 0 : 1);
    if (status !== 'sleeping') scheduleBlink();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [blink, nativeDriver, status]);

  useEffect(() => {
    const gazeTarget = status === 'thinking' ? 1 : status === 'listening' ? -0.4 : 0;
    Animated.timing(gaze, {
      toValue: gazeTarget,
      duration: 420,
      easing: Easing.out(Easing.ease),
      useNativeDriver: nativeDriver,
    }).start();
  }, [gaze, nativeDriver, status]);

  const gazeShift = gaze.interpolate({ inputRange: [-1, 0, 1], outputRange: [-4, 0, 4] });

  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange:
      status === 'speaking'
        ? [0.3, 0.82]
        : status === 'listening'
          ? [0.22, 0.64]
          : [0.08, 0.3],
  });
  const scale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: status === 'sleeping' ? [0.96, 0.975] : [1, 1.025],
  });
  const gestureTranslate = gesture.interpolate({
    inputRange: [0, 1],
    outputRange: status === 'speaking' ? [0, -9] : [0, -3],
  });
  const gestureRotate = gesture.interpolate({
    inputRange: [0, 1],
    outputRange: status === 'speaking' ? ['-4deg', '4deg'] : ['-1deg', '1deg'],
  });

  return (
    <View style={styles.characterWrap}>
      <Animated.View
        style={[
          styles.energyRing,
          styles.energyRingLarge,
          { opacity: glowOpacity, transform: [{ scale: scale }] },
        ]}
      />
      <Animated.View
        style={[
          styles.energyRing,
          styles.energyRingSmall,
          { opacity: glowOpacity, transform: [{ scale: scale }] },
        ]}
      />
      <View style={styles.characterShadow} />
      <Animated.View
        style={[
          styles.character,
          { transform: [{ scale: sceneScale }, { translateY: gestureTranslate }] },
        ]}
      >
        <View style={styles.hairBack} />
        <View style={styles.hairCrown} />
        <View style={styles.hairLockLeft} />
        <View style={styles.hairLockRight} />
        <View style={styles.shoulders}>
          <View style={styles.shoulderGlow} />
          <View style={styles.jacketPanelLeft} />
          <View style={styles.jacketPanelRight} />
        </View>
        <View style={styles.neck} />
        <View style={styles.face}>
          <View style={styles.fringe} />
          <View style={styles.faceShade} />
          <View style={styles.faceHighlight} />
          <View style={styles.eyeRow}>
            <Animated.View
              style={[
                styles.eye,
                status === 'sleeping' && styles.eyeClosed,
                status !== 'sleeping' && { transform: [{ scaleY: blink }] },
              ]}
            >
              <Animated.View
                style={[styles.eyeSpark, { transform: [{ translateX: gazeShift }] }]}
              />
            </Animated.View>
            <Animated.View
              style={[
                styles.eye,
                status === 'sleeping' && styles.eyeClosed,
                status !== 'sleeping' && { transform: [{ scaleY: blink }] },
              ]}
            >
              <Animated.View
                style={[styles.eyeSpark, { transform: [{ translateX: gazeShift }] }]}
              />
            </Animated.View>
          </View>
          <View style={styles.noseLine} />
          <Animated.View
            style={[
              styles.mouthLine,
              status === 'speaking' && {
                transform: [{ scaleX: 1.2 }, { scaleY: 1.65 }],
              },
            ]}
          />
          <View style={styles.cheekLight} />
        </View>
        <View style={styles.collarLeft} />
        <View style={styles.collarRight} />
        <View style={styles.choker}>
          <View style={styles.chokerCore} />
        </View>
        <View style={styles.torsoLine} />
        <Animated.View
          style={[
            styles.gestureArm,
            { transform: [{ translateY: gestureTranslate }, { rotate: gestureRotate }] },
          ]}
        >
          <View style={styles.gestureHand} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function Waveform({ status }: { status: VicStatus }) {
  const bars = [0.32, 0.62, 0.94, 0.48, 0.76, 0.38, 0.85, 0.54, 0.3];
  return (
    <View style={styles.waveform}>
      {bars.map((height, index) => (
        <View
          key={index}
          style={[
            styles.waveBar,
            {
              height: status === 'idle' ? 3 : 6 + height * 17,
              opacity: status === 'idle' ? 0.35 : 0.52 + height * 0.45,
            },
          ]}
        />
      ))}
    </View>
  );
}

function AmbientParticles() {
  const particles = [
    { left: '13%', top: '19%', size: 2, opacity: 0.42 },
    { left: '22%', top: '62%', size: 3, opacity: 0.28 },
    { left: '32%', top: '28%', size: 2, opacity: 0.58 },
    { left: '41%', top: '14%', size: 3, opacity: 0.3 },
    { left: '57%', top: '22%', size: 2, opacity: 0.54 },
    { left: '69%', top: '16%', size: 3, opacity: 0.32 },
    { left: '78%', top: '54%', size: 2, opacity: 0.6 },
    { left: '86%', top: '34%', size: 3, opacity: 0.36 },
    { left: '74%', top: '76%', size: 2, opacity: 0.34 },
    { left: '17%', top: '78%', size: 2, opacity: 0.46 },
  ];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((particle, index) => (
        <View
          key={index}
          style={[
            styles.particle,
            {
              left: particle.left as DimensionValue,
              top: particle.top as DimensionValue,
              width: particle.size,
              height: particle.size,
              borderRadius: particle.size / 2,
              opacity: particle.opacity,
            },
          ]}
        />
      ))}
    </View>
  );
}

function HolographicFloor() {
  return (
    <View pointerEvents="none" style={styles.floorScene}>
      <View style={styles.floorGlow} />
      <View style={styles.floorEllipseOuter} />
      <View style={styles.floorEllipseInner} />
      <View style={[styles.floorBeam, styles.floorBeamLeft]} />
      <View style={[styles.floorBeam, styles.floorBeamRight]} />
    </View>
  );
}

function OverlayShell({
  activeView,
  onChangeView,
  onClose,
  children,
}: {
  activeView: OverlayView;
  onChangeView: (view: OverlayView) => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const tabs: { id: OverlayView; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'dashboard', label: 'Status', icon: 'pulse-outline' },
    { id: 'memory', label: 'Memory', icon: 'sparkles-outline' },
    { id: 'settings', label: 'Settings', icon: 'options-outline' },
    { id: 'history', label: 'History', icon: 'time-outline' },
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlayBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Pressable
          style={styles.overlayCard}
          onStartShouldSetResponder={() => true}
          testID="vic-control-overlay"
        >
          <View style={styles.overlayHeader}>
            <View>
              <Text style={styles.overlayKicker}>VELMORA / CONTROL</Text>
              <Text style={styles.overlayTitle}>VIC command layer</Text>
            </View>
            <Pressable
              accessibilityLabel="Close controls"
              onPress={onClose}
              style={styles.iconButton}
              testID="close-controls"
            >
              <Ionicons name="close" size={20} color={palette.foreground} />
            </Pressable>
          </View>
          <View style={styles.overlayTabs}>
            {tabs.map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => onChangeView(tab.id)}
                style={[styles.overlayTab, activeView === tab.id && styles.overlayTabActive]}
                testID={`overlay-tab-${tab.id}`}
              >
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={activeView === tab.id ? palette.foreground : palette.mutedForeground}
                />
                <Text
                  style={[
                    styles.overlayTabLabel,
                    activeView === tab.id && styles.overlayTabLabelActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.overlayContent}>{children}</View>
        </Pressable>
      </View>
    </Modal>
  );
}

function DashboardPanel() {
  const { status, memory, settings } = useVic();
  const metrics = [
    ['VIC state', statusCopy[status]],
    ['Brain', settings.provider],
    ['Model', settings.provider === 'Groq' ? settings.groqModel : settings.openRouterModel],
    ['Memory', `${memory.length} stored ${memory.length === 1 ? 'item' : 'items'}`],
    ['Language', settings.language === 'Auto' ? 'Auto detect' : settings.language],
  ];
  return (
    <ScrollView contentContainerStyle={styles.panelScroll}>
      <Text style={styles.panelIntro}>A quiet readout of the system behind her presence.</Text>
      <View style={styles.metricGrid}>
        {metrics.map(([label, value]) => (
          <View key={label} style={styles.metricCard}>
            <Text style={styles.metricLabel}>{label}</Text>
            <Text style={styles.metricValue}>{value}</Text>
          </View>
        ))}
      </View>
      <View style={styles.notice}>
        <Ionicons name="information-circle-outline" size={18} color={palette.primary} />
        <Text style={styles.noticeText}>
          The selected provider powers live replies. If it is unavailable, VIC will tell you
          what needs fixing instead of switching to a silent fallback.
        </Text>
      </View>
    </ScrollView>
  );
}

function MemoryPanel() {
  const { memory, forgetMemory, clearMemory } = useVic();
  return (
    <ScrollView contentContainerStyle={styles.panelScroll}>
      <View style={styles.panelTitleRow}>
        <View>
          <Text style={styles.panelHeading}>What VIC keeps</Text>
          <Text style={styles.panelMuted}>Only explicit memories are saved here.</Text>
        </View>
        {memory.length > 0 && (
          <Pressable onPress={clearMemory} style={styles.textAction}>
            <Text style={styles.textActionLabel}>Clear all</Text>
          </Pressable>
        )}
      </View>
      {memory.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="sparkles-outline" size={26} color={palette.primary} />
          <Text style={styles.emptyTitle}>Nothing learned yet</Text>
          <Text style={styles.emptyCopy}>
            Tell VIC “remember that…” and the detail will appear here.
          </Text>
        </View>
      ) : (
        memory.map((item) => (
          <MemoryRow key={item.id} item={item} onDelete={() => forgetMemory(item.id)} />
        ))
      )}
    </ScrollView>
  );
}

function MemoryRow({ item, onDelete }: { item: MemoryItem; onDelete: () => void }) {
  return (
    <View style={styles.memoryRow}>
      <View style={styles.memoryIcon}>
        <Ionicons name="bookmark-outline" size={17} color={palette.primary} />
      </View>
      <View style={styles.memoryBody}>
        <Text style={styles.memoryCategory}>{item.category.toUpperCase()}</Text>
        <Text style={styles.memoryTitle}>{item.title}</Text>
        <Text style={styles.memoryDetail}>{item.detail}</Text>
      </View>
      <Pressable onPress={onDelete} style={styles.deleteButton} accessibilityLabel="Delete memory">
        <Ionicons name="trash-outline" size={16} color={palette.mutedForeground} />
      </Pressable>
    </View>
  );
}

function SettingsPanel() {
  const { settings, updateSetting, testProviderConnection } = useVic();
  const [groqKey, setGroqKey] = useState('');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<
    Record<BrainProvider, { checking: boolean; ok: boolean | null; message: string }>
  >({
    Groq: { checking: false, ok: null, message: '' },
    OpenRouter: { checking: false, ok: null, message: '' },
  });

  async function saveKey(label: string, value: string) {
    if (!value.trim()) return;
    await SecureStore.setItemAsync(`vic.${label}`, value.trim());
    setSavedKey(label);
    setTimeout(() => setSavedKey(null), 1800);
  }

  async function runConnectionTest(provider: BrainProvider) {
    setTestStatus((current) => ({
      ...current,
      [provider]: { checking: true, ok: null, message: '' },
    }));
    const model = provider === 'Groq' ? settings.groqModel : settings.openRouterModel;
    const result = await testProviderConnection(provider, model);
    setTestStatus((current) => ({
      ...current,
      [provider]: { checking: false, ok: result.ok, message: result.message },
    }));
  }

  const languages: Language[] = ['Auto', 'English', 'Hindi', 'Gujarati'];
  const providers: BrainProvider[] = ['Groq', 'OpenRouter'];
  return (
    <ScrollView contentContainerStyle={styles.panelScroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionLabel}>AI BRAIN</Text>
      <Text style={styles.panelMuted}>The identity stays VIC; the brain can change.</Text>
      <View style={styles.choiceRow}>
        {providers.map((provider) => (
          <Pressable
            key={provider}
            onPress={() => updateSetting('provider', provider)}
            style={[styles.choice, settings.provider === provider && styles.choiceActive]}
          >
            <Text style={[styles.choiceText, settings.provider === provider && styles.choiceTextActive]}>
              {provider}
            </Text>
            <Text style={styles.choiceSubtext}>{provider === 'Groq' ? 'Fast / hosted' : 'Open model route'}</Text>
          </Pressable>
        ))}
      </View>
      <SecureKeyField
        label="Groq API key"
        value={groqKey}
        onChangeText={setGroqKey}
        onSave={() => saveKey('groq-api-key', groqKey)}
        saved={savedKey === 'groq-api-key'}
      />
      <ModelPicker
        label="Groq model"
        options={GROQ_MODELS}
        selected={settings.groqModel}
        onSelect={(id) => updateSetting('groqModel', id)}
      />
      <ConnectionTestRow
        provider="Groq"
        status={testStatus.Groq}
        onTest={() => runConnectionTest('Groq')}
      />
      <SecureKeyField
        label="OpenRouter API key"
        value={openRouterKey}
        onChangeText={setOpenRouterKey}
        onSave={() => saveKey('openrouter-api-key', openRouterKey)}
        saved={savedKey === 'openrouter-api-key'}
      />
      <ModelPicker
        label="OpenRouter model"
        options={OPENROUTER_MODELS}
        selected={settings.openRouterModel}
        onSelect={(id) => updateSetting('openRouterModel', id)}
      />
      <ConnectionTestRow
        provider="OpenRouter"
        status={testStatus.OpenRouter}
        onTest={() => runConnectionTest('OpenRouter')}
      />
      <Text style={styles.sectionLabel}>VOICE / LANGUAGE</Text>
      <Text style={styles.panelMuted}>Tap VIC once to keep a hands-free listening loop ready.</Text>
      <View style={styles.languageRow}>
        {languages.map((language) => (
          <Pressable
            key={language}
            onPress={() => updateSetting('language', language)}
            style={[styles.languagePill, settings.language === language && styles.languagePillActive]}
          >
            <Text style={[styles.languageText, settings.language === language && styles.languageTextActive]}>
              {language}
            </Text>
          </Pressable>
        ))}
      </View>
      <SettingSwitch
        label="Return to listening"
        description="Keep the conversation loop ready after a response."
        value={settings.autoListen}
        onValueChange={(value) => updateSetting('autoListen', value)}
      />
      <SettingSwitch
        label="Memory enabled"
        description="Save only information you explicitly teach VIC."
        value={settings.memoryEnabled}
        onValueChange={(value) => updateSetting('memoryEnabled', value)}
      />
      <SettingSwitch
        label="Voice output"
        description="Use the device's female system voice for the prototype."
        value={settings.soundEnabled}
        onValueChange={(value) => updateSetting('soundEnabled', value)}
      />
    </ScrollView>
  );
}

function ModelPicker({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: ReadonlyArray<{ id: string; label: string }>;
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.modelPickerWrap}>
      <Text style={styles.modelPickerLabel}>{label}</Text>
      <View style={styles.modelPickerOptions}>
        {options.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={[styles.modelChip, selected === option.id && styles.modelChipActive]}
            testID={`model-option-${option.id}`}
          >
            <Text
              style={[
                styles.modelChipText,
                selected === option.id && styles.modelChipTextActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ConnectionTestRow({
  provider,
  status,
  onTest,
}: {
  provider: BrainProvider;
  status: { checking: boolean; ok: boolean | null; message: string };
  onTest: () => void;
}) {
  return (
    <View style={styles.connectionRow}>
      <Pressable
        onPress={onTest}
        disabled={status.checking}
        style={styles.connectionTestButton}
        testID={`test-connection-${provider}`}
      >
        <Ionicons
          name={status.checking ? 'sync' : 'pulse-outline'}
          size={14}
          color={palette.primaryForeground}
        />
        <Text style={styles.connectionTestLabel}>
          {status.checking ? 'Testing…' : `Test ${provider} connection`}
        </Text>
      </Pressable>
      {status.ok !== null && (
        <Text
          style={[
            styles.connectionTestResult,
            status.ok ? styles.connectionTestResultOk : styles.connectionTestResultFail,
          ]}
          numberOfLines={2}
        >
          {status.message}
        </Text>
      )}
    </View>
  );
}

function SecureKeyField({
  label,
  value,
  onChangeText,
  onSave,
  saved,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onSave: () => void;
  saved: boolean;
}) {
  return (
    <View style={styles.keyField}>
      <Text style={styles.keyLabel}>{label}</Text>
      <View style={styles.keyInputRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Paste key to save securely"
          placeholderTextColor={palette.mutedForeground}
          secureTextEntry
          autoCapitalize="none"
          style={styles.keyInput}
        />
        <Pressable onPress={onSave} style={styles.saveKeyButton}>
          <Text style={styles.saveKeyLabel}>{saved ? 'Saved' : 'Save'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SettingSwitch({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingCopy}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: palette.muted, true: palette.accent }}
        thumbColor={value ? palette.primary : palette.mutedForeground}
      />
    </View>
  );
}

function HistoryPanel() {
  const { conversation, clearConversation } = useVic();
  return (
    <ScrollView contentContainerStyle={styles.panelScroll}>
      <View style={styles.panelTitleRow}>
        <View>
          <Text style={styles.panelHeading}>Recent conversation</Text>
          <Text style={styles.panelMuted}>Stored locally on this device.</Text>
        </View>
        <Pressable onPress={clearConversation} style={styles.textAction}>
          <Text style={styles.textActionLabel}>Clear</Text>
        </Pressable>
      </View>
      {conversation.slice(-8).map((message) => (
        <View key={message.id} style={styles.historyRow}>
          <Text style={styles.historyRole}>{message.role === 'vic' ? 'VIC' : 'YOU'}</Text>
          <Text style={styles.historyText}>{message.text}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

export default function VicHomeScreen() {
  const insets = useSafeAreaInsets();
  const {
    status,
    setStatus,
    settings,
    conversation,
    sendText,
    errorMessage,
    clearError,
  } = useVic();
  const [overlay, setOverlay] = useState<OverlayView | null>(null);
  const [composer, setComposer] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [voiceLoopEnabled, setVoiceLoopEnabled] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const lastTap = useRef(0);
  const voiceLoopRef = useRef(false);
  const transcriptRef = useRef('');
  const lastVoiceTextRef = useRef('');
  const turnHandledRef = useRef(false);
  const statusRef = useRef(status);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(
    () => () => {
      voiceLoopRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (speechEndTimerRef.current) clearTimeout(speechEndTimerRef.current);
      stopVicListening();
      void stopVicVoice();
    },
    [],
  );

  const latestVic = useMemo(
    () => [...conversation].reverse().find((message) => message.role === 'vic')?.text ?? '',
    [conversation],
  );

  function handleSurfacePress() {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      Haptics.selectionAsync();
      setOverlay('dashboard');
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  }

  function clearVoiceTimers() {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    if (speechEndTimerRef.current) clearTimeout(speechEndTimerRef.current);
    restartTimerRef.current = null;
    speechEndTimerRef.current = null;
  }

  function disableVoiceLoop() {
    voiceLoopRef.current = false;
    setVoiceLoopEnabled(false);
    clearVoiceTimers();
    stopVicListening();
    void stopVicVoice();
    transcriptRef.current = '';
    turnHandledRef.current = false;
    setStatus('idle');
  }

  function queueNextListening() {
    if (!voiceLoopRef.current) {
      setStatus('idle');
      return;
    }

    clearVoiceTimers();
    transcriptRef.current = '';
    turnHandledRef.current = false;
    setStatus('listening');
    restartTimerRef.current = setTimeout(() => {
      if (voiceLoopRef.current) startVicListening(settings.language);
    }, 220);
  }

  async function finishVoiceTurn(text: string) {
    const cleanText = text.trim();
    if (!cleanText || turnHandledRef.current) return;
    turnHandledRef.current = true;
    lastVoiceTextRef.current = cleanText;
    clearVoiceTimers();
    stopVicListening(false);

    try {
      const response = await sendText(cleanText);
      await speakVic(response, {
        rate: settings.speechRate,
        volume: 0.9,
        enabled: settings.soundEnabled,
        language: settings.language,
      });
      queueNextListening();
    } catch (error) {
      setVoiceError(
        error instanceof Error ? error.message : 'VIC could not complete that turn. Try again.',
      );
      queueNextListening();
    }
  }

  useSpeechRecognitionEvent('start', () => {
    if (voiceLoopRef.current) setStatus('listening');
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results
      .map((result) => result.transcript)
      .join(' ')
      .trim();
    if (!transcript) return;
    transcriptRef.current = transcript;
    if (event.isFinal) void finishVoiceTurn(transcript);
  });

  useSpeechRecognitionEvent('speechend', () => {
    if (!voiceLoopRef.current || turnHandledRef.current) return;
    if (speechEndTimerRef.current) clearTimeout(speechEndTimerRef.current);
    speechEndTimerRef.current = setTimeout(() => {
      if (transcriptRef.current) void finishVoiceTurn(transcriptRef.current);
    }, 420);
  });

  useSpeechRecognitionEvent('end', () => {
    if (!voiceLoopRef.current || turnHandledRef.current) return;
    if (transcriptRef.current) {
      void finishVoiceTurn(transcriptRef.current);
    } else if (statusRef.current === 'listening') {
      queueNextListening();
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'aborted') return;
    if (
      voiceLoopRef.current &&
      (event.error === 'no-speech' || event.error === 'speech-timeout')
    ) {
      queueNextListening();
      return;
    }
    setVoiceError(event.message || `Speech recognition failed (${event.error}).`);
    disableVoiceLoop();
  });

  async function handleMicPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (voiceLoopRef.current) {
      disableVoiceLoop();
      return;
    }

    try {
      const permission = await requestVoicePermissions();
      if (!permission.granted) {
        setVoiceError('Microphone and speech recognition permissions are required for VIC to listen.');
        setStatus('idle');
        return;
      }
      clearError();
      setVoiceError(null);
      voiceLoopRef.current = true;
      setVoiceLoopEnabled(true);
      queueNextListening();
    } catch (error) {
      setVoiceError(
        error instanceof Error ? error.message : 'VIC could not start speech recognition.',
      );
      setStatus('idle');
    }
  }

  async function submitComposer() {
    if (!composer.trim()) return;
    const text = composer.trim();
    setComposer('');
    setComposerOpen(false);
    try {
      const response = await sendText(text);
      await speakVic(response, {
        rate: settings.speechRate,
        volume: 0.9,
        enabled: settings.soundEnabled,
        language: settings.language,
      });
      if (voiceLoopRef.current) {
        queueNextListening();
      } else {
        setStatus(settings.autoListen ? 'listening' : 'idle');
      }
    } catch (error) {
      setVoiceError(
        error instanceof Error ? error.message : 'VIC could not complete that turn. Try again.',
      );
    }
  }

  function retryLastVoice() {
    const text = lastVoiceTextRef.current;
    if (!text) {
      setComposerOpen(true);
      return;
    }
    clearError();
    setVoiceError(null);
    turnHandledRef.current = false;
    void finishVoiceTurn(text);
  }

  const visibleError = voiceError ?? errorMessage;

  function renderOverlay() {
    if (overlay === 'dashboard') return <DashboardPanel />;
    if (overlay === 'memory') return <MemoryPanel />;
    if (overlay === 'settings') return <SettingsPanel />;
    return <HistoryPanel />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable
        style={[
          styles.root,
          { paddingTop: Platform.OS === 'web' ? 67 : insets.top, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom },
        ]}
        onPress={handleSurfacePress}
        testID="vic-surface"
      >
        <View style={styles.ambientGlow} />
        <View style={styles.ambientGlowSecondary} />
        <AmbientParticles />
        <View style={styles.topBar}>
          <View style={styles.identity}>
            <Text style={styles.vicWordmark}>VIC</Text>
            <View style={styles.quietState}>
              <StatusDot status={status} />
              <Text style={styles.quietStateText}>{statusCopy[status]}</Text>
            </View>
          </View>
          <View style={styles.topRight}>
            <Text style={styles.timeText}>
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        <View style={styles.mainStage}>
          <HolographicFloor />
          <View style={styles.characterStage}>
            <CharacterPresence status={status} />
            <View style={styles.stateFeedback}>
              <Waveform status={status} />
              {status !== 'idle' && status !== 'sleeping' && (
                <Text style={styles.stateFeedbackText}>{statusCopy[status]}</Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.sceneControls}>
          {visibleError ? (
            <View style={styles.errorPanel}>
              <Text style={styles.errorLabel}>VIC NEEDS ATTENTION</Text>
              <Text style={styles.errorText} numberOfLines={3}>{visibleError}</Text>
              <View style={styles.errorActions}>
                <Pressable
                  onPress={retryLastVoice}
                  style={styles.errorAction}
                  testID="retry-voice"
                >
                  <Text style={styles.errorActionLabel}>Try again</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    clearError();
                    setVoiceError(null);
                    setComposerOpen(true);
                  }}
                  style={styles.errorAction}
                  testID="use-text-fallback"
                >
                  <Text style={styles.errorActionLabel}>Use text</Text>
                </Pressable>
              </View>
            </View>
          ) : status === 'speaking' && latestVic ? (
            <View style={styles.speechHint}>
              <Text style={styles.speechHintText} numberOfLines={2}>{latestVic}</Text>
            </View>
          ) : <View />}
          <Pressable
            onPress={handleMicPress}
            style={[styles.coreButton, status === 'listening' && styles.coreButtonActive]}
            accessibilityLabel="Start or stop conversation"
            testID="conversation-core"
          >
            <View style={styles.coreButtonInner}>
              <Ionicons
                name={voiceLoopEnabled ? 'mic-off' : status === 'speaking' ? 'stop' : 'mic'}
                size={21}
                color={palette.foreground}
              />
            </View>
          </Pressable>
          <View style={styles.sceneSignature}>
            <Text style={styles.signatureText}>VELMORA</Text>
            <View style={styles.signatureLine} />
          </View>
        </View>

        {composerOpen && (
          <View style={styles.composerWrap}>
            <TextInput
              autoFocus
              value={composer}
              onChangeText={setComposer}
              placeholder="Say something to VIC…"
              placeholderTextColor={palette.mutedForeground}
              style={styles.composerInput}
              returnKeyType="send"
              onSubmitEditing={() => void submitComposer()}
              testID="conversation-input"
            />
            <Pressable onPress={() => void submitComposer()} style={styles.composerSend}>
              <Ionicons name="arrow-up" size={19} color={palette.primaryForeground} />
            </Pressable>
          </View>
        )}
      </Pressable>

      {overlay && (
        <OverlayShell
          activeView={overlay}
          onChangeView={setOverlay}
          onClose={() => setOverlay(null)}
        >
          {renderOverlay()}
        </OverlayShell>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  modelPickerWrap: { marginTop: 2, marginBottom: 4 },
  modelPickerLabel: { color: palette.mutedForeground, fontSize: 11, marginBottom: 6, letterSpacing: 0.4 },
  modelPickerOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modelChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.secondary,
  },
  modelChipActive: { borderColor: palette.primary, backgroundColor: palette.accent },
  modelChipText: { color: palette.mutedForeground, fontSize: 12 },
  modelChipTextActive: { color: palette.primaryForeground, fontWeight: '600' },
  connectionRow: { marginTop: 8, marginBottom: 14, gap: 6 },
  connectionTestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: palette.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  connectionTestLabel: { color: palette.primaryForeground, fontSize: 12, fontWeight: '600' },
  connectionTestResult: { fontSize: 12, lineHeight: 16 },
  connectionTestResultOk: { color: '#7fe0a8' },
  connectionTestResultFail: { color: palette.destructive },
  root: {
    flex: 1,
    backgroundColor: palette.background,
    overflow: 'hidden',
  },
  ambientGlow: {
    position: 'absolute',
    width: 760,
    height: 520,
    borderRadius: 380,
    backgroundColor: '#321356',
    opacity: 0.22,
    top: '10%',
    left: '24%',
    transform: [{ scaleX: 1.3 }],
  },
  ambientGlowSecondary: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: '#241248',
    opacity: 0.2,
    top: '23%',
    right: '-5%',
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1,
    backgroundColor: palette.border,
    opacity: 0.22,
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: palette.border,
    opacity: 0.16,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    minHeight: 52,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vicWordmark: {
    color: palette.foreground,
    fontSize: 20,
    letterSpacing: 5,
    fontWeight: '700',
  },
  quietState: { flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.74 },
  quietStateText: { color: palette.mutedForeground, fontSize: 9, letterSpacing: 1 },
  identityMeta: { gap: 4 },
  identityTitle: {
    color: palette.mutedForeground,
    fontSize: 8,
    letterSpacing: 1.8,
    fontWeight: '600',
  },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  onlineText: { color: palette.primary, fontSize: 10, letterSpacing: 1.2 },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8fe9c5',
  },
  statusDotHot: { backgroundColor: '#cf91ff' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 18, opacity: 0.7 },
  connectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 30,
  },
  connectionDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#8fe9c5' },
  connectionText: { color: palette.mutedForeground, fontSize: 9, letterSpacing: 1 },
  timeText: { color: palette.mutedForeground, fontSize: 11 },
  mainStage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mainStagePortrait: { paddingHorizontal: 12 },
  characterStage: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  stateFeedback: {
    position: 'absolute',
    bottom: 26,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    opacity: 0.72,
  },
  stateFeedbackText: { color: palette.mutedForeground, fontSize: 8, letterSpacing: 1.6 },
  particle: { position: 'absolute', backgroundColor: '#dcb7ff', shadowColor: '#be7dff', shadowOpacity: 0.8, shadowRadius: 6 },
  floorScene: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 22 },
  floorGlow: { position: 'absolute', bottom: 12, width: '48%', height: 54, borderRadius: 100, backgroundColor: '#7b32c4', opacity: 0.14 },
  floorEllipseOuter: { width: '44%', height: 48, borderRadius: 999, borderWidth: 1, borderColor: '#8c52c9', opacity: 0.5, transform: [{ scaleY: 0.32 }] },
  floorEllipseInner: { position: 'absolute', bottom: 29, width: '31%', height: 34, borderRadius: 999, borderWidth: 1, borderColor: '#dab0ff', opacity: 0.32, transform: [{ scaleY: 0.28 }] },
  floorBeam: { position: 'absolute', bottom: 20, width: 1, height: '42%', backgroundColor: '#9f63d4', opacity: 0.16 },
  floorBeamLeft: { transform: [{ translateX: -70 }, { rotate: '-18deg' }] },
  floorBeamRight: { transform: [{ translateX: 70 }, { rotate: '18deg' }] },
  leftRail: { width: '23%', paddingLeft: 24, gap: 10 },
  railKicker: { color: palette.primary, fontSize: 10, letterSpacing: 2 },
  railCopy: { color: palette.mutedForeground, fontSize: 13, lineHeight: 19, maxWidth: 190 },
  railLine: { width: 34, height: 1, backgroundColor: palette.primary, marginVertical: 8 },
  railHint: { color: palette.foreground, fontSize: 9, letterSpacing: 1.4 },
  railHintSub: { color: palette.mutedForeground, fontSize: 10 },
  characterWrap: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  energyRing: { position: 'absolute', borderWidth: 1, borderColor: palette.primary, borderRadius: 999 },
  energyRingLarge: { width: 520, height: 520, opacity: 0.25 },
  energyRingSmall: { width: 392, height: 392, opacity: 0.28, borderColor: '#e0baff' },
  characterShadow: { position: 'absolute', bottom: '18%', width: 290, height: 34, borderRadius: 999, backgroundColor: '#431a6e', opacity: 0.24, transform: [{ scaleX: 1.35 }] },
  character: { width: 300, height: 430, alignItems: 'center', justifyContent: 'flex-end' },
  hairBack: {
    position: 'absolute',
    top: 19,
    width: 232,
    height: 310,
    borderRadius: 116,
    backgroundColor: '#110d1b',
    borderWidth: 2,
    borderColor: '#6b3d9a',
    transform: [{ rotate: '-4deg' }],
    shadowColor: '#bb79ff',
    shadowOpacity: 0.56,
    shadowRadius: 22,
  },
  hairCrown: { position: 'absolute', top: 10, width: 206, height: 122, borderRadius: 110, backgroundColor: '#241433', borderWidth: 1, borderColor: '#9862c5', transform: [{ rotate: '-7deg' }] },
  hairLockLeft: { position: 'absolute', top: 88, left: 28, width: 47, height: 236, borderRadius: 26, backgroundColor: '#1b1128', borderLeftWidth: 2, borderLeftColor: '#70439b', transform: [{ rotate: '9deg' }] },
  hairLockRight: { position: 'absolute', top: 90, right: 24, width: 44, height: 244, borderRadius: 26, backgroundColor: '#191026', borderRightWidth: 2, borderRightColor: '#7d4ca9', transform: [{ rotate: '-8deg' }] },
  shoulders: {
    position: 'absolute',
    bottom: 0,
    width: 300,
    height: 173,
    borderRadius: 150,
    backgroundColor: '#0d0a16',
    borderWidth: 1,
    borderColor: '#7148a0',
    overflow: 'hidden',
  },
  shoulderGlow: { position: 'absolute', top: 13, left: 72, width: 154, height: 72, borderRadius: 80, backgroundColor: '#472067', opacity: 0.72 },
  jacketPanelLeft: { position: 'absolute', top: 42, left: 28, width: 90, height: 130, borderTopWidth: 1, borderRightWidth: 1, borderColor: '#40265d', transform: [{ rotate: '17deg' }] },
  jacketPanelRight: { position: 'absolute', top: 42, right: 28, width: 90, height: 130, borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#40265d', transform: [{ rotate: '-17deg' }] },
  neck: { position: 'absolute', top: 224, width: 56, height: 70, borderRadius: 24, backgroundColor: '#ae7fbe' },
  face: {
    position: 'absolute',
    top: 62,
    width: 150,
    height: 182,
    borderRadius: 75,
    backgroundColor: '#c894cc',
    borderWidth: 2,
    borderColor: '#ac70cc',
    overflow: 'hidden',
  },
  faceShade: { position: 'absolute', right: -14, top: -4, width: 82, height: 194, backgroundColor: '#87539a', opacity: 0.36 },
  faceHighlight: { position: 'absolute', left: 18, top: 17, width: 40, height: 70, borderRadius: 30, backgroundColor: '#f2c9ef', opacity: 0.14, transform: [{ rotate: '18deg' }] },
  fringe: { position: 'absolute', top: -12, left: -5, width: 104, height: 76, borderBottomRightRadius: 56, backgroundColor: '#21152f', transform: [{ rotate: '-12deg' }] },
  eyeRow: { position: 'absolute', top: 82, left: 25, right: 25, flexDirection: 'row', justifyContent: 'space-between' },
  eye: { width: 31, height: 12, borderRadius: 10, backgroundColor: '#25183b', borderBottomWidth: 2, borderBottomColor: '#c68cff' },
  eyeClosed: { height: 2, marginTop: 5, borderBottomWidth: 1 },
  eyeSpark: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#f3dcff', marginLeft: 9, marginTop: 2 },
  noseLine: { position: 'absolute', top: 95, left: 72, height: 28, width: 1, backgroundColor: '#845b8c', transform: [{ rotate: '8deg' }] },
  mouthLine: { position: 'absolute', bottom: 31, left: 60, width: 31, height: 8, borderBottomWidth: 1, borderBottomColor: '#6a3d71', borderRadius: 10 },
  cheekLight: { position: 'absolute', right: 20, bottom: 40, width: 19, height: 10, borderRadius: 10, backgroundColor: '#f0b9e5', opacity: 0.22 },
  collarLeft: { position: 'absolute', top: 287, left: 109, width: 42, height: 92, borderLeftWidth: 2, borderTopWidth: 1, borderColor: '#8152a6', transform: [{ rotate: '-24deg' }] },
  collarRight: { position: 'absolute', top: 287, right: 109, width: 42, height: 92, borderRightWidth: 2, borderTopWidth: 1, borderColor: '#8152a6', transform: [{ rotate: '24deg' }] },
  choker: { position: 'absolute', top: 266, width: 66, height: 15, borderRadius: 8, backgroundColor: '#211634', borderWidth: 1, borderColor: palette.primary },
  chokerCore: { width: 8, height: 8, borderRadius: 4, alignSelf: 'center', marginTop: 2, backgroundColor: '#d4a3ff' },
  torsoLine: { position: 'absolute', bottom: 23, width: 2, height: 94, backgroundColor: palette.primary, opacity: 0.7 },
  gestureArm: { position: 'absolute', right: 2, bottom: 55, width: 36, height: 126, borderRadius: 22, backgroundColor: '#161020', borderWidth: 1, borderColor: '#70439b', transformOrigin: 'bottom' },
  gestureHand: { position: 'absolute', top: -9, left: 5, width: 26, height: 20, borderRadius: 12, backgroundColor: '#ae7fbe', borderWidth: 1, borderColor: '#d4a3ff' },
  rightRail: { width: '23%', paddingRight: 24, alignItems: 'flex-end', gap: 8 },
  rightRailLabel: { color: palette.mutedForeground, fontSize: 9, letterSpacing: 1.4 },
  rightRailValue: { color: palette.foreground, fontSize: 15, letterSpacing: 2 },
  waveform: { height: 30, flexDirection: 'row', alignItems: 'center', gap: 3, marginVertical: 8 },
  waveBar: { width: 3, minHeight: 3, borderRadius: 2, backgroundColor: palette.primary },
  rightRailHint: { color: palette.mutedForeground, fontSize: 11, lineHeight: 17, textAlign: 'right', maxWidth: 170 },
  sceneControls: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 18,
    zIndex: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  errorPanel: {
    width: '42%',
    maxWidth: 430,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeftWidth: 1,
    borderLeftColor: '#f0a4c7',
    backgroundColor: 'rgba(42,14,39,0.74)',
    gap: 4,
  },
  errorLabel: { color: '#f0a4c7', fontSize: 8, letterSpacing: 1.4 },
  errorText: { color: '#f4d9e8', fontSize: 11, lineHeight: 16 },
  errorActions: { flexDirection: 'row', gap: 14, marginTop: 3 },
  errorAction: { paddingVertical: 4 },
  errorActionLabel: { color: palette.primary, fontSize: 10, letterSpacing: 0.7 },
  speechHint: { width: '34%', maxWidth: 340, paddingHorizontal: 14, paddingVertical: 9, borderLeftWidth: 1, borderLeftColor: palette.primary, backgroundColor: 'rgba(18,10,30,0.54)' },
  speechHintText: { color: '#ddc9ef', fontSize: 11, lineHeight: 16 },
  sceneSignature: { width: '34%', alignItems: 'flex-end', gap: 6, opacity: 0.48 },
  signatureText: { color: palette.mutedForeground, fontSize: 8, letterSpacing: 2.4 },
  signatureLine: { width: 34, height: 1, backgroundColor: palette.primary },
  bottomBar: {
    minHeight: 92,
    paddingHorizontal: 22,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  responseBubble: { width: '31%', gap: 5 },
  responseLabel: { color: palette.primary, fontSize: 9, letterSpacing: 1.6 },
  responseText: { color: palette.foreground, fontSize: 12, lineHeight: 17 },
  coreControl: { alignItems: 'center', gap: 5 },
  coreButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(37,20,58,0.78)',
    borderWidth: 1,
    borderColor: '#8c54c8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#a85dff',
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  coreButtonActive: { backgroundColor: '#63339a', borderColor: '#dab0ff' },
  coreButtonInner: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  coreLabel: { color: palette.mutedForeground, fontSize: 8, letterSpacing: 1.4 },
  bottomMeta: { width: '31%', alignItems: 'flex-end', gap: 5 },
  bottomMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  bottomMetaText: { color: palette.primary, fontSize: 9, letterSpacing: 1.4 },
  bottomMetaSub: { color: palette.mutedForeground, fontSize: 10 },
  composerWrap: {
    position: 'absolute',
    left: '28%',
    right: '28%',
    bottom: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 6,
    borderRadius: 18,
    backgroundColor: '#171022',
    borderWidth: 1,
    borderColor: palette.primary,
  },
  composerInput: { flex: 1, paddingHorizontal: 12, color: palette.foreground, fontSize: 14, minHeight: 40 },
  composerSend: { width: 36, height: 36, borderRadius: 18, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  overlayBackdrop: { flex: 1, backgroundColor: 'rgba(2,1,6,0.84)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  overlayCard: { width: '92%', maxWidth: 760, maxHeight: '90%', backgroundColor: '#100c19', borderWidth: 1, borderColor: palette.border, borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 30 },
  overlayHeader: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overlayKicker: { color: palette.primary, fontSize: 9, letterSpacing: 2 },
  overlayTitle: { color: palette.foreground, fontSize: 20, marginTop: 5 },
  iconButton: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  overlayTabs: { flexDirection: 'row', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: palette.border },
  overlayTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  overlayTabActive: { borderBottomColor: palette.primary },
  overlayTabLabel: { color: palette.mutedForeground, fontSize: 11 },
  overlayTabLabelActive: { color: palette.foreground },
  overlayContent: { flexShrink: 1 },
  panelScroll: { padding: 20, gap: 14 },
  panelIntro: { color: palette.mutedForeground, fontSize: 13, lineHeight: 19, marginBottom: 2 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { minWidth: '46%', flex: 1, padding: 13, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, borderRadius: 11, gap: 6 },
  metricLabel: { color: palette.mutedForeground, fontSize: 10, letterSpacing: 1 },
  metricValue: { color: palette.foreground, fontSize: 13 },
  notice: { flexDirection: 'row', gap: 10, padding: 13, backgroundColor: '#1b1229', borderRadius: 11, borderWidth: 1, borderColor: '#4d2a6d' },
  noticeText: { flex: 1, color: '#cfb9e7', fontSize: 12, lineHeight: 18 },
  panelTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  panelHeading: { color: palette.foreground, fontSize: 16 },
  panelMuted: { color: palette.mutedForeground, fontSize: 11, marginTop: 4, lineHeight: 16 },
  textAction: { paddingHorizontal: 9, paddingVertical: 6 },
  textActionLabel: { color: palette.primary, fontSize: 11 },
  emptyState: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyTitle: { color: palette.foreground, fontSize: 15 },
  emptyCopy: { color: palette.mutedForeground, fontSize: 12, textAlign: 'center', maxWidth: 260, lineHeight: 18 },
  memoryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, borderRadius: 11 },
  memoryIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#25143a', alignItems: 'center', justifyContent: 'center' },
  memoryBody: { flex: 1, gap: 3 },
  memoryCategory: { color: palette.primary, fontSize: 8, letterSpacing: 1.2 },
  memoryTitle: { color: palette.foreground, fontSize: 13 },
  memoryDetail: { color: palette.mutedForeground, fontSize: 11, lineHeight: 16 },
  deleteButton: { padding: 6 },
  sectionLabel: { color: palette.primary, fontSize: 9, letterSpacing: 1.6, marginTop: 4 },
  choiceRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  choice: { flex: 1, padding: 12, borderWidth: 1, borderColor: palette.border, borderRadius: 10, backgroundColor: palette.card, gap: 4 },
  choiceActive: { borderColor: palette.primary, backgroundColor: '#25143a' },
  choiceText: { color: palette.foreground, fontSize: 13 },
  choiceTextActive: { color: '#e3c9ff' },
  choiceSubtext: { color: palette.mutedForeground, fontSize: 10 },
  keyField: { gap: 6, marginTop: 2 },
  keyLabel: { color: palette.mutedForeground, fontSize: 11 },
  keyInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 10, backgroundColor: palette.card, overflow: 'hidden' },
  keyInput: { flex: 1, minHeight: 42, paddingHorizontal: 12, color: palette.foreground, fontSize: 12 },
  saveKeyButton: { paddingHorizontal: 13, paddingVertical: 12, borderLeftWidth: 1, borderLeftColor: palette.border },
  saveKeyLabel: { color: palette.primary, fontSize: 11 },
  languageRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginTop: 4 },
  languagePill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: palette.border },
  languagePillActive: { borderColor: palette.primary, backgroundColor: '#25143a' },
  languageText: { color: palette.mutedForeground, fontSize: 11 },
  languageTextActive: { color: palette.foreground },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: palette.border },
  settingCopy: { flex: 1, gap: 3 },
  settingLabel: { color: palette.foreground, fontSize: 13 },
  settingDescription: { color: palette.mutedForeground, fontSize: 10, lineHeight: 15 },
  historyRow: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border },
  historyRole: { width: 34, color: palette.primary, fontSize: 9, letterSpacing: 1, paddingTop: 2 },
  historyText: { flex: 1, color: palette.foreground, fontSize: 12, lineHeight: 18 },
});
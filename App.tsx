/**
 * WellGuard — scratch validation harness.
 * Real UI lands in Milestone 1E and will replace this file.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  FlatList,
  Linking,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import DevicePolicy from './src/modules/DevicePolicy';
import type { InstalledApp } from './src/modules/DevicePolicy';
import TimerService from './src/modules/TimerService';
import UsageStats from './src/modules/UsageStats';
import { ZenScreen } from './src/screens/ZenScreen';
import {
  useAppConfigStore,
  type AppConfig,
} from './src/store/appConfigStore';

const ADB_DO_CMD =
  'adb shell dpm set-device-owner com.wellguard/.receivers.DeviceAdminReceiver';

type Gate = {
  deviceOwner: boolean;
  postNotifications: boolean;
  usageStats: boolean;
  batteryOptIgnored: boolean;
};

const INITIAL_GATE: Gate = {
  deviceOwner: false,
  postNotifications: false,
  usageStats: false,
  batteryOptIgnored: false,
};

function allGranted(g: Gate): boolean {
  return (
    g.deviceOwner &&
    g.postNotifications &&
    g.usageStats &&
    g.batteryOptIgnored
  );
}

const DONT_KILL_MY_APP_URL = 'https://dontkillmyapp.com';

const DO_PREREQS = [
  'No Google accounts signed in (Settings → Passwords & accounts)',
  'No work profile (employer MDM)',
  'No guest user, private space, or cloned app profile',
];

async function checkPostNotifications(): Promise<boolean> {
  if (Platform.OS !== 'android' || (Platform.Version as number) < 33) {
    return true;
  }
  return PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
}

async function requestPostNotifications(): Promise<boolean> {
  if (Platform.OS !== 'android' || (Platform.Version as number) < 33) {
    return true;
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function App() {
  const [gate, setGate] = useState<Gate>(INITIAL_GATE);
  const [gateLoaded, setGateLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zenOpen, setZenOpen] = useState(false);

  const refreshGate = useCallback(async () => {
    setError(null);
    try {
      const [deviceOwner, postNotifications, usageStats, batteryOptIgnored] =
        await Promise.all([
          DevicePolicy.isDeviceOwner(),
          checkPostNotifications(),
          UsageStats.hasUsageStatsPermission(),
          TimerService.isIgnoringBatteryOptimizations(),
        ]);
      setGate({
        deviceOwner,
        postNotifications,
        usageStats,
        batteryOptIgnored,
      });
    } catch (e) {
      setError(`gate check failed: ${String(e)}`);
    } finally {
      setGateLoaded(true);
    }
  }, []);

  const handleRequestNotifications = useCallback(async () => {
    setError(null);
    try {
      await requestPostNotifications();
    } catch (e) {
      setError(`notif permission request failed: ${String(e)}`);
    }
    await refreshGate();
  }, [refreshGate]);

  const handleOpenUsageSettings = useCallback(async () => {
    setError(null);
    try {
      await UsageStats.openUsageStatsSettings();
    } catch (e) {
      setError(`open usage settings failed: ${String(e)}`);
    }
  }, []);

  const handleRequestBatteryOpt = useCallback(async () => {
    setError(null);
    try {
      await TimerService.requestIgnoreBatteryOptimizations();
    } catch (e) {
      setError(`battery opt request failed: ${String(e)}`);
    }
  }, []);

  const handleOpenDontKillMyApp = useCallback(() => {
    Linking.openURL(DONT_KILL_MY_APP_URL).catch(e =>
      setError(`open link failed: ${String(e)}`),
    );
  }, []);

  useEffect(() => {
    refreshGate();
  }, [refreshGate]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') refreshGate();
    });
    return () => sub.remove();
  }, [refreshGate]);

  const gatePassed = allGranted(gate);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>WellGuard · harness</Text>

          {!gateLoaded && (
            <View style={styles.card}>
              <Text style={styles.value}>checking permissions…</Text>
            </View>
          )}

          {gateLoaded && !gatePassed && (
            <GateCard
              gate={gate}
              onRefresh={refreshGate}
              onRequestNotifications={handleRequestNotifications}
              onOpenUsageSettings={handleOpenUsageSettings}
              onRequestBatteryOpt={handleRequestBatteryOpt}
              onOpenDontKillMyApp={handleOpenDontKillMyApp}
            />
          )}

          {gatePassed && (
            <>
              <GuardList onError={setError} />
              <Pressable
                style={[styles.button, styles.zenEntry]}
                onPress={() => setZenOpen(true)}>
                <Text style={styles.buttonText}>Zen mode →</Text>
              </Pressable>
            </>
          )}

          {error && (
            <View style={[styles.card, styles.errorCard]}>
              <Text style={styles.label}>Error</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        <Modal
          visible={zenOpen}
          animationType="slide"
          onRequestClose={() => setZenOpen(false)}
          presentationStyle="pageSheet">
          <SafeAreaView style={styles.container}>
            <View style={styles.modalHeader}>
              <Text style={styles.title}>Zen mode</Text>
              <Pressable onPress={() => setZenOpen(false)}>
                <Text style={styles.cancelText}>Close</Text>
              </Pressable>
            </View>
            <ZenScreen onError={setError} />
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// --- Gate -------------------------------------------------------------------

type GateCardProps = {
  gate: Gate;
  onRefresh: () => void;
  onRequestNotifications: () => void;
  onOpenUsageSettings: () => void;
  onRequestBatteryOpt: () => void;
  onOpenDontKillMyApp: () => void;
};

function GateCard({
  gate,
  onRefresh,
  onRequestNotifications,
  onOpenUsageSettings,
  onRequestBatteryOpt,
  onOpenDontKillMyApp,
}: GateCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Setup required</Text>
      <Text style={styles.hint}>
        WellGuard needs these before the cycle engine can run.
      </Text>

      <GateRow
        title="Device Owner"
        granted={gate.deviceOwner}
        hint="Run the ADB command below from your Mac. The command will fail if any of these exist on the device — remove them first:"
        cta={
          <>
            <View style={styles.prereqList}>
              {DO_PREREQS.map(item => (
                <Text key={item} style={styles.prereqItem}>
                  • {item}
                </Text>
              ))}
            </View>
            <Text selectable style={styles.code}>
              {ADB_DO_CMD}
            </Text>
            <Pressable style={styles.button} onPress={onRefresh}>
              <Text style={styles.buttonText}>Re-check</Text>
            </Pressable>
          </>
        }
      />

      <GateRow
        title="Notifications"
        granted={gate.postNotifications}
        hint="Needed for the cycle foreground notification + pre-freeze warnings."
        cta={
          <Pressable style={styles.button} onPress={onRequestNotifications}>
            <Text style={styles.buttonText}>Grant</Text>
          </Pressable>
        }
      />

      <GateRow
        title="Usage Access"
        granted={gate.usageStats}
        hint="Used to read per-app time in foreground (dashboard in M2)."
        cta={
          <>
            <Pressable style={styles.button} onPress={onOpenUsageSettings}>
              <Text style={styles.buttonText}>Open Settings</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.secondary]}
              onPress={onRefresh}>
              <Text style={styles.buttonText}>Re-check</Text>
            </Pressable>
          </>
        }
      />

      <GateRow
        title="Battery Optimization"
        granted={gate.batteryOptIgnored}
        hint="Unrestricted power keeps the cycle service alive through Doze. On aggressive OEMs (OnePlus, Xiaomi, Samsung) additional per-OEM steps are needed."
        cta={
          <>
            <Pressable style={styles.button} onPress={onRequestBatteryOpt}>
              <Text style={styles.buttonText}>Whitelist</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.secondary]}
              onPress={onOpenDontKillMyApp}>
              <Text style={styles.buttonText}>OEM steps</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.secondary]}
              onPress={onRefresh}>
              <Text style={styles.buttonText}>Re-check</Text>
            </Pressable>
          </>
        }
      />
    </View>
  );
}

type GateRowProps = {
  title: string;
  granted: boolean;
  hint: string;
  cta: React.ReactNode;
};

function GateRow({ title, granted, hint, cta }: GateRowProps) {
  return (
    <View style={styles.gateRow}>
      <View style={styles.gateHeader}>
        <Text style={[styles.gateStatus, granted ? styles.ok : styles.notOk]}>
          {granted ? '✓' : '•'}
        </Text>
        <Text style={styles.gateTitle}>{title}</Text>
      </View>
      {!granted && (
        <>
          <Text style={styles.hint}>{hint}</Text>
          <View style={styles.gateCta}>{cta}</View>
        </>
      )}
    </View>
  );
}

// --- Guard list -------------------------------------------------------------

type GuardListProps = {
  onError: (msg: string | null) => void;
};

function GuardList({ onError }: GuardListProps) {
  const configsMap = useAppConfigStore(s => s.configs);
  const remove = useAppConfigStore(s => s.remove);
  const configs = useMemo(
    () =>
      Object.values(configsMap).sort((a, b) =>
        a.appName.localeCompare(b.appName),
      ),
    [configsMap],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [runningMap, setRunningMap] = useState<Record<string, boolean>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const tick = async () => {
      try {
        const entries = await Promise.all(
          configs.map(async c => [
            c.packageName,
            await TimerService.isRunning(c.packageName),
          ] as const),
        );
        setRunningMap(Object.fromEntries(entries));
      } catch {
        // swallow — polling errors shouldn't spam the UI
      }
    };
    tick();
    pollRef.current = setInterval(tick, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [configs]);

  const startCycle = useCallback(
    async (config: AppConfig) => {
      onError(null);
      try {
        await TimerService.startCycle(
          config.packageName,
          config.useWindowMinutes,
          config.freezeWindowMinutes,
        );
      } catch (e) {
        onError(`startCycle failed: ${String(e)}`);
      }
    },
    [onError],
  );

  const stopCycle = useCallback(
    async (config: AppConfig) => {
      onError(null);
      try {
        await TimerService.stopCycle(config.packageName);
      } catch (e) {
        onError(`stopCycle failed: ${String(e)}`);
      }
    },
    [onError],
  );

  const handleRemove = useCallback(
    async (config: AppConfig) => {
      if (runningMap[config.packageName]) {
        await stopCycle(config);
      }
      remove(config.packageName);
    },
    [remove, runningMap, stopCycle],
  );

  return (
    <>
      {configs.length === 0 && (
        <View style={styles.card}>
          <Text style={styles.label}>No apps configured</Text>
          <Text style={styles.hint}>
            Tap + Add app to pick an installed app and set its use/freeze
            windows.
          </Text>
        </View>
      )}

      {configs.map(config => (
        <ConfigRow
          key={config.packageName}
          config={config}
          running={!!runningMap[config.packageName]}
          onStart={() => startCycle(config)}
          onStop={() => stopCycle(config)}
          onRemove={() => handleRemove(config)}
        />
      ))}

      <Pressable
        style={[styles.button, styles.addButton]}
        onPress={() => setPickerOpen(true)}>
        <Text style={styles.buttonText}>+ Add app</Text>
      </Pressable>

      <AddAppModal
        visible={pickerOpen}
        existingPackages={new Set(configs.map(c => c.packageName))}
        onClose={() => setPickerOpen(false)}
        onError={onError}
      />
    </>
  );
}

type ConfigRowProps = {
  config: AppConfig;
  running: boolean;
  onStart: () => void;
  onStop: () => void;
  onRemove: () => void;
};

function ConfigRow({
  config,
  running,
  onStart,
  onStop,
  onRemove,
}: ConfigRowProps) {
  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={styles.configTitle}>{config.appName}</Text>
          <Text style={styles.configPkg}>{config.packageName}</Text>
        </View>
        <Text
          style={[
            styles.runningPill,
            running ? styles.runningPillOn : styles.runningPillOff,
          ]}>
          {running ? 'running' : 'stopped'}
        </Text>
      </View>
      <Text style={styles.configMeta}>
        use {config.useWindowMinutes}min · freeze {config.freezeWindowMinutes}min
      </Text>
      <View style={styles.row}>
        {running ? (
          <Pressable style={[styles.button, styles.block]} onPress={onStop}>
            <Text style={styles.buttonText}>Stop</Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.button, styles.unblock]} onPress={onStart}>
            <Text style={styles.buttonText}>Start</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.button, styles.secondary]}
          onPress={onRemove}>
          <Text style={styles.buttonText}>Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}

// --- Add-app modal ----------------------------------------------------------

type AddAppModalProps = {
  visible: boolean;
  existingPackages: Set<string>;
  onClose: () => void;
  onError: (msg: string | null) => void;
};

function AddAppModal({
  visible,
  existingPackages,
  onClose,
  onError,
}: AddAppModalProps) {
  const upsert = useAppConfigStore(s => s.upsert);
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<InstalledApp | null>(null);
  const [useMin, setUseMin] = useState('10');
  const [freezeMin, setFreezeMin] = useState('60');

  const loadApps = useCallback(async () => {
    setLoading(true);
    try {
      const list = await DevicePolicy.getInstalledUserApps();
      list.sort((a, b) => a.appName.localeCompare(b.appName));
      setApps(list);
    } catch (e) {
      onError(`getInstalledUserApps failed: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    if (visible && apps.length === 0) loadApps();
  }, [visible, apps.length, loadApps]);

  const handleClose = useCallback(() => {
    setPicked(null);
    setUseMin('10');
    setFreezeMin('60');
    onClose();
  }, [onClose]);

  const handleSave = useCallback(() => {
    if (!picked) return;
    const useNum = Number(useMin);
    const freezeNum = Number(freezeMin);
    if (!Number.isFinite(useNum) || useNum <= 0) {
      onError('use minutes must be > 0');
      return;
    }
    if (!Number.isFinite(freezeNum) || freezeNum <= 0) {
      onError('freeze minutes must be > 0');
      return;
    }
    upsert({
      packageName: picked.packageName,
      appName: picked.appName,
      useWindowMinutes: useNum,
      freezeWindowMinutes: freezeNum,
    });
    handleClose();
  }, [picked, useMin, freezeMin, upsert, onError, handleClose]);

  const pickable = useMemo(
    () => apps.filter(a => !existingPackages.has(a.packageName)),
    [apps, existingPackages],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.title}>
            {picked ? 'Configure cycle' : 'Pick an app'}
          </Text>
          <Pressable onPress={handleClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>

        {!picked && (
          <>
            {loading && (
              <View style={styles.card}>
                <Text style={styles.value}>loading apps…</Text>
              </View>
            )}
            {!loading && pickable.length === 0 && (
              <View style={styles.card}>
                <Text style={styles.hint}>
                  All launchable apps are already configured.
                </Text>
              </View>
            )}
            <FlatList
              data={pickable}
              keyExtractor={item => item.packageName}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.appRow}
                  onPress={() => setPicked(item)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.configTitle}>{item.appName}</Text>
                    <Text style={styles.configPkg}>{item.packageName}</Text>
                  </View>
                  {item.isSystem && (
                    <Text style={styles.systemTag}>system</Text>
                  )}
                </Pressable>
              )}
              contentContainerStyle={{ paddingBottom: 40 }}
            />
          </>
        )}

        {picked && (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.card}>
              <Text style={styles.configTitle}>{picked.appName}</Text>
              <Text style={styles.configPkg}>{picked.packageName}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Use window (minutes)</Text>
              <TextInput
                style={styles.input}
                value={useMin}
                onChangeText={setUseMin}
                keyboardType="decimal-pad"
                placeholder="10"
              />
              <Text style={styles.hint}>
                How long the app stays usable in each cycle. Decimals OK for
                testing (0.333 ≈ 20s).
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Freeze window (minutes)</Text>
              <TextInput
                style={styles.input}
                value={freezeMin}
                onChangeText={setFreezeMin}
                keyboardType="decimal-pad"
                placeholder="60"
              />
              <Text style={styles.hint}>
                How long the app is blocked between use windows.
              </Text>
            </View>

            <View style={styles.row}>
              <Pressable
                style={[styles.button, styles.secondary]}
                onPress={() => setPicked(null)}>
                <Text style={styles.buttonText}>Back</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.unblock]}
                onPress={handleSave}>
                <Text style={styles.buttonText}>Save</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// --- styles -----------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  card: {
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 10,
    gap: 6,
  },
  label: { fontSize: 12, color: '#666', textTransform: 'uppercase' },
  value: { fontSize: 16, fontFamily: 'Menlo' },
  hint: { fontSize: 13, color: '#555' },
  row: { flexDirection: 'row', gap: 8, marginTop: 4 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#2b6ef2',
    alignItems: 'center',
    flex: 1,
  },
  addButton: { marginTop: 8 },
  secondary: { backgroundColor: '#6b7280' },
  block: { backgroundColor: '#d93025' },
  unblock: { backgroundColor: '#1e8e3e' },
  buttonText: { color: 'white', fontWeight: '600' },
  errorCard: { backgroundColor: '#fde7e7' },
  errorText: { color: '#8a1e1e', fontFamily: 'Menlo' },
  gateRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5ea',
    paddingTop: 10,
    gap: 6,
  },
  gateHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gateTitle: { fontSize: 15, fontWeight: '600' },
  gateStatus: { fontSize: 16, fontWeight: '700', width: 18 },
  ok: { color: '#1e8e3e' },
  notOk: { color: '#d93025' },
  gateCta: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  code: {
    fontFamily: 'Menlo',
    fontSize: 12,
    padding: 8,
    backgroundColor: '#f0f0f3',
    borderRadius: 6,
  },
  configTitle: { fontSize: 16, fontWeight: '600' },
  configPkg: { fontSize: 12, color: '#777', fontFamily: 'Menlo' },
  configMeta: { fontSize: 13, color: '#444' },
  runningPill: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  runningPillOn: { backgroundColor: '#1e8e3e', color: 'white' },
  runningPillOff: { backgroundColor: '#e5e5ea', color: '#555' },
  modalContainer: { flex: 1, backgroundColor: '#f5f5f7' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 8,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
  },
  cancelText: { color: '#2b6ef2', fontSize: 15 },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 8,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
  },
  systemTag: {
    fontSize: 10,
    color: '#888',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'Menlo',
    backgroundColor: '#fafafa',
  },
  prereqList: { gap: 2, marginBottom: 4 },
  prereqItem: { fontSize: 13, color: '#555' },
  zenEntry: { marginTop: 8, backgroundColor: '#6d28d9' },
});

export default App;

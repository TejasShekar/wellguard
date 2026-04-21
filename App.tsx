/**
 * WellGuard — scratch validation harness.
 * Real UI lands in Milestone 1E and will replace this file.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import DevicePolicy from './src/modules/DevicePolicy';
import TimerService from './src/modules/TimerService';
import UsageStats from './src/modules/UsageStats';

const TARGET_PACKAGE = 'com.android.chrome';
const CYCLE_USE_MIN = 0.333; // 20s — dev-friendly for emulator testing
const CYCLE_FREEZE_MIN = 0.333;
const ADB_DO_CMD =
  'adb shell dpm set-device-owner com.wellguard/.receivers.DeviceAdminReceiver';

type Gate = {
  deviceOwner: boolean;
  postNotifications: boolean;
  usageStats: boolean;
};

const INITIAL_GATE: Gate = {
  deviceOwner: false,
  postNotifications: false,
  usageStats: false,
};

function allGranted(g: Gate): boolean {
  return g.deviceOwner && g.postNotifications && g.usageStats;
}

async function checkPostNotifications(): Promise<boolean> {
  // POST_NOTIFICATIONS only exists on API 33+. Below that it's implicitly granted.
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
  const [lastAction, setLastAction] = useState<string>('—');
  const [cycleRunning, setCycleRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshGate = useCallback(async () => {
    setError(null);
    try {
      const [deviceOwner, postNotifications, usageStats] = await Promise.all([
        DevicePolicy.isDeviceOwner(),
        checkPostNotifications(),
        UsageStats.hasUsageStatsPermission(),
      ]);
      setGate({ deviceOwner, postNotifications, usageStats });
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

  const setSuspended = useCallback(async (suspended: boolean) => {
    setError(null);
    try {
      const failed = await DevicePolicy.setPackagesSuspended(
        [TARGET_PACKAGE],
        suspended,
      );
      const verb = suspended ? 'Blocked' : 'Unblocked';
      setLastAction(
        failed.length === 0
          ? `${verb} ${TARGET_PACKAGE} (empty failed-list)`
          : `${verb} ${TARGET_PACKAGE} with failures: ${failed.join(', ')}`,
      );
    } catch (e) {
      setError(`setPackagesSuspended failed: ${String(e)}`);
    }
  }, []);

  const startCycle = useCallback(async () => {
    setError(null);
    try {
      await TimerService.startCycle(
        TARGET_PACKAGE,
        CYCLE_USE_MIN,
        CYCLE_FREEZE_MIN,
      );
      setLastAction(
        `startCycle(${TARGET_PACKAGE}, use=${CYCLE_USE_MIN}min, freeze=${CYCLE_FREEZE_MIN}min)`,
      );
    } catch (e) {
      setError(`startCycle failed: ${String(e)}`);
    }
  }, []);

  const stopCycle = useCallback(async () => {
    setError(null);
    try {
      await TimerService.stopCycle(TARGET_PACKAGE);
      setLastAction(`stopCycle(${TARGET_PACKAGE})`);
    } catch (e) {
      setError(`stopCycle failed: ${String(e)}`);
    }
  }, []);

  // Initial gate check.
  useEffect(() => {
    refreshGate();
  }, [refreshGate]);

  // Re-check gate whenever the app comes back to the foreground — Settings
  // deep-links (usage access, notifications) flip state outside of our process.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refreshGate();
      }
    });
    return () => sub.remove();
  }, [refreshGate]);

  // Poll cycle status every second — only once the gate passes.
  useEffect(() => {
    if (!allGranted(gate)) return;
    const tick = async () => {
      try {
        const running = await TimerService.isRunning(TARGET_PACKAGE);
        setCycleRunning(running);
      } catch {
        // swallow — polling errors shouldn't spam the UI
      }
    };
    tick();
    pollRef.current = setInterval(tick, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [gate]);

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
            <View style={styles.card}>
              <Text style={styles.label}>Setup required</Text>
              <Text style={styles.hint}>
                WellGuard needs these before the cycle engine can run.
              </Text>

              <GateRow
                title="Device Owner"
                granted={gate.deviceOwner}
                hint="Run this ADB command once from your Mac, then tap Re-check."
                cta={
                  <>
                    <Text selectable style={styles.code}>
                      {ADB_DO_CMD}
                    </Text>
                    <Pressable style={styles.button} onPress={refreshGate}>
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
                  <Pressable
                    style={styles.button}
                    onPress={handleRequestNotifications}>
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
                    <Pressable
                      style={styles.button}
                      onPress={handleOpenUsageSettings}>
                      <Text style={styles.buttonText}>Open Settings</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.button, styles.secondary]}
                      onPress={refreshGate}>
                      <Text style={styles.buttonText}>Re-check</Text>
                    </Pressable>
                  </>
                }
              />
            </View>
          )}

          {gatePassed && (
            <>
              <View style={styles.card}>
                <Text style={styles.label}>Device Owner</Text>
                <Text style={styles.value}>yes</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.label}>Target package</Text>
                <Text style={styles.value}>{TARGET_PACKAGE}</Text>
                <View style={styles.row}>
                  <Pressable
                    style={[styles.button, styles.block]}
                    onPress={() => setSuspended(true)}>
                    <Text style={styles.buttonText}>Block</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.button, styles.unblock]}
                    onPress={() => setSuspended(false)}>
                    <Text style={styles.buttonText}>Unblock</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.label}>
                  Cycle (use {CYCLE_USE_MIN}min / freeze {CYCLE_FREEZE_MIN}min)
                </Text>
                <Text style={styles.value}>
                  {cycleRunning ? 'running' : 'stopped'}
                </Text>
                <View style={styles.row}>
                  <Pressable
                    style={[styles.button, styles.unblock]}
                    onPress={startCycle}>
                    <Text style={styles.buttonText}>Start</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.button, styles.block]}
                    onPress={stopCycle}>
                    <Text style={styles.buttonText}>Stop</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.label}>Last action</Text>
                <Text style={styles.value}>{lastAction}</Text>
              </View>
            </>
          )}

          {error && (
            <View style={[styles.card, styles.errorCard]}>
              <Text style={styles.label}>Error</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
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
  button: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#2b6ef2',
    alignItems: 'center',
    flex: 1,
  },
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
});

export default App;

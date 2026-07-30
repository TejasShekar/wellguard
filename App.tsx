/**
 * WellGuard — friction-based digital wellbeing. Android, Device Owner enforced.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import DevicePolicy from './src/modules/DevicePolicy';
import TimerService from './src/modules/TimerService';
import UsageStats from './src/modules/UsageStats';
import { GuardsScreen } from './src/screens/GuardsScreen';
import {
  allGranted,
  PermissionsScreen,
  type Gate,
} from './src/screens/PermissionsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ZenScreen } from './src/screens/ZenScreen';
import { spacing, useTheme } from './src/theme';

const DONT_KILL_MY_APP_URL = 'https://dontkillmyapp.com';

const INITIAL_GATE: Gate = {
  deviceOwner: false,
  postNotifications: false,
  usageStats: false,
  batteryOptIgnored: false,
};

async function checkPostNotifications(): Promise<boolean> {
  if (Platform.OS !== 'android' || (Platform.Version as number) < 33) return true;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
}

async function requestPostNotifications(): Promise<boolean> {
  if (Platform.OS !== 'android' || (Platform.Version as number) < 33) return true;
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

type Tab = 'guards' | 'zen' | 'settings';
const TABS: { key: Tab; label: string }[] = [
  { key: 'guards', label: 'Guards' },
  { key: 'zen', label: 'Zen' },
  { key: 'settings', label: 'Settings' },
];

function App() {
  const c = useTheme();
  const [gate, setGate] = useState<Gate>(INITIAL_GATE);
  const [gateLoaded, setGateLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('guards');

  const refreshGate = useCallback(async () => {
    setError(null);
    try {
      const [deviceOwner, postNotifications, usageStats, batteryOptIgnored] = await Promise.all([
        DevicePolicy.isDeviceOwner(),
        checkPostNotifications(),
        UsageStats.hasUsageStatsPermission(),
        TimerService.isIgnoringBatteryOptimizations(),
      ]);
      setGate({ deviceOwner, postNotifications, usageStats, batteryOptIgnored });
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
    Linking.openURL(DONT_KILL_MY_APP_URL).catch(e => setError(`open link failed: ${String(e)}`));
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

  const errorBanner = error ? (
    <Pressable
      onPress={() => setError(null)}
      style={{
        margin: spacing.md,
        padding: spacing.md,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: c.danger,
      }}>
      <Text style={{ color: c.danger, fontFamily: 'Menlo', fontSize: 12 }}>{error}</Text>
    </Pressable>
  ) : null;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={c.scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        {!gateLoaded ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={c.textMuted} />
          </View>
        ) : !gatePassed ? (
          <View style={{ flex: 1 }}>
            <PermissionsScreen
              gate={gate}
              onRefresh={refreshGate}
              onRequestNotifications={handleRequestNotifications}
              onOpenUsageSettings={handleOpenUsageSettings}
              onRequestBatteryOpt={handleRequestBatteryOpt}
              onOpenDontKillMyApp={handleOpenDontKillMyApp}
            />
            {errorBanner}
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <View style={{ flex: 1 }}>
              {tab === 'guards' && <GuardsScreen onError={setError} />}
              {tab === 'zen' && <ZenScreen onError={setError} />}
              {tab === 'settings' && (
                <SettingsScreen
                  onRefresh={refreshGate}
                  onOpenDontKillMyApp={handleOpenDontKillMyApp}
                />
              )}
            </View>
            {errorBanner}
            <TabBar tab={tab} onChange={setTab} />
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const c = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: c.border,
        backgroundColor: c.surface,
      }}>
      {TABS.map(({ key, label }) => {
        const active = key === tab;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 14 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: active ? '700' : '500',
                color: active ? c.text : c.textFaint,
              }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default App;

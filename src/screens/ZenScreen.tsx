import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import DevicePolicy from '../modules/DevicePolicy';
import type { InstalledApp } from '../modules/DevicePolicy';
import Zen from '../modules/Zen';
import {
  clearZenSchedule,
  saveZenSchedule,
  useZenStore,
  type ZenSchedule,
} from '../store/zenStore';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // 0=Sun..6=Sat

function toHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

type Props = { onError: (msg: string | null) => void };

export function ZenScreen({ onError }: Props) {
  const saved = useZenStore(s => s.schedule);

  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [allowed, setAllowed] = useState<Set<string>>(new Set());
  const [startText, setStartText] = useState('23:00');
  const [endText, setEndText] = useState('09:00');
  const [days, setDays] = useState<Set<number>>(new Set());
  const [allowBrowser, setAllowBrowser] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [zenActive, setZenActive] = useState(false);
  const [saving, setSaving] = useState(false);

  // Hydrate the editor from the saved schedule once it is available.
  useEffect(() => {
    if (!saved) return;
    setAllowed(new Set(saved.allowedPackages));
    setStartText(toHHMM(saved.startMinuteOfDay));
    setEndText(toHHMM(saved.endMinuteOfDay));
    setDays(new Set(saved.daysOfWeek));
    setAllowBrowser(saved.allowBrowser);
    setIsActive(saved.isActive);
  }, [saved]);

  // Poll the native active-session flag so the status pill reflects reality.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const active = await Zen.isZenActive();
        if (alive) setZenActive(active);
      } catch {
        // ignore transient errors
      }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const loadApps = useCallback(async () => {
    setLoadingApps(true);
    try {
      const list = await DevicePolicy.getInstalledUserApps();
      list.sort((a, b) => a.appName.localeCompare(b.appName));
      setApps(list);
    } catch (e) {
      onError(`getInstalledUserApps failed: ${String(e)}`);
    } finally {
      setLoadingApps(false);
    }
  }, [onError]);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  const toggleAllowed = useCallback((pkg: string) => {
    setAllowed(prev => {
      const next = new Set(prev);
      if (next.has(pkg)) next.delete(pkg);
      else next.add(pkg);
      return next;
    });
  }, []);

  const toggleDay = useCallback((day: number) => {
    setDays(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }, []);

  const buildSchedule = useCallback((): ZenSchedule | null => {
    const start = parseHHMM(startText);
    const end = parseHHMM(endText);
    if (start === null) {
      onError('Start time must be HH:MM (24h)');
      return null;
    }
    if (end === null) {
      onError('End time must be HH:MM (24h)');
      return null;
    }
    if (allowed.size === 0) {
      onError('Pick at least one allowed app');
      return null;
    }
    return {
      startMinuteOfDay: start,
      endMinuteOfDay: end,
      daysOfWeek: [...days].sort((a, b) => a - b),
      allowedPackages: [...allowed],
      allowBrowser,
      isActive,
    };
  }, [startText, endText, allowed, days, allowBrowser, isActive, onError]);

  const handleSave = useCallback(async () => {
    onError(null);
    const schedule = buildSchedule();
    if (!schedule) return;
    setSaving(true);
    try {
      await saveZenSchedule(schedule);
    } catch (e) {
      onError(`save Zen schedule failed: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  }, [buildSchedule, onError]);

  const handleClear = useCallback(async () => {
    onError(null);
    try {
      await clearZenSchedule();
      setAllowed(new Set());
      setDays(new Set());
      setIsActive(false);
      setAllowBrowser(false);
    } catch (e) {
      onError(`clear Zen schedule failed: ${String(e)}`);
    }
  }, [onError]);

  const handleTestStart = useCallback(async () => {
    onError(null);
    const schedule = buildSchedule();
    if (!schedule) return;
    try {
      // Persist first so the native side has the allowlist, then engage for 1 min.
      await saveZenSchedule(schedule);
      await Zen.startZenNow(1);
    } catch (e) {
      onError(`start Zen now failed: ${String(e)}`);
    }
  }, [buildSchedule, onError]);

  const handleTestEnd = useCallback(async () => {
    onError(null);
    try {
      await Zen.endZenNow();
    } catch (e) {
      onError(`end Zen now failed: ${String(e)}`);
    }
  }, [onError]);

  const allowedCount = allowed.size;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Zen mode</Text>
        <Text
          style={[
            styles.pill,
            zenActive ? styles.pillOn : styles.pillOff,
          ]}>
          {zenActive ? 'active' : 'idle'}
        </Text>
      </View>
      <Text style={styles.hint}>
        During the window, only the apps you allow stay usable — everything else
        is suspended. Great for keeping the phone "basic" in the morning.
      </Text>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Enable schedule</Text>
          <Switch value={isActive} onValueChange={setIsActive} />
        </View>
        <Text style={styles.hint}>
          When on, Zen engages automatically during the window below.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.timeRow}>
          <View style={styles.timeField}>
            <Text style={styles.label}>Start</Text>
            <TextInput
              style={styles.input}
              value={startText}
              onChangeText={setStartText}
              placeholder="23:00"
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={styles.timeField}>
            <Text style={styles.label}>End</Text>
            <TextInput
              style={styles.input}
              value={endText}
              onChangeText={setEndText}
              placeholder="09:00"
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>
        <Text style={styles.hint}>24-hour HH:MM. End before start = crosses midnight.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Days (none = every day)</Text>
        <View style={styles.daysRow}>
          {DAY_LABELS.map((lbl, idx) => {
            const on = days.has(idx);
            return (
              <Pressable
                key={idx}
                onPress={() => toggleDay(idx)}
                style={[styles.dayChip, on && styles.dayChipOn]}>
                <Text style={[styles.dayText, on && styles.dayTextOn]}>{lbl}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.label}>Allow browser</Text>
            <Text style={styles.hint}>Off = the browser is blocked too (recommended).</Text>
          </View>
          <Switch value={allowBrowser} onValueChange={setAllowBrowser} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Allowlist ({allowedCount} selected)</Text>
        <Text style={styles.hint}>
          Pick the apps that stay usable (calls, messages, camera, etc.).
        </Text>
        {loadingApps && <ActivityIndicator style={{ marginVertical: 8 }} />}
        <FlatList
          data={apps}
          scrollEnabled={false}
          keyExtractor={item => item.packageName}
          renderItem={({ item }) => {
            const on = allowed.has(item.packageName);
            return (
              <Pressable
                style={styles.appRow}
                onPress={() => toggleAllowed(item.packageName)}>
                <Text style={[styles.check, on ? styles.checkOn : styles.checkOff]}>
                  {on ? '☑' : '☐'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appName}>{item.appName}</Text>
                  <Text style={styles.appPkg}>{item.packageName}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      </View>

      <Pressable
        style={[styles.button, styles.primary, saving && styles.disabled]}
        onPress={handleSave}
        disabled={saving}>
        {saving ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Save schedule</Text>
        )}
      </Pressable>

      <View style={styles.row}>
        <Pressable style={[styles.button, styles.test]} onPress={handleTestStart}>
          <Text style={styles.buttonText}>Test: start 1 min</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.secondary]} onPress={handleTestEnd}>
          <Text style={styles.buttonText}>End now</Text>
        </Pressable>
      </View>

      <Pressable style={[styles.button, styles.danger]} onPress={handleClear}>
        <Text style={styles.buttonText}>Clear schedule</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '600' },
  hint: { fontSize: 13, color: '#555' },
  card: { backgroundColor: 'white', padding: 14, borderRadius: 10, gap: 8 },
  label: { fontSize: 12, color: '#666', textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeRow: { flexDirection: 'row', gap: 12 },
  timeField: { flex: 1, gap: 6 },
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
  daysRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  dayChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e5e5ea',
  },
  dayChipOn: { backgroundColor: '#2b6ef2' },
  dayText: { fontSize: 14, fontWeight: '600', color: '#555' },
  dayTextOn: { color: 'white' },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  check: { fontSize: 20 },
  checkOn: { color: '#1e8e3e' },
  checkOff: { color: '#aaa' },
  appName: { fontSize: 15, fontWeight: '500' },
  appPkg: { fontSize: 11, color: '#888', fontFamily: 'Menlo' },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  primary: { backgroundColor: '#2b6ef2' },
  secondary: { backgroundColor: '#6b7280' },
  test: { backgroundColor: '#1e8e3e' },
  danger: { backgroundColor: '#d93025' },
  disabled: { opacity: 0.6 },
  buttonText: { color: 'white', fontWeight: '600' },
  pill: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  pillOn: { backgroundColor: '#1e8e3e', color: 'white' },
  pillOff: { backgroundColor: '#e5e5ea', color: '#555' },
});

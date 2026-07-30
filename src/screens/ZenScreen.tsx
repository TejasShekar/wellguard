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
import { radius, spacing, useTheme } from '../theme';
import { Body, Button, Card, Hint, Mono, Pill, Row, RowBetween, SectionLabel, Title } from '../ui';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // 0=Sun..6=Sat

function toHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
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
  const c = useTheme();
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

  useEffect(() => {
    if (!saved) return;
    setAllowed(new Set(saved.allowedPackages));
    setStartText(toHHMM(saved.startMinuteOfDay));
    setEndText(toHHMM(saved.endMinuteOfDay));
    setDays(new Set(saved.daysOfWeek));
    setAllowBrowser(saved.allowBrowser);
    setIsActive(saved.isActive);
  }, [saved]);

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

  const input = {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'Menlo',
    color: c.text,
    backgroundColor: c.surfaceAlt,
  } as const;

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      style={{ backgroundColor: c.bg }}>
      <RowBetween>
        <Title>Zen mode</Title>
        <Pill label={zenActive ? 'active' : 'idle'} on={zenActive} />
      </RowBetween>
      <Hint>
        During the window only the apps you allow stay usable — everything else is suspended.
        Keeps the phone "basic" so mornings don't start on a scroll.
      </Hint>

      <Card>
        <RowBetween>
          <SectionLabel>Enable schedule</SectionLabel>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            trackColor={{ false: c.fillMuted, true: c.fill }}
            thumbColor={c.surface}
          />
        </RowBetween>
        <Hint>When on, Zen engages automatically during the window below.</Hint>
      </Card>

      <Card>
        <Row>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <SectionLabel>Start</SectionLabel>
            <TextInput
              style={input}
              value={startText}
              onChangeText={setStartText}
              placeholder="23:00"
              placeholderTextColor={c.textFaint}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <SectionLabel>End</SectionLabel>
            <TextInput
              style={input}
              value={endText}
              onChangeText={setEndText}
              placeholder="09:00"
              placeholderTextColor={c.textFaint}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </Row>
        <Hint>24-hour HH:MM. End before start = crosses midnight.</Hint>
      </Card>

      <Card>
        <SectionLabel>Days (none = every day)</SectionLabel>
        <Row style={{ flexWrap: 'wrap' }}>
          {DAY_LABELS.map((lbl, idx) => {
            const on = days.has(idx);
            return (
              <Pressable
                key={idx}
                onPress={() => toggleDay(idx)}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: on ? c.fill : c.border,
                  backgroundColor: on ? c.fill : 'transparent',
                }}>
                <Text style={{ fontWeight: '700', color: on ? c.onFill : c.textMuted }}>
                  {lbl}
                </Text>
              </Pressable>
            );
          })}
        </Row>
      </Card>

      <Card>
        <RowBetween>
          <View style={{ flex: 1, paddingRight: spacing.sm }}>
            <SectionLabel>Allow browser</SectionLabel>
            <Hint>Off = the browser is blocked too (recommended).</Hint>
          </View>
          <Switch
            value={allowBrowser}
            onValueChange={setAllowBrowser}
            trackColor={{ false: c.fillMuted, true: c.fill }}
            thumbColor={c.surface}
          />
        </RowBetween>
      </Card>

      <Card>
        <SectionLabel>Allowlist ({allowed.size} selected)</SectionLabel>
        <Hint>Pick the apps that stay usable — calls, messages, camera, etc.</Hint>
        {loadingApps && <ActivityIndicator color={c.textMuted} style={{ marginVertical: spacing.sm }} />}
        <FlatList
          data={apps}
          scrollEnabled={false}
          keyExtractor={item => item.packageName}
          renderItem={({ item }) => {
            const on = allowed.has(item.packageName);
            return (
              <Pressable
                onPress={() => toggleAllowed(item.packageName)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: 10,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: c.border,
                }}>
                <Text style={{ fontSize: 18, color: on ? c.text : c.textFaint }}>
                  {on ? '◉' : '○'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '500' }}>{item.appName}</Body>
                  <Mono>{item.packageName}</Mono>
                </View>
              </Pressable>
            );
          }}
        />
      </Card>

      <Button label="Save schedule" onPress={handleSave} busy={saving} />
      <Row>
        <Button label="Test: start 1 min" variant="ghost" onPress={handleTestStart} />
        <Button label="End now" variant="ghost" onPress={handleTestEnd} />
      </Row>
      <Button label="Clear schedule" variant="danger" onPress={handleClear} />
    </ScrollView>
  );
}

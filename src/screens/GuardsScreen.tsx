import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DevicePolicy from '../modules/DevicePolicy';
import type { InstalledApp } from '../modules/DevicePolicy';
import TimerService from '../modules/TimerService';
import { useAppConfigStore, type AppConfig } from '../store/appConfigStore';
import { radius, spacing, useTheme } from '../theme';
import { Body, Button, Card, Hint, Mono, Pill, Row, RowBetween, SectionLabel, Title } from '../ui';

type Props = { onError: (msg: string | null) => void };

export function GuardsScreen({ onError }: Props) {
  const c = useTheme();
  const configsMap = useAppConfigStore(s => s.configs);
  const remove = useAppConfigStore(s => s.remove);
  const configs = useMemo(
    () => Object.values(configsMap).sort((a, b) => a.appName.localeCompare(b.appName)),
    [configsMap],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [runningMap, setRunningMap] = useState<Record<string, boolean>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const tick = async () => {
      try {
        const entries = await Promise.all(
          configs.map(
            async config =>
              [config.packageName, await TimerService.isRunning(config.packageName)] as const,
          ),
        );
        setRunningMap(Object.fromEntries(entries));
      } catch {
        // polling errors shouldn't spam the UI
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
      if (runningMap[config.packageName]) await stopCycle(config);
      remove(config.packageName);
    },
    [remove, runningMap, stopCycle],
  );

  return (
    <>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        style={{ backgroundColor: c.bg }}>
        <Title>Guards</Title>
        <Hint>
          Each guarded app runs a use → freeze cycle. During freeze it's blocked at the OS
          level and can't be opened.
        </Hint>

        {configs.length === 0 && (
          <Card>
            <SectionLabel>No apps guarded</SectionLabel>
            <Hint>Add an app to set its use and freeze windows.</Hint>
          </Card>
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

        <Button label="+  Add app" onPress={() => setPickerOpen(true)} />
      </ScrollView>

      <AddAppModal
        visible={pickerOpen}
        existingPackages={new Set(configs.map(config => config.packageName))}
        onClose={() => setPickerOpen(false)}
        onError={onError}
      />
    </>
  );
}

function ConfigRow({
  config,
  running,
  onStart,
  onStop,
  onRemove,
}: {
  config: AppConfig;
  running: boolean;
  onStart: () => void;
  onStop: () => void;
  onRemove: () => void;
}) {
  return (
    <Card>
      <RowBetween>
        <View style={{ flex: 1 }}>
          <Body style={{ fontWeight: '600' }}>{config.appName}</Body>
          <Mono>{config.packageName}</Mono>
        </View>
        <Pill label={running ? 'running' : 'stopped'} on={running} />
      </RowBetween>
      <Hint>
        use {config.useWindowMinutes}m · freeze {config.freezeWindowMinutes}m
      </Hint>
      <Row>
        {running ? (
          <Button label="Stop" variant="ghost" onPress={onStop} />
        ) : (
          <Button label="Start" onPress={onStart} />
        )}
        <Button label="Remove" variant="danger" onPress={onRemove} />
      </Row>
    </Card>
  );
}

function AddAppModal({
  visible,
  existingPackages,
  onClose,
  onError,
}: {
  visible: boolean;
  existingPackages: Set<string>;
  onClose: () => void;
  onError: (msg: string | null) => void;
}) {
  const c = useTheme();
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
    if (!Number.isFinite(useNum) || useNum <= 0) return onError('use minutes must be > 0');
    if (!Number.isFinite(freezeNum) || freezeNum <= 0) return onError('freeze minutes must be > 0');
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
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: spacing.lg,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: c.border,
          }}>
          <Title>{picked ? 'Configure cycle' : 'Pick an app'}</Title>
          <Pressable onPress={handleClose} hitSlop={8}>
            <Text style={{ color: c.textMuted, fontSize: 15 }}>Cancel</Text>
          </Pressable>
        </View>

        {!picked && (
          <>
            {loading && (
              <View style={{ padding: spacing.lg }}>
                <Hint>loading apps…</Hint>
              </View>
            )}
            {!loading && pickable.length === 0 && (
              <View style={{ padding: spacing.lg }}>
                <Hint>All launchable apps are already guarded.</Hint>
              </View>
            )}
            <FlatList
              data={pickable}
              keyExtractor={item => item.packageName}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setPicked(item)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    padding: spacing.lg,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: c.border,
                  }}>
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontWeight: '500' }}>{item.appName}</Body>
                    <Mono>{item.packageName}</Mono>
                  </View>
                  {item.isSystem && <SectionLabel>system</SectionLabel>}
                </Pressable>
              )}
            />
          </>
        )}

        {picked && (
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
            <Card>
              <Body style={{ fontWeight: '600' }}>{picked.appName}</Body>
              <Mono>{picked.packageName}</Mono>
            </Card>
            <Card>
              <SectionLabel>Use window (minutes)</SectionLabel>
              <TextInput
                style={input}
                value={useMin}
                onChangeText={setUseMin}
                keyboardType="decimal-pad"
                placeholder="10"
                placeholderTextColor={c.textFaint}
              />
              <Hint>How long the app stays usable each cycle. Decimals OK (0.333 ≈ 20s).</Hint>
            </Card>
            <Card>
              <SectionLabel>Freeze window (minutes)</SectionLabel>
              <TextInput
                style={input}
                value={freezeMin}
                onChangeText={setFreezeMin}
                keyboardType="decimal-pad"
                placeholder="60"
                placeholderTextColor={c.textFaint}
              />
              <Hint>How long the app is blocked between use windows.</Hint>
            </Card>
            <Row>
              <Button label="Back" variant="ghost" onPress={() => setPicked(null)} />
              <Button label="Save" onPress={handleSave} />
            </Row>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

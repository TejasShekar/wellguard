import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { radius, spacing, useTheme } from '../theme';
import { Body, Button, Card, Hint, Row, Title } from '../ui';

export type Gate = {
  deviceOwner: boolean;
  postNotifications: boolean;
  usageStats: boolean;
  batteryOptIgnored: boolean;
};

export const ADB_DO_CMD =
  'adb shell dpm set-device-owner com.wellguard/.receivers.DeviceAdminReceiver';

const DO_PREREQS = [
  'No Google accounts signed in (Settings → Passwords & accounts)',
  'No work profile (employer MDM)',
  'No guest user, private space, or cloned app profile',
];

type Props = {
  gate: Gate;
  onRefresh: () => void;
  onRequestNotifications: () => void;
  onOpenUsageSettings: () => void;
  onRequestBatteryOpt: () => void;
  onOpenDontKillMyApp: () => void;
};

export function PermissionsScreen({
  gate,
  onRefresh,
  onRequestNotifications,
  onOpenUsageSettings,
  onRequestBatteryOpt,
  onOpenDontKillMyApp,
}: Props) {
  const c = useTheme();
  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      style={{ backgroundColor: c.bg }}>
      <Title>Setup</Title>
      <Hint>WellGuard needs these before enforcement can run.</Hint>

      <Card>
        <GateRow
          granted={gate.deviceOwner}
          title="Device Owner"
          hint="Run the ADB command below once from your computer. It will fail if any of these exist — remove them first:">
          <View style={{ gap: 2, marginBottom: spacing.xs }}>
            {DO_PREREQS.map(item => (
              <Hint key={item}>• {item}</Hint>
            ))}
          </View>
          <Text
            selectable
            style={{
              fontFamily: 'Menlo',
              fontSize: 12,
              color: c.text,
              padding: spacing.md,
              backgroundColor: c.surfaceAlt,
              borderRadius: radius.sm,
            }}>
            {ADB_DO_CMD}
          </Text>
          <Button label="Re-check" variant="ghost" onPress={onRefresh} />
        </GateRow>
      </Card>

      <Card>
        <GateRow
          granted={gate.postNotifications}
          title="Notifications"
          hint="For the cycle foreground notification + pre-freeze warnings.">
          <Button label="Grant" onPress={onRequestNotifications} />
        </GateRow>
      </Card>

      <Card>
        <GateRow
          granted={gate.usageStats}
          title="Usage Access"
          hint="Reads per-app foreground time (used by insights later).">
          <Row>
            <Button label="Open Settings" onPress={onOpenUsageSettings} />
            <Button label="Re-check" variant="ghost" onPress={onRefresh} />
          </Row>
        </GateRow>
      </Card>

      <Card>
        <GateRow
          granted={gate.batteryOptIgnored}
          title="Battery Optimization"
          hint="Unrestricted power keeps enforcement alive through Doze. Aggressive OEMs (OnePlus, Xiaomi, Samsung) need extra per-device steps.">
          <Row>
            <Button label="Whitelist" onPress={onRequestBatteryOpt} />
            <Button label="OEM steps" variant="ghost" onPress={onOpenDontKillMyApp} />
          </Row>
          <Button label="Re-check" variant="ghost" onPress={onRefresh} />
        </GateRow>
      </Card>
    </ScrollView>
  );
}

function GateRow({
  granted,
  title,
  hint,
  children,
}: {
  granted: boolean;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  const c = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: granted ? c.text : c.textFaint }}>
          {granted ? '✓' : '○'}
        </Text>
        <Body style={{ fontWeight: '600' }}>{title}</Body>
      </View>
      {!granted && (
        <>
          <Hint>{hint}</Hint>
          {children}
        </>
      )}
    </View>
  );
}

export function allGranted(g: Gate): boolean {
  return g.deviceOwner && g.postNotifications && g.usageStats && g.batteryOptIgnored;
}

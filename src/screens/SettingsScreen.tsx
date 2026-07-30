import { ScrollView } from 'react-native';

import { spacing, useTheme } from '../theme';
import { Body, Button, Card, Hint, Mono, SectionLabel, Title } from '../ui';
import { ADB_DO_CMD } from './PermissionsScreen';

type Props = {
  onRefresh: () => void;
  onOpenDontKillMyApp: () => void;
};

export function SettingsScreen({ onRefresh, onOpenDontKillMyApp }: Props) {
  const c = useTheme();
  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      style={{ backgroundColor: c.bg }}>
      <Title>Settings</Title>

      <Card>
        <SectionLabel>Permissions</SectionLabel>
        <Hint>
          If enforcement stops working, re-check that Device Owner, notifications, usage
          access and battery optimization are all still granted.
        </Hint>
        <Button label="Re-check permissions" variant="ghost" onPress={onRefresh} />
      </Card>

      <Card>
        <SectionLabel>Keeping it alive</SectionLabel>
        <Hint>
          Aggressive OEMs kill background services. If cycles or Zen stop firing, follow the
          per-device steps to fully whitelist WellGuard.
        </Hint>
        <Button label="Open dontkillmyapp.com" variant="ghost" onPress={onOpenDontKillMyApp} />
      </Card>

      <Card>
        <SectionLabel>Device Owner command</SectionLabel>
        <Hint>For reference — run once from a computer over ADB:</Hint>
        <Mono>{ADB_DO_CMD}</Mono>
      </Card>

      <Card>
        <SectionLabel>About</SectionLabel>
        <Body style={{ fontWeight: '600' }}>WellGuard</Body>
        <Hint>
          A friction-based digital wellbeing tool. Blocks apps at the OS level so the wall
          can't be walked around — not even by uninstalling. Open source, GPL-3.0.
        </Hint>
        <Mono>alpha</Mono>
      </Card>
    </ScrollView>
  );
}

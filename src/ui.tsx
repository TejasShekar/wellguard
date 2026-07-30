import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { radius, spacing, type as typeScale, useTheme } from './theme';

const hair = StyleSheet.hairlineWidth;

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          borderWidth: hair,
          borderRadius: radius.md,
          padding: spacing.lg,
          gap: spacing.sm,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  const c = useTheme();
  return (
    <Text
      style={{
        fontSize: typeScale.label,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: c.textFaint,
        fontWeight: '600',
      }}>
      {children}
    </Text>
  );
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useTheme();
  return (
    <Text style={[{ fontSize: typeScale.title, fontWeight: '700', color: c.text }, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useTheme();
  return (
    <Text style={[{ fontSize: typeScale.body, color: c.text }, style]}>{children}</Text>
  );
}

export function Hint({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useTheme();
  return (
    <Text style={[{ fontSize: 13, color: c.textMuted, lineHeight: 19 }, style]}>{children}</Text>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  const c = useTheme();
  return (
    <Text style={{ fontFamily: 'Menlo', fontSize: typeScale.mono, color: c.textMuted }}>
      {children}
    </Text>
  );
}

type ButtonVariant = 'primary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const bg = variant === 'primary' ? c.fill : 'transparent';
  const fg =
    variant === 'primary' ? c.onFill : variant === 'danger' ? c.danger : c.text;
  const border = variant === 'primary' ? c.fill : variant === 'danger' ? c.danger : c.border;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        {
          flex: 1,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: 12,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.sm,
          backgroundColor: bg,
          borderWidth: hair,
          borderColor: border,
          opacity: disabled || busy ? 0.5 : pressed ? 0.7 : 1,
        },
        style,
      ]}>
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontWeight: '600', fontSize: typeScale.body }}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Pill({ label, on }: { label: string; on: boolean }) {
  const c = useTheme();
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        overflow: 'hidden',
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 3,
        color: on ? c.onFill : c.textMuted,
        backgroundColor: on ? c.fill : c.fillMuted,
      }}>
      {label}
    </Text>
  );
}

export function Row({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ flexDirection: 'row', gap: spacing.sm }, style]}>{children}</View>;
}

export function RowBetween({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
      }}>
      {children}
    </View>
  );
}

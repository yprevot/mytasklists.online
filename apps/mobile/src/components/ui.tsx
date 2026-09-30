import React, { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, radius, shadow, spacing } from '../theme';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  testID,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'dark';
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  style?: ViewStyle;
}) {
  const palette = {
    primary: { bg: colors.brand, fg: '#fff', border: colors.brand },
    ghost: { bg: colors.surface, fg: colors.ink, border: colors.lineStrong },
    danger: { bg: colors.surface, fg: colors.danger, border: colors.dangerLine },
    dark: { bg: colors.ink, fg: '#fff', border: colors.ink },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        pressed && variant === 'primary' && { backgroundColor: colors.brandDark },
        pressed && variant !== 'primary' && { backgroundColor: colors.chip },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[styles.buttonText, { color: palette.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  testID,
  ...props
}: TextInputProps & { label: string; error?: string; testID?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          focused && styles.inputFocused,
          error ? { borderColor: colors.danger } : null,
        ]}
        {...props}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
      />
      {error ? (
        <Text style={styles.error} testID={testID ? `${testID}-error` : undefined}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Etiqueta pequena: el amarillo es para lo recurrente, el rojo para lo vencido */
export function Badge({
  text,
  tone = 'info',
  testID,
}: {
  text: string;
  tone?: 'info' | 'danger' | 'success' | 'muted';
  testID?: string;
}) {
  const palette = {
    info: { bg: colors.accent, fg: colors.ink },
    danger: { bg: colors.danger, fg: '#fff' },
    success: { bg: colors.brandSoft, fg: colors.brandDark },
    muted: { bg: colors.chip, fg: colors.inkSoft },
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]} testID={testID}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{text}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

/** Palomita dibujada con bordes: sin fuentes de iconos ni imagenes */
export function CheckGlyph({ size = 14, color = '#fff' }: { size?: number; color?: string }) {
  const thickness = Math.max(2, Math.round(size * 0.17));
  return (
    <View
      style={{
        width: size * 0.36,
        height: size * 0.62,
        borderRightWidth: thickness,
        borderBottomWidth: thickness,
        borderColor: color,
        borderRadius: 1,
        transform: [{ rotate: '45deg' }, { translateY: -size * 0.07 }],
      }}
    />
  );
}

export function CrossGlyph({ size = 14, color = colors.muted }: { size?: number; color?: string }) {
  const bar = { position: 'absolute' as const, width: size, height: 2, borderRadius: 1, backgroundColor: color };
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[bar, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[bar, { transform: [{ rotate: '-45deg' }] }]} />
    </View>
  );
}

export function PlusGlyph({ size = 22, color = '#fff' }: { size?: number; color?: string }) {
  const bar = { position: 'absolute' as const, backgroundColor: color, borderRadius: 1 };
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[bar, { width: size, height: 2.5 }]} />
      <View style={[bar, { width: 2.5, height: size }]} />
    </View>
  );
}

/** Marca: palomita sobre fondo pino y la pastilla amarilla de lo recurrente */
export function BrandMark({ size = 44 }: { size?: number }) {
  const dot = size * 0.3;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: colors.brand,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessible={false}
    >
      <CheckGlyph size={size * 0.46} />
      <View
        style={{
          position: 'absolute',
          top: size * 0.06,
          right: size * 0.06,
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: colors.accent,
          borderWidth: size * 0.05,
          borderColor: colors.brand,
        }}
      />
    </View>
  );
}

/** Cuadro de la lista: emoji elegido por la persona sobre un fondo teñido con su color */
export function ListTile({ icon, color, size = 44 }: { icon: string; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: `${color}24`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.5 }}>{icon}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontWeight: '700', fontSize: 16, letterSpacing: -0.1 },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink, marginBottom: 6 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  inputFocused: { borderColor: colors.brand, borderWidth: 2, paddingHorizontal: spacing.md - 1 },
  error: { color: colors.danger, fontSize: 13, marginTop: 4 },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 11.5, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    ...shadow.card,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkSoft,
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
    marginLeft: 2,
  },
});

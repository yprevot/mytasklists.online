import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme';

export interface ToastPayload {
  id: string;
  title: string;
  body: string;
  tone?: 'info' | 'success' | 'warning';
}

/**
 * Aviso emergente dentro de la app cuando llega un cambio en tiempo real y la
 * app esta en primer plano (en segundo plano llega como notificacion push).
 */
export function InAppToast({ toast, onHide }: { toast: ToastPayload | null; onHide: () => void }) {
  const translateY = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    if (!toast) return;
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
    const timer = setTimeout(() => {
      Animated.timing(translateY, {
        toValue: -120,
        duration: 220,
        useNativeDriver: true,
      }).start(onHide);
    }, 4200);
    return () => clearTimeout(timer);
  }, [toast, translateY, onHide]);

  if (!toast) return null;

  const accent =
    toast.tone === 'warning' ? colors.warning : toast.tone === 'success' ? colors.success : colors.brand;

  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY }] }]} testID="in-app-toast">
      <View style={styles.card}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title} testID="toast-title">
            {toast.title}
          </Text>
          <Text style={styles.body} testID="toast-body">
            {toast.body}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.lg,
    zIndex: 100,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    ...shadow.pop,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  title: { fontWeight: '700', fontSize: 15, color: colors.ink, marginBottom: 2 },
  body: { color: colors.inkSoft, fontSize: 14 },
});

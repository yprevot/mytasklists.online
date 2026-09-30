import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

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
      <View style={[styles.card, { borderLeftColor: accent }]}>
        <Text style={styles.title} testID="toast-title">
          {toast.title}
        </Text>
        <Text style={styles.body} testID="toast-body">
          {toast.body}
        </Text>
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
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 5,
    padding: spacing.md,
    shadowColor: '#0b1220',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  title: { fontWeight: '800', color: colors.ink, marginBottom: 2 },
  body: { color: colors.inkSoft, fontSize: 13 },
});

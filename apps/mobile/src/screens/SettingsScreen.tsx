import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '../components/ui';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useAuth } from '../context/AuthContext';
import { usePush } from '../context/PushContext';
import { useSocket } from '../context/SocketContext';
import { authApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { colors, spacing } from '../theme';

export function SettingsScreen() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const { pushToken, permission } = usePush();
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  const { t } = useTranslation();

  if (!user) return null;

  const resendVerification = async () => {
    try {
      await authApi.resendVerification();
      setVerifyNotice(t('settings.resent'));
    } catch (err) {
      setVerifyNotice(err instanceof ApiError ? err.message : t('settings.resendFailed'));
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg }}
      testID="settings-screen"
    >
      <Card>
        <Text style={styles.name}>{user.fullName}</Text>
        <Text style={styles.meta}>{user.email}</Text>
        <Text style={styles.meta}>{user.whatsapp ?? t('settings.noWhatsapp')}</Text>

        <View style={styles.divider} />

        <Row label={t('settings.signupMethod')} value={t(`settings.providers.${user.provider}`)} />
        <Row
          label={t('settings.email')}
          value={user.emailVerified ? t('settings.confirmed') : t('settings.unconfirmed')}
        />
        <Row label={t('settings.mfa')} value={user.mfaEnabled ? t('settings.on') : t('settings.off')} />
        <Row label={t('settings.live')} value={connected ? t('settings.on') : t('settings.offline')} />
        <Row
          label={t('settings.push')}
          value={
            permission === 'granted'
              ? pushToken
                ? t('settings.pushRegistered')
                : t('settings.pushGranted')
              : permission === 'denied'
                ? t('settings.pushDenied')
                : t('settings.pushUndetermined')
          }
        />
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <View style={styles.languageRow} testID="language-card">
          <Text style={styles.rowLabel}>{t('settings.language')}</Text>
          <LanguageSwitcher />
        </View>
        <Text style={[styles.meta, { marginTop: spacing.sm }]}>{t('settings.languageHint')}</Text>
      </Card>

      {!user.emailVerified ? (
        <Card style={{ marginTop: spacing.lg }}>
          <Text style={styles.meta}>
            {t('settings.verifyHint')}
          </Text>
          {verifyNotice ? (
            <Text style={[styles.meta, { marginTop: spacing.sm }]} testID="verify-notice">
              {verifyNotice}
            </Text>
          ) : null}
          <Button
            title={t('settings.resend')}
            variant="ghost"
            onPress={resendVerification}
            testID="verify-resend"
            style={{ marginTop: spacing.md }}
          />
        </Card>
      ) : null}

      <Button
        title={t('settings.logout')}
        variant="danger"
        onPress={logout}
        testID="logout-button"
        style={{ marginTop: spacing.xl }}
      />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 18, fontWeight: '800', color: colors.ink },
  meta: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  languageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { color: colors.inkSoft, fontSize: 13 },
  rowValue: { color: colors.ink, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
});

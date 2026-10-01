import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { SocialHelpScreen } from '../screens/SocialHelpScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { ListsScreen } from '../screens/ListsScreen';
import { ListDetailScreen } from '../screens/ListDetailScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { DeleteAccountScreen } from '../screens/DeleteAccountScreen';
import { colors } from '../theme';

const initials = (name: string): string =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}
        testID="boot-loading"
      >
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
          headerTintColor: colors.brand,
          headerTitleStyle: { fontWeight: '800', color: colors.ink },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        {user ? (
          <>
            <Stack.Screen
              name="Lists"
              component={ListsScreen}
              options={({ navigation }) => ({
                title: t('nav.lists'),
                headerRight: () => (
                  <Pressable
                    onPress={() => navigation.navigate('Settings')}
                    testID="open-settings"
                    accessibilityLabel={t('nav.account')}
                    hitSlop={12}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: colors.brand,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>
                      {initials(user.fullName)}
                    </Text>
                  </Pressable>
                ),
              })}
            />
            <Stack.Screen
              name="ListDetail"
              component={ListDetailScreen}
              options={({ route }: any) => ({ title: route.params?.name ?? t('nav.list') })}
            />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t('nav.account') }} />
            <Stack.Screen
              name="DeleteAccount"
              component={DeleteAccountScreen}
              options={{ title: t('deleteAccount.title') }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ title: t('nav.register') }}
            />
            <Stack.Screen
              name="SocialHelp"
              component={SocialHelpScreen}
              options={{ title: t('nav.signIn') }}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{ title: t('nav.forgot') }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

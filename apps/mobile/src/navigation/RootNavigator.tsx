import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { SocialHelpScreen } from '../screens/SocialHelpScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { ListsScreen } from '../screens/ListsScreen';
import { ListDetailScreen } from '../screens/ListDetailScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { user, loading } = useAuth();

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
          headerStyle: { backgroundColor: colors.brand },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '800' },
        }}
      >
        {user ? (
          <>
            <Stack.Screen
              name="Lists"
              component={ListsScreen}
              options={({ navigation }) => ({
                title: 'Mis listas',
                headerRight: () => (
                  <Pressable
                    onPress={() => navigation.navigate('Settings')}
                    testID="open-settings"
                    hitSlop={12}
                  >
                    <Text style={{ color: '#fff', fontSize: 18 }}>⚙︎</Text>
                  </Pressable>
                ),
              })}
            />
            <Stack.Screen
              name="ListDetail"
              component={ListDetailScreen}
              options={({ route }: any) => ({ title: route.params?.name ?? 'Lista' })}
            />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Mi cuenta' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ title: 'Crear cuenta' }}
            />
            <Stack.Screen
              name="SocialHelp"
              component={SocialHelpScreen}
              options={{ title: 'Iniciar sesion' }}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{ title: 'Recuperar contrasena' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

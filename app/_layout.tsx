// Must be imported before anything else touches Firestore: the module calls
// initializeFirestore to pin offline persistence on, and that call is only
// legal before the first Firestore interaction.
import '../src/firebase';

import React, { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '../src/auth';
import { colors } from '../src/theme';
import { Loading } from '../src/components/ui';

/**
 * RTL is enforced natively by the expo-localization config plugin
 * (`forcesRTL: true` in app.json), which is what makes React Native flip row
 * layouts and start/end spacing for the whole app.
 *
 * This call is the belt to that plugin's braces: the plugin sets the flag at
 * build time, and this keeps it true if a fresh install ever starts up with the
 * default LTR direction before the native flag is read. It cannot take effect
 * mid-session — RTL is applied at layout-engine start-up — so it is not a
 * runtime toggle, just a guarantee for the next launch.
 */
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

const screenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.primary,
  headerTitleStyle: { color: colors.text, fontWeight: '700' as const },
  headerBackTitle: '',
  contentStyle: { backgroundColor: colors.bg },
};

/**
 * Auth gate.
 *
 * Redirects live here rather than in each screen so there is exactly one place
 * that decides whether the signed-out user can see app content.
 */
function RootNavigator() {
  const { user, initializing } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;

    const inAppGroup = segments[0] === '(app)';

    if (!user && inAppGroup) {
      router.replace('/sign-in');
    } else if (user && !inAppGroup) {
      router.replace('/(app)');
    }
  }, [user, initializing, segments, router]);

  // Holding the splash until auth resolves avoids flashing the sign-in screen
  // at a user who is already signed in — persisted sessions resolve async.
  if (initializing) return <Loading />;

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export const unstable_settings = {
  initialRouteName: 'sign-in',
};

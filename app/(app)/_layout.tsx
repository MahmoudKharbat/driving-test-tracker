import React from 'react';
import { Stack } from 'expo-router';

import { useAuth } from '../../src/backend/auth';
import { colors } from '../../src/theme';
import { strings } from '../../src/strings';
import { Loading } from '../../src/components/ui';

export default function AppLayout() {
  const { user } = useAuth();

  // The redirect in app/_layout runs in an effect, so on sign-out this subtree
  // would otherwise render one more frame with no user — and every screen below
  // calls useUid(), which throws in that state. Holding here until the redirect
  // lands keeps the screens free of null-user handling they should never need.
  if (!user) return <Loading />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      {/* The summary draws its own header: title, search and the overflow
          menu, laid out for RTL in the screen itself. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="new-test"
        options={{ title: strings.newTest.title, presentation: 'modal' }}
      />
      <Stack.Screen
        name="add"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen
        name="import"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen
        name="teacher/[id]"
        options={{ title: strings.nav.teacherDetail }}
      />
    </Stack>
  );
}

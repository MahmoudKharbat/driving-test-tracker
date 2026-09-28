import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authErrorMessage, useAuth } from '../src/auth';
import { strings } from '../src/strings';
import { colors, spacing } from '../src/theme';
import { AppText, Button, Field, TextField } from '../src/components/ui';

type Mode = 'signIn' | 'signUp';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    const e = strings.auth.errors;

    if (!email.trim()) next.email = e.emailRequired;
    else if (!EMAIL_PATTERN.test(email.trim())) next.email = e.emailInvalid;

    if (!password) next.password = e.passwordRequired;
    else if (password.length < 6) next.password = e.passwordTooShort;

    if (mode === 'signUp' && !name.trim()) next.name = e.nameRequired;

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    setFormError(null);
    if (!validate()) return;

    setBusy(true);
    try {
      if (mode === 'signIn') await signIn(email, password);
      else await signUp(email, password, name);
      // On success the auth listener flips the gate in app/_layout and
      // navigates; nothing to do here.
    } catch (err) {
      setFormError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.head}>
            <AppText size="xxl" weight="bold" align="center">
              {strings.auth.title}
            </AppText>
            <AppText size="sm" color={colors.textMuted} align="center">
              {strings.auth.subtitle}
            </AppText>
          </View>

          <View style={styles.form}>
            {mode === 'signUp' ? (
              <Field label={strings.auth.name} error={errors.name}>
                <TextField
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  invalid={Boolean(errors.name)}
                />
              </Field>
            ) : null}

            <Field label={strings.auth.email} error={errors.email}>
              <TextField
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                invalid={Boolean(errors.email)}
              />
            </Field>

            <Field label={strings.auth.password} error={errors.password}>
              <TextField
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                onSubmitEditing={submit}
                invalid={Boolean(errors.password)}
              />
            </Field>

            {formError ? (
              <View style={styles.formError}>
                <AppText size="sm" color={colors.fail} align="center">
                  {formError}
                </AppText>
              </View>
            ) : null}

            <Button
              label={mode === 'signIn' ? strings.auth.signIn : strings.auth.signUp}
              onPress={submit}
              loading={busy}
            />

            <Button
              label={
                mode === 'signIn'
                  ? strings.auth.toggleToSignUp
                  : strings.auth.toggleToSignIn
              }
              variant="ghost"
              onPress={() => {
                setMode(mode === 'signIn' ? 'signUp' : 'signIn');
                setErrors({});
                setFormError(null);
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xxl,
  },
  head: { gap: spacing.sm },
  form: { gap: spacing.lg },
  formError: {
    backgroundColor: colors.failFaint,
    borderRadius: 12,
    padding: spacing.md,
  },
});

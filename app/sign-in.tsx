import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authErrorMessage, useAuth } from '../src/backend/auth';
import { strings } from '../src/strings';
import { colors, radius, spacing } from '../src/theme';
import { AppText, Button, Field, TextField } from '../src/components/ui';
import { EyeIcon, EyeOffIcon, WheelIcon } from '../src/components/icons';

type Mode = 'signIn' | 'signUp';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The form sits at the bottom of the screen, under the app's mark, rather than
 * floating mid-screen — it is where the thumb is, and the keyboard pushes it up
 * rather than covering it.
 */
export default function SignInScreen() {
  const { signIn, signUp, resetPassword } = useAuth();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const e = strings.auth.errors;

  const validate = (): boolean => {
    const next: Record<string, string> = {};

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

  /** The reset link goes to the typed address, so the email field is the only
   *  input needed — no separate screen. */
  const forgotPassword = async () => {
    setFormError(null);
    const address = email.trim();
    if (!EMAIL_PATTERN.test(address)) {
      setErrors({ email: address ? e.emailInvalid : e.emailForReset });
      return;
    }
    setErrors({});
    try {
      await resetPassword(address);
      Alert.alert(strings.auth.resetSentTitle, strings.auth.resetSentBody(address));
    } catch (err) {
      setFormError(authErrorMessage(err));
    }
  };

  const toggleMode = () => {
    setMode(mode === 'signIn' ? 'signUp' : 'signIn');
    setErrors({});
    setFormError(null);
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
            <View style={styles.mark}>
              <WheelIcon size={22} color={colors.primary} />
            </View>
            <AppText size="xxl" weight="bold" style={styles.title}>
              {strings.auth.title}
            </AppText>
            <AppText size="md" color={colors.textMuted}>
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
                  autoComplete="name"
                  invalid={Boolean(errors.name)}
                />
              </Field>
            ) : null}

            <Field label={strings.auth.email} error={errors.email}>
              <TextField
                value={email}
                onChangeText={setEmail}
                placeholder={strings.auth.emailPlaceholder}
                keyboardType="email-address"
                autoComplete="email"
                invalid={Boolean(errors.email)}
              />
            </Field>

            <Field label={strings.auth.password} error={errors.password}>
              <View>
                <TextField
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  onSubmitEditing={submit}
                  invalid={Boolean(errors.password)}
                  style={styles.passwordInput}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? strings.auth.hidePassword : strings.auth.showPassword
                  }
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eye}
                  hitSlop={4}
                >
                  {showPassword ? (
                    <EyeOffIcon size={20} color={colors.textMuted} />
                  ) : (
                    <EyeIcon size={20} color={colors.textMuted} />
                  )}
                </Pressable>
              </View>
            </Field>

            {mode === 'signIn' ? (
              <Pressable
                accessibilityRole="link"
                onPress={forgotPassword}
                hitSlop={8}
                style={styles.forgot}
              >
                <AppText size="sm" weight="medium" color={colors.primary}>
                  {strings.auth.forgotPassword}
                </AppText>
              </Pressable>
            ) : null}

            {formError ? (
              <View style={styles.formError}>
                <AppText size="sm" color={colors.fail} align="center">
                  {formError}
                </AppText>
              </View>
            ) : null}
          </View>

          <View style={styles.actions}>
            <Button
              label={mode === 'signIn' ? strings.auth.signIn : strings.auth.signUp}
              onPress={submit}
              loading={busy}
            />
            <Pressable
              accessibilityRole="button"
              onPress={toggleMode}
              hitSlop={8}
              style={styles.toggle}
            >
              <AppText size="sm" color={colors.textMuted} align="center">
                {`${mode === 'signIn' ? strings.auth.noAccount : strings.auth.haveAccount} `}
              </AppText>
              <AppText size="sm" weight="bold" color={colors.primary} align="center">
                {mode === 'signIn' ? strings.auth.signUp : strings.auth.signIn}
              </AppText>
            </Pressable>
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
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  head: { gap: spacing.sm },
  mark: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { marginTop: spacing.sm },
  form: { gap: spacing.md },
  // Room for the eye button at the field's end edge.
  passwordInput: { paddingEnd: 48 },
  eye: {
    position: 'absolute',
    end: 4,
    top: 6,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgot: { alignSelf: 'flex-start' },
  formError: {
    backgroundColor: colors.failFaint,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  actions: { gap: spacing.md },
  toggle: { flexDirection: 'row', justifyContent: 'center' },
});

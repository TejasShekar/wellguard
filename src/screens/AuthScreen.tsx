import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signIn, signUp } from '../services/auth';

const DEV_EMAIL_PREFILL = 'test@wellguard.com';
const DEV_PW_PREFILL = 'test@123';

type Mode = 'signIn' | 'signUp';

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState(DEV_EMAIL_PREFILL);
  const [password, setPassword] = useState(DEV_PW_PREFILL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signIn') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [mode, email, password]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <Text style={styles.title}>WellGuard</Text>
          <Text style={styles.subtitle}>
            {mode === 'signIn' ? 'Sign in' : 'Create an account'}
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              editable={!busy}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!busy}
            />

            <Pressable
              style={[styles.button, busy && styles.buttonDisabled]}
              onPress={submit}
              disabled={busy}>
              {busy ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>
                  {mode === 'signIn' ? 'Sign in' : 'Sign up'}
                </Text>
              )}
            </Pressable>

            {error && <Text style={styles.error}>{error}</Text>}
          </View>

          <Pressable
            onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
            disabled={busy}>
            <Text style={styles.switchLink}>
              {mode === 'signIn'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  content: { flex: 1, padding: 20, gap: 12, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    color: '#555',
    marginBottom: 12,
  },
  card: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  label: { fontSize: 12, color: '#666', textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  button: {
    backgroundColor: '#2b6ef2',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 16 },
  error: { color: '#8a1e1e', fontSize: 13, marginTop: 4 },
  switchLink: {
    color: '#2b6ef2',
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 8,
  },
});

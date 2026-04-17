/**
 * WellGuard — scratch validation harness for Milestone 1A-part-2.
 * Real UI lands in Milestone 1E and will replace this file.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import DevicePolicy from './src/modules/DevicePolicy';

const TARGET_PACKAGE = 'com.android.chrome';

type DeviceOwnerStatus = 'unknown' | 'yes' | 'no';

function App() {
  const [ownerStatus, setOwnerStatus] = useState<DeviceOwnerStatus>('unknown');
  const [lastAction, setLastAction] = useState<string>('—');
  const [error, setError] = useState<string | null>(null);

  const checkDeviceOwner = useCallback(async () => {
    setError(null);
    try {
      const isOwner = await DevicePolicy.isDeviceOwner();
      setOwnerStatus(isOwner ? 'yes' : 'no');
    } catch (e) {
      setError(`isDeviceOwner failed: ${String(e)}`);
    }
  }, []);

  const setSuspended = useCallback(async (suspended: boolean) => {
    setError(null);
    try {
      const failed = await DevicePolicy.setPackagesSuspended(
        [TARGET_PACKAGE],
        suspended,
      );
      const verb = suspended ? 'Blocked' : 'Unblocked';
      setLastAction(
        failed.length === 0
          ? `${verb} ${TARGET_PACKAGE} (empty failed-list)`
          : `${verb} ${TARGET_PACKAGE} with failures: ${failed.join(', ')}`,
      );
    } catch (e) {
      setError(`setPackagesSuspended failed: ${String(e)}`);
    }
  }, []);

  useEffect(() => {
    checkDeviceOwner();
  }, [checkDeviceOwner]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>WellGuard · 1A-part-2 harness</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Device Owner</Text>
            <Text style={styles.value}>{ownerStatus}</Text>
            <Pressable
              style={styles.button}
              onPress={checkDeviceOwner}>
              <Text style={styles.buttonText}>Re-check</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Target package</Text>
            <Text style={styles.value}>{TARGET_PACKAGE}</Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.button, styles.block]}
                onPress={() => setSuspended(true)}>
                <Text style={styles.buttonText}>Block</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.unblock]}
                onPress={() => setSuspended(false)}>
                <Text style={styles.buttonText}>Unblock</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Last action</Text>
            <Text style={styles.value}>{lastAction}</Text>
          </View>

          {error && (
            <View style={[styles.card, styles.errorCard]}>
              <Text style={styles.label}>Error</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  card: {
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 10,
    gap: 6,
  },
  label: { fontSize: 12, color: '#666', textTransform: 'uppercase' },
  value: { fontSize: 16, fontFamily: 'Menlo' },
  row: { flexDirection: 'row', gap: 8, marginTop: 4 },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#2b6ef2',
    alignItems: 'center',
    flex: 1,
  },
  block: { backgroundColor: '#d93025' },
  unblock: { backgroundColor: '#1e8e3e' },
  buttonText: { color: 'white', fontWeight: '600' },
  errorCard: { backgroundColor: '#fde7e7' },
  errorText: { color: '#8a1e1e', fontFamily: 'Menlo' },
});

export default App;

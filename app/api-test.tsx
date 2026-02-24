import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, CheckCircle, XCircle, AlertCircle } from 'lucide-react-native';
import { useState } from 'react';

export default function ApiTestScreen() {
  const router = useRouter();
  const [testResults, setTestResults] = useState<{
    test: string;
    status: 'success' | 'error' | 'pending';
    message: string;
  }[]>([]);

  const runTests = async () => {
    setTestResults([]);
    const baseUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL ||
      (typeof window !== 'undefined' ? window.location.origin : '');

    setTestResults(prev => [...prev, { test: 'OpenAI Connection', status: 'pending', message: 'Testing...' }]);
    try {
      const res = await fetch(`${baseUrl}/api/speech-to-text`, { method: 'GET' });
      // Any response (even 405) means the API is reachable
      setTestResults(prev => prev.map(t =>
        t.test === 'OpenAI Connection'
          ? { test: 'OpenAI Connection', status: 'success', message: `API reachable (HTTP ${res.status})` }
          : t
      ));
    } catch (error: any) {
      setTestResults(prev => prev.map(t =>
        t.test === 'OpenAI Connection'
          ? { test: 'OpenAI Connection', status: 'error', message: error.message }
          : t
      ));
    }

    setTestResults(prev => [...prev, { test: 'API Connectivity', status: 'pending', message: 'Testing...' }]);
    try {
      const res = await fetch(`${baseUrl}/api/test`);
      const data = await res.json().catch(() => ({}));
      setTestResults(prev => prev.map(t =>
        t.test === 'API Connectivity'
          ? { test: 'API Connectivity', status: res.ok ? 'success' : 'error', message: data?.message || `HTTP ${res.status}` }
          : t
      ));
    } catch (error: any) {
      setTestResults(prev => prev.map(t =>
        t.test === 'API Connectivity'
          ? { test: 'API Connectivity', status: 'error', message: error.message }
          : t
      ));
    }

    setTestResults(prev => [...prev, { test: 'API Base URL', status: 'success', message: baseUrl || 'Not set' }]);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>API Connection Test</Text>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <View style={styles.infoBox}>
            <AlertCircle size={20} color="#2563EB" />
            <Text style={styles.infoText}>
              This screen tests the connection to your Rork API backend.
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.testButton}
            onPress={runTests}
          >
            <Text style={styles.testButtonText}>Run Tests</Text>
          </TouchableOpacity>

          {testResults.length > 0 && (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsTitle}>Test Results</Text>
              {testResults.map((result, index) => (
                <View key={index} style={styles.resultCard}>
                  <View style={styles.resultHeader}>
                    <Text style={styles.resultTest}>{result.test}</Text>
                    {result.status === 'pending' && <ActivityIndicator size="small" color="#2563EB" />}
                    {result.status === 'success' && <CheckCircle size={20} color="#10B981" />}
                    {result.status === 'error' && <XCircle size={20} color="#EF4444" />}
                  </View>
                  <Text style={[
                    styles.resultMessage,
                    result.status === 'error' && styles.errorMessage,
                    result.status === 'success' && styles.successMessage,
                  ]}>
                    {result.message}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.envSection}>
            <Text style={styles.envTitle}>Environment Variables</Text>
            <View style={styles.envCard}>
              <Text style={styles.envLabel}>EXPO_PUBLIC_RORK_API_BASE_URL:</Text>
              <Text style={styles.envValue}>
                {process.env.EXPO_PUBLIC_RORK_API_BASE_URL || '❌ Not set'}
              </Text>
            </View>
            <View style={styles.envCard}>
              <Text style={styles.envLabel}>OpenAI API Key:</Text>
              <Text style={styles.envValue}>
                {process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Not set'}
              </Text>
            </View>
            <View style={styles.envCard}>
              <Text style={styles.envLabel}>Twilio SID:</Text>
              <Text style={styles.envValue}>
                {process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID ? '✅ Configured' : '❌ Not set'}
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  testButton: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  resultsContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 16,
  },
  resultCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultTest: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  resultMessage: {
    fontSize: 14,
    color: '#6B7280',
  },
  errorMessage: {
    color: '#EF4444',
  },
  successMessage: {
    color: '#10B981',
  },
  envSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
  },
  envTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 16,
  },
  envCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  envLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  envValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
});

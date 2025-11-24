import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { useTwilioSMS, useTwilioCalls } from '@/components/TwilioIntegration';
import { Phone, MessageSquare } from 'lucide-react-native';

export default function TwilioExample() {
  const { sendSingleSMS, isLoading: isSendingSMS } = useTwilioSMS();
  const { initiateCall, callLogs, isLoadingCall, refetchCallLogs } = useTwilioCalls();

  const [phoneNumber, setPhoneNumber] = useState<string>('+1');
  const [message, setMessage] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');

  const handleSendSMS = async () => {
    if (!phoneNumber || !message) {
      alert('Please enter phone number and message');
      return;
    }

    await sendSingleSMS(phoneNumber, message, clientName);
  };

  const handleMakeCall = async () => {
    if (!phoneNumber) {
      alert('Please enter phone number');
      return;
    }

    await initiateCall(phoneNumber, message || undefined);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Twilio Integration Demo</Text>
        <Text style={styles.subtitle}>Test SMS and Calls</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📱 Contact Information</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number (E.164 format)</Text>
          <TextInput
            style={styles.input}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="+1234567890"
            keyboardType="phone-pad"
            placeholderTextColor="#9CA3AF"
          />
          <Text style={styles.hint}>Format: +[country code][number]</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Client Name (Optional)</Text>
          <TextInput
            style={styles.input}
            value={clientName}
            onChangeText={setClientName}
            placeholder="John Doe"
            placeholderTextColor="#9CA3AF"
          />
          <Text style={styles.hint}>Used for {'{name}'} personalization</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={message}
            onChangeText={setMessage}
            placeholder="Hello {name}, this is Legacy Prime Construction..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholderTextColor="#9CA3AF"
          />
          <Text style={styles.hint}>Use {'{name}'} for personalization</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🚀 Actions</Text>

        <TouchableOpacity
          style={[styles.actionButton, styles.smsButton]}
          onPress={handleSendSMS}
          disabled={isSendingSMS}
        >
          {isSendingSMS ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <MessageSquare size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Send SMS</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.callButton]}
          onPress={handleMakeCall}
          disabled={isLoadingCall}
        >
          {isLoadingCall ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Phone size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Make Call</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📞 Recent Call Logs</Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => refetchCallLogs()}
          >
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {callLogs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No call logs yet</Text>
          </View>
        ) : (
          <View style={styles.callLogsList}>
            {callLogs.slice(0, 5).map((call) => (
              <View key={call.sid} style={styles.callLogCard}>
                <View style={styles.callLogHeader}>
                  <Text style={styles.callLogFrom}>From: {call.from}</Text>
                  <View style={[
                    styles.statusBadge,
                    call.status === 'completed' && styles.completedBadge,
                    call.status === 'failed' && styles.failedBadge,
                  ]}>
                    <Text style={styles.statusText}>{call.status}</Text>
                  </View>
                </View>
                <Text style={styles.callLogTo}>To: {call.to}</Text>
                <Text style={styles.callLogDuration}>Duration: {call.duration}s</Text>
                <Text style={styles.callLogTime}>
                  {call.startTime ? new Date(call.startTime).toLocaleString() : 'N/A'}
                </Text>
                {call.price && (
                  <Text style={styles.callLogPrice}>
                    Cost: {call.price} {call.priceUnit}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💡 Tips</Text>
        <View style={styles.tipCard}>
          <Text style={styles.tipText}>
            1. Make sure you have configured Twilio credentials in your environment variables
          </Text>
          <Text style={styles.tipText}>
            2. Phone numbers must be in E.164 format: +[country code][number]
          </Text>
          <Text style={styles.tipText}>
            3. Trial accounts can only send to verified numbers
          </Text>
          <Text style={styles.tipText}>
            4. Use {'{name}'} in messages for automatic personalization
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#2563EB',
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#DBEAFE',
  },
  section: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 16,
  },
  refreshButton: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  refreshText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1F2937',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic' as const,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  smsButton: {
    backgroundColor: '#10B981',
  },
  callButton: {
    backgroundColor: '#2563EB',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  callLogsList: {
    gap: 12,
  },
  callLogCard: {
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  callLogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  callLogFrom: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  completedBadge: {
    backgroundColor: '#D1FAE5',
  },
  failedBadge: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  callLogTo: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 4,
  },
  callLogDuration: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 4,
  },
  callLogTime: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  callLogPrice: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600' as const,
  },
  tipCard: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  tipText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
});

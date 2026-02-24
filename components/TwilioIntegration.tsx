import { useState } from 'react';
import { Alert } from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';

export const useTwilioSMS = () => {
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [isSendingBulk, setIsSendingBulk] = useState(false);

  const sendSingleSMS = async (phone: string, message: string, name?: string) => {
    const personalizedMessage = name ? message.replace('{name}', name.split(' ')[0]) : message;
    setIsSendingSMS(true);
    try {
      const res = await fetch(`${API_BASE}/api/twilio-send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone, body: personalizedMessage }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to send SMS');
      if (result.success) {
        Alert.alert('Success', 'SMS sent successfully!');
        return true;
      }
      Alert.alert('Error', 'Failed to send SMS');
      return false;
    } catch (error: any) {
      console.error('SMS Error:', error);
      Alert.alert('Error', error.message || 'Failed to send SMS');
      return false;
    } finally {
      setIsSendingSMS(false);
    }
  };

  const sendBulkSMSMessages = async (
    recipients: { phone: string; name: string }[],
    message: string
  ) => {
    setIsSendingBulk(true);
    try {
      const res = await fetch(`${API_BASE}/api/twilio-send-bulk-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients, body: message }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to send bulk SMS');
      if (result.success) {
        Alert.alert(
          'Success',
          `SMS sent to ${result.totalSent} recipients. ${result.totalFailed > 0 ? `${result.totalFailed} failed.` : ''}`
        );
        return result;
      }
      Alert.alert('Error', 'Failed to send bulk SMS');
      return null;
    } catch (error: any) {
      console.error('Bulk SMS Error:', error);
      Alert.alert('Error', error.message || 'Failed to send bulk SMS');
      return null;
    } finally {
      setIsSendingBulk(false);
    }
  };

  return {
    sendSingleSMS,
    sendBulkSMSMessages,
    isLoading: isSendingSMS || isSendingBulk,
  };
};

export const useTwilioCalls = () => {
  const [isLoadingCall, setIsLoadingCall] = useState(false);

  const initiateCall = async (phone: string, message?: string) => {
    setIsLoadingCall(true);
    try {
      const res = await fetch(`${API_BASE}/api/twilio-make-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone, message: message || 'Hello, this is a call from Legacy Prime Construction.' }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to initiate call');
      if (result.success) {
        Alert.alert('Success', 'Call initiated successfully!');
        return true;
      }
      Alert.alert('Error', 'Failed to initiate call');
      return false;
    } catch (error: any) {
      console.error('Call Error:', error);
      Alert.alert('Error', error.message || 'Failed to initiate call');
      return false;
    } finally {
      setIsLoadingCall(false);
    }
  };

  return {
    initiateCall,
    callLogs: [],
    isLoadingCallLogs: false,
    isLoadingCall,
    refetchCallLogs: () => {},
  };
};

export const useTwilioVirtualAssistant = () => {
  const [isLoading, setIsLoading] = useState(false);

  const setupVirtualAssistant = async (
    businessName: string,
    greeting: string,
    webhookUrl: string
  ) => {
    setIsLoading(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';
      const res = await fetch(`${apiUrl}/api/twilio-create-virtual-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, greeting, webhookUrl }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to setup virtual assistant');
      if (result.success) {
        Alert.alert('Success', 'Virtual assistant configured successfully!');
        return result.twiml;
      }
      Alert.alert('Error', 'Failed to setup virtual assistant');
      return null;
    } catch (error: any) {
      console.error('Virtual Assistant Error:', error);
      Alert.alert('Error', error.message || 'Failed to setup virtual assistant');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    setupVirtualAssistant,
    isLoading,
  };
};

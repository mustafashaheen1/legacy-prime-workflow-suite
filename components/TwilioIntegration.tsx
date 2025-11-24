import { Alert } from 'react-native';
import { trpc } from '@/lib/trpc';

export const useTwilioSMS = () => {
  const sendSMS = trpc.twilio.sendSms.useMutation();
  const sendBulkSMS = trpc.twilio.sendBulkSms.useMutation();

  const sendSingleSMS = async (phone: string, message: string, name?: string) => {
    try {
      const personalizedMessage = name 
        ? message.replace('{name}', name.split(' ')[0]) 
        : message;

      const result = await sendSMS.mutateAsync({
        to: phone,
        body: personalizedMessage,
      });

      if (result.success) {
        Alert.alert('Success', 'SMS sent successfully!');
        return true;
      } else {
        Alert.alert('Error', 'Failed to send SMS');
        return false;
      }
    } catch (error: any) {
      console.error('SMS Error:', error);
      Alert.alert('Error', error.message || 'Failed to send SMS');
      return false;
    }
  };

  const sendBulkSMSMessages = async (
    recipients: { phone: string; name: string }[],
    message: string
  ) => {
    try {
      const result = await sendBulkSMS.mutateAsync({
        recipients,
        body: message,
      });

      if (result.success) {
        Alert.alert(
          'Success',
          `SMS sent to ${result.totalSent} recipients. ${result.totalFailed > 0 ? `${result.totalFailed} failed.` : ''}`
        );
        return result;
      } else {
        Alert.alert('Error', 'Failed to send bulk SMS');
        return null;
      }
    } catch (error: any) {
      console.error('Bulk SMS Error:', error);
      Alert.alert('Error', error.message || 'Failed to send bulk SMS');
      return null;
    }
  };

  return {
    sendSingleSMS,
    sendBulkSMSMessages,
    isLoading: sendSMS.isPending || sendBulkSMS.isPending,
  };
};

export const useTwilioCalls = () => {
  const makeCall = trpc.twilio.makeCall.useMutation();
  const getCallLogs = trpc.twilio.getCallLogs.useQuery({ limit: 50 });

  const initiateCall = async (phone: string, message?: string) => {
    try {
      const result = await makeCall.mutateAsync({
        to: phone,
        message: message || 'Hello, this is a call from Legacy Prime Construction.',
      });

      if (result.success) {
        Alert.alert('Success', 'Call initiated successfully!');
        return true;
      } else {
        Alert.alert('Error', 'Failed to initiate call');
        return false;
      }
    } catch (error: any) {
      console.error('Call Error:', error);
      Alert.alert('Error', error.message || 'Failed to initiate call');
      return false;
    }
  };

  return {
    initiateCall,
    callLogs: getCallLogs.data?.calls || [],
    isLoadingCallLogs: getCallLogs.isLoading,
    isLoadingCall: makeCall.isPending,
    refetchCallLogs: getCallLogs.refetch,
  };
};

export const useTwilioVirtualAssistant = () => {
  const createAssistant = trpc.twilio.createVirtualAssistant.useMutation();

  const setupVirtualAssistant = async (
    businessName: string,
    greeting: string,
    webhookUrl: string
  ) => {
    try {
      const result = await createAssistant.mutateAsync({
        businessName,
        greeting,
        webhookUrl,
      });

      if (result.success) {
        Alert.alert('Success', 'Virtual assistant configured successfully!');
        return result.twiml;
      } else {
        Alert.alert('Error', 'Failed to setup virtual assistant');
        return null;
      }
    } catch (error: any) {
      console.error('Virtual Assistant Error:', error);
      Alert.alert('Error', error.message || 'Failed to setup virtual assistant');
      return null;
    }
  };

  return {
    setupVirtualAssistant,
    isLoading: createAssistant.isPending,
  };
};

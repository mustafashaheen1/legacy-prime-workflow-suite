# Twilio Integration - Complete Setup Guide

## 🚀 Overview

Your Legacy Prime Construction app now has a complete Twilio integration for:
- ✅ **SMS Messaging** - Single and bulk SMS sending
- ✅ **Phone Calls** - Automated call initiation
- ✅ **Call Logs** - Track and review call history
- ✅ **Virtual Assistant** - AI-powered call handling

## 📋 Prerequisites

1. **Twilio Account** - Sign up at [https://www.twilio.com](https://www.twilio.com)
2. **Twilio Phone Number** - Purchase a number in your Twilio Console
3. **Twilio Credentials** - Get your Account SID and Auth Token

## 🔧 Step 1: Configure Environment Variables

Add these to your `.env` file or project environment settings:

```bash
EXPO_PUBLIC_TWILIO_ACCOUNT_SID=your_account_sid_here
EXPO_PUBLIC_TWILIO_AUTH_TOKEN=your_auth_token_here
EXPO_PUBLIC_TWILIO_PHONE_NUMBER=+1234567890
```

**Where to find these:**
1. Go to [Twilio Console](https://console.twilio.com/)
2. **Account SID** and **Auth Token** are on the Dashboard
3. **Phone Number** - Go to Phone Numbers → Manage → Active numbers

## 💻 Step 2: Using Twilio in Your App

### Using the Custom Hook

Import the Twilio hooks in your component:

```typescript
import { useTwilioSMS, useTwilioCalls, useTwilioVirtualAssistant } from '@/components/TwilioIntegration';
```

### Example 1: Send Single SMS

```typescript
const YourComponent = () => {
  const { sendSingleSMS, isLoading } = useTwilioSMS();

  const handleSendSMS = async () => {
    await sendSingleSMS(
      '+1234567890',           // Phone number
      'Hello {name}!',         // Message (use {name} for personalization)
      'John Doe'               // Client name (optional)
    );
  };

  return (
    <TouchableOpacity 
      onPress={handleSendSMS}
      disabled={isLoading}
    >
      <Text>Send SMS</Text>
    </TouchableOpacity>
  );
};
```

### Example 2: Send Bulk SMS

```typescript
const BulkSMSComponent = () => {
  const { sendBulkSMSMessages, isLoading } = useTwilioSMS();

  const handleSendBulkSMS = async () => {
    const recipients = [
      { phone: '+1234567890', name: 'John Doe' },
      { phone: '+0987654321', name: 'Jane Smith' },
    ];

    await sendBulkSMSMessages(
      recipients,
      'Hello {name}! Special offer just for you!'
    );
  };

  return (
    <TouchableOpacity 
      onPress={handleSendBulkSMS}
      disabled={isLoading}
    >
      <Text>Send Bulk SMS</Text>
    </TouchableOpacity>
  );
};
```

### Example 3: Make a Call

```typescript
const CallComponent = () => {
  const { initiateCall, isLoadingCall } = useTwilioCalls();

  const handleMakeCall = async () => {
    await initiateCall(
      '+1234567890',
      'Hello, this is Legacy Prime Construction calling about your project.'
    );
  };

  return (
    <TouchableOpacity 
      onPress={handleMakeCall}
      disabled={isLoadingCall}
    >
      <Text>Call Client</Text>
    </TouchableOpacity>
  );
};
```

### Example 4: Setup Virtual Assistant

```typescript
const VirtualAssistantComponent = () => {
  const { setupVirtualAssistant, isLoading } = useTwilioVirtualAssistant();

  const handleSetupAssistant = async () => {
    const twiml = await setupVirtualAssistant(
      'Legacy Prime Construction',
      'Thank you for calling Legacy Prime Construction. How can I help you today?',
      'https://your-domain.com/api/twilio/assistant'
    );

    if (twiml) {
      console.log('Assistant TwiML:', twiml);
    }
  };

  return (
    <TouchableOpacity 
      onPress={handleSetupAssistant}
      disabled={isLoading}
    >
      <Text>Setup Virtual Assistant</Text>
    </TouchableOpacity>
  );
};
```

### Example 5: View Call Logs

```typescript
const CallLogsComponent = () => {
  const { callLogs, isLoadingCallLogs, refetchCallLogs } = useTwilioCalls();

  return (
    <View>
      {isLoadingCallLogs ? (
        <Text>Loading call logs...</Text>
      ) : (
        <ScrollView>
          {callLogs.map((call) => (
            <View key={call.sid}>
              <Text>From: {call.from}</Text>
              <Text>To: {call.to}</Text>
              <Text>Status: {call.status}</Text>
              <Text>Duration: {call.duration}s</Text>
            </View>
          ))}
        </ScrollView>
      )}
      <TouchableOpacity onPress={() => refetchCallLogs()}>
        <Text>Refresh</Text>
      </TouchableOpacity>
    </View>
  );
};
```

## 🎯 Step 3: Using tRPC Directly

If you prefer using tRPC directly:

### Send SMS
```typescript
const sendSMS = trpc.twilio.sendSms.useMutation();

await sendSMS.mutateAsync({
  to: '+1234567890',
  body: 'Your message here'
});
```

### Send Bulk SMS
```typescript
const sendBulkSMS = trpc.twilio.sendBulkSms.useMutation();

await sendBulkSMS.mutateAsync({
  recipients: [
    { phone: '+1234567890', name: 'John' },
    { phone: '+0987654321', name: 'Jane' }
  ],
  body: 'Hello {name}!'
});
```

### Make Call
```typescript
const makeCall = trpc.twilio.makeCall.useMutation();

await makeCall.mutateAsync({
  to: '+1234567890',
  message: 'Hello from Legacy Prime Construction'
});
```

### Get Call Logs
```typescript
const callLogs = trpc.twilio.getCallLogs.useQuery({ limit: 50 });
```

### Create Virtual Assistant
```typescript
const createAssistant = trpc.twilio.createVirtualAssistant.useMutation();

await createAssistant.mutateAsync({
  businessName: 'Legacy Prime Construction',
  greeting: 'Thank you for calling',
  webhookUrl: 'https://your-domain.com/webhook'
});
```

## 📱 Integration with CRM

The CRM screen (`app/(tabs)/crm.tsx`) is already set up to work with Twilio. You can:

1. **Send Single SMS** - Click SMS button on any client
2. **Send Bulk SMS** - Select multiple clients and click SMS
3. **Make Calls** - Click call button on any client
4. **View Call Logs** - Click "Call Logs" button in header
5. **Setup Virtual Assistant** - Click "Call Assistant" button

To activate Twilio in CRM, replace the `Linking.openURL` calls with the Twilio hooks.

## 💰 Pricing (Approximate)

- **SMS**: ~$0.0075 per message in USA
- **Voice Calls**: ~$0.013 per minute in USA
- **Phone Number**: ~$1.15/month for US number

**Tip**: Start with a trial account that includes free credits!

## 🔒 Security Best Practices

1. **Never commit credentials** - Use environment variables
2. **Use webhook authentication** - Verify Twilio requests
3. **Rate limiting** - Implement limits for SMS/calls
4. **Monitor usage** - Set up Twilio alerts for high usage

## 🐛 Troubleshooting

### Issue: "Authentication failed"
**Solution**: Double-check your Account SID and Auth Token in `.env`

### Issue: "Invalid phone number"
**Solution**: Ensure phone numbers are in E.164 format (+1234567890)

### Issue: "Permission denied"
**Solution**: Verify your Twilio number for the destination number (trial accounts)

### Issue: SMS not sending
**Solution**: 
- Check your Twilio balance
- Verify phone numbers are valid
- Check Twilio logs in the console

## 📚 Additional Resources

- [Twilio Documentation](https://www.twilio.com/docs)
- [Twilio Node.js SDK](https://www.twilio.com/docs/libraries/node)
- [TwiML for Voice](https://www.twilio.com/docs/voice/twiml)
- [Twilio Console](https://console.twilio.com/)

## 🎉 Quick Test

Test your integration with this simple code:

```typescript
import { useTwilioSMS } from '@/components/TwilioIntegration';

export default function TestScreen() {
  const { sendSingleSMS, isLoading } = useTwilioSMS();

  const testSMS = async () => {
    await sendSingleSMS(
      'YOUR_PHONE_NUMBER',
      'Test message from Legacy Prime Construction!'
    );
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <TouchableOpacity
        onPress={testSMS}
        disabled={isLoading}
        style={{ 
          backgroundColor: '#2563EB', 
          padding: 16, 
          borderRadius: 8 
        }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>
          {isLoading ? 'Sending...' : 'Send Test SMS'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

## ✅ Checklist

- [ ] Created Twilio account
- [ ] Purchased phone number
- [ ] Added credentials to `.env`
- [ ] Tested single SMS
- [ ] Tested bulk SMS
- [ ] Tested phone call
- [ ] Configured virtual assistant (optional)
- [ ] Integrated with CRM

## 🆘 Need Help?

- Check Twilio Console logs for detailed error messages
- Review the TWILIO_INTEGRATION.md file for Spanish documentation
- Contact Twilio support for account-specific issues

---

**Ready to go!** Your Twilio integration is complete and ready to use! 🎊

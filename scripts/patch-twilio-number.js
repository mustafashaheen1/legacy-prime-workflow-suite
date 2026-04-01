require('dotenv').config({ path: '.env' });
const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID || process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN || process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN
);

client.incomingPhoneNumbers.list({ phoneNumber: '+13462790990' })
  .then(numbers => {
    if (!numbers.length) {
      console.log('Number not found');
      return;
    }
    console.log('Found number SID:', numbers[0].sid);
    return client.incomingPhoneNumbers(numbers[0].sid).update({
      voiceUrl: 'https://legacy-prime-workflow-suite.vercel.app/api/voice-webhook',
      voiceMethod: 'POST',
      smsUrl: 'https://legacy-prime-workflow-suite.vercel.app/api/twilio-webhook',
      smsMethod: 'POST',
    });
  })
  .then(n => n && console.log('Updated:', n.phoneNumber, '| voiceUrl:', n.voiceUrl))
  .catch(e => console.error('Error:', e.message));

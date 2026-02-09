/**
 * Test Email API Locally
 * Run: bun run test-email-api.ts
 */

const API_URL = 'http://localhost:8081'; // or your local dev server

async function testEmail() {
  console.log('Testing email API...\n');

  const emailData = {
    to: 'm.bilal.04631@gmail.com',
    toName: 'Bilal Test Contractor',
    projectName: 'Test Project - Downtown Office',
    companyName: 'Legacy Prime Construction',
    description: 'Need complete electrical wiring for new office building. Includes main panel upgrade, 50 outlets, and LED lighting throughout the building.',
    requiredBy: '03/15/2026',
    notes: 'Budget is around $15,000. Building is currently vacant, so work can start anytime.',
  };

  try {
    const response = await fetch(`${API_URL}/api/send-estimate-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    const result = await response.json();

    console.log('Response:', result);

    if (result.success) {
      console.log('✅ Email sent successfully!');
      console.log('Message ID:', result.messageId);
    } else {
      console.log('❌ Email failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Exception:', error);
  }
}

testEmail();

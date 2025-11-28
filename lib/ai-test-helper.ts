import { trpcClient } from '@/lib/trpc';

export async function runAITests() {
  console.log('\n🚀 Starting AI Assistant Tests...\n');
  const results = {
    connection: false,
    chat: false,
    backend: false,
  };

  try {
    console.log('📡 Test 1: Checking backend connection...');
    const response = await fetch('http://localhost:8081/api/');
    const data = await response.json();
    
    if (data.status === 'ok' && data.openai === 'configured') {
      console.log('✅ Backend is running and OpenAI is configured');
      results.backend = true;
    } else if (data.openai === 'missing') {
      console.log('❌ Backend is running but OpenAI API key is MISSING');
      console.log('   Please add OPENAI_API_KEY to your .env file');
      return results;
    }
  } catch (error) {
    console.log('❌ Backend connection failed');
    console.log('   Make sure server is running on http://localhost:8081');
    return results;
  }

  try {
    console.log('\n🔌 Test 2: Testing OpenAI connection...');
    const connectionTest = await trpcClient.openai.testConnection.query();
    
    if (connectionTest.success) {
      console.log('✅ OpenAI connection successful!');
      console.log('   Model:', connectionTest.model);
      results.connection = true;
    } else {
      console.log('❌ OpenAI connection failed');
      console.log('   Error:', connectionTest.error);
      return results;
    }
  } catch (error: any) {
    console.log('❌ OpenAI test failed');
    console.log('   Error:', error?.message || error);
    return results;
  }

  try {
    console.log('\n💬 Test 3: Testing AI Chat...');
    const chatResult = await trpcClient.openai.chat.mutate({
      messages: [
        { role: 'user', content: 'Say "Hello from AI test"' }
      ],
      model: 'gpt-4o',
      temperature: 0.7,
    });

    if (chatResult.success && chatResult.message) {
      console.log('✅ AI Chat working!');
      console.log('   Response:', chatResult.message.substring(0, 50) + '...');
      results.chat = true;
    } else {
      console.log('❌ AI Chat failed');
      const errorMsg = 'error' in chatResult ? chatResult.error : 'Unknown error';
      console.log('   Error:', errorMsg);
      return results;
    }
  } catch (error: any) {
    console.log('❌ AI Chat test failed');
    console.log('   Error:', error?.message || error);
    return results;
  }

  console.log('\n========================================');
  console.log('🎉 ALL TESTS PASSED!');
  console.log('========================================');
  console.log('✅ Backend: Running');
  console.log('✅ OpenAI: Connected');
  console.log('✅ AI Chat: Working');
  console.log('========================================');
  console.log('\nYour AI Assistant is ready to use!');
  console.log('\n📝 Next steps:');
  console.log('   1. Test AI estimate generation in the app');
  console.log('   2. Try different scope descriptions');
  console.log('   3. Verify generated items match price list');
  console.log('\n');

  return results;
}

export async function testAIEstimateGeneration() {
  console.log('\n🏗️  Testing AI Estimate Generation...\n');

  try {
    const testScope = 'Replace 4 linear feet of semi custom base cabinets';
    console.log('📝 Test Scope:', testScope);
    console.log('⏳ Generating estimate...');

    const systemPrompt = `You are an expert construction estimator. 
Return a JSON array with ONE line item for: ${testScope}

Format:
[
  {
    "priceListItemId": "pl-258",
    "quantity": 4,
    "notes": "Based on scope"
  }
]`;

    const result = await trpcClient.openai.chat.mutate({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: testScope }
      ],
      model: 'gpt-4o',
      temperature: 0.7,
    });

    if (result.success) {
      console.log('✅ Estimate generation successful!');
      console.log('   Response length:', result.message?.length, 'characters');
      console.log('   First 200 chars:', result.message?.substring(0, 200));
      
      try {
        const jsonMatch = result.message.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          const items = JSON.parse(jsonMatch[0]);
          console.log('✅ Valid JSON found!');
          console.log('   Items generated:', items.length);
          console.log('   First item:', JSON.stringify(items[0], null, 2));
        } else {
          console.log('⚠️  No JSON array found in response');
          console.log('   You may need to adjust the prompt');
        }
      } catch (parseError) {
        console.log('⚠️  Failed to parse JSON from response');
      }
    } else {
      console.log('❌ Estimate generation failed');
      const errorMsg = 'error' in result ? result.error : 'Unknown error';
      console.log('   Error:', errorMsg);
    }
  } catch (error: any) {
    console.log('❌ Test failed');
    console.log('   Error:', error?.message || error);
  }

  console.log('\n');
}

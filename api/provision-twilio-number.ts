import type { VercelRequest, VercelResponse } from '@vercel/node';
import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STATE_ABBR: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH',
  'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC',
  'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA',
  'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN',
  'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA',
  'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
};

async function geocodeAddress(address: string, postalCode: string): Promise<{ lat: number; lon: number; stateAbbr?: string } | null> {
  const query = encodeURIComponent(`${address} ${postalCode}`);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=us&addressdetails=1`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'LegacyPrimeWorkflowSuite/1.0' },
  });

  if (!response.ok) return null;

  const results = await response.json();
  if (!results.length) return null;

  const stateName = results[0].address?.state as string | undefined;
  const stateAbbr = stateName ? STATE_ABBR[stateName] : undefined;

  return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon), stateAbbr };
}

async function purchaseNumber(client: twilio.Twilio, phoneNumber: string): Promise<string> {
  const purchased = await client.incomingPhoneNumbers.create({
    phoneNumber,
    voiceUrl: 'https://legacy-prime-workflow-suite.vercel.app/api/voice-webhook',
    voiceMethod: 'POST',
    smsUrl: 'https://legacy-prime-workflow-suite.vercel.app/api/twilio-webhook',
    smsMethod: 'POST',
  });
  return purchased.phoneNumber;
}

async function findAndBuyTwilioNumber(
  client: twilio.Twilio,
  lat: number,
  lon: number,
  stateAbbr?: string
): Promise<string> {
  // 1. Distance-based search (25mi → 100mi → 500mi)
  for (const distance of [25, 100, 500]) {
    try {
      const available = await client.availablePhoneNumbers('US').local.list({
        nearLatLong: `${lat},${lon}`,
        distance,
        limit: 1,
        smsEnabled: true,
        voiceEnabled: true,
      });
      if (available.length > 0) {
        const number = await purchaseNumber(client, available[0].phoneNumber);
        console.log(`[provision-twilio] Purchased ${number} (${distance}mi radius)`);
        return number;
      }
    } catch (err: any) {
      console.warn(`[provision-twilio] Search failed at ${distance}mi:`, err.message);
    }
  }

  // 2. State-level fallback (e.g., all of Alaska)
  if (stateAbbr) {
    try {
      const available = await client.availablePhoneNumbers('US').local.list({
        inRegion: stateAbbr,
        limit: 1,
        smsEnabled: true,
        voiceEnabled: true,
      });
      if (available.length > 0) {
        const number = await purchaseNumber(client, available[0].phoneNumber);
        console.log(`[provision-twilio] Purchased ${number} (state fallback: ${stateAbbr})`);
        return number;
      }
    } catch (err: any) {
      console.warn(`[provision-twilio] State fallback failed (${stateAbbr}):`, err.message);
    }
  }

  // 3. National fallback — any available US number
  try {
    const available = await client.availablePhoneNumbers('US').local.list({
      limit: 1,
      smsEnabled: true,
      voiceEnabled: true,
    });
    if (available.length > 0) {
      const number = await purchaseNumber(client, available[0].phoneNumber);
      console.log(`[provision-twilio] Purchased ${number} (national fallback)`);
      return number;
    }
  } catch (err: any) {
    console.warn('[provision-twilio] National fallback failed:', err.message);
  }

  throw new Error('No available Twilio numbers found');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { companyId, address, postalCode } = req.body;

  if (!companyId || !address || !postalCode) {
    return res.status(400).json({ error: 'companyId, address, and postalCode are required' });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return res.status(500).json({ error: 'Twilio credentials not configured' });
  }

  try {
    console.log(`[provision-twilio] Geocoding address: ${address}, ${postalCode}`);
    const coords = await geocodeAddress(address, postalCode);

    if (!coords) {
      return res.status(400).json({ error: 'Could not geocode the provided address' });
    }

    console.log(`[provision-twilio] Coordinates: ${coords.lat}, ${coords.lon}`);

    const client = twilio(accountSid, authToken);
    const phoneNumber = await findAndBuyTwilioNumber(client, coords.lat, coords.lon, coords.stateAbbr);

    // Save to companies table
    const { error: dbError } = await supabase
      .from('companies')
      .update({
        twilio_phone_number: phoneNumber,
        address,
        postal_code: postalCode,
      })
      .eq('id', companyId);

    if (dbError) {
      console.error('[provision-twilio] DB save error:', dbError);
      return res.status(500).json({ error: 'Failed to save phone number to database' });
    }

    console.log(`[provision-twilio] Saved ${phoneNumber} to company ${companyId}`);

    return res.status(200).json({ success: true, phoneNumber });
  } catch (error: any) {
    console.error('[provision-twilio] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to provision Twilio number' });
  }
}

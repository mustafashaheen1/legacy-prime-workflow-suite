import AsyncStorage from '@react-native-async-storage/async-storage';
import { fixtureData } from '@/mocks/fixtures';

const SEED_VERSION_KEY = 'seed_version';
const CURRENT_SEED_VERSION = '1.2.0';

export async function checkAndSeedData(): Promise<boolean> {
  try {
    const seededVersion = await AsyncStorage.getItem(SEED_VERSION_KEY);
    
    if (seededVersion === CURRENT_SEED_VERSION) {
      console.log('[Seed] App already seeded with version:', seededVersion);
      return false;
    }

    console.log('[Seed] Starting data seeding...');
    
    await AsyncStorage.setItem('system:users', JSON.stringify(fixtureData.users));
    console.log('[Seed] ✓ Seeded users:', fixtureData.users.length);
    
    await AsyncStorage.setItem('expenses', JSON.stringify(fixtureData.expenses));
    console.log('[Seed] ✓ Seeded expenses:', fixtureData.expenses.length);
    
    await AsyncStorage.setItem('conversations', JSON.stringify(fixtureData.conversations));
    console.log('[Seed] ✓ Seeded conversations:', fixtureData.conversations.length);
    
    await AsyncStorage.setItem('dailyLogs', JSON.stringify(fixtureData.dailyLogs));
    console.log('[Seed] ✓ Seeded daily logs:', fixtureData.dailyLogs.length);
    
    await AsyncStorage.setItem('payments', JSON.stringify(fixtureData.payments));
    console.log('[Seed] ✓ Seeded payments:', fixtureData.payments.length);
    
    await AsyncStorage.setItem('changeOrders', JSON.stringify(fixtureData.changeOrders));
    console.log('[Seed] ✓ Seeded change orders:', fixtureData.changeOrders.length);
    
    await AsyncStorage.setItem('subcontractors', JSON.stringify(fixtureData.subcontractors));
    console.log('[Seed] ✓ Seeded subcontractors:', fixtureData.subcontractors.length);
    
    await AsyncStorage.setItem('businessFiles', JSON.stringify(fixtureData.businessFiles));
    console.log('[Seed] ✓ Seeded business files:', fixtureData.businessFiles.length);

    await AsyncStorage.setItem(SEED_VERSION_KEY, CURRENT_SEED_VERSION);
    console.log('[Seed] ✓ Data seeding complete! Version:', CURRENT_SEED_VERSION);
    
    return true;
  } catch (error) {
    console.error('[Seed] Error seeding data:', error);
    return false;
  }
}

export async function getDefaultCompany() {
  return fixtureData.companies[0];
}

export async function getDefaultUser() {
  return fixtureData.users[0];
}

export async function clearSeedData() {
  try {
    await AsyncStorage.multiRemove([
      'system:users',
      'expenses',
      'conversations',
      'dailyLogs',
      'payments',
      'changeOrders',
      'subcontractors',
      'businessFiles',
      SEED_VERSION_KEY,
    ]);
    console.log('[Seed] All seed data cleared');
  } catch (error) {
    console.error('[Seed] Error clearing seed data:', error);
  }
}

export async function reseedData() {
  await clearSeedData();
  await checkAndSeedData();
}

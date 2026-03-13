/**
 * Chatbot permission logic tests — run with: bun run tests/chatbot-permissions.test.ts
 *
 * Covers all 10 feature flags:
 *   Dashboard, CRM, Clock, Expenses, Photos, Chat, Schedule, Subcontractors, Projects, Reports
 */

// Inline the pure logic from lib/permissions.ts to avoid path-alias issues in test env

type UserRole = 'super-admin' | 'admin' | 'salesperson' | 'field-employee' | 'employee';

const ROLE_CHATBOT_LEVELS: Record<UserRole, 'unrestricted' | 'no-financials' | 'basic-only'> = {
  'super-admin':    'unrestricted',
  'admin':          'unrestricted',
  'salesperson':    'no-financials',
  'field-employee': 'basic-only',
  'employee':       'basic-only',
};

const financialKeywords = [
  'price', 'pricing', 'cost', 'costs', 'estimate total', 'markup', 'profit', 'revenue',
  'payment', 'invoice', 'budget', 'financial', 'contract', 'legal', 'terms',
  'how much', 'expense', 'paid', 'charge', 'fee', 'dollar', '$', 'money',
  'analytics', 'report', 'balance', 'income', 'wage', 'salary', 'breakdown',
];

const estimateKeywords = [
  'estimate', 'estimates', 'pricing', 'cost breakdown', 'quote', 'bid', 'proposal',
];

const FEATURE_KEYWORD_UNLOCKS: Record<string, string[]> = {
  expenses:  ['expense', 'cost', 'costs', 'how much', 'paid', 'charge', 'fee', 'dollar', '$', 'money', 'payment', 'invoice'],
  reports:   ['analytics', 'report', 'breakdown', 'balance', 'income', 'revenue', 'profit', 'wage', 'salary', 'financial'],
  projects:  ['budget', 'markup'],
  crm:       ['contract', 'legal', 'terms', 'invoice'],
  subs:      ['estimate', 'estimates', 'pricing', 'cost breakdown', 'quote', 'bid', 'proposal', 'price', 'pricing'],
  dashboard: [],
  clock:     [],
  photos:    [],
  chat:      [],
  schedule:  [],
};

function shouldBlockChatbotQuery(
  userRole: UserRole,
  query: string,
  customPermissions?: Record<string, boolean>
): { shouldBlock: boolean; reason?: string } {
  const restrictionLevel = ROLE_CHATBOT_LEVELS[userRole] || 'basic-only';
  const lowerQuery = query.toLowerCase();

  if (restrictionLevel === 'unrestricted') return { shouldBlock: false };

  const unlockedKeywords = new Set<string>();
  if (customPermissions) {
    for (const [featureKey, keywords] of Object.entries(FEATURE_KEYWORD_UNLOCKS)) {
      if (customPermissions[featureKey] === true) {
        keywords.forEach(k => unlockedKeywords.add(k));
      }
    }
  }

  const effectiveFinancialKeywords = financialKeywords.filter(k => !unlockedKeywords.has(k));
  const effectiveEstimateKeywords  = estimateKeywords.filter(k => !unlockedKeywords.has(k));

  const matchesKeyword = (kw: string) => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![a-z])${escaped}`, 'i').test(lowerQuery);
  };

  const hasFinancialKeyword = effectiveFinancialKeywords.some(matchesKeyword);

  if (restrictionLevel === 'no-financials' && hasFinancialKeyword) {
    return { shouldBlock: true, reason: 'financial block (no-financials level)' };
  }

  if (restrictionLevel === 'basic-only') {
    const hasEstimateKeyword = effectiveEstimateKeywords.some(matchesKeyword);
    if (hasFinancialKeyword || hasEstimateKeyword) {
      return { shouldBlock: true, reason: 'financial block (basic-only level)' };
    }
  }

  return { shouldBlock: false };
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    → ${e.message}`);
    failed++;
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected)
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
  };
}

// ---------------------------------------------------------------------------

console.log('\n=== Chatbot Permission Tests — All 10 Features ===\n');

// ─────────────────────────────────────────────────────────────────
console.log('[ ADMIN ] — always unrestricted, never blocked');
test('admin asking about expenses', () => expect(shouldBlockChatbotQuery('admin', 'What are the total expenses?').shouldBlock).toBe(false));
test('admin asking about wages',    () => expect(shouldBlockChatbotQuery('admin', "What is Henry's hourly wage?").shouldBlock).toBe(false));
test('admin asking about reports',  () => expect(shouldBlockChatbotQuery('admin', 'Show me the financial report').shouldBlock).toBe(false));

// ─────────────────────────────────────────────────────────────────
console.log('\n[ EMPLOYEE — no overrides ] — financial queries blocked');
test('no overrides — expense query BLOCKED',    () => expect(shouldBlockChatbotQuery('employee', 'What project has the most expense?').shouldBlock).toBe(true));
test('no overrides — budget query BLOCKED',     () => expect(shouldBlockChatbotQuery('employee', "What's the project budget?").shouldBlock).toBe(true));
test('no overrides — report query BLOCKED',     () => expect(shouldBlockChatbotQuery('employee', 'Give me the monthly financial report').shouldBlock).toBe(true));
test('no overrides — invoice query BLOCKED',    () => expect(shouldBlockChatbotQuery('employee', 'Show me the invoices').shouldBlock).toBe(true));
test('no overrides — estimate query BLOCKED',   () => expect(shouldBlockChatbotQuery('employee', 'What is the estimate for this project?').shouldBlock).toBe(true));
test('no overrides — wage query BLOCKED',       () => expect(shouldBlockChatbotQuery('employee', "What is the team's wage breakdown?").shouldBlock).toBe(true));
test('no overrides — non-financial ALLOWED',    () => expect(shouldBlockChatbotQuery('employee', 'What tasks are due today?').shouldBlock).toBe(false));
test('no overrides — clock query ALLOWED',      () => expect(shouldBlockChatbotQuery('employee', 'What time did I clock in today?').shouldBlock).toBe(false));
test('no overrides — schedule query ALLOWED',   () => expect(shouldBlockChatbotQuery('employee', "What's on the schedule this week?").shouldBlock).toBe(false));
test('no overrides — photos query ALLOWED',     () => expect(shouldBlockChatbotQuery('employee', 'Show me the photos for this project').shouldBlock).toBe(false));

// ─────────────────────────────────────────────────────────────────
console.log('\n[ EXPENSES: true ]');
const ePerms = { expenses: true };
test('expenses:true — "most expense" ALLOWED',          () => expect(shouldBlockChatbotQuery('employee', 'What project has the most expense so far?', ePerms).shouldBlock).toBe(false));
test('expenses:true — "total cost" ALLOWED',            () => expect(shouldBlockChatbotQuery('employee', 'What is the total cost for project Alpha?', ePerms).shouldBlock).toBe(false));
test('expenses:true — "how much spent" ALLOWED',        () => expect(shouldBlockChatbotQuery('employee', 'How much have we spent this month?', ePerms).shouldBlock).toBe(false));
test('expenses:true — "show invoices" ALLOWED',         () => expect(shouldBlockChatbotQuery('employee', 'Show me the invoices for this project', ePerms).shouldBlock).toBe(false));
test('expenses:true — wage query still BLOCKED',        () => expect(shouldBlockChatbotQuery('employee', "What is John's wage?", ePerms).shouldBlock).toBe(true));
test('expenses:true — revenue query still BLOCKED',     () => expect(shouldBlockChatbotQuery('employee', 'What is our revenue this quarter?', ePerms).shouldBlock).toBe(true));

// ─────────────────────────────────────────────────────────────────
console.log('\n[ REPORTS: true ]');
const rPerms = { reports: true };
test('reports:true — "financial report" ALLOWED',       () => expect(shouldBlockChatbotQuery('employee', 'Give me the monthly financial report', rPerms).shouldBlock).toBe(false));
test('reports:true — "analytics" ALLOWED',              () => expect(shouldBlockChatbotQuery('employee', 'Show me the analytics for this month', rPerms).shouldBlock).toBe(false));
test('reports:true — "revenue" ALLOWED',                () => expect(shouldBlockChatbotQuery('employee', 'What is our revenue this quarter?', rPerms).shouldBlock).toBe(false));
test('reports:true — "wage" ALLOWED',                   () => expect(shouldBlockChatbotQuery('employee', "What is the team's wage breakdown?", rPerms).shouldBlock).toBe(false));
test('reports:true — "salary" ALLOWED',                 () => expect(shouldBlockChatbotQuery('employee', "What is the average salary?", rPerms).shouldBlock).toBe(false));
test('reports:true — expense query still BLOCKED',      () => expect(shouldBlockChatbotQuery('employee', 'What is the total expense?', rPerms).shouldBlock).toBe(true));

// ─────────────────────────────────────────────────────────────────
console.log('\n[ PROJECTS: true ]');
const pPerms = { projects: true };
test('projects:true — "project overview" ALLOWED',      () => expect(shouldBlockChatbotQuery('employee', 'Give me an overview of the downtown project', pPerms).shouldBlock).toBe(false));
test('projects:true — "project budget" ALLOWED',        () => expect(shouldBlockChatbotQuery('employee', "What's the budget for the downtown project?", pPerms).shouldBlock).toBe(false));
test('projects:true — "markup" ALLOWED',                () => expect(shouldBlockChatbotQuery('employee', 'What is the markup on this project?', pPerms).shouldBlock).toBe(false));
test('projects:true — expense query still BLOCKED',     () => expect(shouldBlockChatbotQuery('employee', 'Show me all expenses for this project', pPerms).shouldBlock).toBe(true));

// ─────────────────────────────────────────────────────────────────
console.log('\n[ CRM: true ]');
const cPerms = { crm: true };
test('crm:true — "client details" ALLOWED',             () => expect(shouldBlockChatbotQuery('employee', 'Show me the client details for Smith Corp', cPerms).shouldBlock).toBe(false));
test('crm:true — "contract terms" ALLOWED',             () => expect(shouldBlockChatbotQuery('employee', 'What are the contract terms for this client?', cPerms).shouldBlock).toBe(false));
test('crm:true — "legal requirements" ALLOWED',         () => expect(shouldBlockChatbotQuery('employee', 'What legal requirements does this contract have?', cPerms).shouldBlock).toBe(false));
test('crm:true — "client invoices" ALLOWED',            () => expect(shouldBlockChatbotQuery('employee', 'Show me the invoices for this client', cPerms).shouldBlock).toBe(false));
test('crm:true — financial report still BLOCKED',       () => expect(shouldBlockChatbotQuery('employee', 'Show me the revenue breakdown', cPerms).shouldBlock).toBe(true));

// ─────────────────────────────────────────────────────────────────
console.log('\n[ SUBCONTRACTORS: true ]');
const sPerms = { subs: true };
test('subs:true — "subcontractor quote" ALLOWED',       () => expect(shouldBlockChatbotQuery('employee', 'Show me the quote from the plumber', sPerms).shouldBlock).toBe(false));
test('subs:true — "estimate" ALLOWED',                  () => expect(shouldBlockChatbotQuery('employee', 'What is the estimate for the electrical work?', sPerms).shouldBlock).toBe(false));
test('subs:true — "bid" ALLOWED',                       () => expect(shouldBlockChatbotQuery('employee', 'Show me all bids for this project', sPerms).shouldBlock).toBe(false));
test('subs:true — "proposal" ALLOWED',                  () => expect(shouldBlockChatbotQuery('employee', 'Show me the subcontractor proposals', sPerms).shouldBlock).toBe(false));
test('subs:true — wage query still BLOCKED',            () => expect(shouldBlockChatbotQuery('employee', "What is the team's salary?", sPerms).shouldBlock).toBe(true));

// ─────────────────────────────────────────────────────────────────
console.log('\n[ DASHBOARD, CLOCK, PHOTOS, CHAT, SCHEDULE ] — non-financial, not blocked by keywords');
// These features do NOT involve financial keywords — their queries are never keyword-blocked
// Their access is controlled purely by the system prompt and tool gate (tested in backend)
test('dashboard query — never keyword-blocked',         () => expect(shouldBlockChatbotQuery('employee', "What's the company activity summary today?").shouldBlock).toBe(false));
test('clock query — never keyword-blocked',             () => expect(shouldBlockChatbotQuery('employee', 'Who is clocked in right now?').shouldBlock).toBe(false));
test('photos query — never keyword-blocked',            () => expect(shouldBlockChatbotQuery('employee', 'Show me the latest site photos').shouldBlock).toBe(false));
test('chat query — never keyword-blocked',              () => expect(shouldBlockChatbotQuery('employee', 'What are the recent team messages?').shouldBlock).toBe(false));
test('schedule query — never keyword-blocked',          () => expect(shouldBlockChatbotQuery('employee', "What's scheduled for next week?").shouldBlock).toBe(false));

// ─────────────────────────────────────────────────────────────────
console.log('\n[ SALESPERSON (no-financials) ]');
test('salesperson — expense BLOCKED',                   () => expect(shouldBlockChatbotQuery('salesperson', 'What are the total expenses?').shouldBlock).toBe(true));
test('salesperson — project status ALLOWED',            () => expect(shouldBlockChatbotQuery('salesperson', 'What is the status of the Smith project?').shouldBlock).toBe(false));
test('salesperson — client name ALLOWED',               () => expect(shouldBlockChatbotQuery('salesperson', 'Show me the client list').shouldBlock).toBe(false));
test('salesperson — schedule ALLOWED',                  () => expect(shouldBlockChatbotQuery('salesperson', "What's on the schedule this week?").shouldBlock).toBe(false));

// ─────────────────────────────────────────────────────────────────
console.log('\n[ ALL FEATURES ENABLED — employee with full admin grant ]');
const allPerms = { dashboard: true, clock: true, photos: true, chat: true, schedule: true, expenses: true, projects: true, crm: true, subs: true, reports: true };
test('all features — expense query ALLOWED',            () => expect(shouldBlockChatbotQuery('employee', 'What project has the most expense?', allPerms).shouldBlock).toBe(false));
test('all features — budget query ALLOWED',             () => expect(shouldBlockChatbotQuery('employee', "What's the total budget?", allPerms).shouldBlock).toBe(false));
test('all features — report query ALLOWED',             () => expect(shouldBlockChatbotQuery('employee', 'Show me the financial report', allPerms).shouldBlock).toBe(false));
test('all features — wage query ALLOWED',               () => expect(shouldBlockChatbotQuery('employee', "What is the team's wage?", allPerms).shouldBlock).toBe(false));
test('all features — estimate query ALLOWED',           () => expect(shouldBlockChatbotQuery('employee', 'What is the estimate for the roof?', allPerms).shouldBlock).toBe(false));
test('all features — contract terms ALLOWED',           () => expect(shouldBlockChatbotQuery('employee', 'What are the contract terms?', allPerms).shouldBlock).toBe(false));

// ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(55)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('\nFix required — see failures above.');
  process.exit(1);
} else {
  console.log('\nAll tests passed ✓');
}

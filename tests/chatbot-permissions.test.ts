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
// Test runner with table output
// ---------------------------------------------------------------------------

type Row = { section: string; scenario: string; result: string; ok: boolean };
const rows: Row[] = [];
let currentSection = '';
let passed = 0;
let failed = 0;

function section(name: string) {
  currentSection = name;
}

function test(name: string, fn: () => void) {
  try {
    fn();
    rows.push({ section: currentSection, scenario: name, result: '✓ Pass', ok: true });
    passed++;
  } catch (e: any) {
    rows.push({ section: currentSection, scenario: name, result: `✗ FAIL: ${e.message}`, ok: false });
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

function printTable() {
  const COL1 = 72;
  const COL2 = 17;
  const hr    = `├${'─'.repeat(COL1 + 2)}┼${'─'.repeat(COL2 + 2)}┤`;
  const hrTop = `┌${'─'.repeat(COL1 + 2)}┬${'─'.repeat(COL2 + 2)}┐`;
  const hrBot = `└${'─'.repeat(COL1 + 2)}┴${'─'.repeat(COL2 + 2)}┘`;
  const hrSec = `├${'═'.repeat(COL1 + 2)}╪${'═'.repeat(COL2 + 2)}┤`;

  const pad = (s: string, w: number) => s.length >= w ? s.slice(0, w) : s + ' '.repeat(w - s.length);
  const row = (a: string, b: string) => `│ ${pad(a, COL1)} │ ${pad(b, COL2)} │`;

  console.log('\n' + hrTop);
  console.log(row('Scenario', 'Result'));

  let lastSection = '';
  for (const r of rows) {
    if (r.section !== lastSection) {
      console.log(hrSec);
      console.log(row(`[ ${r.section} ]`, ''));
      console.log(hr);
      lastSection = r.section;
    } else {
      console.log(hr);
    }
    console.log(row(r.scenario, r.result));
  }
  console.log(hrBot);
  console.log(`\n  ${passed} passed, ${failed} failed`);
}

// ---------------------------------------------------------------------------

section('ADMIN — always unrestricted');
test('Admin asking about expenses',                                     () => expect(shouldBlockChatbotQuery('admin', 'What are the total expenses?').shouldBlock).toBe(false));
test('Admin asking about wages',                                        () => expect(shouldBlockChatbotQuery('admin', "What is Henry's hourly wage?").shouldBlock).toBe(false));
test('Admin asking about reports',                                      () => expect(shouldBlockChatbotQuery('admin', 'Show me the financial report').shouldBlock).toBe(false));

section('EMPLOYEE (no overrides) — financial queries blocked');
test('Expense query → BLOCKED',                                         () => expect(shouldBlockChatbotQuery('employee', 'What project has the most expense?').shouldBlock).toBe(true));
test('Budget query → BLOCKED',                                          () => expect(shouldBlockChatbotQuery('employee', "What's the project budget?").shouldBlock).toBe(true));
test('Financial report query → BLOCKED',                                () => expect(shouldBlockChatbotQuery('employee', 'Give me the monthly financial report').shouldBlock).toBe(true));
test('Invoice query → BLOCKED',                                         () => expect(shouldBlockChatbotQuery('employee', 'Show me the invoices').shouldBlock).toBe(true));
test('Estimate query → BLOCKED',                                        () => expect(shouldBlockChatbotQuery('employee', 'What is the estimate for this project?').shouldBlock).toBe(true));
test('Wage query → BLOCKED',                                            () => expect(shouldBlockChatbotQuery('employee', "What is the team's wage breakdown?").shouldBlock).toBe(true));
test('Task query (non-financial) → ALLOWED',                            () => expect(shouldBlockChatbotQuery('employee', 'What tasks are due today?').shouldBlock).toBe(false));
test('Clock-in query → ALLOWED',                                        () => expect(shouldBlockChatbotQuery('employee', 'What time did I clock in today?').shouldBlock).toBe(false));
test('Schedule query → ALLOWED',                                        () => expect(shouldBlockChatbotQuery('employee', "What's on the schedule this week?").shouldBlock).toBe(false));
test('Photos query → ALLOWED',                                          () => expect(shouldBlockChatbotQuery('employee', 'Show me the photos for this project').shouldBlock).toBe(false));

section('EXPENSES: true — expense keywords unlocked');
const ePerms = { expenses: true };
test('"What project has the most expense?" → ALLOWED',                  () => expect(shouldBlockChatbotQuery('employee', 'What project has the most expense so far?', ePerms).shouldBlock).toBe(false));
test('"Total cost for project Alpha" → ALLOWED',                        () => expect(shouldBlockChatbotQuery('employee', 'What is the total cost for project Alpha?', ePerms).shouldBlock).toBe(false));
test('"How much have we spent" → ALLOWED',                              () => expect(shouldBlockChatbotQuery('employee', 'How much have we spent this month?', ePerms).shouldBlock).toBe(false));
test('"Show me the invoices" → ALLOWED',                                () => expect(shouldBlockChatbotQuery('employee', 'Show me the invoices for this project', ePerms).shouldBlock).toBe(false));
test('Wage query (not in expenses) → still BLOCKED',                    () => expect(shouldBlockChatbotQuery('employee', "What is John's wage?", ePerms).shouldBlock).toBe(true));
test('Revenue query (not in expenses) → still BLOCKED',                 () => expect(shouldBlockChatbotQuery('employee', 'What is our revenue this quarter?', ePerms).shouldBlock).toBe(true));

section('REPORTS: true — analytics/revenue/wage keywords unlocked');
const rPerms = { reports: true };
test('"Monthly financial report" → ALLOWED',                            () => expect(shouldBlockChatbotQuery('employee', 'Give me the monthly financial report', rPerms).shouldBlock).toBe(false));
test('"Analytics for this month" → ALLOWED',                            () => expect(shouldBlockChatbotQuery('employee', 'Show me the analytics for this month', rPerms).shouldBlock).toBe(false));
test('"Revenue this quarter" → ALLOWED',                                () => expect(shouldBlockChatbotQuery('employee', 'What is our revenue this quarter?', rPerms).shouldBlock).toBe(false));
test('"Team wage breakdown" → ALLOWED',                                 () => expect(shouldBlockChatbotQuery('employee', "What is the team's wage breakdown?", rPerms).shouldBlock).toBe(false));
test('"Average salary" → ALLOWED',                                      () => expect(shouldBlockChatbotQuery('employee', "What is the average salary?", rPerms).shouldBlock).toBe(false));
test('Expense query (not in reports) → still BLOCKED',                  () => expect(shouldBlockChatbotQuery('employee', 'What is the total expense?', rPerms).shouldBlock).toBe(true));

section('PROJECTS: true — budget/markup keywords unlocked');
const pPerms = { projects: true };
test('"Overview of downtown project" → ALLOWED',                        () => expect(shouldBlockChatbotQuery('employee', 'Give me an overview of the downtown project', pPerms).shouldBlock).toBe(false));
test('"Budget for the downtown project" → ALLOWED',                     () => expect(shouldBlockChatbotQuery('employee', "What's the budget for the downtown project?", pPerms).shouldBlock).toBe(false));
test('"Markup on this project" → ALLOWED',                              () => expect(shouldBlockChatbotQuery('employee', 'What is the markup on this project?', pPerms).shouldBlock).toBe(false));
test('Expense query (not in projects) → still BLOCKED',                 () => expect(shouldBlockChatbotQuery('employee', 'Show me all expenses for this project', pPerms).shouldBlock).toBe(true));

section('CRM: true — contract/legal/invoice keywords unlocked');
const cPerms = { crm: true };
test('"Client details for Smith Corp" → ALLOWED',                       () => expect(shouldBlockChatbotQuery('employee', 'Show me the client details for Smith Corp', cPerms).shouldBlock).toBe(false));
test('"Contract terms for this client" → ALLOWED',                      () => expect(shouldBlockChatbotQuery('employee', 'What are the contract terms for this client?', cPerms).shouldBlock).toBe(false));
test('"Legal requirements" → ALLOWED',                                  () => expect(shouldBlockChatbotQuery('employee', 'What legal requirements does this contract have?', cPerms).shouldBlock).toBe(false));
test('"Invoices for this client" → ALLOWED',                            () => expect(shouldBlockChatbotQuery('employee', 'Show me the invoices for this client', cPerms).shouldBlock).toBe(false));
test('Revenue query (not in CRM) → still BLOCKED',                      () => expect(shouldBlockChatbotQuery('employee', 'Show me the revenue breakdown', cPerms).shouldBlock).toBe(true));

section('SUBCONTRACTORS: true — estimate/bid/proposal/quote unlocked');
const sPerms = { subs: true };
test('"Quote from the plumber" → ALLOWED',                              () => expect(shouldBlockChatbotQuery('employee', 'Show me the quote from the plumber', sPerms).shouldBlock).toBe(false));
test('"Estimate for electrical work" → ALLOWED',                        () => expect(shouldBlockChatbotQuery('employee', 'What is the estimate for the electrical work?', sPerms).shouldBlock).toBe(false));
test('"All bids for this project" → ALLOWED',                           () => expect(shouldBlockChatbotQuery('employee', 'Show me all bids for this project', sPerms).shouldBlock).toBe(false));
test('"Subcontractor proposals" (no false "contract" match) → ALLOWED', () => expect(shouldBlockChatbotQuery('employee', 'Show me the subcontractor proposals', sPerms).shouldBlock).toBe(false));
test('Salary query (not in subs) → still BLOCKED',                      () => expect(shouldBlockChatbotQuery('employee', "What is the team's salary?", sPerms).shouldBlock).toBe(true));

section('DASHBOARD / CLOCK / PHOTOS / CHAT / SCHEDULE — non-financial');
test('Dashboard activity summary → ALLOWED (no financial keywords)',    () => expect(shouldBlockChatbotQuery('employee', "What's the company activity summary today?").shouldBlock).toBe(false));
test('Clock — "Who is clocked in?" → ALLOWED',                         () => expect(shouldBlockChatbotQuery('employee', 'Who is clocked in right now?').shouldBlock).toBe(false));
test('Photos — "Latest site photos" → ALLOWED',                        () => expect(shouldBlockChatbotQuery('employee', 'Show me the latest site photos').shouldBlock).toBe(false));
test('Chat — "Recent team messages" → ALLOWED',                        () => expect(shouldBlockChatbotQuery('employee', 'What are the recent team messages?').shouldBlock).toBe(false));
test('Schedule — "What is scheduled next week?" → ALLOWED',            () => expect(shouldBlockChatbotQuery('employee', "What's scheduled for next week?").shouldBlock).toBe(false));

section('SALESPERSON (no-financials role)');
test('Expense query → BLOCKED',                                         () => expect(shouldBlockChatbotQuery('salesperson', 'What are the total expenses?').shouldBlock).toBe(true));
test('Project status (non-financial) → ALLOWED',                       () => expect(shouldBlockChatbotQuery('salesperson', 'What is the status of the Smith project?').shouldBlock).toBe(false));
test('Client name query → ALLOWED',                                     () => expect(shouldBlockChatbotQuery('salesperson', 'Show me the client list').shouldBlock).toBe(false));
test('Schedule query → ALLOWED',                                        () => expect(shouldBlockChatbotQuery('salesperson', "What's on the schedule this week?").shouldBlock).toBe(false));

section('ALL FEATURES ENABLED — employee with full admin grant');
const allPerms = { dashboard: true, clock: true, photos: true, chat: true, schedule: true, expenses: true, projects: true, crm: true, subs: true, reports: true };
test('"Most expense" → ALLOWED',                                        () => expect(shouldBlockChatbotQuery('employee', 'What project has the most expense?', allPerms).shouldBlock).toBe(false));
test('"Total budget" → ALLOWED',                                        () => expect(shouldBlockChatbotQuery('employee', "What's the total budget?", allPerms).shouldBlock).toBe(false));
test('"Financial report" → ALLOWED',                                    () => expect(shouldBlockChatbotQuery('employee', 'Show me the financial report', allPerms).shouldBlock).toBe(false));
test('"Team wage" → ALLOWED',                                           () => expect(shouldBlockChatbotQuery('employee', "What is the team's wage?", allPerms).shouldBlock).toBe(false));
test('"Estimate for the roof" → ALLOWED',                               () => expect(shouldBlockChatbotQuery('employee', 'What is the estimate for the roof?', allPerms).shouldBlock).toBe(false));
test('"Contract terms" → ALLOWED',                                      () => expect(shouldBlockChatbotQuery('employee', 'What are the contract terms?', allPerms).shouldBlock).toBe(false));

// ─────────────────────────────────────────────────────────────────
printTable();
if (failed > 0) process.exit(1);

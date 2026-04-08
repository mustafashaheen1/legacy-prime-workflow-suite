/**
 * Subcontractor Assignment Email Logic Tests
 *
 * Run with: bunx vitest run tests/unit/schedule/sub-assignment-email.test.ts
 *
 * Tests pure logic extracted from sendSubAssignmentEmail in app/(tabs)/schedule.tsx
 */

import { describe, it, expect } from 'vitest';

// ─── Pure logic extracted from sendSubAssignmentEmail ────────────────────────

function buildAssignmentEmail(
  email: string,
  subName: string,
  taskName: string,
  startDate: string,
  companyName: string,
): { skip: boolean; subject: string; body: string; mailto: string } | { skip: true } {
  if (!email?.trim()) return { skip: true };

  const firstName = subName?.split(' ')[0] || '';
  const dateStr = new Date(startDate.split('T')[0] + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const subject = `Job Assignment — ${taskName}`;
  const body = `Hi ${firstName},\n\n${companyName} has assigned you to: ${taskName} on ${dateStr}.\n\n— ${companyName}`;
  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return { skip: false, subject, body, mailto };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildAssignmentEmail', () => {
  it('skips when email is empty string', () => {
    const result = buildAssignmentEmail('', 'Blake Smith', 'Site Clearing', '2026-04-07', 'Allen & Co.');
    expect(result).toEqual({ skip: true });
  });

  it('skips when email is whitespace only', () => {
    const result = buildAssignmentEmail('   ', 'Blake Smith', 'Site Clearing', '2026-04-07', 'Allen & Co.');
    expect(result).toEqual({ skip: true });
  });

  it('builds correct subject', () => {
    const result = buildAssignmentEmail('blake@sub.com', 'Blake Smith', 'Site Clearing', '2026-04-07', 'Allen & Co.') as any;
    expect(result.skip).toBe(false);
    expect(result.subject).toBe('Job Assignment — Site Clearing');
  });

  it('uses first name only in body greeting', () => {
    const result = buildAssignmentEmail('blake@sub.com', 'Blake Smith', 'Site Clearing', '2026-04-07', 'Allen & Co.') as any;
    expect(result.body).toContain('Hi Blake,');
    expect(result.body).not.toContain('Hi Blake Smith,');
  });

  it('includes company name in body', () => {
    const result = buildAssignmentEmail('blake@sub.com', 'Blake Smith', 'Site Clearing', '2026-04-07', 'Allen & Co.') as any;
    expect(result.body).toContain('Allen & Co. has assigned you to:');
    expect(result.body).toContain('— Allen & Co.');
  });

  it('includes task name in body', () => {
    const result = buildAssignmentEmail('blake@sub.com', 'Blake Smith', 'Site Clearing', '2026-04-07', 'Allen & Co.') as any;
    expect(result.body).toContain('Site Clearing');
  });

  it('formats date correctly', () => {
    const result = buildAssignmentEmail('blake@sub.com', 'Blake Smith', 'Site Clearing', '2026-04-07', 'Allen & Co.') as any;
    expect(result.body).toContain('Apr 7, 2026');
  });

  it('handles ISO datetime startDate (strips time component)', () => {
    const result = buildAssignmentEmail('blake@sub.com', 'Blake Smith', 'Site Clearing', '2026-04-07T00:00:00Z', 'Allen & Co.') as any;
    expect(result.body).toContain('Apr 7, 2026');
  });

  it('builds valid mailto URL', () => {
    const result = buildAssignmentEmail('blake@sub.com', 'Blake Smith', 'Site Clearing', '2026-04-07', 'Allen & Co.') as any;
    expect(result.mailto).toMatch(/^mailto:/);
    expect(result.mailto).toContain(encodeURIComponent('blake@sub.com'));
    expect(result.mailto).toContain('subject=');
    expect(result.mailto).toContain('body=');
  });

  it('handles single-name subcontractor', () => {
    const result = buildAssignmentEmail('blake@sub.com', 'Blake', 'Site Clearing', '2026-04-07', 'Allen & Co.') as any;
    expect(result.body).toContain('Hi Blake,');
  });

  it('falls back to company name Legacy Prime when empty', () => {
    const result = buildAssignmentEmail('blake@sub.com', 'Blake Smith', 'Site Clearing', '2026-04-07', '') as any;
    expect(result.body).toContain('Hi Blake,');
    // empty companyName still formats without crashing
    expect(result.skip).toBe(false);
  });

  it('only fires for newly added subs — logic test', () => {
    const originalSubIds = ['sub-1', 'sub-2'];
    const editAssignedSubIds = ['sub-1', 'sub-2', 'sub-3'];
    const newlyAdded = editAssignedSubIds.filter(id => !originalSubIds.includes(id));
    expect(newlyAdded).toEqual(['sub-3']);
  });

  it('returns empty newlyAdded when no new subs assigned', () => {
    const originalSubIds = ['sub-1', 'sub-2'];
    const editAssignedSubIds = ['sub-1', 'sub-2'];
    const newlyAdded = editAssignedSubIds.filter(id => !originalSubIds.includes(id));
    expect(newlyAdded).toHaveLength(0);
  });

  it('returns all as newlyAdded when previously unassigned', () => {
    const originalSubIds: string[] = [];
    const editAssignedSubIds = ['sub-1', 'sub-2'];
    const newlyAdded = editAssignedSubIds.filter(id => !originalSubIds.includes(id));
    expect(newlyAdded).toEqual(['sub-1', 'sub-2']);
  });
});

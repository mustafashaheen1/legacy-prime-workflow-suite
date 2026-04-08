/**
 * Task Assignment Push Notification Logic Tests
 *
 * Run with: bunx vitest run tests/unit/schedule/task-assignment-notification.test.ts
 *
 * Tests pure logic for M1-T5: push notification to employee on task assignment.
 */

import { describe, it, expect } from 'vitest';

// ─── Pure logic extracted from schedule.tsx + send-task-assignment-notification.ts ──

function buildNotificationPayload(
  employeeId: string,
  companyId: string,
  taskName: string,
  startDate: string,
  companyName: string,
): { title: string; message: string; type: string } | { skip: true } {
  if (!employeeId || !companyId || !taskName || !startDate) return { skip: true };

  const dateStr = new Date(startDate.split('T')[0] + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const sender = companyName || 'Your company';

  return {
    type: 'task-assigned',
    title: 'New Job Assignment',
    message: `You've been assigned to: ${taskName} on ${dateStr}. — ${sender}`,
  };
}

function getNewlyAssignedEmployees(
  originalEmpIds: string[],
  editAssignedEmpIds: string[],
): string[] {
  return editAssignedEmpIds.filter(id => !originalEmpIds.includes(id));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildNotificationPayload', () => {
  it('skips when employeeId is missing', () => {
    const result = buildNotificationPayload('', 'company-1', 'Site Clearing', '2026-04-07', 'Allen & Co.');
    expect(result).toEqual({ skip: true });
  });

  it('skips when companyId is missing', () => {
    const result = buildNotificationPayload('emp-1', '', 'Site Clearing', '2026-04-07', 'Allen & Co.');
    expect(result).toEqual({ skip: true });
  });

  it('skips when taskName is missing', () => {
    const result = buildNotificationPayload('emp-1', 'company-1', '', '2026-04-07', 'Allen & Co.');
    expect(result).toEqual({ skip: true });
  });

  it('skips when startDate is missing', () => {
    const result = buildNotificationPayload('emp-1', 'company-1', 'Site Clearing', '', 'Allen & Co.');
    expect(result).toEqual({ skip: true });
  });

  it('builds correct notification type', () => {
    const result = buildNotificationPayload('emp-1', 'company-1', 'Site Clearing', '2026-04-07', 'Allen & Co.') as any;
    expect(result.type).toBe('task-assigned');
  });

  it('builds correct title', () => {
    const result = buildNotificationPayload('emp-1', 'company-1', 'Site Clearing', '2026-04-07', 'Allen & Co.') as any;
    expect(result.title).toBe('New Job Assignment');
  });

  it('includes task name in message', () => {
    const result = buildNotificationPayload('emp-1', 'company-1', 'Site Clearing', '2026-04-07', 'Allen & Co.') as any;
    expect(result.message).toContain('Site Clearing');
  });

  it('includes formatted date in message', () => {
    const result = buildNotificationPayload('emp-1', 'company-1', 'Site Clearing', '2026-04-07', 'Allen & Co.') as any;
    expect(result.message).toContain('Apr 7, 2026');
  });

  it('includes company name in message', () => {
    const result = buildNotificationPayload('emp-1', 'company-1', 'Site Clearing', '2026-04-07', 'Allen & Co.') as any;
    expect(result.message).toContain('Allen & Co.');
  });

  it('falls back to "Your company" when companyName is empty', () => {
    const result = buildNotificationPayload('emp-1', 'company-1', 'Site Clearing', '2026-04-07', '') as any;
    expect(result.message).toContain('Your company');
  });

  it('handles ISO datetime startDate', () => {
    const result = buildNotificationPayload('emp-1', 'company-1', 'Site Clearing', '2026-04-07T00:00:00Z', 'Allen & Co.') as any;
    expect(result.message).toContain('Apr 7, 2026');
  });
});

describe('getNewlyAssignedEmployees', () => {
  it('returns only newly added employee IDs', () => {
    const result = getNewlyAssignedEmployees(['emp-1', 'emp-2'], ['emp-1', 'emp-2', 'emp-3']);
    expect(result).toEqual(['emp-3']);
  });

  it('returns empty when no new employees added', () => {
    const result = getNewlyAssignedEmployees(['emp-1', 'emp-2'], ['emp-1', 'emp-2']);
    expect(result).toHaveLength(0);
  });

  it('returns all when originally unassigned', () => {
    const result = getNewlyAssignedEmployees([], ['emp-1', 'emp-2']);
    expect(result).toEqual(['emp-1', 'emp-2']);
  });

  it('does not notify already assigned employees', () => {
    const result = getNewlyAssignedEmployees(['emp-1'], ['emp-1']);
    expect(result).not.toContain('emp-1');
  });

  it('handles multiple newly added employees', () => {
    const result = getNewlyAssignedEmployees(['emp-1'], ['emp-1', 'emp-2', 'emp-3']);
    expect(result).toEqual(['emp-2', 'emp-3']);
  });
});

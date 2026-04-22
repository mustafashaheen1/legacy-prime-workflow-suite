import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { User, ClockEntry } from '@/types';
import { Clock, DollarSign, CheckCircle, XCircle, FileText, Edit2, Download, HardHat, ClipboardList, Send, Megaphone, Phone, Users, Building2, Monitor, Truck, MoreHorizontal, ChevronDown, Calendar, Tag } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';

const OFFICE_ROLES: { name: string; icon: React.ComponentType<any>; color: string; bg: string }[] = [
  { name: 'Project Manager', icon: ClipboardList, color: '#4F46E5', bg: '#EEF2FF' },
  { name: 'Bookkeeper', icon: ClipboardList, color: '#4F46E5', bg: '#EEF2FF' },
  { name: 'Accountant', icon: ClipboardList, color: '#4F46E5', bg: '#EEF2FF' },
  { name: 'Sales', icon: Send, color: '#16A34A', bg: '#F0FDF4' },
  { name: 'Marketing', icon: Megaphone, color: '#DC2626', bg: '#FEF2F2' },
  { name: 'Office Assistant', icon: ClipboardList, color: '#4F46E5', bg: '#EEF2FF' },
  { name: 'Receptionist', icon: Phone, color: '#16A34A', bg: '#F0FDF4' },
  { name: 'Project Coordinator', icon: ClipboardList, color: '#EA580C', bg: '#FFF7ED' },
  { name: 'HR / Payroll Admin', icon: Users, color: '#DC2626', bg: '#FEF2F2' },
  { name: 'Estimator', icon: FileText, color: '#4F46E5', bg: '#EEF2FF' },
  { name: 'Office Manager', icon: Building2, color: '#4F46E5', bg: '#EEF2FF' },
  { name: 'IT Support', icon: Monitor, color: '#0891B2', bg: '#ECFEFF' },
  { name: 'Dispatcher', icon: Truck, color: '#EA580C', bg: '#FFF7ED' },
  { name: 'Other', icon: MoreHorizontal, color: '#6B7280', bg: '#F3F4F6' },
];

export default function EmployeeManagementScreen() {
  const { user: currentUser, clockEntries, refreshClockEntries } = useApp();
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);

  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportPeriod, setReportPeriod] = useState<'current-week' | 'last-week' | 'this-month' | 'last-month' | 'all-time'>('current-week');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showEditRateModal, setShowEditRateModal] = useState<boolean>(false);
  const [editingRate, setEditingRate] = useState<string>('');

  const [refreshing, setRefreshing] = useState(false);
  const [usersData, setUsersData] = useState<{ users: User[] } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Classify modal
  const [showClassifyModal, setShowClassifyModal] = useState(false);
  const [classifyType, setClassifyType] = useState<'field' | 'office' | null>(null);
  const [classifyOfficeRole, setClassifyOfficeRole] = useState<string>('');
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [isSavingClassify, setIsSavingClassify] = useState(false);

  // Timecard modal
  const [showTimecardModal, setShowTimecardModal] = useState(false);
  const [timecardPeriod, setTimecardPeriod] = useState<'weekly' | 'bi-weekly'>('weekly');
  const [isGeneratingTimecard, setIsGeneratingTimecard] = useState(false);

  // Timecard success modal
  const [showTimecardSuccess, setShowTimecardSuccess] = useState(false);
  const [timecardResult, setTimecardResult] = useState<{
    employeeName: string; totalHours: number; regularHours: number;
    overtimeHours: number; totalEarnings: number;
  } | null>(null);
  // Tick every 60s so live hours for clocked-in employees update automatically
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const fetchUsers = useCallback(async () => {
    if (!currentUser?.companyId) return;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('company_id', currentUser.companyId);
      if (error) throw error;
      const users: User[] = (data || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        companyId: u.company_id,
        avatar: u.avatar || undefined,
        phone: u.phone || undefined,
        address: u.address || undefined,
        hourlyRate: u.hourly_rate || undefined,
        isActive: u.is_active,
        createdAt: u.created_at,
        rateChangeRequest: u.rate_change_request || undefined,
      }));
      setUsersData({ users });
    } catch (err) {
      console.error('[Admin] Error fetching users:', err);
    }
  }, [currentUser?.companyId]);

  useFocusEffect(
    useCallback(() => {
      fetchUsers();
      refreshClockEntries();
    }, [fetchUsers, refreshClockEntries])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  }, [fetchUsers]);

  const [employeeFilter, setEmployeeFilter] = useState<'all' | 'field' | 'office'>('all');

  const employees = useMemo(() => {
    const allUsers = usersData?.users || [];
    return allUsers.filter((u: User) =>
      u.role !== 'admin' && u.role !== 'super-admin'
    );
  }, [usersData]);

  // Classify employees as office or field based on clockEntries
  const officeEmployeeIds = useMemo(() => {
    const ids = new Set<string>();
    clockEntries.forEach((e: ClockEntry) => {
      if (e.officeRole) ids.add(e.employeeId);
    });
    return ids;
  }, [clockEntries]);

  const classifiedEmployees = useMemo(() => {
    if (employeeFilter === 'office') return employees.filter((emp: User) => officeEmployeeIds.has(emp.id));
    if (employeeFilter === 'field') return employees.filter((emp: User) => !officeEmployeeIds.has(emp.id));
    return employees;
  }, [employees, employeeFilter, officeEmployeeIds]);

  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return classifiedEmployees;
    const query = searchQuery.toLowerCase();
    return classifiedEmployees.filter((emp: User) =>
      emp.name.toLowerCase().includes(query) ||
      emp.email.toLowerCase().includes(query) ||
      emp.phone?.toLowerCase().includes(query)
    );
  }, [classifiedEmployees, searchQuery]);

  const employeesWithRateChangeRequests = useMemo(() => {
    return employees.filter((emp: User) => 
      emp.rateChangeRequest && emp.rateChangeRequest.status === 'pending'
    );
  }, [employees]);

  const handleApproveRateChange = async (employee: User, approve: boolean) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/api/approve-rate-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employee.id, approve }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to process rate change');
      Alert.alert('Success', approve ? 'Rate change approved successfully' : 'Rate change rejected');
      setSelectedEmployee(null);
      await fetchUsers();
    } catch (error: any) {
      console.error('[Admin] Error handling rate change:', error);
      Alert.alert('Error', error.message || 'Failed to process rate change');
    }
  };

  const openEditRateModal = (employee: User) => {
    setSelectedEmployee(employee);
    setEditingRate(employee.hourlyRate?.toString() || '');
    setShowEditRateModal(true);
  };

  const handleUpdateRate = async () => {
    if (!selectedEmployee) return;

    const rate = parseFloat(editingRate);
    if (isNaN(rate) || rate < 0) {
      Alert.alert('Invalid Rate', 'Please enter a valid hourly rate');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/approve-rate-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // approve=true + newRate = direct admin override (bypasses pending request)
        body: JSON.stringify({ employeeId: selectedEmployee.id, approve: true, newRate: rate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update hourly rate');
      Alert.alert('Success', 'Hourly rate updated successfully');
      setShowEditRateModal(false);
      setSelectedEmployee(null);
      setEditingRate('');
      await fetchUsers();
    } catch (error: any) {
      console.error('[Admin] Error updating rate:', error);
      Alert.alert('Error', error.message || 'Failed to update hourly rate');
    } finally {
      setIsSaving(false);
    }
  };

  const getEmployeeStats = (employeeId: string) => {
    const employeeEntries = clockEntries.filter(e => e.employeeId === employeeId);
    const now = Date.now();
    const today = new Date().toDateString();

    // Monday of current week at midnight
    const weekStart = (() => {
      const d = new Date();
      const day = d.getDay();
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })();

    // Calculate net ms for one entry; uses now as end if still clocked in
    const entryMs = (entry: ClockEntry): number => {
      const start = new Date(entry.clockIn).getTime();
      const end = entry.clockOut ? new Date(entry.clockOut).getTime() : now;
      let ms = end - start;
      if (entry.lunchBreaks) {
        entry.lunchBreaks.forEach(lunch => {
          const ls = new Date(lunch.startTime).getTime();
          const le = lunch.endTime
            ? new Date(lunch.endTime).getTime()
            : (entry.clockOut ? new Date(entry.clockOut).getTime() : now);
          if (!isNaN(ls) && !isNaN(le)) ms -= (le - ls);
        });
      }
      return Math.max(0, ms);
    };

    const todayEntries = employeeEntries.filter(e => new Date(e.clockIn).toDateString() === today);
    const weekEntries  = employeeEntries.filter(e => new Date(e.clockIn).getTime() >= weekStart);

    const todayHours = todayEntries.reduce((sum, e) => sum + entryMs(e), 0) / 3_600_000;
    const weekHours  = weekEntries.reduce((sum, e)  => sum + entryMs(e), 0) / 3_600_000;
    const totalHours = employeeEntries.reduce((sum, e) => sum + entryMs(e), 0) / 3_600_000;

    const activeEntry = employeeEntries.find(e => !e.clockOut);
    const isClockedIn = !!activeEntry;
    const clockInTime = activeEntry ? new Date(activeEntry.clockIn) : null;

    return { todayHours, weekHours, totalHours, isClockedIn, clockInTime };
  };

  const openReportModal = (employee: User) => {
    setSelectedEmployee(employee);
    setShowReportModal(true);
  };

  const getEmployeeBadge = (emp: User): { label: string; color: string; bg: string } => {
    if (officeEmployeeIds.has(emp.id)) {
      const entry = clockEntries.find((e: ClockEntry) => e.employeeId === emp.id && e.officeRole);
      const roleName = entry?.officeRole || 'Office';
      return { label: roleName.toUpperCase(), color: '#4F46E5', bg: '#EEF2FF' };
    }
    return { label: 'FIELD', color: '#4F46E5', bg: '#EEF2FF' };
  };

  const openClassifyModal = (employee: User) => {
    setSelectedEmployee(employee);
    const isOffice = officeEmployeeIds.has(employee.id);
    setClassifyType(isOffice ? 'office' : 'field');
    const entry = clockEntries.find((e: ClockEntry) => e.employeeId === employee.id && e.officeRole);
    setClassifyOfficeRole(entry?.officeRole || '');
    setShowClassifyModal(true);
  };

  const handleSaveClassify = async () => {
    if (!selectedEmployee) return;
    setIsSavingClassify(true);
    try {
      if (classifyType === 'office' && classifyOfficeRole) {
        const { data: entries } = await supabase
          .from('clock_entries')
          .select('id')
          .eq('employee_id', selectedEmployee.id)
          .order('clock_in', { ascending: false })
          .limit(1);
        if (entries && entries.length > 0) {
          await supabase
            .from('clock_entries')
            .update({ office_role: classifyOfficeRole })
            .eq('id', entries[0].id);
        }
      } else if (classifyType === 'field') {
        await supabase
          .from('clock_entries')
          .update({ office_role: null })
          .eq('employee_id', selectedEmployee.id);
      }
      await refreshClockEntries();
      setShowClassifyModal(false);
      setShowRolePicker(false);
      Alert.alert('Success', `${selectedEmployee.name} classified as ${classifyType === 'field' ? 'Field Worker' : classifyOfficeRole}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to classify employee');
    } finally {
      setIsSavingClassify(false);
    }
  };

  const openTimecardModal = (employee: User) => {
    setSelectedEmployee(employee);
    setTimecardPeriod('weekly');
    setShowTimecardModal(true);
  };

  const handleGenerateTimecard = async () => {
    if (!selectedEmployee) return;
    setIsGeneratingTimecard(true);
    try {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const periodDays = timecardPeriod === 'weekly' ? 7 : 14;

      const start = new Date(now);
      start.setDate(now.getDate() - diffToMonday - (timecardPeriod === 'bi-weekly' ? 7 : 0));
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + periodDays - 1);
      end.setHours(23, 59, 59, 999);

      const empEntries = clockEntries.filter((e: ClockEntry) =>
        e.employeeId === selectedEmployee.id &&
        new Date(e.clockIn).getTime() >= start.getTime() &&
        new Date(e.clockIn).getTime() <= end.getTime()
      );

      const entryMs = (entry: ClockEntry): number => {
        const s = new Date(entry.clockIn).getTime();
        const en = entry.clockOut ? new Date(entry.clockOut).getTime() : Date.now();
        let ms = en - s;
        if (entry.lunchBreaks) {
          entry.lunchBreaks.forEach((lunch: any) => {
            const ls = new Date(lunch.startTime).getTime();
            const le = lunch.endTime ? new Date(lunch.endTime).getTime() : en;
            if (!isNaN(ls) && !isNaN(le)) ms -= (le - ls);
          });
        }
        return Math.max(0, ms);
      };

      const totalHours = empEntries.reduce((sum: number, e: ClockEntry) => sum + entryMs(e), 0) / 3_600_000;
      const regularHours = Math.min(totalHours, 40);
      const overtimeHours = Math.max(0, totalHours - 40);
      const rate = selectedEmployee.hourlyRate || 0;
      const totalEarnings = (regularHours * rate) + (overtimeHours * rate * 1.5);

      setTimecardResult({
        employeeName: selectedEmployee.name,
        totalHours, regularHours, overtimeHours, totalEarnings,
      });
      setShowTimecardModal(false);
      setShowTimecardSuccess(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to generate timecard');
    } finally {
      setIsGeneratingTimecard(false);
    }
  };

  const getReportDateRange = (period: typeof reportPeriod): { start: Date; end: Date; label: string } => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    if (period === 'current-week') {
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      return { start: monday, end: sunday, label: `Week of ${monday.toLocaleDateString()}` };
    }
    if (period === 'last-week') {
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday - 7);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      return { start: monday, end: sunday, label: `Week of ${monday.toLocaleDateString()}` };
    }
    if (period === 'this-month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end, label: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) };
    }
    if (period === 'last-month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start, end, label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) };
    }
    // all-time
    return { start: new Date(0), end: new Date(8640000000000000), label: 'All Time' };
  };

  const generateWorkHistoryReport = async (format: 'pdf' | 'csv') => {
    if (!selectedEmployee) return;
    setIsGeneratingReport(true);

    try {
      const { start, end, label: periodLabel } = getReportDateRange(reportPeriod);

      // Fetch clock entries + project names in parallel
      const [{ data: entriesData, error: entriesErr }, { data: projectsData, error: projErr }] = await Promise.all([
        supabase
          .from('clock_entries')
          .select('*')
          .eq('employee_id', selectedEmployee.id)
          .gte('clock_in', start.toISOString())
          .lte('clock_in', end.toISOString())
          .order('clock_in', { ascending: true }),
        supabase.from('projects').select('id, name'),
      ]);

      if (entriesErr || projErr) throw new Error((entriesErr || projErr)!.message);

      const entries = entriesData || [];
      const projectMap = new Map<string, string>(
        (projectsData || []).map((p: any) => [p.id, p.name])
      );

      // Compute per-entry stats
      const calcNetHours = (e: any): number => {
        if (!e.clock_in) return 0;
        const inMs = new Date(e.clock_in).getTime();
        const outMs = e.clock_out ? new Date(e.clock_out).getTime() : Date.now();
        let ms = outMs - inMs;
        if (e.lunch_breaks) {
          e.lunch_breaks.forEach((l: any) => {
            const ls = new Date(l.startTime).getTime();
            const le = l.endTime ? new Date(l.endTime).getTime() : outMs;
            if (!isNaN(ls) && !isNaN(le)) ms -= (le - ls);
          });
        }
        return Math.max(0, ms / 3_600_000);
      };

      const formatTime = (iso: string) => {
        const d = new Date(iso);
        const h = d.getHours(), m = d.getMinutes();
        return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
      };

      const sortedEntries = [...entries].sort(
        (a: any, b: any) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime()
      );

      let cumulativeHours = 0;
      let totalEarnings = 0;
      const processedRows: Array<{
        date: string; dayName: string; clockIn: string; clockOut: string;
        lunchMin: number; netHours: number; rate: number | null;
        cost: number; project: string; isActive: boolean;
      }> = [];

      for (const e of sortedEntries as any[]) {
        const netHours = calcNetHours(e);
        // Use the rate snapshot stored at clock-in time. For legacy entries that
        // predate the snapshot column (hourly_rate = null), fall back to the
        // employee's current rate so the report shows estimated earnings rather
        // than $0. The rate column in the table will show "(est.)" to signal this.
        const snapshotRate: number | null = e.hourly_rate ?? null;
        const rate: number | null = snapshotRate ?? selectedEmployee.hourlyRate ?? null;
        const isEstimatedRate = snapshotRate == null && rate != null;
        const regInEntry = rate ? Math.max(0, Math.min(netHours, 40 - cumulativeHours)) : 0;
        const otInEntry = rate ? Math.max(0, netHours - regInEntry) : 0;
        const cost = rate ? (regInEntry * rate) + (otInEntry * rate * 1.5) : 0;
        cumulativeHours += netHours;
        totalEarnings += cost;

        const lunchMs = e.lunch_breaks
          ? (e.lunch_breaks as any[]).reduce((s: number, l: any) => {
              if (!l.endTime) return s;
              return s + (new Date(l.endTime).getTime() - new Date(l.startTime).getTime());
            }, 0)
          : 0;

        const d = new Date(e.clock_in);
        processedRows.push({
          date: d.toLocaleDateString(),
          dayName: d.toLocaleDateString('en-US', { weekday: 'long' }),
          clockIn: formatTime(e.clock_in),
          clockOut: e.clock_out ? formatTime(e.clock_out) : 'Active',
          lunchMin: Math.round(lunchMs / 60_000),
          netHours,
          rate,
          isEstimatedRate,
          cost,
          project: e.project_id ? (projectMap.get(e.project_id) || 'Unknown Project') : '—',
          isActive: !e.clock_out,
        });
      }

      const totalHours = processedRows.reduce((s, r) => s + r.netHours, 0);
      const regularHours = Math.min(totalHours, 40);
      const overtimeHours = Math.max(0, totalHours - 40);
      const daysWorked = new Set(processedRows.map(r => r.date)).size;
      const rateLabel = selectedEmployee.hourlyRate ? `$${selectedEmployee.hourlyRate.toFixed(2)}/hr` : 'Not set';
      const companyName = currentUser?.companyId ? 'Legacy Prime' : 'Company';
      const generatedOn = new Date().toLocaleString();

      if (format === 'pdf') {
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { font-family: -apple-system, Arial, sans-serif; font-size: 12px; color: #111827; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 2px solid #2563eb; margin-bottom: 24px; }
  .company h1 { font-size: 20px; font-weight: 700; color: #2563eb; }
  .doc-title { font-size: 14px; color: #374151; margin-top: 4px; font-weight: 500; }
  .meta p { font-size: 12px; color: #111827; text-align: right; line-height: 1.8; }
  .meta strong { color: #111827; }
  .section-title { font-size: 13px; font-weight: 700; color: #111827; margin: 20px 0 10px 0; border-left: 3px solid #2563eb; padding-left: 8px; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .stat-box { background: #e5e7eb !important; border-radius: 8px; padding: 12px; text-align: center; }
  .stat-value { font-size: 20px; font-weight: 700; color: #111827; }
  .stat-value.green { color: #059669; }
  .stat-value.blue { color: #1d4ed8; }
  .stat-label { font-size: 10px; color: #374151; margin-top: 4px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #1e3a8a !important; color: #ffffff !important; font-size: 10px; font-weight: 700; padding: 9px 6px; text-align: left; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 8px 6px; font-size: 11px; border-bottom: 1px solid #d1d5db; color: #111827; }
  tr:nth-child(even) td { background: #f3f4f6 !important; }
  .badge-ot { background: #fef3c7 !important; color: #92400e; font-size: 9px; padding: 1px 5px; border-radius: 9px; font-weight: 600; }
  .badge-active { background: #d1fae5 !important; color: #065f46; font-size: 9px; padding: 1px 5px; border-radius: 9px; font-weight: 600; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #9ca3af; font-size: 10px; color: #374151; display: flex; justify-content: space-between; font-weight: 500; }
  @media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
</style></head><body>
<div class="header">
  <div class="company">
    <h1>${companyName}</h1>
    <div class="doc-title">Work History Report</div>
  </div>
  <div class="meta">
    <p><strong>Employee:</strong> ${selectedEmployee.name}</p>
    <p><strong>Period:</strong> ${periodLabel}</p>
    <p><strong>Rate:</strong> ${rateLabel}</p>
    <p><strong>Generated:</strong> ${generatedOn}</p>
  </div>
</div>

<div class="section-title">Summary</div>
<div class="summary-grid">
  <div class="stat-box"><div class="stat-value blue">${totalHours.toFixed(2)}h</div><div class="stat-label">Total Hours</div></div>
  <div class="stat-box"><div class="stat-value">${regularHours.toFixed(2)}h</div><div class="stat-label">Regular Hours</div></div>
  <div class="stat-box"><div class="stat-value">${overtimeHours.toFixed(2)}h</div><div class="stat-label">Overtime Hours</div></div>
  <div class="stat-box"><div class="stat-value green">$${totalEarnings.toFixed(2)}</div><div class="stat-label">Total Earnings</div></div>
</div>
<table>
  <tr>
    <th>Days Worked</th><th>Sessions</th><th>Avg Hours/Day</th><th>OT Rate</th>
  </tr>
  <tr>
    <td>${daysWorked}</td>
    <td>${processedRows.length}</td>
    <td>${daysWorked > 0 ? (totalHours / daysWorked).toFixed(2) : '0.00'}h</td>
    <td>1.5×</td>
  </tr>
</table>

<div class="section-title">Detailed Work Log</div>
<table>
  <tr>
    <th>Date</th><th>Day</th><th>Clock In</th><th>Clock Out</th><th>Lunch</th><th>Net Hours</th><th>Project</th><th>Rate</th><th>Cost</th>
  </tr>
  ${processedRows.map(r => `
  <tr>
    <td>${r.date}</td>
    <td>${r.dayName}</td>
    <td>${r.clockIn}</td>
    <td>${r.isActive ? '<span class="badge-active">Active</span>' : r.clockOut}</td>
    <td>${r.lunchMin > 0 ? `${r.lunchMin}min` : '—'}</td>
    <td>${r.netHours.toFixed(2)}h</td>
    <td>${r.project}</td>
    <td>${r.rate != null ? `$${r.rate.toFixed(2)}/hr${r.isEstimatedRate ? '<span style="color:#f59e0b;font-size:9px"> *</span>' : ''}` : '—'}</td>
    <td>${r.cost > 0 ? `$${r.cost.toFixed(2)}${r.isEstimatedRate ? '<span style="color:#f59e0b;font-size:9px"> *</span>' : ''}` : '—'}</td>
  </tr>`).join('')}
  <tr style="font-weight:700; background:#eff6ff;">
    <td colspan="5"><strong>Totals</strong></td>
    <td><strong>${totalHours.toFixed(2)}h</strong></td>
    <td></td><td></td>
    <td><strong>$${totalEarnings.toFixed(2)}</strong></td>
  </tr>
</table>

${processedRows.some(r => r.isEstimatedRate) ? `<p style="font-size:10px;color:#92400e;background:#fef3c7;padding:8px 12px;border-radius:6px;margin-bottom:16px;">* Rate not recorded at clock-in (legacy entry). Cost estimated using current rate of ${rateLabel}.</p>` : ''}

<div class="footer">
  <span>Confidential — ${companyName}</span>
  <span>Generated ${generatedOn}</span>
</div>
</body></html>`;

        if (Platform.OS === 'web') {
          const win = window.open('', '_blank');
          if (win) {
            win.document.write(html);
            win.document.close();
            setTimeout(() => win.print(), 400);
          }
        } else {
          // Use printAsync (opens OS print dialog) instead of printToFileAsync + shareAsync.
          // On Mac Catalyst, UIActivityViewController runs in a sandboxed WebContent process
          // that cannot read files from the app's Caches/Print folder, causing silent failures.
          // printAsync bypasses file sharing entirely — the OS print dialog handles Save as PDF.
          await Print.printAsync({ html });
        }

      } else {
        // CSV / Spreadsheet
        const safeName = selectedEmployee.name.replace(/[^a-z0-9]/gi, '_');
        let csv = `WORK HISTORY REPORT\n`;
        csv += `Employee,${selectedEmployee.name}\n`;
        csv += `Period,${periodLabel}\n`;
        csv += `Rate,${rateLabel}\n`;
        csv += `Generated,${generatedOn}\n\n`;
        csv += `SUMMARY\n`;
        csv += `Total Hours,${totalHours.toFixed(2)}\n`;
        csv += `Regular Hours,${regularHours.toFixed(2)}\n`;
        csv += `Overtime Hours,${overtimeHours.toFixed(2)}\n`;
        csv += `Total Earnings,$${totalEarnings.toFixed(2)}\n`;
        csv += `Days Worked,${daysWorked}\n`;
        csv += `Sessions,${processedRows.length}\n\n`;
        csv += `DETAILED LOG\n`;
        csv += `Date,Day,Clock In,Clock Out,Lunch (min),Net Hours,Project,Rate,Cost\n`;
        processedRows.forEach(r => {
          csv += `${r.date},${r.dayName},${r.clockIn},${r.clockOut},${r.lunchMin},${r.netHours.toFixed(2)},${r.project},${r.rate != null ? `${r.rate.toFixed(2)}${r.isEstimatedRate ? ' (est.)' : ''}` : ''},${r.cost > 0 ? `${r.cost.toFixed(2)}${r.isEstimatedRate ? ' (est.)' : ''}` : ''}\n`;
        });

        if (Platform.OS === 'web') {
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `${safeName}_work_history.csv`;
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          Alert.alert('Success', 'Spreadsheet downloaded.');
        } else {
          // documentDirectory is accessible to the share sheet on Mac Catalyst;
          // cacheDirectory is not (sandboxed WebContent process can't read it).
          const fileUri = `${FileSystem.documentDirectory}${safeName}_work_history.csv`;
          await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
          } else {
            Alert.alert('Saved', fileUri);
          }
        }
      }

      setShowReportModal(false);
    } catch (err: any) {
      console.error('[Admin] Report generation error:', err);
      Alert.alert('Error', err.message || 'Failed to generate report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super-admin')) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Access Denied' }} />
        <View style={styles.centerContent}>
          <XCircle size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorText}>You don&apos;t have permission to access this page.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{
        title: 'Employee Management',
        headerShown: true,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ fontSize: 16, color: '#2563EB' }}>‹ Back</Text>
          </TouchableOpacity>
        ),
      }} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#10B981" colors={['#10B981']} />
        }
      >
        {employeesWithRateChangeRequests.length > 0 && (
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <DollarSign size={24} color="#F59E0B" />
              <Text style={styles.alertTitle}>Pending Rate Change Requests</Text>
            </View>
            {employeesWithRateChangeRequests.map((emp: User) => (
              <View key={emp.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <Text style={styles.requestName}>{emp.name}</Text>
                  <Text style={styles.requestDate}>
                    {new Date(emp.rateChangeRequest!.requestDate).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.requestDetails}>
                  <Text style={styles.requestLabel}>Current Rate: ${emp.hourlyRate?.toFixed(2) || '0.00'}/hr</Text>
                  <Text style={styles.requestLabelNew}>New Rate: ${emp.rateChangeRequest!.newRate.toFixed(2)}/hr</Text>
                </View>
                {emp.rateChangeRequest!.reason && (
                  <Text style={styles.requestReason}>Reason: {emp.rateChangeRequest!.reason}</Text>
                )}
                <View style={styles.requestActions}>
                  <TouchableOpacity 
                    style={styles.rejectButton}
                    onPress={() => handleApproveRateChange(emp, false)}
                  >
                    <XCircle size={18} color="#FFFFFF" />
                    <Text style={styles.rejectButtonText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.approveButton}
                    onPress={() => handleApproveRateChange(emp, true)}
                  >
                    <CheckCircle size={18} color="#FFFFFF" />
                    <Text style={styles.approveButtonText}>Approve</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.searchCard}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search employees..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.filterRow}>
          {(['all', 'field', 'office'] as const).map(tab => {
            const count = tab === 'all' ? employees.length
              : tab === 'office' ? employees.filter((emp: User) => officeEmployeeIds.has(emp.id)).length
              : employees.filter((emp: User) => !officeEmployeeIds.has(emp.id)).length;
            const label = tab === 'all' ? 'All' : tab === 'field' ? 'Field' : 'Office';
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.filterTab, employeeFilter === tab && styles.filterTabActive]}
                onPress={() => setEmployeeFilter(tab)}
              >
                <Text style={[styles.filterTabText, employeeFilter === tab && styles.filterTabTextActive]}>{label} ({count})</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.employeesSection}>
          <Text style={styles.sectionTitle}>{employeeFilter === 'all' ? 'All' : employeeFilter === 'field' ? 'Field' : 'Office'} Employees ({filteredEmployees.length})</Text>
          
          {filteredEmployees.map((employee: User) => {
            const stats = getEmployeeStats(employee.id);
            const badge = getEmployeeBadge(employee);
            const isField = !officeEmployeeIds.has(employee.id);

            return (
              <View key={employee.id} style={[styles.employeeCard, stats.isClockedIn && styles.employeeCardActive]}>
                {/* Name + Active badge (no badge when off) */}
                <View style={styles.employeeHeader}>
                  <Text style={styles.employeeName}>{employee.name}</Text>
                  {stats.isClockedIn && (
                    <View style={styles.activeBadge}>
                      <View style={styles.activeDot} />
                      <Text style={styles.activeText}>Active</Text>
                    </View>
                  )}
                </View>

                {/* Role badges row */}
                <View style={styles.badgesRow}>
                  <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.roleBadgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                  {isField && (
                    <View style={[styles.fieldTypeBadge]}>
                      <HardHat size={12} color="#16A34A" />
                      <Text style={[styles.roleBadgeText, { color: '#16A34A' }]}>FIELD</Text>
                    </View>
                  )}
                </View>

                {/* Email + Phone */}
                <Text style={styles.employeeEmail}>{employee.email}</Text>
                {employee.phone && (
                  <Text style={styles.employeePhone}>{employee.phone}</Text>
                )}

                {/* Today hours + Rate inline with icons */}
                <View style={styles.inlineStatsRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Clock size={14} color="#6B7280" />
                    <Text style={styles.inlineStatText}>
                      Today: {stats.todayHours.toFixed(1)}h
                    </Text>
                  </View>
                  {employee.hourlyRate && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <DollarSign size={14} color="#6B7280" />
                      <Text style={styles.inlineStatText}>
                        ${employee.hourlyRate.toFixed(2)}/hr
                      </Text>
                    </View>
                  )}
                </View>

                {/* Actions: Timecard + Classify only */}
                <View style={styles.employeeActions}>
                  <TouchableOpacity
                    style={styles.greenActionButton}
                    onPress={() => openTimecardModal(employee)}
                  >
                    <FileText size={15} color="#16A34A" />
                    <Text style={styles.greenActionText}>Timecard</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.greenActionButton}
                    onPress={() => openClassifyModal(employee)}
                  >
                    <Building2 size={15} color="#16A34A" />
                    <Text style={styles.greenActionText}>Classify</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Modal
        visible={showReportModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Generate Work History Report</Text>

            {selectedEmployee && (
              <View style={styles.modalInfo}>
                <Text style={styles.modalInfoLabel}>Employee</Text>
                <Text style={styles.modalInfoValue}>{selectedEmployee.name}</Text>
                {selectedEmployee.hourlyRate && (
                  <Text style={styles.modalInfoSub}>${selectedEmployee.hourlyRate.toFixed(2)}/hr</Text>
                )}
              </View>
            )}

            <Text style={styles.periodLabel}>Select Time Period</Text>
            <View style={styles.periodButtons}>
              {([
                { key: 'current-week', label: 'Current Week' },
                { key: 'last-week',    label: 'Last Week' },
              ] as const).map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.periodButton, reportPeriod === key && styles.periodButtonActive]}
                  onPress={() => setReportPeriod(key)}
                >
                  <FileText size={14} color={reportPeriod === key ? '#2563EB' : '#6B7280'} />
                  <Text style={[styles.periodButtonText, reportPeriod === key && styles.periodButtonTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[styles.periodButtons, { marginTop: 8 }]}>
              {([
                { key: 'this-month',  label: 'This Month' },
                { key: 'last-month',  label: 'Last Month' },
              ] as const).map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.periodButton, reportPeriod === key && styles.periodButtonActive]}
                  onPress={() => setReportPeriod(key)}
                >
                  <FileText size={14} color={reportPeriod === key ? '#2563EB' : '#6B7280'} />
                  <Text style={[styles.periodButtonText, reportPeriod === key && styles.periodButtonTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.periodButton, styles.periodButtonFull, reportPeriod === 'all-time' && styles.periodButtonActive, { marginTop: 8 }]}
              onPress={() => setReportPeriod('all-time')}
            >
              <FileText size={14} color={reportPeriod === 'all-time' ? '#2563EB' : '#6B7280'} />
              <Text style={[styles.periodButtonText, reportPeriod === 'all-time' && styles.periodButtonTextActive]}>
                All Time
              </Text>
            </TouchableOpacity>

            <View style={[styles.modalButtons, { marginTop: 24 }]}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowReportModal(false)}
                disabled={isGeneratingReport}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reportExportButton, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
                onPress={() => generateWorkHistoryReport('csv')}
                disabled={isGeneratingReport}
              >
                {isGeneratingReport ? (
                  <ActivityIndicator size="small" color="#2563EB" />
                ) : (
                  <Text style={[styles.reportExportButtonText, { color: '#2563EB' }]}>Spreadsheet</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reportExportButton, { backgroundColor: '#2563EB' }]}
                onPress={() => generateWorkHistoryReport('pdf')}
                disabled={isGeneratingReport}
              >
                {isGeneratingReport ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.reportExportButtonText, { color: '#FFFFFF' }]}>Export PDF</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEditRateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditRateModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} />
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Hourly Rate</Text>

              {selectedEmployee && (
                <>
                  <View style={styles.modalInfo}>
                    <Text style={styles.modalInfoLabel}>Employee:</Text>
                    <Text style={styles.modalInfoValue}>{selectedEmployee.name}</Text>
                  </View>

                  <View style={styles.modalInfo}>
                    <Text style={styles.modalInfoLabel}>Current Hourly Rate:</Text>
                    <Text style={styles.modalInfoValue}>
                      ${selectedEmployee.hourlyRate?.toFixed(2) || '0.00'}/hr
                    </Text>
                  </View>

                  <View style={styles.rateInputSection}>
                    <Text style={styles.rateInputLabel}>New Hourly Rate:</Text>
                    <TextInput
                      style={styles.rateInput}
                      value={editingRate}
                      onChangeText={(text) => {
                        // Only allow numbers and decimal point
                        const filtered = text.replace(/[^0-9.]/g, '');
                        // Ensure only one decimal point
                        const parts = filtered.split('.');
                        if (parts.length > 2) return;
                        setEditingRate(filtered);
                      }}
                      placeholder="25.50"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />
                  </View>
                </>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowEditRateModal(false);
                    setSelectedEmployee(null);
                    setEditingRate('');
                  }}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmButton}
                  onPress={handleUpdateRate}
                  disabled={isSaving}
                >
                  <Text style={styles.modalConfirmButtonText}>
                    {isSaving ? 'Updating...' : 'Update Rate'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Classify Employee Modal */}
      <Modal
        visible={showClassifyModal}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowClassifyModal(false); setShowRolePicker(false); }}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { setShowClassifyModal(false); setShowRolePicker(false); }} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Classify Employee</Text>

            {selectedEmployee && (
              <View style={styles.modalInfo}>
                <Text style={styles.modalInfoLabel}>Employee:</Text>
                <Text style={styles.modalInfoValue}>{selectedEmployee.name}</Text>
              </View>
            )}

            <Text style={styles.classifySectionLabel}>Employee Type</Text>
            <View style={styles.classifyCardsRow}>
              <TouchableOpacity
                style={[styles.classifyCard, classifyType === 'field' && styles.classifyCardSelected]}
                onPress={() => { setClassifyType('field'); setClassifyOfficeRole(''); }}
              >
                <View style={[styles.classifyIconWrap, classifyType === 'field' && { backgroundColor: '#F3E8FF' }]}>
                  <HardHat size={28} color={classifyType === 'field' ? '#7C3AED' : '#9CA3AF'} />
                </View>
                <Text style={[styles.classifyCardTitle, classifyType === 'field' && { color: '#7C3AED' }]}>Field Worker</Text>
                <Text style={styles.classifyCardSub}>Works on project sites</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.classifyCard, classifyType === 'office' && styles.classifyCardSelected]}
                onPress={() => setClassifyType('office')}
              >
                <View style={[styles.classifyIconWrap, classifyType === 'office' && { backgroundColor: '#F3E8FF' }]}>
                  <ClipboardList size={28} color={classifyType === 'office' ? '#7C3AED' : '#9CA3AF'} />
                </View>
                <Text style={[styles.classifyCardTitle, classifyType === 'office' && { color: '#7C3AED' }]}>Office Staff</Text>
                <Text style={styles.classifyCardSub}>Works in the office</Text>
              </TouchableOpacity>
            </View>

            {classifyType === 'office' && (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.classifySectionLabel}>Office Role</Text>
                <TouchableOpacity
                  style={styles.roleDropdown}
                  onPress={() => setShowRolePicker(true)}
                >
                  <Text style={[styles.roleDropdownText, !classifyOfficeRole && { color: '#9CA3AF' }]}>
                    {classifyOfficeRole || 'Select a role...'}
                  </Text>
                  <ChevronDown size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
            )}

            <View style={[styles.modalButtons, { marginTop: 24 }]}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => { setShowClassifyModal(false); setShowRolePicker(false); }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, { backgroundColor: '#7C3AED' }]}
                onPress={handleSaveClassify}
                disabled={isSavingClassify || (classifyType === 'office' && !classifyOfficeRole)}
              >
                <Text style={styles.modalConfirmButtonText}>
                  {isSavingClassify ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Office Role Picker Modal */}
      <Modal
        visible={showRolePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRolePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowRolePicker(false)} />
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Select Office Role</Text>
            <ScrollView style={{ marginTop: 8 }}>
              {OFFICE_ROLES.map((role) => {
                const RoleIcon = role.icon;
                const isSelected = classifyOfficeRole === role.name;
                return (
                  <TouchableOpacity
                    key={role.name}
                    style={[styles.rolePickerRow, isSelected && { backgroundColor: '#F3E8FF' }]}
                    onPress={() => {
                      setClassifyOfficeRole(role.name);
                      setShowRolePicker(false);
                    }}
                  >
                    <View style={[styles.rolePickerIcon, { backgroundColor: role.bg }]}>
                      <RoleIcon size={20} color={role.color} />
                    </View>
                    <Text style={[styles.rolePickerName, isSelected && { color: '#7C3AED', fontWeight: '600' as const }]}>{role.name}</Text>
                    {isSelected && <CheckCircle size={20} color="#7C3AED" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Generate Timecard Modal */}
      <Modal
        visible={showTimecardModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTimecardModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowTimecardModal(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Generate Timecard</Text>

            {selectedEmployee && (
              <>
                <View style={styles.modalInfo}>
                  <Text style={styles.modalInfoLabel}>Employee:</Text>
                  <Text style={styles.modalInfoValue}>{selectedEmployee.name}</Text>
                </View>
                <View style={styles.modalInfo}>
                  <Text style={styles.modalInfoLabel}>Hourly Rate:</Text>
                  <Text style={styles.modalInfoValue}>
                    {selectedEmployee.hourlyRate ? `$${selectedEmployee.hourlyRate.toFixed(2)}/hr` : 'Not set'}
                  </Text>
                </View>
              </>
            )}

            <Text style={[styles.classifySectionLabel, { marginTop: 8 }]}>Period:</Text>
            <View style={styles.timecardToggleRow}>
              <TouchableOpacity
                style={[styles.timecardToggle, timecardPeriod === 'weekly' && styles.timecardToggleActive]}
                onPress={() => setTimecardPeriod('weekly')}
              >
                <Text style={[styles.timecardToggleText, timecardPeriod === 'weekly' && styles.timecardToggleTextActive]}>Weekly</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timecardToggle, timecardPeriod === 'bi-weekly' && styles.timecardToggleActive]}
                onPress={() => setTimecardPeriod('bi-weekly')}
              >
                <Text style={[styles.timecardToggleText, timecardPeriod === 'bi-weekly' && styles.timecardToggleTextActive]}>Bi-Weekly</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.modalButtons, { marginTop: 24 }]}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowTimecardModal(false)}
                disabled={isGeneratingTimecard}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleGenerateTimecard}
                disabled={isGeneratingTimecard}
              >
                {isGeneratingTimecard ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmButtonText}>Generate</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Timecard Generated Success Modal */}
      <Modal
        visible={showTimecardSuccess}
        animationType="fade"
        transparent
        onRequestClose={() => setShowTimecardSuccess(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <CheckCircle size={48} color="#10B981" style={{ marginBottom: 16 }} />
            <Text style={styles.successTitle}>Timecard Generated</Text>

            {timecardResult && (
              <View style={styles.successStatsContainer}>
                <View style={styles.successStatRow}>
                  <Text style={styles.successStatLabel}>Employee</Text>
                  <Text style={styles.successStatValue}>{timecardResult.employeeName}</Text>
                </View>
                <View style={styles.successStatRow}>
                  <Text style={styles.successStatLabel}>Total Hours</Text>
                  <Text style={styles.successStatValue}>{timecardResult.totalHours.toFixed(2)}h</Text>
                </View>
                <View style={styles.successStatRow}>
                  <Text style={styles.successStatLabel}>Regular</Text>
                  <Text style={styles.successStatValue}>{timecardResult.regularHours.toFixed(2)}h</Text>
                </View>
                <View style={styles.successStatRow}>
                  <Text style={styles.successStatLabel}>Overtime</Text>
                  <Text style={styles.successStatValue}>{timecardResult.overtimeHours.toFixed(2)}h</Text>
                </View>
                <View style={styles.successStatRow}>
                  <Text style={styles.successStatLabel}>Total Earnings</Text>
                  <Text style={[styles.successStatValue, { color: '#10B981' }]}>
                    ${timecardResult.totalEarnings.toFixed(2)}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.successOkButton}
              onPress={() => setShowTimecardSuccess(false)}
            >
              <Text style={styles.successOkText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  alertCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#92400E',
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  requestDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  requestDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  requestLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  requestLabelNew: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#059669',
  },
  requestReason: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 12,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    borderRadius: 6,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 6,
  },
  approveButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    fontSize: 16,
    color: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 10,
    outlineStyle: 'none' as any,
  },
  filterRow: {
    flexDirection: 'row' as const,
    gap: 0,
    marginBottom: 16,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterTabActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#64748B',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  employeesSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  employeeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  employeeCardActive: {
    borderLeftColor: '#22C55E',
    borderLeftWidth: 3,
  },
  employeeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  employeeEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  employeePhone: {
    fontSize: 14,
    color: '#6B7280',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
  },
  activeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#22C55E',
  },
  clockedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  offBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  offBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#9CA3AF',
  },
  sessionBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  sessionText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500' as const,
  },
  statsGrid: {
    flexDirection: 'row' as const,
    alignItems: 'stretch' as const,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden' as const,
  },
  statBox: {
    flex: 1,
    alignItems: 'center' as const,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  statBoxDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  statBoxLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500' as const,
    marginBottom: 3,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  statBoxValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  statBoxValueLive: {
    color: '#059669',
  },
  statBoxValueMuted: {
    color: '#9CA3AF',
    fontSize: 20,
  },
  statBoxSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  clockedInText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#059669',
  },
  employeeStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: '#4B5563',
  },
  employeeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 8,
    borderRadius: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 20,
  },
  modalInfo: {
    marginBottom: 16,
  },
  modalInfoLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  modalInfoValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  periodSelector: {
    marginBottom: 24,
  },
  periodLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  periodButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  periodButtonTextActive: {
    color: '#2563EB',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  modalInfoSub: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600' as const,
    marginTop: 2,
  },
  periodButtonFull: {
    flex: 0,
    width: '100%',
  },
  reportExportButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reportExportButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  rateInputSection: {
    marginBottom: 24,
  },
  rateInputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 8,
  },
  rateInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1F2937',
  },
  // Role badge on employee cards
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  // Badges row below name
  badgesRow: {
    flexDirection: 'row' as const,
    gap: 8,
    marginBottom: 8,
  },
  // FIELD type badge (green with border + hardhat icon)
  fieldTypeBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  // Inline stats row (Today + Rate)
  inlineStatsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 20,
    marginTop: 10,
    marginBottom: 12,
  },
  inlineStatText: {
    fontSize: 14,
    color: '#4B5563',
  },
  // Green action buttons (Timecard, Classify)
  greenActionButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  greenActionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#16A34A',
  },
  // Classify modal
  classifySectionLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  classifyCardsRow: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  classifyCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center' as const,
  },
  classifyCardSelected: {
    borderColor: '#7C3AED',
    backgroundColor: '#FAF5FF',
  },
  classifyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 10,
  },
  classifyCardTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  classifyCardSub: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center' as const,
  },
  // Role dropdown
  roleDropdown: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  roleDropdownText: {
    fontSize: 15,
    color: '#1F2937',
  },
  // Role picker rows
  rolePickerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 12,
  },
  rolePickerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  rolePickerName: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  // Timecard toggle
  timecardToggleRow: {
    flexDirection: 'row' as const,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
  },
  timecardToggle: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center' as const,
  },
  timecardToggleActive: {
    backgroundColor: '#2563EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  timecardToggleText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#64748B',
  },
  timecardToggleTextActive: {
    color: '#FFFFFF',
  },
  // Success modal
  successModal: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 32,
    marginHorizontal: 24,
    alignItems: 'center' as const,
    alignSelf: 'center' as const,
    marginTop: 'auto' as any,
    marginBottom: 'auto' as any,
    width: '90%' as any,
    maxWidth: 400,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 24,
  },
  successStatsContainer: {
    width: '100%' as any,
    marginBottom: 24,
  },
  successStatRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  successStatLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  successStatValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  successOkButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 48,
    alignItems: 'center' as const,
  },
  successOkText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});

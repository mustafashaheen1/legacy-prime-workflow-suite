import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/contexts/AppContext';
import { ScheduledTask, User } from '@/types';
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Check,
  X,
  Briefcase,
  CircleCheck,
  UserPlus,
  AlertCircle,
  Calendar,
} from 'lucide-react-native';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const DAY_COLUMN_WIDTH = 110;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CrewScheduleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, projects } = useApp();

  const isAdmin = user?.role === 'admin' || user?.role === 'super-admin';

  // ── State ──────────────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<ScheduledTask | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);

  // ── Load employees ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.companyId) return;
    fetch(`${API_BASE}/api/get-users?companyId=${user.companyId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.users)) {
          setEmployees(
            (data.users as User[]).filter(
              u => u.role === 'employee' || u.role === 'field-employee' || u.role === 'salesperson'
            )
          );
        }
      })
      .catch(() => {});
  }, [user?.companyId]);

  // ── Load tasks for ALL active projects ─────────────────────────────────────
  // Edge case: scheduledTasks in AppContext loads one project at a time.
  // Crew schedule needs all projects, so we fetch independently here.
  useEffect(() => {
    const activeProjects = projects.filter(p => p.status === 'active');
    if (activeProjects.length === 0) {
      setLoadingTasks(false);
      return;
    }
    setLoadingTasks(true);
    Promise.all(
      activeProjects.map(p =>
        fetch(`${API_BASE}/api/get-scheduled-tasks?projectId=${p.id}`)
          .then(r => r.json())
          .then(data => (data.scheduledTasks ?? []) as ScheduledTask[])
          .catch(() => [] as ScheduledTask[])
      )
    )
      .then(results => setTasks(results.flat()))
      .finally(() => setLoadingTasks(false));
  }, [projects]);

  // ── Week navigation ────────────────────────────────────────────────────────
  const weekDates = useMemo<Date[]>(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(currentWeekStart);
        d.setDate(currentWeekStart.getDate() + i);
        return d;
      }),
    [currentWeekStart]
  );

  const weekLabel = useMemo(() => {
    const s = weekDates[0];
    const e = weekDates[6];
    if (s.getMonth() === e.getMonth()) {
      return `${s.toLocaleDateString('en-US', { month: 'long' })} ${s.getDate()} – ${e.getDate()}, ${s.getFullYear()}`;
    }
    return `${s.toLocaleDateString('en-US', { month: 'short' })} ${s.getDate()} – ${e.toLocaleDateString('en-US', { month: 'short' })} ${e.getDate()}, ${e.getFullYear()}`;
  }, [weekDates]);

  const goToPreviousWeek = useCallback(() => {
    setCurrentWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }, []);

  const goToNextWeek = useCallback(() => {
    setCurrentWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }, []);

  const goToThisWeek = useCallback(() => setCurrentWeekStart(getMonday(new Date())), []);

  const isToday = useCallback((date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }, []);

  // ── Derived data ───────────────────────────────────────────────────────────
  const unassignedTasks = useMemo(
    () => tasks.filter(t => !t.assignedEmployeeIds?.length),
    [tasks]
  );

  const displayTasks = useMemo(() => {
    if (!isAdmin) {
      return tasks.filter(t => t.assignedEmployeeIds?.includes(user?.id ?? ''));
    }
    if (selectedEmployeeFilter) {
      return tasks.filter(t => t.assignedEmployeeIds?.includes(selectedEmployeeFilter));
    }
    return tasks.filter(t => (t.assignedEmployeeIds?.length ?? 0) > 0);
  }, [isAdmin, tasks, selectedEmployeeFilter, user?.id]);

  const getTasksForDate = useCallback(
    (date: Date, taskList: ScheduledTask[]): ScheduledTask[] => {
      const time = new Date(date).setHours(0, 0, 0, 0);
      return taskList.filter(t => {
        const start = new Date(t.startDate).setHours(0, 0, 0, 0);
        const end = new Date(t.endDate).setHours(0, 0, 0, 0);
        // endDate is exclusive (matches Gantt duration logic)
        return time >= start && time < end;
      });
    },
    []
  );

  // O(1) lookups — avoid scanning arrays in render loops
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p.name])), [projects]);
  const employeeMap = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);

  const getInitials = useCallback(
    (name: string) =>
      name
        .split(' ')
        .map(n => n[0] ?? '')
        .join('')
        .toUpperCase()
        .slice(0, 2),
    []
  );

  // ── Assignment toggle ──────────────────────────────────────────────────────
  // Direct API call (not updateScheduledTasks) — avoids full-array replace risk
  // when tasks from other projects haven't been loaded into AppContext yet.
  const openAssignModal = useCallback(
    (task: ScheduledTask) => {
      if (!isAdmin) return;
      setSelectedTask(task);
      setShowAssignModal(true);
    },
    [isAdmin]
  );

  const closeAssignModal = useCallback(() => {
    setShowAssignModal(false);
    setSelectedTask(null);
  }, []);

  const toggleEmployeeAssignment = useCallback(
    async (employeeId: string) => {
      if (!selectedTask || savingAssignment) return;

      const current = selectedTask.assignedEmployeeIds ?? [];
      const newAssigned = current.includes(employeeId)
        ? current.filter(id => id !== employeeId)
        : [...current, employeeId];

      const updatedTask: ScheduledTask = { ...selectedTask, assignedEmployeeIds: newAssigned };
      const snapshot = selectedTask; // keep for revert

      // Optimistic update — instant UI response
      setTasks(prev => prev.map(t => (t.id === selectedTask.id ? updatedTask : t)));
      setSelectedTask(updatedTask);

      setSavingAssignment(true);
      try {
        const res = await fetch(`${API_BASE}/api/update-scheduled-task`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedTask),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch {
        // Revert on failure
        setTasks(prev => prev.map(t => (t.id === snapshot.id ? snapshot : t)));
        setSelectedTask(snapshot);
      } finally {
        setSavingAssignment(false);
      }
    },
    [selectedTask, savingAssignment]
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* HEADER */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={20} color="#1E3A5F" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {isAdmin ? 'Crew Schedule' : 'My Schedule'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {isAdmin ? `${employees.length} employees` : 'Your assigned tasks'}
          </Text>
        </View>
        <TouchableOpacity style={styles.todayBtn} onPress={goToThisWeek}>
          <Text style={styles.todayBtnText}>Today</Text>
        </TouchableOpacity>
      </View>

      {/* WEEK NAVIGATION */}
      <View style={styles.weekNav}>
        <TouchableOpacity style={styles.weekNavBtn} onPress={goToPreviousWeek} hitSlop={8}>
          <ChevronLeft size={18} color="#475569" />
        </TouchableOpacity>
        <Text style={styles.weekLabel}>{weekLabel}</Text>
        <TouchableOpacity style={styles.weekNavBtn} onPress={goToNextWeek} hitSlop={8}>
          <ChevronRight size={18} color="#475569" />
        </TouchableOpacity>
      </View>

      {/* EMPLOYEE FILTER — admin only */}
      {isAdmin && (
        <View style={styles.filterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
          >
            <TouchableOpacity
              style={[styles.filterChip, !selectedEmployeeFilter && styles.filterChipActive]}
              onPress={() => setSelectedEmployeeFilter(null)}
            >
              <Users size={13} color={!selectedEmployeeFilter ? '#FFF' : '#475569'} />
              <Text style={[styles.filterChipText, !selectedEmployeeFilter && styles.filterChipTextActive]}>
                All Crew
              </Text>
            </TouchableOpacity>

            {employees.map(emp => {
              const active = selectedEmployeeFilter === emp.id;
              return (
                <TouchableOpacity
                  key={emp.id}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setSelectedEmployeeFilter(active ? null : emp.id)}
                >
                  <View style={[styles.filterAvatar, active && styles.filterAvatarActive]}>
                    <Text style={[styles.filterAvatarText, active && styles.filterAvatarTextActive]}>
                      {getInitials(emp.name)}
                    </Text>
                  </View>
                  <Text
                    style={[styles.filterChipText, active && styles.filterChipTextActive]}
                    numberOfLines={1}
                  >
                    {emp.name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* BODY */}
      {loadingTasks ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#1E3A5F" />
          <Text style={styles.loadingText}>Loading schedule…</Text>
        </View>
      ) : (
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

          {/* WEEKLY GRID */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.weekGrid}>
              {weekDates.map((date, idx) => {
                const dayTasks = getTasksForDate(date, displayTasks);
                const today = isToday(date);
                const isPast = date.getTime() < new Date().setHours(0, 0, 0, 0) && !today;

                return (
                  <View
                    key={idx}
                    style={[
                      styles.dayColumn,
                      today && styles.dayColumnToday,
                      isPast && styles.dayColumnPast,
                    ]}
                  >
                    {/* Day header */}
                    <View style={[styles.dayHeader, today && styles.dayHeaderToday]}>
                      <Text style={[styles.dayWeekday, today && styles.dayWeekdayToday]}>
                        {WEEKDAYS[idx]}
                      </Text>
                      <View style={[styles.dayDateCircle, today && styles.dayDateCircleToday]}>
                        <Text style={[styles.dayDateText, today && styles.dayDateTextToday]}>
                          {date.getDate()}
                        </Text>
                      </View>
                    </View>

                    {/* Day tasks */}
                    <View style={styles.dayTasks}>
                      {dayTasks.length === 0 ? (
                        <View style={styles.emptyDay}>
                          <Text style={styles.emptyDayDash}>–</Text>
                        </View>
                      ) : (
                        dayTasks.map(task => {
                          const completed = task.completed === true;
                          return (
                            <TouchableOpacity
                              key={task.id}
                              style={[
                                styles.taskCard,
                                {
                                  borderLeftColor: completed ? '#16A34A' : task.color,
                                  backgroundColor: completed
                                    ? '#F0FDF4'
                                    : hexToRgba(task.color, 0.08),
                                },
                              ]}
                              onPress={() => openAssignModal(task)}
                              activeOpacity={isAdmin ? 0.7 : 1}
                            >
                              <View style={styles.taskCardTop}>
                                {completed && <CircleCheck size={11} color="#16A34A" />}
                                <Text
                                  style={[
                                    styles.taskCardCategory,
                                    { color: completed ? '#15803D' : task.color },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {task.category}
                                </Text>
                              </View>

                              <View style={styles.taskCardMeta}>
                                <Briefcase size={9} color="#94A3B8" />
                                <Text style={styles.taskCardProject} numberOfLines={1}>
                                  {projectMap.get(task.projectId) ?? '—'}
                                </Text>
                              </View>

                              {!!task.notes && (
                                <Text style={styles.taskCardNote} numberOfLines={1}>
                                  {task.notes}
                                </Text>
                              )}

                              {isAdmin && (task.assignedEmployeeIds?.length ?? 0) > 0 && (
                                <View style={styles.crewRow}>
                                  {(task.assignedEmployeeIds ?? []).slice(0, 3).map((empId, i) => {
                                    const emp = employeeMap.get(empId);
                                    return (
                                      <View
                                        key={empId}
                                        style={[styles.miniAvatar, i > 0 && styles.miniAvatarOverlap]}
                                      >
                                        <Text style={styles.miniAvatarText}>
                                          {getInitials(emp?.name ?? '?')}
                                        </Text>
                                      </View>
                                    );
                                  })}
                                  {(task.assignedEmployeeIds?.length ?? 0) > 3 && (
                                    <Text style={styles.crewMore}>
                                      +{(task.assignedEmployeeIds?.length ?? 0) - 3}
                                    </Text>
                                  )}
                                </View>
                              )}
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>

          {/* UNASSIGNED TASKS — admin only */}
          {isAdmin && unassignedTasks.length > 0 && (
            <View style={styles.unassignedSection}>
              <View style={styles.unassignedHeaderRow}>
                <AlertCircle size={16} color="#D97706" />
                <Text style={styles.unassignedTitle}>
                  Unassigned Tasks ({unassignedTasks.length})
                </Text>
              </View>
              <Text style={styles.unassignedSubtitle}>Tap a card to assign crew</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.unassignedScroll}
              >
                {unassignedTasks.slice(0, 15).map(task => (
                  <TouchableOpacity
                    key={task.id}
                    style={[styles.unassignedCard, { borderTopColor: task.color }]}
                    onPress={() => openAssignModal(task)}
                  >
                    <Text
                      style={[styles.unassignedCategory, { color: task.color }]}
                      numberOfLines={1}
                    >
                      {task.category}
                    </Text>
                    <Text style={styles.unassignedProject} numberOfLines={1}>
                      {projectMap.get(task.projectId) ?? '—'}
                    </Text>
                    <Text style={styles.unassignedDates}>
                      {new Date(task.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' – '}
                      {new Date(task.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                    <View style={styles.unassignedBtn}>
                      <UserPlus size={11} color="#2563EB" />
                      <Text style={styles.unassignedBtnText}>Assign</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* EMPTY STATE — employee with no assigned tasks */}
          {!isAdmin && displayTasks.length === 0 && (
            <View style={styles.emptyState}>
              <Calendar size={48} color="#CBD5E1" />
              <Text style={styles.emptyStateTitle}>No Tasks Assigned</Text>
              <Text style={styles.emptyStateSubtitle}>
                You don't have any scheduled tasks yet.{'\n'}Your admin will assign work to you.
              </Text>
            </View>
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>
      )}

      {/* ASSIGN CREW MODAL */}
      <Modal
        visible={showAssignModal}
        transparent
        animationType="slide"
        onRequestClose={closeAssignModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: Platform.OS === 'ios' ? 34 : 20 }]}>
            <View style={styles.modalHandle} />

            {selectedTask && (
              <>
                {/* Modal header */}
                <View style={styles.modalHeader}>
                  <View style={[styles.modalDot, { backgroundColor: selectedTask.color }]} />
                  <View style={styles.modalTitleBlock}>
                    <Text style={styles.modalTitle} numberOfLines={1}>
                      {selectedTask.category}
                    </Text>
                    <Text style={styles.modalSubtitle}>
                      {projectMap.get(selectedTask.projectId) ?? '—'}
                      {' · '}
                      {new Date(selectedTask.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' – '}
                      {new Date(selectedTask.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={closeAssignModal} hitSlop={8}>
                    <X size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalSectionLabel}>ASSIGN CREW MEMBERS</Text>

                {/* Employee list */}
                <ScrollView style={styles.employeeList} showsVerticalScrollIndicator={false}>
                  {employees.length === 0 && (
                    <View style={styles.noEmployees}>
                      <Users size={32} color="#CBD5E1" />
                      <Text style={styles.noEmployeesText}>No employees found</Text>
                    </View>
                  )}
                  {employees.map(emp => {
                    const assigned = (selectedTask.assignedEmployeeIds ?? []).includes(emp.id);
                    const roleLabel =
                      emp.role === 'field-employee' ? 'Field' :
                      emp.role === 'salesperson' ? 'Sales' : 'Employee';

                    return (
                      <TouchableOpacity
                        key={emp.id}
                        style={[styles.employeeRow, assigned && styles.employeeRowAssigned]}
                        onPress={() => toggleEmployeeAssignment(emp.id)}
                        disabled={savingAssignment}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.empAvatar, assigned && styles.empAvatarAssigned]}>
                          <Text style={[styles.empAvatarText, assigned && styles.empAvatarTextAssigned]}>
                            {getInitials(emp.name)}
                          </Text>
                        </View>
                        <View style={styles.empInfo}>
                          <Text style={styles.empName}>{emp.name}</Text>
                          <Text style={styles.empRole}>{roleLabel}</Text>
                        </View>
                        <View style={[styles.checkbox, assigned && styles.checkboxActive]}>
                          {assigned && <Check size={13} color="#FFF" />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <TouchableOpacity style={styles.doneBtn} onPress={closeAssignModal}>
                  <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:               { flex: 1, backgroundColor: '#F1F5F9' },

  // Header
  headerBar:               { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn:                 { marginRight: 10, padding: 2 },
  headerCenter:            { flex: 1 },
  headerTitle:             { fontSize: 18, fontWeight: '700', color: '#1E3A5F' },
  headerSubtitle:          { fontSize: 12, color: '#64748B', marginTop: 1 },
  todayBtn:                { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#1E3A5F' },
  todayBtnText:            { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },

  // Week nav
  weekNav:                 { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  weekNavBtn:              { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  weekLabel:               { fontSize: 13, fontWeight: '600', color: '#334155' },

  // Filter bar
  filterBar:               { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingVertical: 8 },
  filterContent:           { paddingHorizontal: 12, gap: 6 },
  filterChip:              { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  filterChipActive:        { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },
  filterChipText:          { fontSize: 12, fontWeight: '500', color: '#475569' },
  filterChipTextActive:    { color: '#FFFFFF' },
  filterAvatar:            { width: 20, height: 20, borderRadius: 10, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  filterAvatarActive:      { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterAvatarText:        { fontSize: 8, fontWeight: '700', color: '#64748B' },
  filterAvatarTextActive:  { color: '#FFFFFF' },

  // Body
  body:                    { flex: 1 },
  loadingState:            { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:             { fontSize: 14, color: '#64748B' },

  // Weekly grid
  weekGrid:                { flexDirection: 'row', paddingHorizontal: 8, paddingTop: 10, gap: 6 },
  dayColumn:               { width: DAY_COLUMN_WIDTH, backgroundColor: '#FFFFFF', borderRadius: 10, overflow: 'hidden', minHeight: 200 },
  dayColumnToday:          { borderWidth: 1.5, borderColor: '#2563EB' },
  dayColumnPast:           { opacity: 0.65 },
  dayHeader:               { alignItems: 'center', paddingVertical: 8, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dayHeaderToday:          { backgroundColor: '#EFF6FF' },
  dayWeekday:              { fontSize: 10, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  dayWeekdayToday:         { color: '#2563EB' },
  dayDateCircle:           { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  dayDateCircleToday:      { backgroundColor: '#2563EB' },
  dayDateText:             { fontSize: 13, fontWeight: '700', color: '#334155' },
  dayDateTextToday:        { color: '#FFFFFF' },

  // Day tasks
  dayTasks:                { padding: 4, gap: 4, minHeight: 140 },
  emptyDay:                { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  emptyDayDash:            { fontSize: 14, color: '#CBD5E1' },

  // Task card
  taskCard:                { borderLeftWidth: 3, borderRadius: 6, padding: 6 },
  taskCardTop:             { flexDirection: 'row', alignItems: 'center', gap: 3 },
  taskCardCategory:        { fontSize: 10, fontWeight: '700', flex: 1 },
  taskCardMeta:            { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  taskCardProject:         { fontSize: 9, color: '#64748B', flex: 1 },
  taskCardNote:            { fontSize: 8, color: '#94A3B8', marginTop: 2 },
  crewRow:                 { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  miniAvatar:              { width: 18, height: 18, borderRadius: 9, backgroundColor: '#1E3A5F', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFFFFF' },
  miniAvatarOverlap:       { marginLeft: -6 },
  miniAvatarText:          { fontSize: 7, fontWeight: '700', color: '#FFFFFF' },
  crewMore:                { fontSize: 9, fontWeight: '600', color: '#64748B', marginLeft: 4 },

  // Unassigned section
  unassignedSection:       { marginHorizontal: 12, marginTop: 16, backgroundColor: '#FFFBEB', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#FDE68A' },
  unassignedHeaderRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unassignedTitle:         { fontSize: 14, fontWeight: '700', color: '#92400E' },
  unassignedSubtitle:      { fontSize: 12, color: '#B45309', marginTop: 3, marginBottom: 10 },
  unassignedScroll:        { marginHorizontal: -4 },
  unassignedCard:          { width: 140, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 10, marginRight: 8, borderTopWidth: 3 },
  unassignedCategory:      { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  unassignedProject:       { fontSize: 10, color: '#64748B', marginBottom: 4 },
  unassignedDates:         { fontSize: 9, color: '#94A3B8', marginBottom: 8 },
  unassignedBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingVertical: 5, borderRadius: 6 },
  unassignedBtnText:       { fontSize: 10, fontWeight: '600', color: '#2563EB' },

  // Empty state
  emptyState:              { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 40 },
  emptyStateTitle:         { fontSize: 18, fontWeight: '700', color: '#334155', marginTop: 16 },
  emptyStateSubtitle:      { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 8, lineHeight: 22 },

  bottomPadding:           { height: 40 },

  // Modal
  modalOverlay:            { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet:              { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  modalHandle:             { width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  modalHeader:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 10 },
  modalDot:                { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  modalTitleBlock:         { flex: 1 },
  modalTitle:              { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  modalSubtitle:           { fontSize: 12, color: '#64748B', marginTop: 2 },
  modalSectionLabel:       { fontSize: 11, fontWeight: '600', color: '#94A3B8', letterSpacing: 0.8, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 },

  // Employee rows
  employeeList:            { paddingHorizontal: 12, maxHeight: 340 },
  employeeRow:             { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4, backgroundColor: '#F8FAFC' },
  employeeRowAssigned:     { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  empAvatar:               { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  empAvatarAssigned:       { backgroundColor: '#1E3A5F' },
  empAvatarText:           { fontSize: 13, fontWeight: '700', color: '#64748B' },
  empAvatarTextAssigned:   { color: '#FFFFFF' },
  empInfo:                 { flex: 1, marginLeft: 12 },
  empName:                 { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  empRole:                 { fontSize: 11, color: '#64748B', marginTop: 1 },
  checkbox:                { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  checkboxActive:          { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  noEmployees:             { alignItems: 'center', paddingVertical: 32, gap: 8 },
  noEmployeesText:         { fontSize: 14, color: '#94A3B8' },

  // Done button
  doneBtn:                 { marginHorizontal: 20, marginTop: 12, backgroundColor: '#1E3A5F', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  doneBtnText:             { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});

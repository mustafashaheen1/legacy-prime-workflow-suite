import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Plus, CheckSquare } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DailyTask } from '@/types';
import { useDailyTaskResponsive } from './hooks/useDailyTaskResponsive';
import DailyTaskCard from './DailyTaskCard';

type TaskFilter = 'today' | 'upcoming' | 'all';

interface DailyTasksSidebarProps {
  visible: boolean;
  onClose: () => void;
  onAddTask: () => void;
  tasks: DailyTask[];
  onToggleComplete: (task: DailyTask) => void;
  onDeleteTask: (taskId: string) => void;
}

export default function DailyTasksSidebar({
  visible,
  onClose,
  onAddTask,
  tasks,
  onToggleComplete,
  onDeleteTask,
}: DailyTasksSidebarProps) {
  const responsive = useDailyTaskResponsive();
  const insets = useSafeAreaInsets();
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('today');

  const filteredTasks = useMemo(() => {
    if (!tasks || !Array.isArray(tasks)) return [];
    const today = new Date().toISOString().split('T')[0];
    const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    switch (taskFilter) {
      case 'today':
        return tasks.filter((t) => t.dueDate === today);
      case 'upcoming':
        return tasks.filter((t) => t.dueDate >= today && t.dueDate <= weekEnd && !t.completed);
      case 'all':
        return [...tasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      default:
        return tasks;
    }
  }, [tasks, taskFilter]);

  const pendingCount = tasks?.filter((t) => !t.completed).length || 0;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Backdrop */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        {/* Sidebar */}
        <View style={[styles.sidebar, { width: responsive.sidebarWidth }]}>
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
            <View style={styles.headerTop}>
              <View style={styles.headerText}>
                <Text style={styles.title}>Daily Tasks</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statBadge}>
                    <Text style={styles.statNumber}>{tasks?.length || 0}</Text>
                    <Text style={styles.statLabel}>Total</Text>
                  </View>
                  <View style={[styles.statBadge, styles.statBadgePending]}>
                    <Text style={[styles.statNumber, styles.statNumberPending]}>{pendingCount}</Text>
                    <Text style={[styles.statLabel, styles.statLabelPending]}>Pending</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={styles.addButton} onPress={onAddTask} activeOpacity={0.7}>
                <Plus size={22} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterTabs}>
              {(['today', 'upcoming', 'all'] as const).map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[styles.filterTab, taskFilter === filter && styles.filterTabActive]}
                  onPress={() => setTaskFilter(filter)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.filterTabText, taskFilter === filter && styles.filterTabTextActive]}
                  >
                    {filter === 'today' ? 'Today' : filter === 'upcoming' ? 'This Week' : 'All Tasks'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Task List */}
          <ScrollView
            style={styles.taskList}
            contentContainerStyle={{ padding: responsive.sidebarPadding }}
            showsVerticalScrollIndicator={false}
          >
            {filteredTasks.length === 0 ? (
              <View style={styles.emptyState}>
                <CheckSquare size={56} color="#D1D5DB" strokeWidth={1.5} />
                <Text style={styles.emptyTitle}>No tasks</Text>
                <Text style={styles.emptyText}>
                  {taskFilter === 'today'
                    ? 'No tasks scheduled for today'
                    : taskFilter === 'upcoming'
                    ? 'No tasks this week'
                    : 'Tap + to add your first task'}
                </Text>
              </View>
            ) : (
              filteredTasks.map((task) => (
                <DailyTaskCard
                  key={task.id}
                  task={task}
                  onToggleComplete={onToggleComplete}
                  onDelete={onDeleteTask}
                />
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  sidebar: {
    backgroundColor: '#F9FAFB',
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },

  // Header
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  statBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  statNumberPending: {
    color: '#F59E0B',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  statLabelPending: {
    color: '#D97706',
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },

  // Filter Tabs
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#2563EB',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },

  // Task List
  taskList: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
});

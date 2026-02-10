import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Plus, CheckSquare } from 'lucide-react-native';
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
          <View style={[styles.header, { padding: responsive.sidebarPadding }]}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { fontSize: responsive.headerFontSize }]}>
                Daily Tasks
              </Text>
              <Text style={[styles.subtitle, { fontSize: responsive.subtitleFontSize }]}>
                {tasks?.length || 0} total • {pendingCount} pending
              </Text>
            </View>
            <TouchableOpacity style={styles.addButton} onPress={onAddTask} activeOpacity={0.7}>
              <Plus size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Filter Tabs */}
          <View style={[styles.filterTabs, { padding: responsive.sidebarPadding - 4 }]}>
            {(['today', 'upcoming', 'all'] as const).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[styles.filterTab, taskFilter === filter && styles.filterTabActive]}
                onPress={() => setTaskFilter(filter)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    { fontSize: responsive.subtitleFontSize },
                    taskFilter === filter && styles.filterTabTextActive,
                  ]}
                >
                  {filter === 'today' ? 'Today' : filter === 'upcoming' ? 'Week' : 'All'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Task List */}
          <ScrollView
            style={styles.taskList}
            contentContainerStyle={{ padding: responsive.sidebarPadding }}
            showsVerticalScrollIndicator={false}
          >
            {filteredTasks.length === 0 ? (
              <View style={styles.emptyState}>
                <CheckSquare size={48} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>No tasks</Text>
                <Text style={styles.emptyText}>
                  {taskFilter === 'today'
                    ? 'No tasks for today'
                    : taskFilter === 'upcoming'
                    ? 'No upcoming tasks'
                    : 'Add your first task'}
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebar: {
    backgroundColor: '#FFFFFF',
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  subtitle: {
    color: '#6B7280',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Filter Tabs
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#2563EB',
  },
  filterTabText: {
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },

  // Task List
  taskList: {
    flex: 1,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 6,
  },
});

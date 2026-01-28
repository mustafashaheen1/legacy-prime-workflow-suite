import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, TextInput, Platform, Alert } from 'react-native';
import { CheckSquare, Plus, X, Calendar, Bell, Trash2, Check, Clock } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { DailyTask } from '@/types';

interface DailyTasksButtonProps {
  buttonStyle?: object;
  iconColor?: string;
  iconSize?: number;
}

export default function DailyTasksButton({
  buttonStyle,
  iconColor = '#10B981',
  iconSize = 20
}: DailyTasksButtonProps) {
  const {
    dailyTasks = [],
    loadDailyTasks,
    addDailyTask,
    updateDailyTask,
    deleteDailyTask,
    company,
    user
  } = useApp();

  // State
  const [showDailyTasksMenu, setShowDailyTasksMenu] = useState<boolean>(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState<boolean>(false);
  const [taskFilter, setTaskFilter] = useState<'today' | 'upcoming' | 'all'>('today');
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskDateString, setNewTaskDateString] = useState<string>('');
  const [newTaskTime, setNewTaskTime] = useState<string>('09:00');
  const [newTaskReminder, setNewTaskReminder] = useState<boolean>(false);
  const [newTaskNotes, setNewTaskNotes] = useState<string>('');

  // Helper functions
  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const filteredTasks = useMemo(() => {
    if (!dailyTasks || !Array.isArray(dailyTasks)) return [];
    const today = new Date().toISOString().split('T')[0];
    const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    switch (taskFilter) {
      case 'today':
        return dailyTasks.filter(t => t.dueDate === today);
      case 'upcoming':
        return dailyTasks.filter(t => t.dueDate >= today && t.dueDate <= weekEnd && !t.completed);
      case 'all':
        return [...dailyTasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      default:
        return dailyTasks;
    }
  }, [dailyTasks, taskFilter]);

  const formatTaskDate = (dateString: string): string => {
    if (!dateString) return '';
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    if (dateString === today) return 'Today';
    if (dateString === tomorrow) return 'Tomorrow';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (timeStr: string): string => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const resetTaskForm = () => {
    setNewTaskTitle('');
    setNewTaskDateString('');
    setNewTaskTime('09:00');
    setNewTaskReminder(false);
    setNewTaskNotes('');
  };

  const isValidFutureDate = (): boolean => {
    if (!newTaskDateString || newTaskDateString.length !== 10) return false;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(newTaskDateString)) return false;
    const today = new Date().toISOString().split('T')[0];
    return newTaskDateString >= today;
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) {
      showAlert('Error', 'Please enter a task title');
      return;
    }
    if (!isValidFutureDate()) {
      showAlert('Error', 'Please enter a valid date (YYYY-MM-DD format, today or future)');
      return;
    }

    const dueDateTime = `${newTaskDateString}T${newTaskTime}:00`;

    try {
      await addDailyTask({
        title: newTaskTitle.trim(),
        dueDate: newTaskDateString,
        dueTime: newTaskTime,
        dueDateTime: dueDateTime,
        reminder: newTaskReminder,
        notes: newTaskNotes.trim(),
        completed: false,
        companyId: company?.id || '',
        userId: user?.id || '',
      });
      setShowAddTaskModal(false);
      resetTaskForm();
      setTimeout(() => setShowDailyTasksMenu(true), 200);
    } catch (error) {
      console.error('Error adding task:', error);
      showAlert('Error', 'Failed to add task');
    }
  };

  const handleToggleComplete = async (task: DailyTask) => {
    try {
      await updateDailyTask(task.id, { completed: !task.completed });
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteDailyTask(taskId);
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const pendingCount = dailyTasks?.filter(t => !t.completed).length || 0;

  return (
    <>
      {/* Daily Tasks Button */}
      <TouchableOpacity
        style={[styles.iconButton, buttonStyle]}
        onPress={() => {
          if (loadDailyTasks) loadDailyTasks();
          setShowDailyTasksMenu(true);
        }}
      >
        <CheckSquare size={iconSize} color={iconColor} />
        {pendingCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Daily Tasks Side Menu */}
      <Modal
        visible={showDailyTasksMenu}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDailyTasksMenu(false)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setShowDailyTasksMenu(false)}
          />
          <View style={styles.sideMenu}>
            {/* Header */}
            <View style={styles.menuHeader}>
              <View>
                <Text style={styles.menuTitle}>Daily Tasks</Text>
                <Text style={styles.menuSubtitle}>
                  {dailyTasks?.length || 0} total • {pendingCount} pending
                </Text>
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  setShowDailyTasksMenu(false);
                  setTimeout(() => setShowAddTaskModal(true), 200);
                }}
              >
                <Plus size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterTabs}>
              {(['today', 'upcoming', 'all'] as const).map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[styles.filterTab, taskFilter === filter && styles.filterTabActive]}
                  onPress={() => setTaskFilter(filter)}
                >
                  <Text style={[styles.filterTabText, taskFilter === filter && styles.filterTabTextActive]}>
                    {filter === 'today' ? 'Today' : filter === 'upcoming' ? 'Week' : 'All'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Task List */}
            <ScrollView style={styles.taskList} showsVerticalScrollIndicator={false}>
              {filteredTasks.length === 0 ? (
                <View style={styles.emptyState}>
                  <CheckSquare size={48} color="#D1D5DB" />
                  <Text style={styles.emptyTitle}>No tasks</Text>
                  <Text style={styles.emptyText}>
                    {taskFilter === 'today' ? 'No tasks for today' :
                     taskFilter === 'upcoming' ? 'No upcoming tasks' : 'Add your first task'}
                  </Text>
                </View>
              ) : (
                filteredTasks.map((task) => (
                  <View key={task.id} style={[styles.taskCard, task.completed && styles.taskCardCompleted]}>
                    <TouchableOpacity
                      style={styles.checkbox}
                      onPress={() => handleToggleComplete(task)}
                    >
                      <View style={[styles.checkboxInner, task.completed && styles.checkboxChecked]}>
                        {task.completed && <Check size={14} color="#FFF" />}
                      </View>
                    </TouchableOpacity>

                    <View style={styles.taskContent}>
                      <Text style={[styles.taskTitle, task.completed && styles.taskTitleCompleted]}>
                        {task.title}
                      </Text>
                      <View style={styles.taskMeta}>
                        <Calendar size={12} color="#9CA3AF" />
                        <Text style={styles.taskMetaText}>
                          {formatTaskDate(task.dueDate)}
                          {task.dueTime && ` at ${formatTime(task.dueTime)}`}
                        </Text>
                        {task.reminder && (
                          <>
                            <Bell size={12} color="#F59E0B" style={{ marginLeft: 8 }} />
                            <Text style={[styles.taskMetaText, { color: '#F59E0B' }]}>
                              {task.reminderSent ? 'Sent' : 'Set'}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>

                    <TouchableOpacity onPress={() => handleDeleteTask(task.id)}>
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Task Modal */}
      <Modal
        visible={showAddTaskModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { setShowAddTaskModal(false); resetTaskForm(); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Task</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => { setShowAddTaskModal(false); resetTaskForm(); }}
              >
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Form */}
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Task Title */}
              <View style={styles.field}>
                <Text style={styles.label}>Task Title <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="What needs to be done?"
                  placeholderTextColor="#9CA3AF"
                  value={newTaskTitle}
                  onChangeText={setNewTaskTitle}
                />
              </View>

              {/* Due Date */}
              <View style={styles.field}>
                <Text style={styles.label}>Due Date <Text style={styles.required}>*</Text></Text>
                <View style={styles.inputWithIcon}>
                  <Calendar size={20} color="#6B7280" />
                  <TextInput
                    style={styles.inputInner}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9CA3AF"
                    value={newTaskDateString}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/[^0-9-]/g, '');
                      setNewTaskDateString(cleaned);
                    }}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
              </View>

              {/* Due Time */}
              <View style={styles.field}>
                <Text style={styles.label}>Due Time</Text>
                <View style={styles.inputWithIcon}>
                  <Clock size={20} color="#6B7280" />
                  <TextInput
                    style={styles.inputInner}
                    placeholder="HH:MM"
                    placeholderTextColor="#9CA3AF"
                    value={newTaskTime}
                    onChangeText={(text) => {
                      let cleaned = text.replace(/[^0-9:]/g, '');
                      if (cleaned.length === 2 && !cleaned.includes(':')) {
                        cleaned = cleaned + ':';
                      }
                      if (cleaned.length <= 5) {
                        setNewTaskTime(cleaned);
                      }
                    }}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                  <View style={styles.timePresets}>
                    <TouchableOpacity style={styles.presetBtn} onPress={() => setNewTaskTime('09:00')}>
                      <Text style={styles.presetText}>9AM</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.presetBtn} onPress={() => setNewTaskTime('12:00')}>
                      <Text style={styles.presetText}>12PM</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.presetBtn} onPress={() => setNewTaskTime('17:00')}>
                      <Text style={styles.presetText}>5PM</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Reminder Toggle */}
              <View style={styles.field}>
                <TouchableOpacity
                  style={styles.reminderRow}
                  onPress={() => setNewTaskReminder(!newTaskReminder)}
                >
                  <View style={[styles.reminderIcon, newTaskReminder && styles.reminderIconActive]}>
                    <Bell size={20} color={newTaskReminder ? '#F59E0B' : '#9CA3AF'} />
                  </View>
                  <View style={styles.reminderText}>
                    <Text style={styles.reminderLabel}>Set Reminder</Text>
                    <Text style={styles.reminderHint}>Get notified when task is due</Text>
                  </View>
                  <View style={[styles.toggle, newTaskReminder && styles.toggleActive]}>
                    <View style={[styles.toggleKnob, newTaskReminder && styles.toggleKnobActive]} />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Notes */}
              <View style={styles.field}>
                <Text style={styles.label}>Notes <Text style={styles.optional}>(Optional)</Text></Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Add any additional details..."
                  placeholderTextColor="#9CA3AF"
                  value={newTaskNotes}
                  onChangeText={setNewTaskNotes}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowAddTaskModal(false); resetTaskForm(); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, (!newTaskTitle.trim() || !isValidFutureDate()) && styles.submitBtnDisabled]}
                onPress={handleAddTask}
                disabled={!newTaskTitle.trim() || !isValidFutureDate()}
              >
                <Plus size={18} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>Add Task</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Button
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },

  // Overlay & Side Menu
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sideMenu: {
    width: 340,
    backgroundColor: '#FFFFFF',
    height: '100%',
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
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
    padding: 12,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#2563EB',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },

  // Task List
  taskList: {
    flex: 1,
    padding: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  taskCardCompleted: {
    backgroundColor: '#F9FAFB',
    opacity: 0.7,
  },
  checkbox: {
    marginRight: 12,
  },
  checkboxInner: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  taskMetaText: {
    fontSize: 12,
    color: '#9CA3AF',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },

  // Form
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  optional: {
    color: '#9CA3AF',
    fontWeight: '400',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  inputInner: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  timePresets: {
    flexDirection: 'row',
    gap: 6,
  },
  presetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
  },
  presetText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },

  // Reminder
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reminderIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reminderIconActive: {
    backgroundColor: '#FEF3C7',
  },
  reminderText: {
    flex: 1,
  },
  reminderLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  reminderHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D1D5DB',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#10B981',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  toggleKnobActive: {
    transform: [{ translateX: 20 }],
  },

  // Buttons
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  submitBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

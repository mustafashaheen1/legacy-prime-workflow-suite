import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CheckSquare } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { DailyTask } from '@/types';
import DailyTasksSidebar from './DailyTasks/DailyTasksSidebar';
import AddTaskModal from './DailyTasks/AddTaskModal';

interface DailyTasksButtonProps {
  buttonStyle?: object;
  iconColor?: string;
  iconSize?: number;
}

export default function DailyTasksButton({
  buttonStyle,
  iconColor = '#10B981',
  iconSize = 20,
}: DailyTasksButtonProps) {
  const {
    dailyTasks = [],
    loadDailyTasks,
    addDailyTask,
    updateDailyTask,
    deleteDailyTask,
    company,
    user,
  } = useApp();

  const [showSidebar, setShowSidebar] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const handleOpenSidebar = () => {
    if (loadDailyTasks) loadDailyTasks();
    setShowSidebar(true);
  };

  const handleOpenAddModal = () => {
    setShowSidebar(false);
    setTimeout(() => setShowAddModal(true), 200);
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

  const handleAddTask = async (taskData: {
    title: string;
    dueDate: string;
    dueTime: string;
    dueDateTime: string;
    reminder: boolean;
    notes: string;
  }) => {
    await addDailyTask({
      ...taskData,
      completed: false,
      companyId: company?.id || '',
      userId: user?.id || '',
    });
    // Reopen sidebar after adding task
    setTimeout(() => setShowSidebar(true), 200);
  };

  const pendingCount = dailyTasks?.filter((t) => !t.completed).length || 0;

  return (
    <>
      {/* Daily Tasks Button */}
      <TouchableOpacity
        style={[styles.button, buttonStyle]}
        onPress={handleOpenSidebar}
        activeOpacity={0.7}
      >
        <CheckSquare size={iconSize} color={iconColor} />
        {pendingCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Sidebar */}
      <DailyTasksSidebar
        visible={showSidebar}
        onClose={() => setShowSidebar(false)}
        onAddTask={handleOpenAddModal}
        tasks={dailyTasks}
        onToggleComplete={handleToggleComplete}
        onDeleteTask={handleDeleteTask}
      />

      {/* Add Task Modal */}
      <AddTaskModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddTask}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
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
});

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Plus } from 'lucide-react-native';

export default function ScheduleScreen() {
  const { tasks } = useApp();
  const [showAddTask, setShowAddTask] = useState<boolean>(false);
  const [taskName, setTaskName] = useState<string>('');
  const [taskDate, setTaskDate] = useState<string>('');
  const [reminder, setReminder] = useState<string>('');
  const [logDate, setLogDate] = useState<string>('');
  const [logNote, setLogNote] = useState<string>('');

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Schedule</Text>
          <View style={styles.headerButtons}>

            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => setShowAddTask(!showAddTask)}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.headerButtonText}>Add Task</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.banner}>
          <Text style={styles.bannerText}>Schedule Management</Text>
        </View>

        {showAddTask && (
          <View style={styles.addTaskForm}>
            <View style={styles.formRow}>
              <View style={styles.formColumn}>
                <Text style={styles.label}>Task Name</Text>
                <TextInput
                  style={styles.input}
                  value={taskName}
                  onChangeText={setTaskName}
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={styles.formColumn}>
                <Text style={styles.label}>Date</Text>
                <TextInput
                  style={styles.input}
                  value={taskDate}
                  onChangeText={setTaskDate}
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={styles.formColumn}>
                <Text style={styles.label}>Reminder</Text>
                <TextInput
                  style={styles.input}
                  value={reminder}
                  onChangeText={setReminder}
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>
            <TouchableOpacity style={styles.addButton}>
              <Text style={styles.addButtonText}>Add Task</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.taskList}>
          <Text style={styles.sectionTitle}>Task List</Text>
          {tasks.map((task) => (
            <View key={task.id} style={styles.taskCard}>
              <Text style={styles.taskName}>{task.name}</Text>
              <Text style={styles.taskDate}>{task.date}</Text>
              <Text style={styles.taskReminder}>Reminder: {task.reminder}</Text>
            </View>
          ))}
        </View>

        <View style={styles.dailyLogs}>
          <Text style={styles.sectionTitle}>Daily Logs</Text>
          <View style={styles.logForm}>
            <View style={styles.formRow}>
              <View style={styles.formColumn}>
                <Text style={styles.label}>Date</Text>
                <TextInput
                  style={styles.input}
                  value={logDate}
                  onChangeText={setLogDate}
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={[styles.formColumn, { flex: 2 }]}>
                <Text style={styles.label}>Note</Text>
                <TextInput
                  style={styles.input}
                  value={logNote}
                  onChangeText={setLogNote}
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>
            <TouchableOpacity style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tasksSection}>
            <Text style={styles.subsectionTitle}>Tasks</Text>
            <View style={styles.tasksList}>
              <Text style={styles.taskItem}>Task 1: Meeting with client</Text>
              <Text style={styles.taskItem}>Task 2: Project deadline</Text>
              <Text style={styles.taskItem}>Task 3: Submit report</Text>
            </View>
          </View>

          <View style={styles.logsSection}>
            <Text style={styles.subsectionTitle}>Logs</Text>
            <View style={styles.logsList}>
              <Text style={styles.logItem}>Log 1: Completed task review</Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  headerButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  banner: {
    backgroundColor: '#2563EB',
    padding: 40,
    alignItems: 'center',
  },
  bannerText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  addTaskForm: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  formColumn: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1F2937',
  },
  addButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  taskList: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 16,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  taskName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 8,
  },
  taskDate: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  taskReminder: {
    fontSize: 14,
    color: '#6B7280',
  },
  dailyLogs: {
    padding: 16,
    backgroundColor: '#E5E7EB',
  },
  logForm: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  tasksSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  logsSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  tasksList: {
    backgroundColor: '#E5E7EB',
    padding: 12,
    borderRadius: 8,
  },
  taskItem: {
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 8,
  },
  logsList: {
    backgroundColor: '#E5E7EB',
    padding: 12,
    borderRadius: 8,
  },
  logItem: {
    fontSize: 14,
    color: '#1F2937',
  },
});

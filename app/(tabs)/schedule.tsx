import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Modal,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useRef, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Calendar, X, GripVertical } from 'lucide-react-native';
import { ScheduledTask } from '@/types';

const CONSTRUCTION_CATEGORIES = [
  { name: 'Pre-Construction', color: '#8B5CF6' },
  { name: 'Foundation', color: '#EF4444' },
  { name: 'Framing', color: '#F59E0B' },
  { name: 'Asphalt', color: '#1F2937' },
  { name: 'Roofing', color: '#7C3AED' },
  { name: 'Electrical', color: '#F97316' },
  { name: 'Plumbing', color: '#3B82F6' },
  { name: 'HVAC', color: '#10B981' },
  { name: 'Drywall', color: '#6366F1' },
  { name: 'Painting', color: '#EC4899' },
  { name: 'Flooring', color: '#84CC16' },
  { name: 'Exterior', color: '#14B8A6' },
  { name: 'Landscaping', color: '#22C55E' },
  { name: 'Final Inspection', color: '#06B6D4' },
];

const DAY_WIDTH = 80;
const ROW_HEIGHT = 60;

export default function ScheduleScreen() {
  const { projects } = useApp();
  const [selectedProject, setSelectedProject] = useState<string | null>(
    projects.length > 0 ? projects[0].id : null
  );
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [workType, setWorkType] = useState<'in-house' | 'subcontractor'>('in-house');
  const [notes, setNotes] = useState<string>('');
  
  const timelineRef = useRef<ScrollView>(null);
  const projectTasks = scheduledTasks.filter(t => t.projectId === selectedProject);

  const generateDates = (numDays: number): Date[] => {
    const dates: Date[] = [];
    const today = new Date();
    for (let i = 0; i < numDays; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const dates = useMemo(() => generateDates(60), []);

  const formatDate = (date: Date): string => {
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  };

  const handleCategoryDrop = (category: string, date: Date) => {
    const categoryData = CONSTRUCTION_CATEGORIES.find(c => c.name === category);
    if (!categoryData || !selectedProject) return;

    const endDate = new Date(date);
    endDate.setDate(date.getDate() + 7);

    const newTask: ScheduledTask = {
      id: Date.now().toString(),
      projectId: selectedProject,
      category: category,
      startDate: date.toISOString(),
      endDate: endDate.toISOString(),
      duration: 7,
      workType: 'in-house',
      notes: '',
      color: categoryData.color,
    };

    setEditingTask(newTask);
    setWorkType('in-house');
    setNotes('');
    setShowModal(true);
  };

  const handleSaveTask = () => {
    if (editingTask) {
      const existingIndex = scheduledTasks.findIndex(t => t.id === editingTask.id);
      if (existingIndex >= 0) {
        const updated = [...scheduledTasks];
        updated[existingIndex] = { ...editingTask, workType, notes };
        setScheduledTasks(updated);
      } else {
        setScheduledTasks([...scheduledTasks, { ...editingTask, workType, notes }]);
      }
    }
    setShowModal(false);
    setEditingTask(null);
  };

  const handleDeleteTask = (taskId: string) => {
    setScheduledTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const getTaskPosition = (task: ScheduledTask) => {
    const startIdx = dates.findIndex(d => 
      d.toDateString() === new Date(task.startDate).toDateString()
    );
    if (startIdx === -1) return null;
    
    return {
      left: startIdx * DAY_WIDTH,
      width: task.duration * DAY_WIDTH,
    };
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Project Schedule</Text>
      </View>

      <View style={styles.projectSelector}>
        <Text style={styles.sectionTitle}>Select Project</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.projectList}>
          {projects.filter(p => p.status === 'active').map(project => (
            <TouchableOpacity
              key={project.id}
              style={[
                styles.projectChip,
                selectedProject === project.id && styles.projectChipSelected
              ]}
              onPress={() => setSelectedProject(project.id)}
            >
              <Text style={[
                styles.projectChipText,
                selectedProject === project.id && styles.projectChipTextSelected
              ]}>
                {project.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {!selectedProject && (
        <View style={styles.emptyState}>
          <Calendar size={48} color="#9CA3AF" />
          <Text style={styles.emptyText}>Select a project to view schedule</Text>
        </View>
      )}

      {selectedProject && (
        <>
          <View style={styles.categoriesSection}>
            <Text style={styles.sectionTitle}>Construction Phases</Text>
            <Text style={styles.sectionSubtitle}>Drag to timeline to schedule</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesList}>
              {CONSTRUCTION_CATEGORIES.map(category => (
                <TouchableOpacity
                  key={category.name}
                  style={[styles.categoryChip, { backgroundColor: category.color }]}
                  onPress={() => handleCategoryDrop(category.name, new Date())}
                >
                  <GripVertical size={16} color="#FFFFFF" />
                  <Text style={styles.categoryText}>{category.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.timeline}>
            <View style={styles.timelineHeader}>
              <ScrollView 
                ref={timelineRef}
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.timelineScroll}
              >
                <View style={styles.datesContainer}>
                  {dates.map((date, idx) => (
                    <View key={idx} style={styles.dateColumn}>
                      <Text style={styles.dateText}>{formatDate(date)}</Text>
                      <Text style={styles.dayText}>
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>

            <ScrollView 
              style={styles.tasksArea}
              showsVerticalScrollIndicator={false}
            >
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                scrollEnabled={true}
              >
                <View style={styles.tasksGrid}>
                  {dates.map((date, idx) => (
                    <View key={idx} style={styles.dayGridColumn} />
                  ))}
                  
                  {projectTasks.map((task) => {
                    const position = getTaskPosition(task);
                    if (!position) return null;

                    return (
                      <View
                        key={task.id}
                        style={[
                          styles.taskBlock,
                          {
                            left: position.left,
                            width: position.width,
                            backgroundColor: task.color,
                          }
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.taskContent}
                          onPress={() => {
                            setEditingTask(task);
                            setWorkType(task.workType);
                            setNotes(task.notes || '');
                            setShowModal(true);
                          }}
                        >
                          <Text style={styles.taskTitle} numberOfLines={1}>
                            {task.category}
                          </Text>
                          <Text style={styles.taskSubtitle} numberOfLines={1}>
                            {task.workType === 'in-house' ? '🏠 In-House' : '👷 Subcontractor'}
                          </Text>
                          <Text style={styles.taskDuration}>
                            {task.duration} days
                          </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={styles.deleteTaskButton}
                          onPress={() => handleDeleteTask(task.id)}
                        >
                          <X size={14} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </ScrollView>
          </View>
        </>
      )}

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingTask ? editingTask.category : 'Add Task'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.label}>Work Type</Text>
              <View style={styles.workTypeContainer}>
                <TouchableOpacity
                  style={[
                    styles.workTypeButton,
                    workType === 'in-house' && styles.workTypeButtonActive
                  ]}
                  onPress={() => setWorkType('in-house')}
                >
                  <Text style={[
                    styles.workTypeText,
                    workType === 'in-house' && styles.workTypeTextActive
                  ]}>
                    🏠 In-House
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.workTypeButton,
                    workType === 'subcontractor' && styles.workTypeButtonActive
                  ]}
                  onPress={() => setWorkType('subcontractor')}
                >
                  <Text style={[
                    styles.workTypeText,
                    workType === 'subcontractor' && styles.workTypeTextActive
                  ]}>
                    👷 Subcontractor
                  </Text>
                </TouchableOpacity>
              </View>

              {editingTask && (
                <View style={styles.durationControl}>
                  <Text style={styles.label}>Duration (days)</Text>
                  <View style={styles.durationButtons}>
                    <TouchableOpacity
                      style={styles.durationButton}
                      onPress={() => {
                        if (editingTask.duration > 1) {
                          setEditingTask({
                            ...editingTask,
                            duration: editingTask.duration - 1
                          });
                        }
                      }}
                    >
                      <Text style={styles.durationButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.durationValue}>{editingTask.duration}</Text>
                    <TouchableOpacity
                      style={styles.durationButton}
                      onPress={() => {
                        setEditingTask({
                          ...editingTask,
                          duration: editingTask.duration + 1
                        });
                      }}
                    >
                      <Text style={styles.durationButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={styles.textArea}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add notes about this phase..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={handleSaveTask}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#2563EB',
  },
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  projectSelector: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  projectList: {
    flexDirection: 'row',
  },
  projectChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  projectChipSelected: {
    backgroundColor: '#2563EB',
  },
  projectChipText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#1F2937',
  },
  projectChipTextSelected: {
    color: '#FFFFFF',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  categoriesSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  categoriesList: {
    flexDirection: 'row',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    gap: 6,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  timeline: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  timelineHeader: {
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
  },
  timelineScroll: {
    maxHeight: 60,
  },
  datesContainer: {
    flexDirection: 'row',
  },
  dateColumn: {
    width: DAY_WIDTH,
    paddingVertical: 12,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F3F4F6',
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  dayText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  tasksArea: {
    flex: 1,
  },
  tasksGrid: {
    flexDirection: 'row',
    minHeight: 400,
    position: 'relative',
  },
  dayGridColumn: {
    width: DAY_WIDTH,
    borderRightWidth: 1,
    borderRightColor: '#F3F4F6',
  },
  taskBlock: {
    position: 'absolute',
    height: ROW_HEIGHT,
    borderRadius: 8,
    padding: 8,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  taskSubtitle: {
    fontSize: 11,
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: 2,
  },
  taskDuration: {
    fontSize: 10,
    color: '#FFFFFF',
    opacity: 0.8,
    marginTop: 2,
  },
  deleteTaskButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '80%',
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
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  modalBody: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 8,
  },
  workTypeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  workTypeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  workTypeButtonActive: {
    backgroundColor: '#2563EB',
  },
  workTypeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  workTypeTextActive: {
    color: '#FFFFFF',
  },
  durationControl: {
    marginBottom: 20,
  },
  durationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  durationButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationButtonText: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  durationValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1F2937',
    minWidth: 60,
    textAlign: 'center',
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1F2937',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});

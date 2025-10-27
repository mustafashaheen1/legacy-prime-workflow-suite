import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Modal,
  Platform,
  PanResponder
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
const HOUR_HEIGHT = 60;
const LEFT_MARGIN = 60;

export default function ScheduleScreen() {
  const { projects } = useApp();
  const insets = useSafeAreaInsets();
  const [selectedProject, setSelectedProject] = useState<string | null>(
    projects.length > 0 ? projects[0].id : null
  );
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [workType, setWorkType] = useState<'in-house' | 'subcontractor'>('in-house');
  const [notes, setNotes] = useState<string>('');
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [resizingTask, setResizingTask] = useState<{ id: string; type: 'right' | 'bottom' | 'corner' } | null>(null);
  const [touchingHandle, setTouchingHandle] = useState<{ id: string; type: 'right' | 'bottom' | 'corner' } | null>(null);
  const [quickEditTask, setQuickEditTask] = useState<string | null>(null);
  const [quickNoteText, setQuickNoteText] = useState<string>('');
  const [quickEditWorkType, setQuickEditWorkType] = useState<'in-house' | 'subcontractor'>('in-house');
  const [lastTap, setLastTap] = useState<number>(0);
  
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

  const handleCategoryClick = (category: string) => {
    const categoryData = CONSTRUCTION_CATEGORIES.find(c => c.name === category);
    if (!categoryData || !selectedProject) return;

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 7);

    const newTask: ScheduledTask = {
      id: Date.now().toString(),
      projectId: selectedProject,
      category: category,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      duration: 7,
      workType: 'in-house',
      notes: '',
      color: categoryData.color,
      row: projectTasks.length,
      rowSpan: 1,
    };

    setScheduledTasks([...scheduledTasks, newTask]);
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
    
    const rowSpan = task.rowSpan || 1;
    const height = rowSpan * ROW_HEIGHT + (rowSpan - 1) * 16;
    
    return {
      left: LEFT_MARGIN + startIdx * DAY_WIDTH,
      width: task.duration * DAY_WIDTH,
      top: (task.row || 0) * (ROW_HEIGHT + 16),
      height,
    };
  };

  const createPanResponder = (task: ScheduledTask) => {
    let initialRow = task.row || 0;
    let initialStartDate = new Date(task.startDate);

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        setDraggedTask(task.id);
        initialRow = task.row || 0;
        initialStartDate = new Date(task.startDate);
      },
      onPanResponderMove: (_, gestureState) => {
        const newRow = Math.max(0, Math.floor((initialRow * (ROW_HEIGHT + 16) + gestureState.dy) / (ROW_HEIGHT + 16)));
        const daysDelta = Math.round(gestureState.dx / DAY_WIDTH);
        
        const newStartDate = new Date(initialStartDate);
        newStartDate.setDate(initialStartDate.getDate() + daysDelta);
        
        const newEndDate = new Date(newStartDate);
        newEndDate.setDate(newStartDate.getDate() + task.duration);
        
        const updatedTasks = scheduledTasks.map(t => 
          t.id === task.id ? { 
            ...t, 
            row: newRow,
            startDate: newStartDate.toISOString(),
            endDate: newEndDate.toISOString(),
          } : t
        );
        setScheduledTasks(updatedTasks);
      },
      onPanResponderRelease: () => {
        setDraggedTask(null);
      },
    });
  };

  const createResizePanResponder = (task: ScheduledTask, resizeType: 'right' | 'bottom' | 'corner') => {
    let initialDuration = task.duration;
    let initialRowSpan = task.rowSpan || 1;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const threshold = 2;
        return Math.abs(gestureState.dx) > threshold || Math.abs(gestureState.dy) > threshold;
      },
      onPanResponderGrant: () => {
        setResizingTask({ id: task.id, type: resizeType });
        setTouchingHandle({ id: task.id, type: resizeType });
        initialDuration = task.duration;
        initialRowSpan = task.rowSpan || 1;
      },
      onPanResponderMove: (_, gestureState) => {
        if (resizeType === 'right') {
          const daysDelta = Math.round(gestureState.dx / DAY_WIDTH);
          const newDuration = Math.max(1, initialDuration + daysDelta);
          
          const newEndDate = new Date(task.startDate);
          newEndDate.setDate(newEndDate.getDate() + newDuration);
          
          const updatedTasks = scheduledTasks.map(t => 
            t.id === task.id ? { 
              ...t, 
              duration: newDuration,
              endDate: newEndDate.toISOString(),
            } : t
          );
          setScheduledTasks(updatedTasks);
        } else if (resizeType === 'bottom') {
          const rowsDelta = Math.round(gestureState.dy / (ROW_HEIGHT + 16));
          const newRowSpan = Math.max(1, initialRowSpan + rowsDelta);
          
          const updatedTasks = scheduledTasks.map(t => 
            t.id === task.id ? { ...t, rowSpan: newRowSpan } : t
          );
          setScheduledTasks(updatedTasks);
        } else if (resizeType === 'corner') {
          const daysDelta = Math.round(gestureState.dx / DAY_WIDTH);
          const newDuration = Math.max(1, initialDuration + daysDelta);
          
          const rowsDelta = Math.round(gestureState.dy / (ROW_HEIGHT + 16));
          const newRowSpan = Math.max(1, initialRowSpan + rowsDelta);
          
          const newEndDate = new Date(task.startDate);
          newEndDate.setDate(newEndDate.getDate() + newDuration);
          
          const updatedTasks = scheduledTasks.map(t => 
            t.id === task.id ? { 
              ...t, 
              duration: newDuration,
              endDate: newEndDate.toISOString(),
              rowSpan: newRowSpan,
            } : t
          );
          setScheduledTasks(updatedTasks);
        }
      },
      onPanResponderRelease: () => {
        setResizingTask(null);
        setTouchingHandle(null);
      },
    });
  };

  return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.bgArea} />
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
            <Text style={styles.sectionSubtitle}>Tap to add to schedule</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesList}>
              {CONSTRUCTION_CATEGORIES.map(category => (
                <TouchableOpacity
                  key={category.name}
                  style={[styles.categoryChip, { backgroundColor: category.color }]}
                  onPress={() => handleCategoryClick(category.name)}
                >
                  <GripVertical size={16} color="#FFFFFF" />
                  <Text style={styles.categoryText}>{category.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.timeline}>
            <View style={styles.timelineHeader}>
              <View style={styles.hourLabelHeader} />
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
              <View style={styles.tasksContainer}>
                <View style={styles.hourLabels}>
                  {Array.from({ length: 15 }, (_, i) => {
                    const hour = i + 6;
                    return (
                      <View key={i} style={styles.hourLabelRow}>
                        <Text style={styles.hourText}>
                          {hour === 12 ? '12 PM' : hour < 12 ? `${hour} AM` : hour === 24 ? '12 AM' : `${hour - 12} PM`}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  scrollEnabled={true}
                  style={styles.tasksScrollView}
                >
                  <View style={styles.tasksGrid}>
                    {dates.map((date, idx) => (
                      <View key={idx} style={styles.dayGridColumn} />
                    ))}
                    
                    {projectTasks.map((task) => {
                      const position = getTaskPosition(task);
                      if (!position) return null;
                      const panResponder = createPanResponder(task);
                      const rightResizeResponder = createResizePanResponder(task, 'right');
                      const bottomResizeResponder = createResizePanResponder(task, 'bottom');
                      const cornerResizeResponder = createResizePanResponder(task, 'corner');
                      const isQuickEditing = quickEditTask === task.id;

                      const handleTaskTap = () => {
                        const now = Date.now();
                        const DOUBLE_TAP_DELAY = 300;
                        
                        if (now - lastTap < DOUBLE_TAP_DELAY) {
                          setQuickEditTask(task.id);
                          setQuickNoteText(task.notes || '');
                          setQuickEditWorkType(task.workType);
                          setLastTap(0);
                        } else {
                          setLastTap(now);
                        }
                      };

                      const isTouchingRightHandle = touchingHandle?.id === task.id && touchingHandle?.type === 'right';
                      const isTouchingBottomHandle = touchingHandle?.id === task.id && touchingHandle?.type === 'bottom';
                      const isTouchingCornerHandle = touchingHandle?.id === task.id && touchingHandle?.type === 'corner';

                      return (
                        <View
                          key={task.id}
                          style={[
                            styles.taskBlock,
                            {
                              left: position.left,
                              top: position.top,
                              width: position.width,
                              height: position.height,
                              backgroundColor: task.color,
                            },
                            draggedTask === task.id && styles.taskBlockDragging,
                            resizingTask?.id === task.id && styles.taskBlockResizing,
                          ]}
                        >
                          <View
                            {...panResponder.panHandlers}
                            style={styles.taskContent}
                          >
                            <TouchableOpacity
                              onPress={handleTaskTap}
                              activeOpacity={0.8}
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
                              {task.notes && !isQuickEditing && (
                                <Text style={styles.taskNotes} numberOfLines={2}>
                                  {task.notes}
                                </Text>
                              )}
                            </TouchableOpacity>
                          </View>

                          {isQuickEditing && (
                            <View style={styles.quickEditContainer}>
                              <ScrollView style={styles.quickEditScroll}>
                                <Text style={styles.quickEditLabel}>Work Type</Text>
                                <View style={styles.quickEditWorkTypeRow}>
                                  <TouchableOpacity
                                    style={[
                                      styles.quickEditWorkTypeButton,
                                      quickEditWorkType === 'in-house' && styles.quickEditWorkTypeButtonActive
                                    ]}
                                    onPress={() => setQuickEditWorkType('in-house')}
                                  >
                                    <Text style={[
                                      styles.quickEditWorkTypeText,
                                      quickEditWorkType === 'in-house' && styles.quickEditWorkTypeTextActive
                                    ]}>🏠 In-House</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[
                                      styles.quickEditWorkTypeButton,
                                      quickEditWorkType === 'subcontractor' && styles.quickEditWorkTypeButtonActive
                                    ]}
                                    onPress={() => setQuickEditWorkType('subcontractor')}
                                  >
                                    <Text style={[
                                      styles.quickEditWorkTypeText,
                                      quickEditWorkType === 'subcontractor' && styles.quickEditWorkTypeTextActive
                                    ]}>👷 Sub</Text>
                                  </TouchableOpacity>
                                </View>

                                <Text style={styles.quickEditLabel}>Notes</Text>
                                <TextInput
                                  style={styles.quickEditInput}
                                  value={quickNoteText}
                                  onChangeText={setQuickNoteText}
                                  placeholder="Add notes..."
                                  placeholderTextColor="rgba(255,255,255,0.6)"
                                  multiline
                                  autoFocus
                                />
                              </ScrollView>
                              <View style={styles.quickEditButtons}>
                                <TouchableOpacity
                                  style={styles.quickEditButton}
                                  onPress={() => {
                                    const updatedTasks = scheduledTasks.map(t => 
                                      t.id === task.id ? { ...t, notes: quickNoteText, workType: quickEditWorkType } : t
                                    );
                                    setScheduledTasks(updatedTasks);
                                    setQuickEditTask(null);
                                  }}
                                >
                                  <Text style={styles.quickEditButtonText}>Save</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.quickEditButton, styles.quickEditButtonCancel]}
                                  onPress={() => setQuickEditTask(null)}
                                >
                                  <Text style={styles.quickEditButtonText}>Cancel</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                          
                          <View 
                            {...rightResizeResponder.panHandlers}
                            style={[
                              styles.resizeHandleRight,
                              isTouchingRightHandle && styles.resizeHandleActive,
                            ]}
                          >
                            <View style={[
                              styles.resizeIndicator,
                              isTouchingRightHandle && styles.resizeIndicatorActive,
                            ]} />
                          </View>

                          <View 
                            {...bottomResizeResponder.panHandlers}
                            style={[
                              styles.resizeHandleBottom,
                              isTouchingBottomHandle && styles.resizeHandleActive,
                            ]}
                          >
                            <View style={[
                              styles.resizeIndicatorHorizontal,
                              isTouchingBottomHandle && styles.resizeIndicatorActive,
                            ]} />
                          </View>

                          <View 
                            {...cornerResizeResponder.panHandlers}
                            style={[
                              styles.resizeHandleCorner,
                              isTouchingCornerHandle && styles.resizeHandleActive,
                            ]}
                          >
                            <View style={[
                              styles.resizeIndicatorCorner,
                              isTouchingCornerHandle && styles.resizeIndicatorActive,
                            ]} />
                          </View>
                          
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
              </View>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2563EB',
  },
  bgArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: '#2563EB',
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
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
  },
  hourLabelHeader: {
    width: LEFT_MARGIN,
    backgroundColor: '#FFFFFF',
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
  tasksContainer: {
    flexDirection: 'row',
  },
  hourLabels: {
    width: LEFT_MARGIN,
    backgroundColor: '#F9FAFB',
    borderRightWidth: 2,
    borderRightColor: '#E5E7EB',
  },
  hourLabelRow: {
    height: HOUR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  hourText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  tasksScrollView: {
    flex: 1,
  },
  tasksGrid: {
    flexDirection: 'row',
    minHeight: 900,
    position: 'relative',
  },
  dayGridColumn: {
    width: DAY_WIDTH,
    borderRightWidth: 1,
    borderRightColor: '#F3F4F6',
    height: 900,
  },
  taskBlock: {
    position: 'absolute',
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
  taskBlockDragging: {
    opacity: 0.8,
    transform: [{ scale: 1.05 }],
  },
  taskBlockResizing: {
    opacity: 0.9,
  },
  taskNotes: {
    fontSize: 10,
    color: '#FFFFFF',
    opacity: 0.85,
    marginTop: 4,
  },
  quickEditContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.92)',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'space-between',
  },
  quickEditScroll: {
    flex: 1,
  },
  quickEditLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600' as const,
    marginBottom: 6,
    opacity: 0.9,
  },
  quickEditWorkTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  quickEditWorkTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  quickEditWorkTypeButtonActive: {
    backgroundColor: '#2563EB',
  },
  quickEditWorkTypeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600' as const,
    opacity: 0.8,
  },
  quickEditWorkTypeTextActive: {
    opacity: 1,
  },
  quickEditInput: {
    color: '#FFFFFF',
    fontSize: 12,
    textAlignVertical: 'top',
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    minHeight: 60,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  quickEditButtons: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  quickEditButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  quickEditButtonCancel: {
    backgroundColor: '#6B7280',
  },
  quickEditButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600' as const,
  },
  resizeHandleRight: {
    position: 'absolute',
    right: -20,
    top: 0,
    bottom: 0,
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resizeHandleBottom: {
    position: 'absolute',
    bottom: -20,
    left: 0,
    right: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resizeHandleCorner: {
    position: 'absolute',
    bottom: -20,
    right: -20,
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resizeHandleActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
  },
  resizeIndicator: {
    width: 8,
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'rgba(37, 99, 235, 0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  resizeIndicatorHorizontal: {
    height: 8,
    width: 60,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'rgba(37, 99, 235, 0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  resizeIndicatorCorner: {
    width: 24,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: 'rgba(37, 99, 235, 0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 5,
    elevation: 6,
  },
  resizeIndicatorActive: {
    backgroundColor: '#2563EB',
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.2 }],
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

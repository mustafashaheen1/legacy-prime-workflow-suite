import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Modal,
  Platform,
  PanResponder,
  Alert,
  Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useRef, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Calendar, X, GripVertical, BookOpen, Plus, Bell, Trash2, Check, Share2, Users, History, Download, Camera, ImageIcon, Clock, User } from 'lucide-react-native';
import { ScheduledTask, DailyLog, DailyLogReminder, DailyLogNote, DailyLogPhoto } from '@/types';

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
  const { user, projects, dailyLogs, addDailyLog, updateDailyLog, deleteDailyLog } = useApp();
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
  const [showDailyLogsModal, setShowDailyLogsModal] = useState<boolean>(false);
  const [dailyLogNote, setDailyLogNote] = useState<string>('');
  const [dailyLogCategory, setDailyLogCategory] = useState<string>('');
  const [dailyLogWorkPerformed, setDailyLogWorkPerformed] = useState<string>('');
  const [dailyLogIssues, setDailyLogIssues] = useState<string>('');
  const [dailyLogReminders, setDailyLogReminders] = useState<DailyLogReminder[]>([]);
  const [newReminderTask, setNewReminderTask] = useState<string>('');
  const [newReminderTime, setNewReminderTime] = useState<string>('');
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [shareEmail, setShareEmail] = useState<string>('');
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [noteEntries, setNoteEntries] = useState<DailyLogNote[]>([]);
  const [photoEntries, setPhotoEntries] = useState<DailyLogPhoto[]>([]);
  const [currentNoteInput, setCurrentNoteInput] = useState<string>('');
  
  const timelineRef = useRef<ScrollView>(null);
  const projectTasks = scheduledTasks.filter(t => t.projectId === selectedProject);
  const projectDailyLogs = dailyLogs.filter(log => log.projectId === selectedProject);

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

  const handleOpenDailyLogs = () => {
    setShowDailyLogsModal(true);
    setDailyLogNote('');
    setDailyLogCategory('');
    setDailyLogWorkPerformed('');
    setDailyLogIssues('');
    setDailyLogReminders([]);
    setNewReminderTask('');
    setNewReminderTime('');
    setNoteEntries([]);
    setPhotoEntries([]);
    setCurrentNoteInput('');
  };

  const handleAddReminder = () => {
    if (!newReminderTask.trim() || !newReminderTime.trim()) return;

    const reminder: DailyLogReminder = {
      id: Date.now().toString(),
      dailyLogId: '',
      task: newReminderTask,
      time: newReminderTime,
      completed: false,
    };

    setDailyLogReminders([...dailyLogReminders, reminder]);
    setNewReminderTask('');
    setNewReminderTime('');
  };

  const handleToggleReminder = (reminderId: string) => {
    setDailyLogReminders(prev => 
      prev.map(r => r.id === reminderId ? { ...r, completed: !r.completed } : r)
    );
  };

  const handleDeleteReminder = (reminderId: string) => {
    setDailyLogReminders(prev => prev.filter(r => r.id !== reminderId));
  };

  const handleAddTeamMember = () => {
    if (!shareEmail.trim()) return;
    if (sharedWith.includes(shareEmail.trim())) {
      console.log('[Share] User already added');
      return;
    }
    setSharedWith([...sharedWith, shareEmail.trim()]);
    setShareEmail('');
    console.log('[Share] Added team member:', shareEmail);
  };

  const handleRemoveTeamMember = (email: string) => {
    setSharedWith(prev => prev.filter(e => e !== email));
    console.log('[Share] Removed team member:', email);
  };

  const handleAddNoteEntry = () => {
    if (!currentNoteInput.trim()) return;

    const noteEntry: DailyLogNote = {
      id: Date.now().toString(),
      text: currentNoteInput,
      timestamp: new Date().toISOString(),
      author: user?.name || 'Unknown User',
    };

    setNoteEntries([...noteEntries, noteEntry]);
    setCurrentNoteInput('');
    console.log('[Note Entry] Added note at:', new Date().toLocaleTimeString());
  };

  const handleTakePhoto = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Camera', 'Camera access is not available on web. Please use a mobile device.');
      return;
    }

    try {
      const { CameraView, useCameraPermissions } = await import('expo-camera');
      Alert.alert('Photo', 'Camera functionality will be available in the next update.');
      console.log('[Camera] Opening camera...');
    } catch (error) {
      console.error('[Camera] Error:', error);
      Alert.alert('Error', 'Could not access camera');
    }
  };

  const handlePickPhoto = async () => {
    try {
      const photoEntry: DailyLogPhoto = {
        id: Date.now().toString(),
        uri: `https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400`,
        timestamp: new Date().toISOString(),
        author: user?.name || 'Unknown User',
        notes: '',
      };

      setPhotoEntries([...photoEntries, photoEntry]);
      console.log('[Photo] Photo added at:', new Date().toLocaleTimeString());
    } catch (error) {
      console.error('[Photo Picker] Error:', error);
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    setPhotoEntries(prev => prev.filter(p => p.id !== photoId));
  };

  const handleRemoveNoteEntry = (noteId: string) => {
    setNoteEntries(prev => prev.filter(n => n.id !== noteId));
  };

  const handleSaveDailyLog = () => {
    if (!selectedProject) return;

    const logId = Date.now().toString();
    const log: DailyLog = {
      id: logId,
      projectId: selectedProject,
      date: new Date().toISOString(),
      note: dailyLogNote,
      category: dailyLogCategory,
      workPerformed: dailyLogWorkPerformed,
      issues: dailyLogIssues,
      reminders: dailyLogReminders.map(r => ({ ...r, dailyLogId: logId })),
      notes: noteEntries,
      photos: photoEntries,
      sharedWith: sharedWith,
    };

    addDailyLog(log);
    
    if (sharedWith.length > 0) {
      console.log('[Share] Daily log shared with:', sharedWith.join(', '));
    }
    
    setShowDailyLogsModal(false);
    setSharedWith([]);
    console.log('[Daily Log] Created with', dailyLogReminders.length, 'reminders,', noteEntries.length, 'notes, and', photoEntries.length, 'photos');
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
        {selectedProject && (
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.dailyLogHeaderButton}
              onPress={handleOpenDailyLogs}
            >
              <BookOpen size={20} color="#2563EB" />
              <Text style={styles.dailyLogHeaderButtonText}>Daily Log</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.historyButton}
              onPress={() => setShowHistoryModal(true)}
            >
              <History size={20} color="#059669" />
            </TouchableOpacity>
          </View>
        )}
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
                                    console.log('Saving notes:', quickNoteText);
                                    console.log('Saving work type:', quickEditWorkType);
                                    const updatedTasks = scheduledTasks.map(t => 
                                      t.id === task.id ? { ...t, notes: quickNoteText, workType: quickEditWorkType } : t
                                    );
                                    setScheduledTasks(updatedTasks);
                                    setQuickEditTask(null);
                                    setQuickNoteText('');
                                  }}
                                >
                                  <Text style={styles.quickEditButtonText}>Save</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.quickEditButton, styles.quickEditButtonCancel]}
                                  onPress={() => {
                                    setQuickEditTask(null);
                                    setQuickNoteText('');
                                  }}
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

      <Modal
        visible={showDailyLogsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDailyLogsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <BookOpen size={24} color="#2563EB" />
                <Text style={styles.modalTitle}>Daily Log</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDailyLogsModal(false)}>
                <X size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Work Category</Text>
              <TextInput
                style={styles.dailyLogInput}
                value={dailyLogCategory}
                onChangeText={setDailyLogCategory}
                placeholder="e.g., Framing, Plumbing, etc."
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.label}>Work Performed Today</Text>
              <TextInput
                style={styles.textArea}
                value={dailyLogWorkPerformed}
                onChangeText={setDailyLogWorkPerformed}
                placeholder="Describe what was completed today..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Issues/Notes</Text>
              <TextInput
                style={styles.textArea}
                value={dailyLogIssues}
                onChangeText={setDailyLogIssues}
                placeholder="Any issues or important notes..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Additional Notes</Text>
              <TextInput
                style={styles.textArea}
                value={dailyLogNote}
                onChangeText={setDailyLogNote}
                placeholder="General notes for the day..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
              />

              <View style={styles.remindersSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Bell size={20} color="#2563EB" />
                  <Text style={styles.label}>Reminders & Tasks</Text>
                </View>
                
                {dailyLogReminders.length > 0 && (
                  <View style={styles.remindersList}>
                    {dailyLogReminders.map((reminder) => (
                      <View key={reminder.id} style={styles.reminderItem}>
                        <TouchableOpacity 
                          onPress={() => handleToggleReminder(reminder.id)}
                          style={styles.reminderCheckbox}
                        >
                          {reminder.completed && <Check size={16} color="#FFFFFF" />}
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.reminderText, reminder.completed && styles.reminderTextCompleted]}>
                            {reminder.task}
                          </Text>
                          <Text style={styles.reminderTime}>⏰ {reminder.time}</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleDeleteReminder(reminder.id)}>
                          <Trash2 size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.addReminderContainer}>
                  <TextInput
                    style={styles.reminderInput}
                    value={newReminderTask}
                    onChangeText={setNewReminderTask}
                    placeholder="Task description..."
                    placeholderTextColor="#9CA3AF"
                  />
                  <TextInput
                    style={styles.reminderTimeInput}
                    value={newReminderTime}
                    onChangeText={setNewReminderTime}
                    placeholder="Time (e.g., 9:00 AM)"
                    placeholderTextColor="#9CA3AF"
                  />
                  <TouchableOpacity 
                    style={styles.addReminderButton}
                    onPress={handleAddReminder}
                  >
                    <Plus size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.noteEntriesSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Clock size={20} color="#2563EB" />
                  <Text style={styles.label}>Timestamped Notes</Text>
                </View>
                
                {noteEntries.length > 0 && (
                  <View style={styles.noteEntriesList}>
                    {noteEntries.map((note) => (
                      <View key={note.id} style={styles.noteEntryItem}>
                        <View style={styles.noteEntryHeader}>
                          <View style={styles.noteEntryInfo}>
                            <User size={14} color="#6B7280" />
                            <Text style={styles.noteEntryAuthor}>{note.author}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={styles.noteEntryTime}>
                              {new Date(note.timestamp).toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </Text>
                            <TouchableOpacity onPress={() => handleRemoveNoteEntry(note.id)}>
                              <X size={16} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                        <Text style={styles.noteEntryText}>{note.text}</Text>
                        <Text style={styles.noteEntryDate}>
                          {new Date(note.timestamp).toLocaleDateString()}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.addNoteEntryContainer}>
                  <TextInput
                    style={styles.noteEntryInput}
                    value={currentNoteInput}
                    onChangeText={setCurrentNoteInput}
                    placeholder="Add a note entry..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                  />
                  <TouchableOpacity 
                    style={styles.addNoteEntryButton}
                    onPress={handleAddNoteEntry}
                  >
                    <Plus size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.photoEntriesSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <ImageIcon size={20} color="#2563EB" />
                  <Text style={styles.label}>Photo Attachments</Text>
                </View>
                
                {photoEntries.length > 0 && (
                  <View style={styles.photoEntriesList}>
                    {photoEntries.map((photo) => (
                      <View key={photo.id} style={styles.photoEntryItem}>
                        <Image 
                          source={{ uri: photo.uri }} 
                          style={styles.photoEntryImage}
                        />
                        <View style={styles.photoEntryDetails}>
                          <View style={styles.photoEntryHeader}>
                            <View style={styles.photoEntryInfo}>
                              <User size={12} color="#6B7280" />
                              <Text style={styles.photoEntryAuthor}>{photo.author}</Text>
                            </View>
                            <TouchableOpacity onPress={() => handleRemovePhoto(photo.id)}>
                              <Trash2 size={16} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                          <Text style={styles.photoEntryTime}>
                            📅 {new Date(photo.timestamp).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Text>
                          {photo.notes && (
                            <Text style={styles.photoEntryNotes}>{photo.notes}</Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.photoButtonsContainer}>
                  <TouchableOpacity 
                    style={styles.photoButton}
                    onPress={handleTakePhoto}
                  >
                    <Camera size={20} color="#FFFFFF" />
                    <Text style={styles.photoButtonText}>Take Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.photoButton}
                    onPress={handlePickPhoto}
                  >
                    <ImageIcon size={20} color="#FFFFFF" />
                    <Text style={styles.photoButtonText}>Pick Photo</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.shareSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Users size={20} color="#2563EB" />
                  <Text style={styles.label}>Share with Team</Text>
                </View>
                
                {sharedWith.length > 0 && (
                  <View style={styles.sharedList}>
                    {sharedWith.map((email, idx) => (
                      <View key={idx} style={styles.sharedItem}>
                        <Text style={styles.sharedEmail}>{email}</Text>
                        <TouchableOpacity onPress={() => handleRemoveTeamMember(email)}>
                          <X size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.addShareContainer}>
                  <TextInput
                    style={styles.shareInput}
                    value={shareEmail}
                    onChangeText={setShareEmail}
                    placeholder="Team member email..."
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity 
                    style={styles.addShareButton}
                    onPress={handleAddTeamMember}
                  >
                    <Plus size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowDailyLogsModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={handleSaveDailyLog}
              >
                <Text style={styles.saveButtonText}>Save Log</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showHistoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <History size={24} color="#059669" />
                <Text style={styles.modalTitle}>Daily Logs History</Text>
              </View>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                <X size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {projectDailyLogs.length === 0 ? (
                <View style={styles.emptyHistoryState}>
                  <BookOpen size={48} color="#9CA3AF" />
                  <Text style={styles.emptyHistoryText}>No daily logs yet</Text>
                  <Text style={styles.emptyHistorySubtext}>Start creating daily logs to track project progress</Text>
                </View>
              ) : (
                <View style={styles.historyList}>
                  {projectDailyLogs
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((log) => (
                    <View key={log.id} style={styles.historyItem}>
                      <View style={styles.historyItemHeader}>
                        <View>
                          <Text style={styles.historyDate}>
                            {new Date(log.date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </Text>
                          {log.category && (
                            <Text style={styles.historyCategory}>{log.category}</Text>
                          )}
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            const logText = `Daily Log - ${new Date(log.date).toLocaleDateString()}\n\n` +
                              (log.category ? `Category: ${log.category}\n` : '') +
                              (log.workPerformed ? `\nWork Performed:\n${log.workPerformed}\n` : '') +
                              (log.issues ? `\nIssues/Notes:\n${log.issues}\n` : '') +
                              (log.note ? `\nAdditional Notes:\n${log.note}\n` : '') +
                              (log.reminders && log.reminders.length > 0 
                                ? `\nReminders:\n${log.reminders.map(r => `- ${r.task} (${r.time}) ${r.completed ? '✓' : ''}`).join('\n')}\n`
                                : '');
                            console.log('[Export] Daily log:', logText);
                            alert('Export functionality: This will be available to share via email/SMS in production.');
                          }}
                          style={styles.exportButton}
                        >
                          <Download size={18} color="#2563EB" />
                        </TouchableOpacity>
                      </View>

                      {log.workPerformed && (
                        <View style={styles.historySection}>
                          <Text style={styles.historySectionTitle}>Work Performed:</Text>
                          <Text style={styles.historySectionText}>{log.workPerformed}</Text>
                        </View>
                      )}

                      {log.issues && (
                        <View style={styles.historySection}>
                          <Text style={styles.historySectionTitle}>Issues/Notes:</Text>
                          <Text style={styles.historySectionText}>{log.issues}</Text>
                        </View>
                      )}

                      {log.note && (
                        <View style={styles.historySection}>
                          <Text style={styles.historySectionTitle}>Additional Notes:</Text>
                          <Text style={styles.historySectionText}>{log.note}</Text>
                        </View>
                      )}

                      {log.reminders && log.reminders.length > 0 && (
                        <View style={styles.historySection}>
                          <Text style={styles.historySectionTitle}>Reminders:</Text>
                          {log.reminders.map((reminder) => (
                            <View key={reminder.id} style={styles.historyReminderItem}>
                              <View style={[styles.historyReminderCheck, reminder.completed && styles.historyReminderCheckCompleted]}>
                                {reminder.completed && <Check size={12} color="#FFFFFF" />}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.historyReminderText, reminder.completed && styles.historyReminderTextCompleted]}>
                                  {reminder.task}
                                </Text>
                                <Text style={styles.historyReminderTime}>⏰ {reminder.time}</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}

                      {log.notes && log.notes.length > 0 && (
                        <View style={styles.historySection}>
                          <Text style={styles.historySectionTitle}>Timestamped Notes:</Text>
                          {log.notes.map((note) => (
                            <View key={note.id} style={styles.historyNoteItem}>
                              <View style={styles.historyNoteHeader}>
                                <Text style={styles.historyNoteAuthor}>👤 {note.author}</Text>
                                <Text style={styles.historyNoteTime}>
                                  {new Date(note.timestamp).toLocaleString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </Text>
                              </View>
                              <Text style={styles.historyNoteText}>{note.text}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {log.photos && log.photos.length > 0 && (
                        <View style={styles.historySection}>
                          <Text style={styles.historySectionTitle}>Photo Attachments:</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={styles.historyPhotosList}>
                              {log.photos.map((photo) => (
                                <View key={photo.id} style={styles.historyPhotoItem}>
                                  <Image 
                                    source={{ uri: photo.uri }} 
                                    style={styles.historyPhotoImage}
                                  />
                                  <View style={styles.historyPhotoInfo}>
                                    <Text style={styles.historyPhotoAuthor}>👤 {photo.author}</Text>
                                    <Text style={styles.historyPhotoTime}>
                                      {new Date(photo.timestamp).toLocaleString([], {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </Text>
                                  </View>
                                </View>
                              ))}
                            </View>
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <View style={styles.historyFooter}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowHistoryModal(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
              {projectDailyLogs.length > 0 && (
                <TouchableOpacity 
                  style={styles.exportAllButton}
                  onPress={() => {
                    const allLogsText = projectDailyLogs
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(log => {
                        return `Daily Log - ${new Date(log.date).toLocaleDateString()}\n\n` +
                          (log.category ? `Category: ${log.category}\n` : '') +
                          (log.workPerformed ? `\nWork Performed:\n${log.workPerformed}\n` : '') +
                          (log.issues ? `\nIssues/Notes:\n${log.issues}\n` : '') +
                          (log.note ? `\nAdditional Notes:\n${log.note}\n` : '') +
                          (log.reminders && log.reminders.length > 0 
                            ? `\nReminders:\n${log.reminders.map(r => `- ${r.task} (${r.time}) ${r.completed ? '✓' : ''}`).join('\n')}\n`
                            : '') +
                          '\n---\n\n';
                      })
                      .join('');
                    console.log('[Export All] Daily logs:', allLogsText);
                    alert('Export All functionality: This will be available to share via email/SMS in production.');
                  }}
                >
                  <Download size={18} color="#FFFFFF" />
                  <Text style={styles.exportAllButtonText}>Export All</Text>
                </TouchableOpacity>
              )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 6,
    minHeight: 60,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  quickEditButtons: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  quickEditButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  quickEditButtonCancel: {
    backgroundColor: '#6B7280',
  },
  quickEditButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700' as const,
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
  dailyLogHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  dailyLogHeaderButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  historyList: {
    gap: 16,
  },
  historyItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  historyDate: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  historyCategory: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  historySection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  historySectionTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  historySectionText: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
  },
  historyReminderItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  historyReminderCheck: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  historyReminderCheckCompleted: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  historyReminderText: {
    fontSize: 13,
    color: '#1F2937',
  },
  historyReminderTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  historyReminderTime: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  exportButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  emptyHistoryState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyHistoryText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginTop: 16,
  },
  emptyHistorySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  historyFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  closeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  exportAllButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#059669',
  },
  exportAllButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  dailyLogInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 16,
  },
  remindersSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  remindersList: {
    marginBottom: 16,
    gap: 12,
  },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reminderCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#2563EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#1F2937',
  },
  reminderTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  reminderTime: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  addReminderContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  reminderInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1F2937',
  },
  reminderTimeInput: {
    width: 130,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1F2937',
  },
  addReminderButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  sharedList: {
    marginBottom: 12,
    gap: 8,
  },
  sharedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  sharedEmail: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#0C4A6E',
  },
  addShareContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  shareInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1F2937',
  },
  addShareButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteEntriesSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  noteEntriesList: {
    marginBottom: 12,
    gap: 12,
  },
  noteEntryItem: {
    padding: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  noteEntryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteEntryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noteEntryAuthor: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  noteEntryTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  noteEntryText: {
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 6,
    lineHeight: 20,
  },
  noteEntryDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  addNoteEntryContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  noteEntryInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1F2937',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  addNoteEntryButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEntriesSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  photoEntriesList: {
    marginBottom: 12,
    gap: 12,
  },
  photoEntryItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  photoEntryImage: {
    width: 80,
    height: 80,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  photoEntryDetails: {
    flex: 1,
    justifyContent: 'space-between',
  },
  photoEntryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoEntryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  photoEntryAuthor: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  photoEntryTime: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  photoEntryNotes: {
    fontSize: 12,
    color: '#1F2937',
    marginTop: 4,
  },
  photoButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#059669',
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  historyNoteItem: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#F0F9FF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  historyNoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyNoteAuthor: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  historyNoteTime: {
    fontSize: 11,
    color: '#6B7280',
  },
  historyNoteText: {
    fontSize: 13,
    color: '#1F2937',
    lineHeight: 18,
  },
  historyPhotosList: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },
  historyPhotoItem: {
    width: 120,
  },
  historyPhotoImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  historyPhotoInfo: {
    marginTop: 6,
  },
  historyPhotoAuthor: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  historyPhotoTime: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
});

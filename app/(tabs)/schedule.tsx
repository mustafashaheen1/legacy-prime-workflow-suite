import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  Alert,
  Image,
  Switch
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Calendar, X, GripVertical, BookOpen, Plus, Trash2, Check, Share2, Users, History, Download, Camera, ImageIcon, ChevronDown, ChevronRight, FileText } from 'lucide-react-native';
import { ScheduledTask, DailyLog, DailyLogTask, DailyLogPhoto } from '@/types';
import { trpc } from '@/lib/trpc';

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
const ROW_HEIGHT = 80;
const HOUR_HEIGHT = 80;
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
  const [resizingTask, setResizingTask] = useState<{ id: string; type: 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' } | null>(null);
  const [touchingHandle, setTouchingHandle] = useState<{ id: string; type: 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' } | null>(null);
  const [quickEditTask, setQuickEditTask] = useState<string | null>(null);
  const [quickNoteText, setQuickNoteText] = useState<string>('');
  const [quickEditWorkType, setQuickEditWorkType] = useState<'in-house' | 'subcontractor'>('in-house');
  const [lastTap, setLastTap] = useState<number>(0);

  // Resize tracking state
  const [activeResize, setActiveResize] = useState<{
    taskId: string;
    type: 'right' | 'bottom';
    startX: number;
    startY: number;
    initialDuration: number;
    initialRowSpan: number;
  } | null>(null);

  // Drag tracking state
  const [activeDrag, setActiveDrag] = useState<{
    taskId: string;
    startX: number;
    startY: number;
    initialRow: number;
    initialStartDate: Date;
    initialDayIndex: number;
  } | null>(null);

  // Refs to track current state inside event listeners (prevents stale closure issues)
  const activeResizeRef = useRef<{
    taskId: string;
    type: 'right' | 'bottom';
    startX: number;
    startY: number;
    initialDuration: number;
    initialRowSpan: number;
  } | null>(null);

  const activeDragRef = useRef<{
    taskId: string;
    startX: number;
    startY: number;
    initialRow: number;
    initialStartDate: Date;
    initialDayIndex: number;
  } | null>(null);

  const [showDailyLogsModal, setShowDailyLogsModal] = useState<boolean>(false);
  const [equipmentExpanded, setEquipmentExpanded] = useState<boolean>(false);
  const [materialExpanded, setMaterialExpanded] = useState<boolean>(false);
  const [officialExpanded, setOfficialExpanded] = useState<boolean>(false);
  const [subsExpanded, setSubsExpanded] = useState<boolean>(false);
  const [employeesExpanded, setEmployeesExpanded] = useState<boolean>(false);
  
  const [equipmentNote, setEquipmentNote] = useState<string>('');
  const [materialNote, setMaterialNote] = useState<string>('');
  const [officialNote, setOfficialNote] = useState<string>('');
  const [subsNote, setSubsNote] = useState<string>('');
  const [employeesNote, setEmployeesNote] = useState<string>('');
  
  const [workPerformed, setWorkPerformed] = useState<string>('');
  const [issues, setIssues] = useState<string>('');
  const [generalNotes, setGeneralNotes] = useState<string>('');
  
  const [tasks, setTasks] = useState<DailyLogTask[]>([]);
  const [photos, setPhotos] = useState<DailyLogPhoto[]>([]);
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [shareEmail, setShareEmail] = useState<string>('');
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // tRPC queries and mutations for scheduled tasks
  const scheduledTasksQuery = trpc.scheduledTasks.getScheduledTasks.useQuery(
    { projectId: selectedProject || undefined },
    { enabled: !!selectedProject }
  );

  const addScheduledTaskMutation = trpc.scheduledTasks.addScheduledTask.useMutation({
    onSuccess: () => {
      scheduledTasksQuery.refetch();
    },
    onError: (error) => {
      console.error('[Scheduled Task] Error adding task:', error);
      Alert.alert('Error', 'Failed to add task to schedule');
    },
  });

  const updateScheduledTaskMutation = trpc.scheduledTasks.updateScheduledTask.useMutation({
    onSuccess: () => {
      scheduledTasksQuery.refetch();
    },
    onError: (error) => {
      console.error('[Scheduled Task] Error updating task:', error);
      Alert.alert('Error', 'Failed to update task');
    },
  });

  const deleteScheduledTaskMutation = trpc.scheduledTasks.deleteScheduledTask.useMutation({
    onSuccess: () => {
      scheduledTasksQuery.refetch();
    },
    onError: (error) => {
      console.error('[Scheduled Task] Error deleting task:', error);
      Alert.alert('Error', 'Failed to delete task');
    },
  });

  // Sync scheduled tasks from database to local state
  useEffect(() => {
    if (scheduledTasksQuery.data?.scheduledTasks) {
      setScheduledTasks(scheduledTasksQuery.data.scheduledTasks);
    }
  }, [scheduledTasksQuery.data]);

  const timelineRef = useRef<ScrollView>(null);
  const projectTasks = scheduledTasks.filter(t => t.projectId === selectedProject);
  const projectDailyLogs = (dailyLogs && Array.isArray(dailyLogs)) ? dailyLogs.filter(log => log.projectId === selectedProject) : [];

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

    const newTask = {
      projectId: selectedProject,
      category: category,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      duration: 7,
      workType: 'in-house' as const,
      notes: '',
      color: categoryData.color,
      row: projectTasks.length,
      rowSpan: 1,
    };

    // Save to database via tRPC
    addScheduledTaskMutation.mutate(newTask);

    // Also update local state optimistically
    const localTask: ScheduledTask = {
      id: `temp-${Date.now()}`,
      ...newTask,
    };
    setScheduledTasks([...scheduledTasks, localTask]);
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
    // Delete from database
    deleteScheduledTaskMutation.mutate({ id: taskId });

    // Also remove from local state optimistically
    setScheduledTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleOpenDailyLogs = () => {
    setShowDailyLogsModal(true);
    setEquipmentExpanded(false);
    setMaterialExpanded(false);
    setOfficialExpanded(false);
    setSubsExpanded(false);
    setEmployeesExpanded(false);
    setEquipmentNote('');
    setMaterialNote('');
    setOfficialNote('');
    setSubsNote('');
    setEmployeesNote('');
    setWorkPerformed('');
    setIssues('');
    setGeneralNotes('');
    setTasks([]);
    setPhotos([]);
    setSharedWith([]);
  };

  const handleAddTask = () => {
    const newTask: DailyLogTask = {
      id: Date.now().toString(),
      description: '',
      completed: false,
    };
    setTasks([...tasks, newTask]);
  };

  const handleUpdateTask = (id: string, description: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, description } : t));
  };

  const handleToggleTaskComplete = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleDeleteTaskRow = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleTakePhoto = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Camera', 'Camera access is not available on web. Please use a mobile device.');
      return;
    }

    try {
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

      setPhotos([...photos, photoEntry]);
      console.log('[Photo] Photo added at:', new Date().toLocaleTimeString());
    } catch (error) {
      console.error('[Photo Picker] Error:', error);
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId));
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

  const handleSaveDailyLog = async () => {
    if (!selectedProject || !user) return;

    const logId = Date.now().toString();
    const log: DailyLog = {
      id: logId,
      projectId: selectedProject,
      logDate: new Date().toISOString().split('T')[0],
      createdBy: user.name,
      equipmentNote: equipmentExpanded ? equipmentNote : undefined,
      materialNote: materialExpanded ? materialNote : undefined,
      officialNote: officialExpanded ? officialNote : undefined,
      subsNote: subsExpanded ? subsNote : undefined,
      employeesNote: employeesExpanded ? employeesNote : undefined,
      workPerformed,
      issues,
      generalNotes,
      tasks,
      photos,
      sharedWith,
      createdAt: new Date().toISOString(),
    };

    try {
      await addDailyLog(log); // Now returns Promise

      if (sharedWith.length > 0) {
        console.log('[Share] Daily log shared with:', sharedWith.join(', '));
      }

      setShowDailyLogsModal(false);
      console.log('[Daily Log] Created with', tasks.length, 'tasks and', photos.length, 'photos');

      // Show success message
      Alert.alert('Success', 'Daily log saved successfully');
    } catch (error: any) {
      console.error('[Daily Log] Error saving:', error);
      // Log was saved locally, show appropriate message
      Alert.alert(
        'Saved Locally',
        'Daily log saved to your device. It will sync when connection is restored.'
      );
    }
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

  // Resize handler functions
  const handleResizeStart = (task: ScheduledTask, resizeType: 'right' | 'bottom', clientX: number, clientY: number) => {
    const resizeState = {
      taskId: task.id,
      type: resizeType,
      startX: clientX,
      startY: clientY,
      initialDuration: task.duration,
      initialRowSpan: task.rowSpan || 1,
    };

    // Store in ref for event listeners
    activeResizeRef.current = resizeState;

    // Also update state for UI
    setActiveResize(resizeState);
    setResizingTask({ id: task.id, type: resizeType });
    setTouchingHandle({ id: task.id, type: resizeType });
  };

  const handleResizeMove = (clientX: number, clientY: number) => {
    // Read from ref to avoid stale closure
    const resize = activeResizeRef.current;
    if (!resize) return;

    // Use functional setState to always get latest tasks
    setScheduledTasks(prevTasks => {
      const task = prevTasks.find(t => t.id === resize.taskId);
      if (!task) return prevTasks;

      if (resize.type === 'right') {
        // Calculate delta from initial position
        const deltaX = clientX - resize.startX;
        const deltaDays = Math.round(deltaX / DAY_WIDTH);
        const newDuration = Math.max(1, resize.initialDuration + deltaDays);

        if (newDuration !== task.duration) {
          const newEndDate = new Date(task.startDate);
          newEndDate.setDate(newEndDate.getDate() + newDuration);

          return prevTasks.map(t =>
            t.id === resize.taskId ? {
              ...t,
              duration: newDuration,
              endDate: newEndDate.toISOString(),
            } : t
          );
        }
      } else if (resize.type === 'bottom') {
        // Calculate delta from initial position
        const deltaY = clientY - resize.startY;
        const rowHeight = ROW_HEIGHT + 16;
        const deltaRows = Math.round(deltaY / rowHeight);
        const newRowSpan = Math.max(1, resize.initialRowSpan + deltaRows);

        if (newRowSpan !== (task.rowSpan || 1)) {
          return prevTasks.map(t =>
            t.id === resize.taskId ? { ...t, rowSpan: newRowSpan } : t
          );
        }
      }

      return prevTasks;
    });
  };

  const handleResizeEnd = () => {
    const resize = activeResizeRef.current;
    if (resize) {
      // Find the updated task
      const task = scheduledTasks.find(t => t.id === resize.taskId);
      if (task) {
        // Save changes to database
        updateScheduledTaskMutation.mutate({
          id: task.id,
          startDate: task.startDate,
          endDate: task.endDate,
          duration: task.duration,
          rowSpan: task.rowSpan,
        });
      }
    }

    activeResizeRef.current = null;
    setActiveResize(null);
    setResizingTask(null);
    setTouchingHandle(null);
  };

  // Drag handlers
  const handleDragStart = (task: ScheduledTask, clientX: number, clientY: number) => {
    // Find the initial day index
    const taskStartDate = new Date(task.startDate);
    const initialDayIndex = dates.findIndex(d =>
      d.toDateString() === taskStartDate.toDateString()
    );

    const dragState = {
      taskId: task.id,
      startX: clientX,
      startY: clientY,
      initialRow: task.row || 0,
      initialStartDate: taskStartDate,
      initialDayIndex: initialDayIndex,
    };

    // Store in ref for event listeners
    activeDragRef.current = dragState;

    // Also update state for UI
    setDraggedTask(task.id);
    setActiveDrag(dragState);
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    // Read from ref to avoid stale closure
    const drag = activeDragRef.current;
    if (!drag) return;

    // Use functional setState to always get latest tasks
    setScheduledTasks(prevTasks => {
      const task = prevTasks.find(t => t.id === drag.taskId);
      if (!task) return prevTasks;

      // Calculate horizontal movement (days)
      const deltaX = clientX - drag.startX;
      const deltaDays = Math.round(deltaX / DAY_WIDTH);

      // Calculate vertical movement (rows)
      const deltaY = clientY - drag.startY;
      const rowHeight = ROW_HEIGHT + 16;
      const deltaRows = Math.round(deltaY / rowHeight);
      const newRow = Math.max(0, drag.initialRow + deltaRows);

      // Calculate new start date
      const newStartDate = new Date(drag.initialStartDate);
      newStartDate.setDate(drag.initialStartDate.getDate() + deltaDays);

      // Calculate new end date based on duration
      const newEndDate = new Date(newStartDate);
      newEndDate.setDate(newStartDate.getDate() + task.duration);

      // Only update if something changed
      const currentRow = task.row || 0;
      const currentStartDate = new Date(task.startDate).toDateString();
      const newStartDateString = newStartDate.toDateString();

      if (newRow !== currentRow || currentStartDate !== newStartDateString) {
        return prevTasks.map(t =>
          t.id === drag.taskId
            ? {
                ...t,
                row: newRow,
                startDate: newStartDate.toISOString(),
                endDate: newEndDate.toISOString(),
              }
            : t
        );
      }

      return prevTasks;
    });
  };

  const handleDragEnd = () => {
    const drag = activeDragRef.current;
    if (drag) {
      // Find the updated task
      const task = scheduledTasks.find(t => t.id === drag.taskId);
      if (task) {
        // Save all drag-related changes to database
        updateScheduledTaskMutation.mutate({
          id: task.id,
          startDate: task.startDate,
          endDate: task.endDate,
          duration: task.duration,
          row: task.row,
        });
      }
    }

    activeDragRef.current = null;
    setActiveDrag(null);
    setDraggedTask(null);
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
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.categoriesList}>
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
                showsHorizontalScrollIndicator={true}
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
              showsVerticalScrollIndicator={true}
              scrollEnabled={!resizingTask && !draggedTask}
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
                  showsHorizontalScrollIndicator={true}
                  scrollEnabled={!resizingTask && !draggedTask}
                  style={styles.tasksScrollView}
                >
                  <View style={styles.tasksGrid}>
                    {dates.map((date, idx) => (
                      <View key={idx} style={styles.dayGridColumn} />
                    ))}
                    
                    {projectTasks.map((task) => {
                      const position = getTaskPosition(task);
                      if (!position) return null;

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
                            activeDrag?.taskId === task.id && styles.taskBlockDragging,
                            activeResize?.taskId === task.id && styles.taskBlockResizing,
                          ]}
                        >
                          {/* Main draggable content */}
                          <View
                            style={[
                              styles.taskContentWrapper,
                              activeDrag?.taskId === task.id && styles.taskDragging,
                            ]}
                            onStartShouldSetResponder={() => true}
                            onResponderGrant={(e) => {
                              if (Platform.OS !== 'web') {
                                const { pageX, pageY } = e.nativeEvent;
                                handleDragStart(task, pageX, pageY);
                              }
                            }}
                            onResponderMove={(e) => {
                              if (Platform.OS !== 'web' && activeDrag) {
                                const { pageX, pageY } = e.nativeEvent;
                                handleDragMove(pageX, pageY);
                              }
                            }}
                            onResponderRelease={() => {
                              if (Platform.OS !== 'web') {
                                handleDragEnd();
                              }
                            }}
                            {...(Platform.OS === 'web' ? {
                              onPointerDown: (e: any) => {
                                e.stopPropagation();
                                const clientX = e.clientX;
                                const clientY = e.clientY;
                                handleDragStart(task, clientX, clientY);

                                const onMove = (moveEvent: PointerEvent) => {
                                  handleDragMove(moveEvent.clientX, moveEvent.clientY);
                                };
                                const onUp = () => {
                                  handleDragEnd();
                                  document.removeEventListener('pointermove', onMove);
                                  document.removeEventListener('pointerup', onUp);
                                  document.body.style.cursor = '';
                                };
                                document.addEventListener('pointermove', onMove);
                                document.addEventListener('pointerup', onUp);
                                document.body.style.cursor = 'grabbing';
                              },
                              onClick: handleTaskTap,
                            } : {})}
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
                          </View>

                          {/* Right edge resize handle */}
                          <View
                            style={[
                              styles.resizeHandleRight,
                              isTouchingRightHandle && styles.resizeHandleActive,
                            ]}
                            onStartShouldSetResponder={() => true}
                            onResponderGrant={(event) => {
                              const { pageX, pageY } = event.nativeEvent;
                              handleResizeStart(task, 'right', pageX, pageY);
                            }}
                            onResponderMove={(event) => {
                              if (Platform.OS !== 'web') {
                                const { pageX, pageY } = event.nativeEvent;
                                handleResizeMove(pageX, pageY);
                              }
                            }}
                            onResponderRelease={() => {
                              if (Platform.OS !== 'web') {
                                handleResizeEnd();
                              }
                            }}
                            {...(Platform.OS === 'web' ? {
                              onPointerDown: (e: any) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const clientX = e.clientX;
                                const clientY = e.clientY;
                                handleResizeStart(task, 'right', clientX, clientY);

                                const onMove = (moveEvent: PointerEvent) => {
                                  handleResizeMove(moveEvent.clientX, moveEvent.clientY);
                                };
                                const onUp = () => {
                                  handleResizeEnd();
                                  document.removeEventListener('pointermove', onMove);
                                  document.removeEventListener('pointerup', onUp);
                                  document.body.style.cursor = '';
                                };
                                document.addEventListener('pointermove', onMove);
                                document.addEventListener('pointerup', onUp);
                                document.body.style.cursor = 'ew-resize';
                              },
                            } : {})}
                          >
                            <View
                              style={[
                                styles.resizeIndicatorVertical,
                                isTouchingRightHandle && styles.resizeIndicatorActive,
                              ]}
                            />
                          </View>

                          {/* Bottom edge resize handle */}
                          <View
                            style={[
                              styles.resizeHandleBottom,
                              isTouchingBottomHandle && styles.resizeHandleActive,
                            ]}
                            onStartShouldSetResponder={() => true}
                            onResponderGrant={(event) => {
                              const { pageX, pageY } = event.nativeEvent;
                              handleResizeStart(task, 'bottom', pageX, pageY);
                            }}
                            onResponderMove={(event) => {
                              if (Platform.OS !== 'web') {
                                const { pageX, pageY } = event.nativeEvent;
                                handleResizeMove(pageX, pageY);
                              }
                            }}
                            onResponderRelease={() => {
                              if (Platform.OS !== 'web') {
                                handleResizeEnd();
                              }
                            }}
                            {...(Platform.OS === 'web' ? {
                              onPointerDown: (e: any) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const clientX = e.clientX;
                                const clientY = e.clientY;
                                handleResizeStart(task, 'bottom', clientX, clientY);

                                const onMove = (moveEvent: PointerEvent) => {
                                  handleResizeMove(moveEvent.clientX, moveEvent.clientY);
                                };
                                const onUp = () => {
                                  handleResizeEnd();
                                  document.removeEventListener('pointermove', onMove);
                                  document.removeEventListener('pointerup', onUp);
                                  document.body.style.cursor = '';
                                };
                                document.addEventListener('pointermove', onMove);
                                document.addEventListener('pointerup', onUp);
                                document.body.style.cursor = 'ns-resize';
                              },
                            } : {})}
                          >
                            <View
                              style={[
                                styles.resizeIndicatorHorizontal,
                                isTouchingBottomHandle && styles.resizeIndicatorActive,
                              ]}
                            />
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
                                    // Update local state
                                    const updatedTasks = scheduledTasks.map(t =>
                                      t.id === task.id ? { ...t, notes: quickNoteText, workType: quickEditWorkType } : t
                                    );
                                    setScheduledTasks(updatedTasks);

                                    // Save to database
                                    updateScheduledTaskMutation.mutate({
                                      id: task.id,
                                      notes: quickNoteText,
                                      workType: quickEditWorkType,
                                    });

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
                <View>
                  <Text style={styles.modalTitle}>Daily Log</Text>
                  <Text style={styles.modalSubtitle}>
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowDailyLogsModal(false)}>
                <X size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.toggleSection}>
                <TouchableOpacity 
                  style={styles.toggleRow}
                  onPress={() => setEquipmentExpanded(!equipmentExpanded)}
                >
                  {equipmentExpanded ? <ChevronDown size={20} color="#2563EB" /> : <ChevronRight size={20} color="#6B7280" />}
                  <Text style={styles.toggleLabel}>🚜 Equipment</Text>
                </TouchableOpacity>
                {equipmentExpanded && (
                  <TextInput
                    style={styles.oneLineInput}
                    value={equipmentNote}
                    onChangeText={setEquipmentNote}
                    placeholder="Quick note about equipment..."
                    placeholderTextColor="#9CA3AF"
                  />
                )}
              </View>

              <View style={styles.toggleSection}>
                <TouchableOpacity 
                  style={styles.toggleRow}
                  onPress={() => setMaterialExpanded(!materialExpanded)}
                >
                  {materialExpanded ? <ChevronDown size={20} color="#2563EB" /> : <ChevronRight size={20} color="#6B7280" />}
                  <Text style={styles.toggleLabel}>📦 Material</Text>
                </TouchableOpacity>
                {materialExpanded && (
                  <TextInput
                    style={styles.oneLineInput}
                    value={materialNote}
                    onChangeText={setMaterialNote}
                    placeholder="Quick note about materials..."
                    placeholderTextColor="#9CA3AF"
                  />
                )}
              </View>

              <View style={styles.toggleSection}>
                <TouchableOpacity 
                  style={styles.toggleRow}
                  onPress={() => setOfficialExpanded(!officialExpanded)}
                >
                  {officialExpanded ? <ChevronDown size={20} color="#2563EB" /> : <ChevronRight size={20} color="#6B7280" />}
                  <Text style={styles.toggleLabel}>📋 Official</Text>
                </TouchableOpacity>
                {officialExpanded && (
                  <TextInput
                    style={styles.oneLineInput}
                    value={officialNote}
                    onChangeText={setOfficialNote}
                    placeholder="Quick note about official matters..."
                    placeholderTextColor="#9CA3AF"
                  />
                )}
              </View>

              <View style={styles.toggleSection}>
                <TouchableOpacity 
                  style={styles.toggleRow}
                  onPress={() => setSubsExpanded(!subsExpanded)}
                >
                  {subsExpanded ? <ChevronDown size={20} color="#2563EB" /> : <ChevronRight size={20} color="#6B7280" />}
                  <Text style={styles.toggleLabel}>👷 Subs</Text>
                </TouchableOpacity>
                {subsExpanded && (
                  <TextInput
                    style={styles.oneLineInput}
                    value={subsNote}
                    onChangeText={setSubsNote}
                    placeholder="Quick note about subcontractors..."
                    placeholderTextColor="#9CA3AF"
                  />
                )}
              </View>

              <View style={styles.toggleSection}>
                <TouchableOpacity 
                  style={styles.toggleRow}
                  onPress={() => setEmployeesExpanded(!employeesExpanded)}
                >
                  {employeesExpanded ? <ChevronDown size={20} color="#2563EB" /> : <ChevronRight size={20} color="#6B7280" />}
                  <Text style={styles.toggleLabel}>👥 Employees</Text>
                </TouchableOpacity>
                {employeesExpanded && (
                  <TextInput
                    style={styles.oneLineInput}
                    value={employeesNote}
                    onChangeText={setEmployeesNote}
                    placeholder="Quick note about employees..."
                    placeholderTextColor="#9CA3AF"
                  />
                )}
              </View>

              <View style={styles.divider} />

              <Text style={styles.label}>Work Performed</Text>
              <TextInput
                style={styles.textArea}
                value={workPerformed}
                onChangeText={setWorkPerformed}
                placeholder="Describe what was completed today..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Issues</Text>
              <TextInput
                style={styles.textArea}
                value={issues}
                onChangeText={setIssues}
                placeholder="Any issues or concerns..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>General Notes</Text>
              <TextInput
                style={styles.textArea}
                value={generalNotes}
                onChangeText={setGeneralNotes}
                placeholder="Additional notes..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
              />

              <View style={styles.divider} />

              <View style={styles.photoSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={styles.label}>Photo Attachments</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity 
                      style={styles.photoButton}
                      onPress={handleTakePhoto}
                    >
                      <Camera size={18} color="#2563EB" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.photoButton}
                      onPress={handlePickPhoto}
                    >
                      <ImageIcon size={18} color="#2563EB" />
                    </TouchableOpacity>
                  </View>
                </View>
                
                {photos.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.photosList}>
                      {photos.map((photo) => (
                        <View key={photo.id} style={styles.photoItem}>
                          <Image 
                            source={{ uri: photo.uri }} 
                            style={styles.photoThumbnail}
                          />
                          <TouchableOpacity
                            style={styles.photoRemoveButton}
                            onPress={() => handleRemovePhoto(photo.id)}
                          >
                            <X size={14} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                )}
              </View>

              <View style={styles.divider} />

              <View style={styles.tasksSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={styles.label}>Tasks</Text>
                  <TouchableOpacity 
                    style={styles.addTaskButton}
                    onPress={handleAddTask}
                  >
                    <Plus size={18} color="#FFFFFF" />
                    <Text style={styles.addTaskButtonText}>Add Row</Text>
                  </TouchableOpacity>
                </View>
                
                {tasks.map((task) => (
                  <View key={task.id} style={styles.taskRow}>
                    <TouchableOpacity 
                      onPress={() => handleToggleTaskComplete(task.id)}
                      style={[styles.taskCheckbox, task.completed && styles.taskCheckboxCompleted]}
                    >
                      {task.completed && <Check size={14} color="#FFFFFF" />}
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.taskInput, task.completed && styles.taskInputCompleted]}
                      value={task.description}
                      onChangeText={(text) => handleUpdateTask(task.id, text)}
                      placeholder="Task description..."
                      placeholderTextColor="#9CA3AF"
                    />
                    <TouchableOpacity onPress={() => handleDeleteTaskRow(task.id)}>
                      <Trash2 size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={styles.divider} />

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
                    .sort((a, b) => new Date(b.logDate).getTime() - new Date(a.logDate).getTime())
                    .map((log) => (
                    <View key={log.id} style={styles.historyItem}>
                      <View style={styles.historyItemHeader}>
                        <View>
                          <Text style={styles.historyDate}>
                            {new Date(log.logDate).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </Text>
                          <Text style={styles.historyCreatedBy}>
                            By {log.createdBy} • {new Date(log.createdAt).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row' }}>
                          <TouchableOpacity
                            onPress={() => {
                              Alert.alert(
                                'Delete Daily Log',
                                'Are you sure you want to delete this daily log? This action cannot be undone.',
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Delete',
                                    style: 'destructive',
                                    onPress: async () => {
                                      try {
                                        await deleteDailyLog(log.id);
                                        Alert.alert('Success', 'Daily log deleted successfully');
                                      } catch (error) {
                                        Alert.alert('Error', 'Failed to delete daily log');
                                      }
                                    },
                                  },
                                ],
                              );
                            }}
                            style={[styles.exportButton, { marginRight: 8 }]}
                          >
                            <Trash2 size={18} color="#EF4444" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              const logText = `Daily Log - ${new Date(log.logDate).toLocaleDateString()}\n` +
                                `Created by: ${log.createdBy}\n\n` +
                                (log.equipmentNote ? `Equipment: ${log.equipmentNote}\n` : '') +
                                (log.materialNote ? `Material: ${log.materialNote}\n` : '') +
                                (log.officialNote ? `Official: ${log.officialNote}\n` : '') +
                                (log.subsNote ? `Subs: ${log.subsNote}\n` : '') +
                                (log.employeesNote ? `Employees: ${log.employeesNote}\n` : '') +
                                `\nWork Performed:\n${log.workPerformed}\n` +
                                `\nIssues:\n${log.issues}\n` +
                                `\nGeneral Notes:\n${log.generalNotes}\n` +
                                (log.tasks.length > 0 ? `\nTasks:\n${log.tasks.map(t => `${t.completed ? '✓' : '○'} ${t.description}`).join('\n')}\n` : '');
                              console.log('[Export] Daily log:', logText);
                              alert('Export functionality: This will be available to share via email/SMS in production.');
                            }}
                            style={styles.exportButton}
                          >
                            <Download size={18} color="#2563EB" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {(log.equipmentNote || log.materialNote || log.officialNote || log.subsNote || log.employeesNote) && (
                        <View style={styles.historySection}>
                          <Text style={styles.historySectionTitle}>Quick Notes:</Text>
                          {log.equipmentNote && <Text style={styles.quickNoteItem}>🚜 Equipment: {log.equipmentNote}</Text>}
                          {log.materialNote && <Text style={styles.quickNoteItem}>📦 Material: {log.materialNote}</Text>}
                          {log.officialNote && <Text style={styles.quickNoteItem}>📋 Official: {log.officialNote}</Text>}
                          {log.subsNote && <Text style={styles.quickNoteItem}>👷 Subs: {log.subsNote}</Text>}
                          {log.employeesNote && <Text style={styles.quickNoteItem}>👥 Employees: {log.employeesNote}</Text>}
                        </View>
                      )}

                      {log.workPerformed && (
                        <View style={styles.historySection}>
                          <Text style={styles.historySectionTitle}>Work Performed:</Text>
                          <Text style={styles.historySectionText}>{log.workPerformed}</Text>
                        </View>
                      )}

                      {log.issues && (
                        <View style={styles.historySection}>
                          <Text style={styles.historySectionTitle}>Issues:</Text>
                          <Text style={styles.historySectionText}>{log.issues}</Text>
                        </View>
                      )}

                      {log.generalNotes && (
                        <View style={styles.historySection}>
                          <Text style={styles.historySectionTitle}>General Notes:</Text>
                          <Text style={styles.historySectionText}>{log.generalNotes}</Text>
                        </View>
                      )}

                      {log.tasks.length > 0 && (
                        <View style={styles.historySection}>
                          <Text style={styles.historySectionTitle}>Tasks:</Text>
                          {log.tasks.map((task) => (
                            <View key={task.id} style={styles.historyTaskItem}>
                              <View style={[styles.historyTaskCheck, task.completed && styles.historyTaskCheckCompleted]}>
                                {task.completed && <Check size={12} color="#FFFFFF" />}
                              </View>
                              <Text style={[styles.historyTaskText, task.completed && styles.historyTaskTextCompleted]}>
                                {task.description}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {log.photos.length > 0 && (
                        <View style={styles.historySection}>
                          <Text style={styles.historySectionTitle}>Photos ({log.photos.length}):</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={styles.historyPhotosList}>
                              {log.photos.map((photo) => (
                                <View key={photo.id} style={styles.historyPhotoItem}>
                                  <Image 
                                    source={{ uri: photo.uri }} 
                                    style={styles.historyPhotoImage}
                                  />
                                </View>
                              ))}
                            </View>
                          </ScrollView>
                        </View>
                      )}

                      {log.sharedWith.length > 0 && (
                        <View style={styles.historySection}>
                          <Text style={styles.historySectionTitle}>Shared with:</Text>
                          <Text style={styles.historySectionText}>{log.sharedWith.join(', ')}</Text>
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
                      .sort((a, b) => new Date(b.logDate).getTime() - new Date(a.logDate).getTime())
                      .map(log => {
                        return `Daily Log - ${new Date(log.logDate).toLocaleDateString()}\n` +
                          `Created by: ${log.createdBy}\n\n` +
                          (log.equipmentNote ? `Equipment: ${log.equipmentNote}\n` : '') +
                          (log.materialNote ? `Material: ${log.materialNote}\n` : '') +
                          (log.officialNote ? `Official: ${log.officialNote}\n` : '') +
                          (log.subsNote ? `Subs: ${log.subsNote}\n` : '') +
                          (log.employeesNote ? `Employees: ${log.employeesNote}\n` : '') +
                          `\nWork Performed:\n${log.workPerformed}\n` +
                          `\nIssues:\n${log.issues}\n` +
                          `\nGeneral Notes:\n${log.generalNotes}\n\n---\n\n`;
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
    overflow: 'visible',
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
    overflow: 'visible',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    padding: 10,
    minHeight: 70,
  },
  taskContentWrapper: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 34,
    bottom: 34,
    cursor: 'grab' as any,
  },
  taskDragging: {
    cursor: 'grabbing' as any,
  },
  taskContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 24,
    bottom: 24,
    zIndex: 1,
  },
  taskContentInner: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  taskDragArea: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 1,
  },
  taskSubtitle: {
    fontSize: 10,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 1,
  },
  taskDuration: {
    fontSize: 10,
    color: '#FFFFFF',
    opacity: 0.8,
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
    zIndex: 300,
  },
  taskBlockDragging: {
    opacity: 0.85,
    transform: [{ scale: 1.02 }],
    zIndex: 1000,
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
    right: 0,
    top: 0,
    bottom: 24,
    width: 28,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
    backgroundColor: 'transparent',
    cursor: 'ew-resize' as any,
  },
  resizeHandleBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
    backgroundColor: 'transparent',
    cursor: 'ns-resize' as any,
  },
  resizeHandleActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  resizeIndicatorVertical: {
    width: 4,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  resizeIndicatorHorizontal: {
    height: 4,
    width: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  resizeIndicatorActive: {
    backgroundColor: '#F3F4F6',
    transform: [{ scale: 1.1 }],
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
  modalSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  modalBody: {
    padding: 20,
  },
  toggleSection: {
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1F2937',
    flex: 1,
  },
  oneLineInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1F2937',
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 8,
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
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  photoSection: {
    marginBottom: 16,
  },
  photoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  photosList: {
    flexDirection: 'row',
    gap: 12,
  },
  photoItem: {
    position: 'relative',
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  photoRemoveButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tasksSection: {
    marginBottom: 16,
  },
  addTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2563EB',
    borderRadius: 6,
  },
  addTaskButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
  },
  taskCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#2563EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCheckboxCompleted: {
    backgroundColor: '#2563EB',
  },
  taskInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    paddingVertical: 4,
  },
  taskInputCompleted: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  shareSection: {
    marginBottom: 16,
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
  historyCreatedBy: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#6B7280',
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
  quickNoteItem: {
    fontSize: 13,
    color: '#1F2937',
    marginTop: 4,
  },
  historyTaskItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  historyTaskCheck: {
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
  historyTaskCheckCompleted: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  historyTaskText: {
    flex: 1,
    fontSize: 13,
    color: '#1F2937',
  },
  historyTaskTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  historyPhotosList: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },
  historyPhotoItem: {
    width: 100,
  },
  historyPhotoImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
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
});

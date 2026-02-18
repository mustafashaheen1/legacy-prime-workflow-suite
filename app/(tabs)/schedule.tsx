import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Platform, Alert, ActivityIndicator, PanResponder, Switch, Pressable, Animated, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import DailyTasksButton from '@/components/DailyTasksButton';
import { Calendar, X, Plus, Trash2, Check, Share2, History, Printer, CheckSquare, BookOpen, FileText, Shovel, Mountain, Home, Droplets, Hammer, Triangle, DoorOpen, Shield, Wrench, Zap, Wind, Snowflake, Layers, Paintbrush, Bath, Lightbulb, Fan, Trees, Sparkles, ClipboardCheck, ChevronDown, ChevronRight, Eye, EyeOff, CircleCheck, Pencil, Clock } from 'lucide-react-native';
import { ScheduledTask, DailyLog, DailyLogTask, DailyLogPhoto, DailyTask } from '@/types';
import * as Clipboard from 'expo-clipboard';

// Helper function to get API base URL for both web and mobile
const getApiBaseUrl = () => {
  const rorkApi = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  if (rorkApi) return rorkApi;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:8081';
};

// Predefined sub-phases for each main category
const PREDEFINED_SUB_PHASES: Record<string, string[]> = {
  'Pre-Construction': ['Feasibility', 'Site Visit', 'Budgeting', 'Design Development', 'Engineering', 'Permitting', 'Procurement'],
  'Site Preparation': ['Surveying', 'Site Clearing', 'Demolition', 'Temporary Utilities', 'Erosion Control', 'Layout & Staking'],
  'Earthwork & Excavation': ['Excavation', 'Grading', 'Soil Compaction', 'Trenching', 'Import / Export Soil'],
  'Foundation': ['Footings', 'Stem Walls', 'Slab Prep', 'Vapor Barrier', 'Rebar', 'Concrete Pour', 'Waterproofing', 'Foundation Inspection'],
  'Underground Utilities': ['Sewer', 'Water Line', 'Storm Drain', 'Electrical Conduit', 'Gas Line'],
  'Framing': ['Subfloor', 'Exterior Walls', 'Interior Walls', 'Beams', 'Roof Framing', 'Sheathing', 'Stairs'],
  'Roofing': ['Underlayment', 'Flashing', 'Shingles / Metal / TPO', 'Roof Penetrations'],
  'Windows & Exterior Doors': [],
  'Exterior Envelope': ['House Wrap', 'Siding', 'Exterior Trim', 'Exterior Caulking'],
  'Plumbing Rough-In': [],
  'Electrical Rough-In': [],
  'HVAC Rough-In': [],
  'Insulation': [],
  'Drywall': ['Hang', 'Tape', 'Texture'],
  'Interior Finishes': ['Interior Doors', 'Trim', 'Baseboard', 'Crown Molding', 'Cabinet Installation', 'Flooring', 'Tile', 'Countertops'],
  'Painting': ['Interior', 'Exterior'],
  'Plumbing Fixtures': [],
  'Electrical Fixtures': ['Switches', 'Outlets', 'Lighting', 'Panel Final'],
  'HVAC Final': [],
  'Exterior Improvements': ['Driveway', 'Walkways', 'Deck', 'Fence', 'Landscaping', 'Irrigation'],
  'Final Touches': ['Hardware', 'Mirrors', 'Accessories', 'Cleaning'],
  'Inspections & Closeout': ['Final Inspection', 'Punch List', 'Corrections', 'Client Walkthrough', 'Project Closeout'],
};

// 22 Construction phases with icons
const CONSTRUCTION_CATEGORIES = [
  { name: 'Pre-Construction', color: '#8B5CF6', icon: FileText },
  { name: 'Site Preparation', color: '#A16207', icon: Shovel },
  { name: 'Earthwork & Excavation', color: '#92400E', icon: Mountain },
  { name: 'Foundation', color: '#991B1B', icon: Home },
  { name: 'Underground Utilities', color: '#1E3A8A', icon: Droplets },
  { name: 'Framing', color: '#F59E0B', icon: Hammer },
  { name: 'Roofing', color: '#7C3AED', icon: Triangle },
  { name: 'Windows & Exterior Doors', color: '#0369A1', icon: DoorOpen },
  { name: 'Exterior Envelope', color: '#065F46', icon: Shield },
  { name: 'Plumbing Rough-In', color: '#1E40AF', icon: Wrench },
  { name: 'Electrical Rough-In', color: '#F97316', icon: Zap },
  { name: 'HVAC Rough-In', color: '#059669', icon: Wind },
  { name: 'Insulation', color: '#0891B2', icon: Snowflake },
  { name: 'Drywall', color: '#6366F1', icon: Layers },
  { name: 'Interior Finishes', color: '#DB2777', icon: Sparkles },
  { name: 'Painting', color: '#EC4899', icon: Paintbrush },
  { name: 'Plumbing Fixtures', color: '#0284C7', icon: Bath },
  { name: 'Electrical Fixtures', color: '#EAB308', icon: Lightbulb },
  { name: 'HVAC Final', color: '#10B981', icon: Fan },
  { name: 'Exterior Improvements', color: '#22C55E', icon: Trees },
  { name: 'Final Touches', color: '#A855F7', icon: Sparkles },
  { name: 'Inspections & Closeout', color: '#06B6D4', icon: ClipboardCheck },
];

// Layout constants
const SIDEBAR_WIDTH = 240; // Wider for comfortable viewing
const ROW_HEIGHT = 46;
const BAR_HEIGHT = 34;
const DAY_WIDTH = 72;
const HEADER_HEIGHT = 50;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;

interface ScheduledTaskWithStatus extends ScheduledTask {
  completed?: boolean;
  completedAt?: string;
  visibleToClient?: boolean;
}

interface SubPhase {
  id: string;
  name: string;
  parentId: string;
  color: string;
}

export default function ScheduleScreen() {
  const {
    user,
    projects,
    dailyLogs,
    addDailyLog,
    addDailyTaskReminder,
    updateDailyTaskReminder,
    deleteDailyTaskReminder,
    getDailyTaskReminders,
    generateShareLink,
    disableShareLink,
    regenerateShareLink,
    getShareLinkByProject
  } = useApp();
  const insets = useSafeAreaInsets();

  // State management
  const [selectedProject, setSelectedProject] = useState<string | null>(
    projects.length > 0 ? projects[0].id : null
  );
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTaskWithStatus[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState<boolean>(false);

  // Phase management - Start with all phases COLLAPSED
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [customSubPhases, setCustomSubPhases] = useState<SubPhase[]>([]);
  const [customMainCategories, setCustomMainCategories] = useState<Array<{ name: string; color: string; icon: any }>>([]);

  // UI state
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const [contextMenuPhase, setContextMenuPhase] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);

  // Modals
  const [showTasksModal, setShowTasksModal] = useState<boolean>(false);
  const [showDailyLogModal, setShowDailyLogModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [showTaskModal, setShowTaskModal] = useState<boolean>(false);
  const [showAddSubPhaseModal, setShowAddSubPhaseModal] = useState<boolean>(false);
  const [showRenamePhaseModal, setShowRenamePhaseModal] = useState<boolean>(false);
  const [showAddMainCategoryModal, setShowAddMainCategoryModal] = useState<boolean>(false);

  // Task editing
  const [editingTask, setEditingTask] = useState<ScheduledTaskWithStatus | null>(null);
  const [taskFormData, setTaskFormData] = useState({
    category: '',
    startDate: '',
    endDate: '',
    workType: 'in-house' as 'in-house' | 'subcontractor',
    notes: '',
    visibleToClient: true,
    completed: false,
  });
  const [newSubPhaseName, setNewSubPhaseName] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategoryColor, setNewCategoryColor] = useState<string>('#7C3AED');

  // Daily Log state
  const [equipmentNote, setEquipmentNote] = useState<string>('');
  const [materialNote, setMaterialNote] = useState<string>('');
  const [officialNote, setOfficialNote] = useState<string>('');
  const [subsNote, setSubsNote] = useState<string>('');
  const [employeesNote, setEmployeesNote] = useState<string>('');
  const [workPerformed, setWorkPerformed] = useState<string>('');
  const [issues, setIssues] = useState<string>('');
  const [generalNotes, setGeneralNotes] = useState<string>('');
  const [logTasks, setLogTasks] = useState<DailyLogTask[]>([]);
  const [logPhotos, setLogPhotos] = useState<DailyLogPhoto[]>([]);
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [isSavingLog, setIsSavingLog] = useState<boolean>(false);

  // Zoom state
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Resize state
  const [resizingTask, setResizingTask] = useState<{ id: string; type: 'left' | 'right' } | null>(null);

  // Scroll refs for synced horizontal scrolling
  const headerScrollRef = useRef<ScrollView>(null);
  const gridScrollRef = useRef<ScrollView>(null);

  // Computed dimensions based on zoom
  const dayWidth = DAY_WIDTH * zoomLevel;
  const rowHeight = ROW_HEIGHT;
  const barHeight = BAR_HEIGHT;

  // Get selected project details
  const selectedProjectData = useMemo(() => {
    return projects.find(p => p.id === selectedProject);
  }, [projects, selectedProject]);

  // Generate timeline dates (90 days from today)
  const timelineDates = useMemo(() => {
    const dates: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to midnight
    for (let i = 0; i < 90; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, []);

  const formatDate = (date: Date): string => {
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  };

  const formatDayOfWeek = (date: Date): string => {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Fetch scheduled tasks from API
  const fetchScheduledTasks = useCallback(async () => {
    if (!selectedProject) return;

    console.log('[Schedule] Fetching tasks for project:', selectedProject);
    setIsLoadingTasks(true);
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/get-scheduled-tasks?projectId=${selectedProject}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('[Schedule] Fetched tasks:', data);

      if (data.success && data.scheduledTasks) {
        setScheduledTasks(data.scheduledTasks);
      } else {
        setScheduledTasks([]);
      }
    } catch (error: any) {
      console.error('[Schedule] Error fetching tasks:', error);
      setScheduledTasks([]);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    fetchScheduledTasks();
  }, [fetchScheduledTasks]);

  // Save task to API
  const saveTask = async (task: ScheduledTaskWithStatus) => {
    console.log('[Schedule] Saving task:', task);
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/save-scheduled-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('[Schedule] Save task response:', data);

      if (data.success) {
        await fetchScheduledTasks();
      }
    } catch (error) {
      console.error('[Schedule] Error saving task:', error);
      Alert.alert('Error', 'Failed to save task');
    }
  };

  // Update task in API
  const updateTask = async (taskId: string, updates: Partial<ScheduledTaskWithStatus>) => {
    console.log('[Schedule] Updating task:', taskId, updates);
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/update-scheduled-task`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, ...updates }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('[Schedule] Update task response:', data);

      if (data.success) {
        await fetchScheduledTasks();
      }
    } catch (error) {
      console.error('[Schedule] Error updating task:', error);
      Alert.alert('Error', 'Failed to update task');
    }
  };

  // Delete task from API
  const deleteTask = async (taskId: string) => {
    console.log('[Schedule] Deleting task:', taskId);
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/delete-scheduled-task?id=${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('[Schedule] Delete task response:', data);

      if (data.success) {
        await fetchScheduledTasks();
      }
    } catch (error) {
      console.error('[Schedule] Error deleting task:', error);
      Alert.alert('Error', 'Failed to delete task');
    }
  };

  // Toggle phase expansion
  const togglePhase = (phaseIndex: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseIndex)) {
        next.delete(phaseIndex);
      } else {
        next.add(phaseIndex);
      }
      return next;
    });
  };

  // Zoom controls
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  };

  const handleZoomReset = () => {
    setZoomLevel(1.0);
  };

  // Sync scroll handler for grid and header
  const handleGridScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    headerScrollRef.current?.scrollTo({ x: offsetX, animated: false });
  };

  // Context menu for phase management
  const openContextMenu = (phaseIndex: string, x: number, y: number) => {
    setContextMenuPhase(phaseIndex);
    setContextMenuPosition({ x, y });
  };

  const closeContextMenu = () => {
    setContextMenuPhase(null);
    setContextMenuPosition(null);
  };

  const handleAddSubPhase = () => {
    setShowAddSubPhaseModal(true);
    closeContextMenu();
  };

  const handleRenamePhase = () => {
    setShowRenamePhaseModal(true);
    closeContextMenu();
  };

  const saveSubPhase = () => {
    if (!contextMenuPhase || !newSubPhaseName.trim()) return;

    const parentPhase = CONSTRUCTION_CATEGORIES[parseInt(contextMenuPhase)];
    const newSubPhase: SubPhase = {
      id: `sub-${Date.now()}`,
      name: newSubPhaseName.trim(),
      parentId: contextMenuPhase,
      color: parentPhase.color,
    };

    setCustomSubPhases([...customSubPhases, newSubPhase]);
    setNewSubPhaseName('');
    setShowAddSubPhaseModal(false);
  };

  // Task creation on grid click
  const handleGridCellPress = (phaseIndex: number, dateIndex: number) => {
    // Only create task if a phase is selected
    if (!selectedProject || selectedPhase === null) return;

    const phase = CONSTRUCTION_CATEGORIES[phaseIndex];
    const clickedDate = timelineDates[dateIndex];

    // Debug logging to verify date
    console.log('[Schedule] Clicked date index:', dateIndex);
    console.log('[Schedule] Clicked date:', clickedDate.toISOString());
    console.log('[Schedule] Clicked date formatted:', clickedDate.toLocaleDateString());

    // Create dates in local timezone to avoid timezone offset issues
    const startDate = new Date(clickedDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 1);

    console.log('[Schedule] Creating task - Start:', startDate.toISOString(), 'End:', endDate.toISOString());

    const newTask: ScheduledTaskWithStatus = {
      id: `task-${Date.now()}`,
      projectId: selectedProject,
      category: phase.name,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      duration: 1,
      workType: 'in-house',
      color: phase.color,
      notes: '',
      visibleToClient: true,
      completed: false,
    };

    saveTask(newTask);

    // Clear selection after creating task
    setSelectedPhase(null);
  };

  // Task editing
  const handleTaskPress = (task: ScheduledTaskWithStatus) => {
    setEditingTask(task);
    setTaskFormData({
      category: task.category,
      startDate: task.startDate,
      endDate: task.endDate,
      workType: task.workType,
      notes: task.notes || '',
      visibleToClient: task.visibleToClient ?? true,
      completed: task.completed ?? false,
    });
    setShowTaskModal(true);
  };

  const handleDeleteTask = async () => {
    if (!editingTask) return;

    const confirmed = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to delete this task?')
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Delete Task',
            'Are you sure you want to delete this task?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => resolve(true),
              },
            ]
          );
        });

    if (!confirmed) return;

    try {
      console.log('[Schedule] Deleting task:', editingTask.id);
      await deleteTask(editingTask.id);
      setShowTaskModal(false);
      setEditingTask(null);
    } catch (error) {
      console.error('[Schedule] Delete failed:', error);
      Alert.alert('Error', 'Failed to delete task');
    }
  };

  const toggleTaskCompletion = async (taskId: string) => {
    const task = scheduledTasks.find(t => t.id === taskId);
    if (!task) return;

    const updates: Partial<ScheduledTaskWithStatus> = {
      completed: !task.completed,
      completedAt: !task.completed ? new Date().toISOString() : undefined,
    };

    await updateTask(taskId, updates);
  };

  // Daily Log handlers
  const handleSaveDailyLog = async () => {
    if (!selectedProject || !user) return;

    setIsSavingLog(true);
    try {
      const newLog: DailyLog = {
        id: `log-${Date.now()}`,
        projectId: selectedProject,
        logDate: new Date().toISOString().split('T')[0],
        createdBy: user.id,
        equipmentNote,
        materialNote,
        officialNote,
        subsNote,
        employeesNote,
        workPerformed,
        issues,
        generalNotes,
        tasks: logTasks,
        photos: logPhotos,
        sharedWith,
        createdAt: new Date().toISOString(),
      };

      await addDailyLog(newLog);
      Alert.alert('Success', 'Daily log saved successfully');
      setShowDailyLogModal(false);
      resetDailyLogForm();
    } catch (error) {
      console.error('[Schedule] Error saving daily log:', error);
      Alert.alert('Error', 'Failed to save daily log');
    } finally {
      setIsSavingLog(false);
    }
  };

  const resetDailyLogForm = () => {
    setEquipmentNote('');
    setMaterialNote('');
    setOfficialNote('');
    setSubsNote('');
    setEmployeesNote('');
    setWorkPerformed('');
    setIssues('');
    setGeneralNotes('');
    setLogTasks([]);
    setLogPhotos([]);
    setSharedWith([]);
  };

  // Share functionality
  const handleShare = async () => {
    try {
      if (!selectedProject) return;

      const shareLink = await generateShareLink(selectedProject, 'schedule');
      if (shareLink) {
        await Clipboard.setStringAsync(shareLink);
        Alert.alert('Success', 'Share link copied to clipboard');
        setShowShareModal(false);
      }
    } catch (error) {
      console.error('[Schedule] Error sharing:', error);
      Alert.alert('Error', 'Failed to generate share link');
    }
  };

  // Get all phases (built-in + custom)
  const allPhases = useMemo(() => {
    return [...CONSTRUCTION_CATEGORIES, ...customMainCategories];
  }, [customMainCategories]);

  // Get sub-phases for a phase
  const getSubPhases = (phaseIndex: string) => {
    const builtInSubPhases = PREDEFINED_SUB_PHASES[CONSTRUCTION_CATEGORIES[parseInt(phaseIndex)]?.name] || [];
    const customSubs = customSubPhases.filter(sp => sp.parentId === phaseIndex);
    return [...builtInSubPhases, ...customSubs.map(cs => cs.name)];
  };

  // Get tasks for a phase
  const getTasksForPhase = (phaseName: string) => {
    return scheduledTasks.filter(task => task.category === phaseName);
  };

  // Calculate task position on timeline
  const getTaskPosition = (task: ScheduledTaskWithStatus) => {
    const startDate = new Date(task.startDate);
    const daysSinceStart = Math.floor((startDate.getTime() - timelineDates[0].getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysSinceStart * dayWidth);
  };

  const getTaskWidth = (task: ScheduledTaskWithStatus) => {
    return task.duration * dayWidth;
  };

  // Resize handlers for task bars
  const createResizePanResponder = (task: ScheduledTaskWithStatus, handleType: 'left' | 'right') => {
    let startX = 0;
    let startDate = new Date(task.startDate);
    let endDate = new Date(task.endDate);
    let originalDuration = task.duration;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gestureState) => {
        startX = gestureState.x0;
        startDate = new Date(task.startDate);
        endDate = new Date(task.endDate);
        originalDuration = task.duration;
        setResizingTask({ id: task.id, type: handleType });
      },
      onPanResponderMove: (_, gestureState) => {
        const daysDelta = Math.round(gestureState.dx / dayWidth);

        // Update local state for immediate visual feedback
        setScheduledTasks(prev => prev.map(t => {
          if (t.id !== task.id) return t;

          if (handleType === 'left') {
            // Resize from left (change start date)
            const newStartDate = new Date(startDate);
            newStartDate.setDate(startDate.getDate() + daysDelta);
            const newDuration = Math.max(1, originalDuration - daysDelta);

            return {
              ...t,
              startDate: newStartDate.toISOString().split('T')[0],
              duration: newDuration,
            };
          } else {
            // Resize from right (change end date)
            const newDuration = Math.max(1, originalDuration + daysDelta);
            const newEndDate = new Date(startDate);
            newEndDate.setDate(startDate.getDate() + newDuration);

            return {
              ...t,
              endDate: newEndDate.toISOString().split('T')[0],
              duration: newDuration,
            };
          }
        }));
      },
      onPanResponderRelease: async (_, gestureState) => {
        const daysDelta = Math.round(gestureState.dx / dayWidth);

        if (handleType === 'left') {
          const newStartDate = new Date(startDate);
          newStartDate.setDate(startDate.getDate() + daysDelta);
          const newDuration = Math.max(1, originalDuration - daysDelta);

          await updateTask(task.id, {
            startDate: newStartDate.toISOString().split('T')[0],
            duration: newDuration,
          });
        } else {
          const newDuration = Math.max(1, originalDuration + daysDelta);
          const newEndDate = new Date(startDate);
          newEndDate.setDate(startDate.getDate() + newDuration);

          await updateTask(task.id, {
            endDate: newEndDate.toISOString().split('T')[0],
            duration: newDuration,
          });
        }

        setResizingTask(null);
      },
    });
  };

  // Project daily logs
  const projectDailyLogs = useMemo(() => {
    return (dailyLogs && Array.isArray(dailyLogs))
      ? dailyLogs.filter(log => log.projectId === selectedProject).sort((a, b) =>
          new Date(b.logDate).getTime() - new Date(a.logDate).getTime()
        )
      : [];
  }, [dailyLogs, selectedProject]);

  // Get daily task reminders
  const dailyTaskReminders = useMemo(() => {
    if (!selectedProject) return [];
    return getDailyTaskReminders?.(selectedProject) || [];
  }, [selectedProject, getDailyTaskReminders]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Schedule</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: '#E0F2FE' }]}
            onPress={() => setShowTasksModal(true)}
          >
            <CheckSquare size={16} color="#0EA5E9" />
            <Text style={[styles.headerButtonText, { color: '#0EA5E9' }]}>Tasks</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: '#DBEAFE' }]}
            onPress={() => setShowDailyLogModal(true)}
          >
            <BookOpen size={16} color="#2563EB" />
            <Text style={[styles.headerButtonText, { color: '#2563EB' }]}>Log</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButtonIconOnly, { backgroundColor: '#D1FAE5' }]}
            onPress={() => setShowHistoryModal(true)}
          >
            <Clock size={16} color="#059669" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButtonIconOnly, { backgroundColor: '#E2E8F0' }]}
            onPress={() => Alert.alert('Print', 'Print functionality coming soon')}
          >
            <Printer size={16} color="#64748B" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButtonIconOnly, { backgroundColor: '#EDE9FE' }]}
            onPress={() => setShowShareModal(true)}
          >
            <Share2 size={16} color="#7C3AED" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Project Tabs */}
      <View style={styles.projectTabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.projectTabs}
        >
          {projects.map(project => (
            <TouchableOpacity
              key={project.id}
              style={[
                styles.projectTab,
                selectedProject === project.id && styles.projectTabActive,
              ]}
              onPress={() => setSelectedProject(project.id)}
            >
              <Text
                style={[
                  styles.projectTabText,
                  selectedProject === project.id && styles.projectTabTextActive,
                ]}
                numberOfLines={1}
              >
                {project.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Instruction Banner (when phase selected) */}
      {selectedPhase !== null && (
        <View style={styles.instructionBanner}>
          <View style={[
            styles.instructionDot,
            { backgroundColor: CONSTRUCTION_CATEGORIES[parseInt(selectedPhase)]?.color || '#999' }
          ]} />
          <Text style={styles.instructionText}>
            Tap on the calendar to place <Text style={styles.instructionPhaseName}>
              {CONSTRUCTION_CATEGORIES[parseInt(selectedPhase)]?.name || 'phase'}
            </Text>
          </Text>
          <TouchableOpacity
            onPress={() => setSelectedPhase(null)}
            style={styles.instructionClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={16} color="#78350F" />
          </TouchableOpacity>
        </View>
      )}

      {/* Main Content */}
      {isLoadingTasks ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Loading schedule...</Text>
        </View>
      ) : (
        <View style={styles.scheduleContainer}>
          {/* UNIFIED SCROLLING CONTAINER - FIXED PHASE COLUMN + SYNCED TIMELINE */}
          <View style={styles.ganttContainer}>
            {/* Fixed Header Row */}
            <View style={styles.fixedHeaderRow}>
              {/* Phases Header (Fixed) */}
              <View style={[styles.phasesHeader, { width: SIDEBAR_WIDTH }]}>
                <Text style={styles.phasesHeaderText}>PHASES</Text>
              </View>

              {/* Timeline Header (Synced with Grid Scroll) */}
              <ScrollView
                ref={headerScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                scrollEnabled={false}
                scrollEventThrottle={16}
              >
                <View style={[styles.timelineHeader, { height: HEADER_HEIGHT }]}>
                  {timelineDates.map((date, index) => (
                    <View
                      key={index}
                      style={[
                        styles.dateCell,
                        { width: dayWidth },
                        isToday(date) && styles.dateCellToday,
                      ]}
                    >
                      <Text style={[
                        styles.dateText,
                        isToday(date) && styles.dateTextToday,
                      ]}>
                        {formatDate(date)}
                      </Text>
                      <Text style={[
                        styles.dayText,
                        isToday(date) && styles.dayTextToday,
                      ]}>
                        {formatDayOfWeek(date)}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Scrollable Content (Vertical) */}
            <ScrollView
              style={styles.contentScrollContainer}
              showsVerticalScrollIndicator={true}
            >
              <View style={styles.ganttContentRow}>
                {/* Fixed Phase Column (Sidebar) */}
                <View style={[styles.phaseColumn, { width: SIDEBAR_WIDTH }]}>
                  {CONSTRUCTION_CATEGORIES.map((phase, phaseIndex) => {
                    const isExpanded = expandedPhases.has(phaseIndex.toString());
                    const subPhases = getSubPhases(phaseIndex.toString());
                    const Icon = phase.icon;

                    return (
                      <View key={phaseIndex}>
                        {/* Main phase sidebar cell */}
                        <TouchableOpacity
                          style={[
                            styles.phaseRow,
                            phaseIndex % 2 === 1 && styles.phaseRowAlternate,
                            selectedPhase === phaseIndex.toString() && styles.phaseRowSelected,
                          ]}
                          onPress={() => {
                            setSelectedPhase(phaseIndex.toString());
                            if (subPhases.length > 0) {
                              togglePhase(phaseIndex.toString());
                            }
                          }}
                          onLongPress={(e) => {
                            const { pageX, pageY } = e.nativeEvent;
                            openContextMenu(phaseIndex.toString(), pageX, pageY);
                          }}
                        >
                          <View style={[styles.phaseColorStripe, { backgroundColor: phase.color }]} />
                          <View style={styles.phaseContent}>
                            {subPhases.length > 0 && (
                              <View style={styles.phaseChevron}>
                                {isExpanded ? (
                                  <ChevronRight size={16} color="#475569" style={{ transform: [{ rotate: '90deg' }] }} />
                                ) : (
                                  <ChevronRight size={16} color="#475569" />
                                )}
                              </View>
                            )}
                            <Icon size={14} color={phase.color} />
                            <Text style={styles.phaseName} numberOfLines={1}>
                              {phase.name}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.phaseAddButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              const { pageX, pageY } = e.nativeEvent;
                              openContextMenu(phaseIndex.toString(), pageX, pageY);
                            }}
                          >
                            <View style={styles.addButtonCircle}>
                              <Plus size={14} color="#64748B" />
                            </View>
                          </TouchableOpacity>
                        </TouchableOpacity>

                        {/* Sub-phase sidebar cells */}
                        {isExpanded && subPhases.map((subPhase, subIndex) => (
                          <TouchableOpacity
                            key={`${phaseIndex}-${subIndex}`}
                            style={styles.subPhaseRow}
                            onPress={() => setSelectedPhase(`${phaseIndex}-${subIndex}`)}
                          >
                            <View style={styles.subPhaseIndent} />
                            <Text style={styles.subPhaseName} numberOfLines={1}>
                              {typeof subPhase === 'string' ? subPhase : subPhase}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    );
                  })}
                </View>

                {/* Scrollable Timeline Grid (All Rows Together) */}
                <ScrollView
                  ref={gridScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={Platform.OS === 'web'}
                  scrollEventThrottle={16}
                  onScroll={handleGridScroll}
                >
                  <View style={styles.gridContainer}>
                    {CONSTRUCTION_CATEGORIES.map((phase, phaseIndex) => {
                      const isExpanded = expandedPhases.has(phaseIndex.toString());
                      const subPhases = getSubPhases(phaseIndex.toString());
                      const phaseTasks = getTasksForPhase(phase.name);

                      return (
                        <View key={phaseIndex}>
                          {/* Main phase timeline row */}
                          <View
                            style={[
                              styles.timelineRow,
                              { height: rowHeight },
                              phaseIndex % 2 === 0 && styles.timelineRowAlternate,
                              selectedPhase === phaseIndex.toString() && styles.timelineRowSelected,
                            ]}
                          >
                            {/* Grid cells */}
                            {timelineDates.map((date, dateIndex) => (
                              <Pressable
                                key={dateIndex}
                                style={[
                                  styles.gridCell,
                                  { width: dayWidth, height: rowHeight },
                                  isToday(date) && styles.gridCellToday,
                                ]}
                                onPress={() => handleGridCellPress(phaseIndex, dateIndex)}
                              />
                            ))}

                            {/* Task bars with resize handles */}
                            {phaseTasks.map(task => {
                              const leftResizer = createResizePanResponder(task, 'left');
                              const rightResizer = createResizePanResponder(task, 'right');

                              return (
                                <TouchableOpacity
                                  key={task.id}
                                  style={[
                                    styles.taskBar,
                                    {
                                      left: getTaskPosition(task),
                                      width: getTaskWidth(task),
                                      height: barHeight,
                                      top: (rowHeight - barHeight) / 2,
                                      backgroundColor: task.completed ? '#10B981' : task.color,
                                      opacity: task.completed ? 0.7 : 1,
                                    },
                                  ]}
                                  onPress={() => handleTaskPress(task)}
                                >
                                  {/* Left resize handle */}
                                  <View {...leftResizer.panHandlers} style={styles.resizeHandleLeft}>
                                    <View style={styles.resizeDot} />
                                  </View>

                                  {/* Task content */}
                                  <View style={styles.taskBarContent}>
                                    <Text style={styles.taskBarText} numberOfLines={1}>
                                      {task.category}
                                    </Text>
                                    {task.completed && (
                                      <CircleCheck size={12} color="#FFF" />
                                    )}
                                    {!task.visibleToClient && (
                                      <EyeOff size={12} color="#FFF" />
                                    )}
                                  </View>

                                  {/* Right resize handle */}
                                  <View {...rightResizer.panHandlers} style={styles.resizeHandleRight}>
                                    <View style={styles.resizeDot} />
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </View>

                          {/* Sub-phase timeline rows */}
                          {isExpanded && subPhases.map((subPhase, subIndex) => (
                            <View
                              key={`${phaseIndex}-${subIndex}`}
                              style={[
                                styles.timelineRow,
                                styles.subPhaseTimelineRow,
                                { height: rowHeight },
                              ]}
                            >
                              {timelineDates.map((date, dateIndex) => (
                                <Pressable
                                  key={dateIndex}
                                  style={[
                                    styles.gridCell,
                                    { width: dayWidth, height: rowHeight },
                                    isToday(date) && styles.gridCellToday,
                                  ]}
                                  onPress={() => handleGridCellPress(phaseIndex, dateIndex)}
                                />
                              ))}
                            </View>
                          ))}
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      {/* Zoom Controls (Web only) */}
      {Platform.OS === 'web' && (
        <View style={styles.zoomControls}>
          <TouchableOpacity style={styles.zoomButton} onPress={handleZoomOut}>
            <Text style={styles.zoomButtonText}>-</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomReset} onPress={handleZoomReset}>
            <Text style={styles.zoomResetText}>{Math.round(zoomLevel * 100)}%</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomButton} onPress={handleZoomIn}>
            <Text style={styles.zoomButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Context Menu */}
      {contextMenuPhase !== null && contextMenuPosition && (
        <Modal
          transparent
          visible={true}
          onRequestClose={closeContextMenu}
        >
          <Pressable
            style={styles.contextMenuOverlay}
            onPress={closeContextMenu}
          >
            <View
              style={[
                styles.contextMenu,
                {
                  top: Math.min(contextMenuPosition.y, 600),
                  left: Math.min(contextMenuPosition.x, 300),
                },
              ]}
            >
              <TouchableOpacity style={styles.contextMenuItem} onPress={handleAddSubPhase}>
                <Plus size={18} color="#374151" />
                <Text style={styles.contextMenuText}>Add Sub-Phase</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contextMenuItem} onPress={handleRenamePhase}>
                <Pencil size={18} color="#374151" />
                <Text style={styles.contextMenuText}>Rename Phase</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      )}

      {/* Add Sub-Phase Modal */}
      <Modal
        visible={showAddSubPhaseModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddSubPhaseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Sub-Phase</Text>
              <TouchableOpacity onPress={() => setShowAddSubPhaseModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Sub-Phase Name</Text>
              <TextInput
                style={styles.input}
                value={newSubPhaseName}
                onChangeText={setNewSubPhaseName}
                placeholder="Enter sub-phase name"
                autoFocus
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={() => {
                    setNewSubPhaseName('');
                    setShowAddSubPhaseModal(false);
                  }}
                >
                  <Text style={styles.buttonSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.buttonPrimary]}
                  onPress={saveSubPhase}
                  disabled={!newSubPhaseName.trim()}
                >
                  <Text style={styles.buttonPrimaryText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Tasks Modal */}
      <Modal
        visible={showTasksModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTasksModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Daily Task Reminders</Text>
            <TouchableOpacity onPress={() => setShowTasksModal(false)}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {dailyTaskReminders.length === 0 ? (
              <View style={styles.emptyState}>
                <CheckSquare size={48} color="#D1D5DB" />
                <Text style={styles.emptyStateText}>No task reminders yet</Text>
              </View>
            ) : (
              dailyTaskReminders.map(task => (
                <View key={task.id} style={styles.taskItem}>
                  <View style={styles.taskItemHeader}>
                    <Text style={styles.taskItemTitle}>{task.title}</Text>
                    {task.completed && <CircleCheck size={20} color="#10B981" />}
                  </View>
                  <Text style={styles.taskItemDate}>
                    {new Date(task.dueDate).toLocaleDateString()}
                    {task.dueTime && ` at ${task.dueTime}`}
                  </Text>
                  {task.notes && (
                    <Text style={styles.taskItemNotes}>{task.notes}</Text>
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Daily Log Modal */}
      <Modal
        visible={showDailyLogModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDailyLogModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Daily Log</Text>
            <TouchableOpacity onPress={() => setShowDailyLogModal(false)}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <View style={styles.logSection}>
              <Text style={styles.logLabel}>Work Performed</Text>
              <TextInput
                style={styles.logInput}
                multiline
                numberOfLines={4}
                value={workPerformed}
                onChangeText={setWorkPerformed}
                placeholder="Describe work completed today..."
              />
            </View>

            <View style={styles.logSection}>
              <Text style={styles.logLabel}>Equipment Notes</Text>
              <TextInput
                style={styles.logInput}
                multiline
                numberOfLines={3}
                value={equipmentNote}
                onChangeText={setEquipmentNote}
                placeholder="Equipment used or issues..."
              />
            </View>

            <View style={styles.logSection}>
              <Text style={styles.logLabel}>Material Notes</Text>
              <TextInput
                style={styles.logInput}
                multiline
                numberOfLines={3}
                value={materialNote}
                onChangeText={setMaterialNote}
                placeholder="Materials delivered or used..."
              />
            </View>

            <View style={styles.logSection}>
              <Text style={styles.logLabel}>Issues</Text>
              <TextInput
                style={styles.logInput}
                multiline
                numberOfLines={3}
                value={issues}
                onChangeText={setIssues}
                placeholder="Any issues or concerns..."
              />
            </View>

            <View style={styles.logSection}>
              <Text style={styles.logLabel}>General Notes</Text>
              <TextInput
                style={styles.logInput}
                multiline
                numberOfLines={3}
                value={generalNotes}
                onChangeText={setGeneralNotes}
                placeholder="Additional notes..."
              />
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveDailyLog}
              disabled={isSavingLog}
            >
              {isSavingLog ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save Daily Log</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* History Modal */}
      <Modal
        visible={showHistoryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Daily Log History</Text>
            <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {projectDailyLogs.length === 0 ? (
              <View style={styles.emptyState}>
                <History size={48} color="#D1D5DB" />
                <Text style={styles.emptyStateText}>No daily logs yet</Text>
              </View>
            ) : (
              projectDailyLogs.map(log => (
                <View key={log.id} style={styles.historyItem}>
                  <Text style={styles.historyDate}>
                    {new Date(log.logDate).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </Text>
                  {log.workPerformed && (
                    <Text style={styles.historyText} numberOfLines={3}>
                      {log.workPerformed}
                    </Text>
                  )}
                  {log.issues && (
                    <View style={styles.historyIssues}>
                      <Text style={styles.historyIssuesLabel}>Issues:</Text>
                      <Text style={styles.historyIssuesText} numberOfLines={2}>
                        {log.issues}
                      </Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share Schedule</Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TouchableOpacity style={styles.shareOption} onPress={handleShare}>
                <Share2 size={24} color="#7C3AED" />
                <View style={styles.shareOptionContent}>
                  <Text style={styles.shareOptionTitle}>Generate Share Link</Text>
                  <Text style={styles.shareOptionDescription}>
                    Create a secure link to share this schedule
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Task Edit Modal */}
      {editingTask && (
        <Modal
          visible={showTaskModal}
          animationType="slide"
          transparent
          onRequestClose={() => {
            setShowTaskModal(false);
            setEditingTask(null);
          }}
        >
          <View style={styles.taskModalOverlay}>
            <View style={[styles.taskModalSheet, { paddingBottom: insets.bottom + 16 }]}>
              {/* Header */}
              <View style={styles.taskModalHeader}>
                <View style={styles.taskModalHeaderLeft}>
                  <View style={[styles.taskColorDot, { backgroundColor: editingTask.color }]} />
                  <Text style={styles.taskModalTitle}>{editingTask.category}</Text>
                </View>
                <TouchableOpacity
                  style={styles.taskModalCloseButton}
                  onPress={() => {
                    setShowTaskModal(false);
                    setEditingTask(null);
                  }}
                >
                  <X size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Body Content */}
              <ScrollView style={styles.taskModalBody} showsVerticalScrollIndicator={false}>
                {/* Date Range (Read-only) */}
                <View style={styles.taskModalSection}>
                  <Text style={styles.taskModalLabel}>Date Range</Text>
                  <Text style={styles.taskModalDateRange}>
                    {new Date(editingTask.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → {new Date(editingTask.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>

                {/* Duration Input */}
                <View style={styles.taskModalSection}>
                  <Text style={styles.taskModalLabel}>Duration (days)</Text>
                  <TextInput
                    style={styles.taskModalInput}
                    value={String(editingTask.duration)}
                    onChangeText={(value) => {
                      const duration = parseInt(value) || 1;
                      setEditingTask({ ...editingTask, duration });
                    }}
                    keyboardType="number-pad"
                    placeholder="Duration"
                  />
                </View>

                {/* Work Type Toggles */}
                <View style={styles.taskModalSection}>
                  <Text style={styles.taskModalLabel}>Work Type</Text>
                  <View style={styles.taskModalToggleContainer}>
                    <TouchableOpacity
                      style={[
                        styles.taskModalToggleButton,
                        editingTask.workType === 'in-house' && styles.taskModalToggleButtonSelected
                      ]}
                      onPress={() => setEditingTask({ ...editingTask, workType: 'in-house' })}
                    >
                      <Text style={[
                        styles.taskModalToggleText,
                        editingTask.workType === 'in-house' && styles.taskModalToggleTextSelected
                      ]}>
                        🏠 In-House
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.taskModalToggleButton,
                        editingTask.workType === 'subcontractor' && styles.taskModalToggleButtonSelected
                      ]}
                      onPress={() => setEditingTask({ ...editingTask, workType: 'subcontractor' })}
                    >
                      <Text style={[
                        styles.taskModalToggleText,
                        editingTask.workType === 'subcontractor' && styles.taskModalToggleTextSelected
                      ]}>
                        👷 Subcontractor
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Notes Textarea */}
                <View style={styles.taskModalSection}>
                  <Text style={styles.taskModalLabel}>Notes</Text>
                  <TextInput
                    style={styles.taskModalTextarea}
                    value={editingTask.notes || ''}
                    onChangeText={(value) => setEditingTask({ ...editingTask, notes: value })}
                    placeholder="Add notes visible on the block..."
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                {/* Visible to Client Toggle */}
                <View style={styles.toggleRow}>
                  <View style={styles.toggleLeft}>
                    <EyeOff size={20} color="#9CA3AF" />
                    <View>
                      <Text style={styles.toggleLabel}>Visible to Client</Text>
                      <Text style={styles.toggleHint}>Note hidden from shared link</Text>
                    </View>
                  </View>
                  <Switch
                    value={taskFormData.visibleToClient}
                    onValueChange={(value) => setTaskFormData(prev => ({ ...prev, visibleToClient: value }))}
                    trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
                    thumbColor={taskFormData.visibleToClient ? '#10B981' : '#F3F4F6'}
                  />
                </View>

                {/* Mark as Completed */}
                <TouchableOpacity
                  style={styles.completedRow}
                  onPress={() => setTaskFormData(prev => ({ ...prev, completed: !prev.completed }))}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.completedCheckbox,
                    taskFormData.completed && styles.completedCheckboxActive,
                  ]}>
                    {taskFormData.completed && <Check size={18} color="#FFF" />}
                  </View>
                  <Text style={styles.completedLabel}>Mark as Completed</Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Footer */}
              <View style={styles.taskModalFooter}>
                {/* Delete Button */}
                <TouchableOpacity
                  style={styles.taskModalDeleteButton}
                  onPress={handleDeleteTask}
                >
                  <Trash2 size={20} color="#EF4444" />
                </TouchableOpacity>

                {/* Cancel Button */}
                <TouchableOpacity
                  style={styles.taskModalCancelButton}
                  onPress={() => {
                    setShowTaskModal(false);
                    setEditingTask(null);
                  }}
                >
                  <Text style={styles.taskModalCancelText}>Cancel</Text>
                </TouchableOpacity>

                {/* Save Button */}
                <TouchableOpacity
                  style={styles.taskModalSaveButton}
                  onPress={async () => {
                    await updateTask(editingTask.id, {
                      duration: editingTask.duration,
                      workType: editingTask.workType,
                      notes: editingTask.notes,
                      visibleToClient: taskFormData.visibleToClient,
                      completed: taskFormData.completed,
                      completedAt: taskFormData.completed ? new Date().toISOString() : undefined,
                    });
                    setShowTaskModal(false);
                    setEditingTask(null);
                  }}
                >
                  <Check size={16} color="#FFF" />
                  <Text style={styles.taskModalSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Daily Tasks Button */}
      <DailyTasksButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  instructionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  instructionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  instructionText: {
    flex: 1,
    fontSize: 13,
    color: '#78350F',
  },
  instructionPhaseName: {
    fontWeight: '600',
    color: '#78350F',
  },
  instructionClose: {
    padding: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E3A5F',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  headerButtonIconOnly: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  headerButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  projectTabsContainer: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  projectTabs: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  projectTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    minWidth: 120,
  },
  projectTabActive: {
    backgroundColor: '#1E3A5F',
  },
  projectTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
  projectTabTextActive: {
    color: '#FFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  scheduleContainer: {
    flex: 1,
  },
  // Gantt chart container with fixed phase column
  ganttContainer: {
    flex: 1,
  },
  fixedHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
  },
  contentScrollContainer: {
    flex: 1,
  },
  ganttContentRow: {
    flexDirection: 'row',
  },
  phaseColumn: {
    backgroundColor: '#F8FAFC',
  },
  gridContainer: {
    // Container for all timeline rows
  },
  phasesHeader: {
    height: HEADER_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#FFF',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  phasesHeaderText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    height: ROW_HEIGHT,
    backgroundColor: '#FFF',
    width: SIDEBAR_WIDTH,
  },
  phaseRowAlternate: {
    backgroundColor: '#FAFBFC',
  },
  phaseRowSelected: {
    backgroundColor: '#FEF3C7',
  },
  phaseColorStripe: {
    width: 3,
    height: '100%',
  },
  phaseContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    paddingLeft: 6,
  },
  phaseChevron: {
    width: 16,
    alignItems: 'center',
  },
  phaseName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
    lineHeight: 13,
  },
  phaseToggle: {
    marginLeft: 2,
  },
  phaseAddButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  addButtonCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subPhaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    backgroundColor: '#FAFBFC',
    height: ROW_HEIGHT,
    width: SIDEBAR_WIDTH,
  },
  subPhaseIndent: {
    width: 3,
    height: '100%',
    backgroundColor: 'transparent',
    marginLeft: 20,
  },
  subPhaseName: {
    fontSize: 9,
    color: '#6B7280',
    flex: 1,
    paddingLeft: 6,
  },
  subPhaseTimelineRow: {
    backgroundColor: '#F9FAFB',
  },
  timelineContainer: {
    flex: 1,
  },
  timelineHeader: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
  },
  dateCell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    paddingVertical: 8,
  },
  dateCellToday: {
    backgroundColor: '#DBEAFE',
  },
  dateText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  dateTextToday: {
    color: '#2563EB',
    fontWeight: '600',
  },
  dayText: {
    fontSize: 9,
    fontWeight: '400',
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 2,
  },
  dayTextToday: {
    color: '#2563EB',
  },
  timelineRow: {
    flexDirection: 'row',
    position: 'relative',
  },
  timelineRowAlternate: {
    backgroundColor: '#FAFAFA',
  },
  timelineRowSelected: {
    backgroundColor: '#FFFBEB',
  },
  gridCell: {
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  gridCellToday: {
    backgroundColor: '#DBEAFE',
  },
  taskBar: {
    position: 'absolute',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  taskBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  taskBarText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFF',
    flex: 1,
  },
  // NEW: Resize handles
  resizeHandleLeft: {
    position: 'absolute',
    left: -10,
    top: 0,
    bottom: 0,
    width: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resizeHandleRight: {
    position: 'absolute',
    right: -10,
    top: 0,
    bottom: 0,
    width: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resizeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  zoomControls: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    overflow: 'hidden',
  },
  zoomButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  zoomReset: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  zoomResetText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  contextMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  contextMenu: {
    position: 'absolute',
    backgroundColor: '#FFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 180,
    overflow: 'hidden',
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  contextMenuText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalBody: {
    padding: 20,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#7C3AED',
  },
  buttonSecondary: {
    backgroundColor: '#F3F4F6',
  },
  buttonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  buttonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  taskItem: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 12,
  },
  taskItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  taskItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  taskItemDate: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  taskItemNotes: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  logSection: {
    marginBottom: 20,
  },
  logLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  logInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#111827',
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#7C3AED',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 16,
  },
  historyItem: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 12,
  },
  historyDate: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  historyText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  historyIssues: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  historyIssuesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 4,
  },
  historyIssuesText: {
    fontSize: 14,
    color: '#6B7280',
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  shareOptionContent: {
    flex: 1,
  },
  shareOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  shareOptionDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  taskDetailSection: {
    marginBottom: 20,
  },
  taskDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  taskDetailLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
  },
  taskDetailValue: {
    fontSize: 16,
    color: '#111827',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    borderRadius: 10,
    marginTop: 20,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  // Task Modal Styles (Bottom Sheet Design)
  taskModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  taskModalSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  taskModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  taskModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  taskColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  taskModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  taskModalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  taskModalBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  taskModalSection: {
    marginBottom: 20,
  },
  taskModalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 8,
  },
  taskModalDateRange: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  taskModalInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  taskModalToggleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  taskModalToggleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  taskModalToggleButtonSelected: {
    backgroundColor: '#FFF',
    borderColor: '#3B82F6',
  },
  taskModalToggleText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
  },
  taskModalToggleTextSelected: {
    color: '#111827',
    fontWeight: '600',
  },
  taskModalTextarea: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  taskModalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  taskModalDeleteButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskModalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  taskModalSaveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#10B981',
  },
  taskModalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  toggleHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  completedCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedCheckboxActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  completedLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
});

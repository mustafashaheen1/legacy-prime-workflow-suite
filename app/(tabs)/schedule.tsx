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
  ActivityIndicator,
  PanResponder,
  Dimensions,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import DailyTasksButton from '@/components/DailyTasksButton';
import {
  Calendar,
  X,
  Plus,
  Trash2,
  Check,
  Share2,
  History,
  Download,
  Camera,
  ImageIcon,
  ChevronDown,
  ChevronRight,
  FileText,
  Shovel,
  Mountain,
  Home,
  Droplets,
  Hammer,
  Triangle,
  DoorOpen,
  Shield,
  Wrench,
  Zap,
  Wind,
  Snowflake,
  Layers,
  Paintbrush,
  Bath,
  Lightbulb,
  Fan,
  Trees,
  Sparkles,
  ClipboardCheck,
  BookOpen,
  Printer,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ScheduledTask, DailyLog, DailyLogTask, DailyLogPhoto, DailyTask } from '@/types';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

// Helper function to get API base URL for both web and mobile
const getApiBaseUrl = () => {
  const rorkApi = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  if (rorkApi) {
    return rorkApi;
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:8081';
};

// Construction phases with icons
const CONSTRUCTION_PHASES = [
  { id: 'pre-construction', name: 'Pre-Construction', icon: FileText, color: '#8B5CF6' },
  { id: 'site-prep', name: 'Site Preparation', icon: Shovel, color: '#EF4444' },
  { id: 'earthwork', name: 'Earthwork & Excavation', icon: Mountain, color: '#F59E0B' },
  { id: 'foundation', name: 'Foundation', icon: Home, color: '#DC2626' },
  { id: 'utilities', name: 'Underground Utilities', icon: Droplets, color: '#3B82F6' },
  { id: 'framing', name: 'Framing', icon: Hammer, color: '#D97706' },
  { id: 'roofing', name: 'Roofing', icon: Triangle, color: '#7C3AED' },
  { id: 'windows-doors', name: 'Windows & Exterior Doors', icon: DoorOpen, color: '#06B6D4' },
  { id: 'exterior', name: 'Exterior Envelope', icon: Shield, color: '#14B8A6' },
  { id: 'plumbing-rough', name: 'Plumbing Rough-In', icon: Wrench, color: '#0EA5E9' },
  { id: 'electrical-rough', name: 'Electrical Rough-In', icon: Zap, color: '#F97316' },
  { id: 'hvac-rough', name: 'HVAC Rough-In', icon: Wind, color: '#10B981' },
  { id: 'insulation', name: 'Insulation', icon: Snowflake, color: '#38BDF8' },
  { id: 'drywall', name: 'Drywall', icon: Layers, color: '#6366F1' },
  { id: 'interior-finishes', name: 'Interior Finishes', icon: Sparkles, color: '#F472B6' },
  { id: 'painting', name: 'Painting', icon: Paintbrush, color: '#EC4899' },
  { id: 'plumbing-fixtures', name: 'Plumbing Fixtures', icon: Bath, color: '#0284C7' },
  { id: 'electrical-fixtures', name: 'Electrical Fixtures', icon: Lightbulb, color: '#EA580C' },
  { id: 'hvac-final', name: 'HVAC Final', icon: Fan, color: '#059669' },
  { id: 'exterior-improvements', name: 'Exterior Improvements', icon: Trees, color: '#22C55E' },
  { id: 'final-touches', name: 'Final Touches', icon: Sparkles, color: '#A855F7' },
  { id: 'inspections', name: 'Inspections & Closeout', icon: ClipboardCheck, color: '#0891B2' },
];

// Layout constants
const SIDEBAR_WIDTH = 140;
const BASE_DAY_WIDTH = 80;
const BASE_ROW_HEIGHT = 60;
const BASE_BAR_HEIGHT = 40;
const HEADER_HEIGHT = 50;

// Zoom constants
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;

// Extended ScheduledTask to include completed status
interface ScheduledTaskWithStatus extends ScheduledTask {
  completed?: boolean;
  completedAt?: string;
  visibleToClient?: boolean;
}

export default function ScheduleScreen() {
  const { user, projects, dailyLogs, addDailyLog, updateDailyLog, deleteDailyLog } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // State management
  const [selectedProject, setSelectedProject] = useState<string | null>(
    projects.length > 0 ? projects[0].id : null
  );
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTaskWithStatus[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState<boolean>(false);

  // Phase management
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(
    new Set(CONSTRUCTION_PHASES.map(p => p.id))
  );
  const [customPhases, setCustomPhases] = useState<Array<{ id: string; name: string; parentId?: string; color: string }>>([]);
  const [contextMenuPhase, setContextMenuPhase] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);

  // Modals
  const [showTasksModal, setShowTasksModal] = useState<boolean>(false);
  const [showDailyLogModal, setShowDailyLogModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [showAddSubPhaseModal, setShowAddSubPhaseModal] = useState<boolean>(false);

  // Task editing
  const [editingTask, setEditingTask] = useState<ScheduledTaskWithStatus | null>(null);
  const [showTaskModal, setShowTaskModal] = useState<boolean>(false);
  const [taskFormData, setTaskFormData] = useState({
    category: '',
    startDate: '',
    endDate: '',
    workType: 'in-house' as 'in-house' | 'subcontractor',
    notes: '',
    visibleToClient: true,
  });

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

  // Drag and resize state
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [resizingTask, setResizingTask] = useState<{ id: string; type: 'left' | 'right' } | null>(null);

  // Computed dimensions based on zoom
  const DAY_WIDTH = BASE_DAY_WIDTH * zoomLevel;
  const ROW_HEIGHT = BASE_ROW_HEIGHT * zoomLevel;
  const BAR_HEIGHT = BASE_BAR_HEIGHT * zoomLevel;

  // Get selected project details
  const selectedProjectData = useMemo(() => {
    return projects.find(p => p.id === selectedProject);
  }, [projects, selectedProject]);

  // Generate timeline dates (next 120 days)
  const timelineDates = useMemo(() => {
    const dates: Date[] = [];
    const today = new Date();
    for (let i = 0; i < 120; i++) {
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

  // Fetch scheduled tasks from API
  const fetchScheduledTasks = useCallback(async () => {
    if (!selectedProject) return;

    setIsLoadingTasks(true);
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/get-scheduled-tasks?projectId=${selectedProject}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.scheduledTasks) {
        setScheduledTasks(data.scheduledTasks);
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
      if (data.success) {
        await fetchScheduledTasks();
      }
    } catch (error) {
      console.error('[Schedule] Error updating task:', error);
      Alert.alert('Error', 'Failed to update task');
    }
  };

  // Toggle phase expansion
  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
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

  // Context menu for adding sub-phases
  const openContextMenu = (phaseId: string, x: number, y: number) => {
    setContextMenuPhase(phaseId);
    setContextMenuPosition({ x, y });
  };

  const closeContextMenu = () => {
    setContextMenuPhase(null);
    setContextMenuPosition(null);
  };

  const handleAddSubPhase = () => {
    if (contextMenuPhase) {
      setShowAddSubPhaseModal(true);
      closeContextMenu();
    }
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

  const handleAddLogPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0] && user) {
      const photo: DailyLogPhoto = {
        id: `photo-${Date.now()}`,
        uri: result.assets[0].uri,
        timestamp: new Date().toISOString(),
        author: user.name,
      };
      setLogPhotos([...logPhotos, photo]);
    }
  };

  // Share functionality
  const handleShare = async () => {
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Share', 'Sharing is not available on web');
        return;
      }

      // Generate a simple text summary
      const summary = `Schedule for ${selectedProjectData?.name}\n${scheduledTasks.length} tasks scheduled`;

      await Sharing.shareAsync(summary, {
        mimeType: 'text/plain',
        dialogTitle: 'Share Schedule',
      });
    } catch (error) {
      console.error('[Schedule] Error sharing:', error);
      Alert.alert('Error', 'Failed to share schedule');
    }
  };

  // Print functionality
  const handlePrint = () => {
    Alert.alert('Print', 'Print functionality coming soon');
  };

  // Get all phases (built-in + custom)
  const allPhases = useMemo(() => {
    return [
      ...CONSTRUCTION_PHASES,
      ...customPhases.map(cp => ({
        id: cp.id,
        name: cp.name,
        icon: Plus,
        color: cp.color,
      })),
    ];
  }, [customPhases]);

  // Get sub-phases for a phase
  const getSubPhases = (parentId: string) => {
    return customPhases.filter(cp => cp.parentId === parentId);
  };

  // Get tasks for a phase
  const getTasksForPhase = (phaseId: string) => {
    return scheduledTasks.filter(task => {
      const phase = CONSTRUCTION_PHASES.find(p => p.name === task.category);
      return phase?.id === phaseId;
    });
  };

  // Calculate task position on timeline
  const getTaskPosition = (task: ScheduledTaskWithStatus) => {
    const startDate = new Date(task.startDate);
    const daysSinceStart = Math.floor((startDate.getTime() - timelineDates[0].getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceStart * DAY_WIDTH;
  };

  const getTaskWidth = (task: ScheduledTaskWithStatus) => {
    return task.duration * DAY_WIDTH;
  };

  // Toggle task completion
  const toggleTaskCompletion = async (taskId: string) => {
    const task = scheduledTasks.find(t => t.id === taskId);
    if (!task) return;

    const updates: Partial<ScheduledTaskWithStatus> = {
      completed: !task.completed,
      completedAt: !task.completed ? new Date().toISOString() : undefined,
    };

    await updateTask(taskId, updates);
  };

  // Project daily logs
  const projectDailyLogs = useMemo(() => {
    return (dailyLogs && Array.isArray(dailyLogs))
      ? dailyLogs.filter(log => log.projectId === selectedProject)
      : [];
  }, [dailyLogs, selectedProject]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Schedule</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={() => setShowTasksModal(true)}>
            <BookOpen size={20} color="#6B7280" />
            <Text style={styles.headerButtonText}>Tasks</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => setShowDailyLogModal(true)}>
            <Calendar size={20} color="#6B7280" />
            <Text style={styles.headerButtonText}>Log</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => setShowHistoryModal(true)}>
            <History size={20} color="#6B7280" />
            <Text style={styles.headerButtonText}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handlePrint}>
            <Printer size={20} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => setShowShareModal(true)}>
            <Share2 size={20} color="#6B7280" />
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

      {/* Main Content */}
      {isLoadingTasks ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Loading schedule...</Text>
        </View>
      ) : (
        <View style={styles.scheduleContainer}>
          {/* Phase Sidebar */}
          <View style={[styles.phaseSidebar, { width: SIDEBAR_WIDTH }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {allPhases.map(phase => {
                const isExpanded = expandedPhases.has(phase.id);
                const subPhases = getSubPhases(phase.id);
                const Icon = phase.icon;

                return (
                  <View key={phase.id}>
                    <TouchableOpacity
                      style={styles.phaseRow}
                      onPress={() => togglePhase(phase.id)}
                      onLongPress={(e) => {
                        const { pageX, pageY } = e.nativeEvent;
                        openContextMenu(phase.id, pageX, pageY);
                      }}
                    >
                      <View style={styles.phaseHeader}>
                        <Icon size={16} color={phase.color} />
                        <Text style={styles.phaseName} numberOfLines={2}>
                          {phase.name}
                        </Text>
                      </View>
                      {subPhases.length > 0 && (
                        <View style={styles.phaseToggle}>
                          {isExpanded ? (
                            <ChevronDown size={16} color="#9CA3AF" />
                          ) : (
                            <ChevronRight size={16} color="#9CA3AF" />
                          )}
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Sub-phases */}
                    {isExpanded && subPhases.map(subPhase => (
                      <View key={subPhase.id} style={styles.subPhaseRow}>
                        <View style={styles.subPhaseIndent} />
                        <Text style={styles.subPhaseName} numberOfLines={1}>
                          {subPhase.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {/* Timeline Grid */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            style={styles.timelineContainer}
          >
            <View>
              {/* Timeline Header */}
              <View style={[styles.timelineHeader, { height: HEADER_HEIGHT }]}>
                {timelineDates.map((date, index) => (
                  <View
                    key={index}
                    style={[styles.dateCell, { width: DAY_WIDTH }]}
                  >
                    <Text style={styles.dateText}>{formatDate(date)}</Text>
                  </View>
                ))}
              </View>

              {/* Timeline Rows */}
              <ScrollView showsVerticalScrollIndicator={true}>
                {allPhases.map((phase, phaseIndex) => {
                  const isExpanded = expandedPhases.has(phase.id);
                  const subPhases = getSubPhases(phase.id);
                  const phaseTasks = getTasksForPhase(phase.id);

                  return (
                    <View key={phase.id}>
                      {/* Main phase row */}
                      <View
                        style={[
                          styles.timelineRow,
                          { height: ROW_HEIGHT },
                        ]}
                      >
                        {/* Grid cells */}
                        {timelineDates.map((_, index) => (
                          <View
                            key={index}
                            style={[
                              styles.gridCell,
                              { width: DAY_WIDTH, height: ROW_HEIGHT },
                            ]}
                          />
                        ))}

                        {/* Task bars */}
                        {phaseTasks.map(task => (
                          <TouchableOpacity
                            key={task.id}
                            style={[
                              styles.taskBar,
                              {
                                left: getTaskPosition(task),
                                width: getTaskWidth(task),
                                height: BAR_HEIGHT,
                                top: (ROW_HEIGHT - BAR_HEIGHT) / 2,
                                backgroundColor: task.completed ? '#10B981' : task.color,
                                opacity: task.completed ? 0.6 : 1,
                              },
                            ]}
                            onPress={() => {
                              setEditingTask(task);
                              setShowTaskModal(true);
                            }}
                          >
                            <View style={styles.taskBarContent}>
                              <Text style={styles.taskBarText} numberOfLines={1}>
                                {task.category}
                              </Text>
                              {task.completed && (
                                <Check size={14} color="#FFF" />
                              )}
                              {!task.visibleToClient && (
                                <EyeOff size={14} color="#FFF" />
                              )}
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Sub-phase rows */}
                      {isExpanded && subPhases.map(subPhase => (
                        <View
                          key={subPhase.id}
                          style={[
                            styles.timelineRow,
                            { height: ROW_HEIGHT },
                          ]}
                        >
                          {timelineDates.map((_, index) => (
                            <View
                              key={index}
                              style={[
                                styles.gridCell,
                                { width: DAY_WIDTH, height: ROW_HEIGHT },
                              ]}
                            />
                          ))}
                        </View>
                      ))}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      )}

      {/* Zoom Controls */}
      <View style={styles.zoomControls}>
        <TouchableOpacity style={styles.zoomButton} onPress={handleZoomOut}>
          <ZoomOut size={20} color="#6B7280" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomReset} onPress={handleZoomReset}>
          <Text style={styles.zoomResetText}>{Math.round(zoomLevel * 100)}%</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomButton} onPress={handleZoomIn}>
          <ZoomIn size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Context Menu */}
      {contextMenuPhase && contextMenuPosition && (
        <Modal
          transparent
          visible={!!contextMenuPhase}
          onRequestClose={closeContextMenu}
        >
          <TouchableOpacity
            style={styles.contextMenuOverlay}
            activeOpacity={1}
            onPress={closeContextMenu}
          >
            <View
              style={[
                styles.contextMenu,
                {
                  top: contextMenuPosition.y,
                  left: contextMenuPosition.x,
                },
              ]}
            >
              <TouchableOpacity style={styles.contextMenuItem} onPress={handleAddSubPhase}>
                <Plus size={18} color="#374151" />
                <Text style={styles.contextMenuText}>Add Sub-Phase</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Tasks Modal */}
      <Modal
        visible={showTasksModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTasksModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Tasks</Text>
            <TouchableOpacity onPress={() => setShowTasksModal(false)}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {scheduledTasks.map(task => (
              <TouchableOpacity
                key={task.id}
                style={styles.taskItem}
                onPress={() => toggleTaskCompletion(task.id)}
              >
                <View style={styles.taskItemHeader}>
                  <View style={[styles.taskColorDot, { backgroundColor: task.color }]} />
                  <Text style={styles.taskItemTitle}>{task.category}</Text>
                  {task.completed && <Check size={20} color="#10B981" />}
                </View>
                <Text style={styles.taskItemDate}>
                  {new Date(task.startDate).toLocaleDateString()} - {new Date(task.endDate).toLocaleDateString()}
                </Text>
                {task.notes && (
                  <Text style={styles.taskItemNotes}>{task.notes}</Text>
                )}
              </TouchableOpacity>
            ))}
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

            <View style={styles.logSection}>
              <TouchableOpacity style={styles.addPhotoButton} onPress={handleAddLogPhoto}>
                <Camera size={20} color="#7C3AED" />
                <Text style={styles.addPhotoText}>Add Photos</Text>
              </TouchableOpacity>
              {logPhotos.length > 0 && (
                <Text style={styles.photoCount}>{logPhotos.length} photo(s) added</Text>
              )}
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
                    {new Date(log.logDate).toLocaleDateString()}
                  </Text>
                  {log.workPerformed && (
                    <Text style={styles.historyText} numberOfLines={2}>
                      {log.workPerformed}
                    </Text>
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
        presentationStyle="pageSheet"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Share Schedule</Text>
            <TouchableOpacity onPress={() => setShowShareModal(false)}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.shareOption} onPress={handleShare}>
              <Share2 size={24} color="#7C3AED" />
              <Text style={styles.shareOptionText}>Share via System</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareOption} onPress={handlePrint}>
              <Download size={24} color="#7C3AED" />
              <Text style={styles.shareOptionText}>Export as PDF</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Task Edit Modal */}
      {editingTask && (
        <Modal
          visible={showTaskModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            setShowTaskModal(false);
            setEditingTask(null);
          }}
        >
          <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Task Details</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowTaskModal(false);
                  setEditingTask(null);
                }}
              >
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <View style={styles.taskDetailSection}>
                <Text style={styles.taskDetailLabel}>Category</Text>
                <Text style={styles.taskDetailValue}>{editingTask.category}</Text>
              </View>

              <View style={styles.taskDetailSection}>
                <Text style={styles.taskDetailLabel}>Duration</Text>
                <Text style={styles.taskDetailValue}>{editingTask.duration} days</Text>
              </View>

              <View style={styles.taskDetailSection}>
                <Text style={styles.taskDetailLabel}>Work Type</Text>
                <Text style={styles.taskDetailValue}>
                  {editingTask.workType === 'in-house' ? 'In-House' : 'Subcontractor'}
                </Text>
              </View>

              <View style={styles.taskDetailSection}>
                <Text style={styles.taskDetailLabel}>Visible to Client</Text>
                <Switch
                  value={editingTask.visibleToClient !== false}
                  onValueChange={(value) => {
                    updateTask(editingTask.id, { visibleToClient: value });
                  }}
                />
              </View>

              <View style={styles.taskDetailSection}>
                <Text style={styles.taskDetailLabel}>Completed</Text>
                <Switch
                  value={editingTask.completed || false}
                  onValueChange={() => toggleTaskCompletion(editingTask.id)}
                />
              </View>

              {editingTask.notes && (
                <View style={styles.taskDetailSection}>
                  <Text style={styles.taskDetailLabel}>Notes</Text>
                  <Text style={styles.taskDetailValue}>{editingTask.notes}</Text>
                </View>
              )}
            </ScrollView>
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
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  projectTabsContainer: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  projectTabs: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  projectTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    minWidth: 120,
  },
  projectTabActive: {
    backgroundColor: '#7C3AED',
  },
  projectTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
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
    flexDirection: 'row',
  },
  phaseSidebar: {
    backgroundColor: '#FFF',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    minHeight: 60,
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  phaseName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  phaseToggle: {
    marginLeft: 4,
  },
  subPhaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
  },
  subPhaseIndent: {
    width: 16,
  },
  subPhaseName: {
    fontSize: 11,
    color: '#6B7280',
    flex: 1,
  },
  timelineContainer: {
    flex: 1,
  },
  timelineHeader: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dateCell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F3F4F6',
  },
  dateText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
  },
  timelineRow: {
    flexDirection: 'row',
    position: 'relative',
  },
  gridCell: {
    borderRightWidth: 1,
    borderRightColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  taskBar: {
    position: 'absolute',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
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
  },
  zoomButton: {
    padding: 12,
    borderRadius: 8,
  },
  zoomReset: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E5E7EB',
  },
  zoomResetText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  contextMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  contextMenu: {
    position: 'absolute',
    backgroundColor: '#FFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 160,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  contextMenuText: {
    fontSize: 14,
    color: '#374151',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  taskItem: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 12,
  },
  taskItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  taskColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
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
    marginTop: 4,
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
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#7C3AED',
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  addPhotoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
  },
  photoCount: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: '#7C3AED',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 12,
  },
  historyItem: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 12,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  historyText: {
    fontSize: 14,
    color: '#6B7280',
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 12,
  },
  shareOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  taskDetailSection: {
    marginBottom: 20,
  },
  taskDetailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  taskDetailValue: {
    fontSize: 16,
    color: '#111827',
  },
});

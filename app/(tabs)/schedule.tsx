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
  Image,
  Switch,
  Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Calendar, X, BookOpen, Plus, Trash2, Check, Users, History, Download, Camera, ImageIcon, ChevronDown, ChevronRight, CheckSquare, Bell, FileText, Shovel, Mountain, Home, Droplets, Hammer, Triangle, DoorOpen, Shield, Wrench, Zap, Wind, Snowflake, Layers, Paintbrush, Bath, Lightbulb, Fan, Trees, Sparkles, ClipboardCheck, Pencil, Share2, Link, Copy, RefreshCw, Eye, EyeOff, Lock, ShieldOff, Printer, CircleCheck } from 'lucide-react-native';
import { ScheduledTask, DailyLog, DailyLogTask, DailyLogPhoto, DailyTaskReminder } from '@/types';
import * as Clipboard from 'expo-clipboard';
import { Gesture, GestureDetector, ScrollView as GHScrollView } from 'react-native-gesture-handler';

interface PhaseStructure {
  id: string;
  name: string;
  color: string;
  icon: any;
  isSubPhase: boolean;
  parentId?: string;
}

interface CustomMainCategory {
  id: string;
  name: string;
  color: string;
  icon: any;
  insertAfterId: string;
}

const MAIN_CATEGORY_COLORS = [
  '#2563EB', '#DC2626', '#059669', '#D97706', '#7C3AED',
  '#DB2777', '#0891B2', '#4F46E5', '#EA580C', '#16A34A',
];

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

const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const SIDEBAR_WIDTH = 154;
const ROW_HEIGHT = 46;
const BAR_HEIGHT = 34;
const DAY_WIDTH = 96;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;

export default function ScheduleScreen() {
  const { user, projects, dailyLogs, addDailyLog, loadScheduledTasks, addDailyTaskReminder, updateDailyTaskReminder, deleteDailyTaskReminder, getDailyTaskReminders, generateShareLink, disableShareLink, regenerateShareLink, getShareLinkByProject, updateScheduledTasks, scheduledTasks: contextScheduledTasks } = useApp();
  const insets = useSafeAreaInsets();

  const [selectedProject, setSelectedProject] = useState<string | null>(
    projects.length > 0 ? projects[0].id : null
  );
  const [scheduledTasks, setScheduledTasksLocal] = useState<ScheduledTask[]>([]);

  const pendingSyncRef = useRef<ScheduledTask[] | null>(null);

  const setScheduledTasks = useCallback((updater: ScheduledTask[] | ((prev: ScheduledTask[]) => ScheduledTask[])) => {
    setScheduledTasksLocal(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      pendingSyncRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (pendingSyncRef.current !== null) {
      updateScheduledTasks(pendingSyncRef.current);
      pendingSyncRef.current = null;
    }
  });
  const [resizingTask, setResizingTask] = useState<{ id: string; type: 'left' | 'right' } | null>(null);
  const resizingTaskRef = useRef<{ id: string; type: 'left' | 'right' } | null>(null);
  const setResizingTaskSync = useCallback((val: { id: string; type: 'left' | 'right' } | null) => {
    resizingTaskRef.current = val;
    setResizingTask(val);
  }, []);
  const [touchingHandle, setTouchingHandle] = useState<{ id: string; type: 'left' | 'right' } | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);

  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [editNoteText, setEditNoteText] = useState<string>('');
  const [editWorkType, setEditWorkType] = useState<'in-house' | 'subcontractor'>('in-house');
  const [editDuration, setEditDuration] = useState<string>('1');
  const [editCompleted, setEditCompleted] = useState<boolean>(false);
  const [editCompletedDate, setEditCompletedDate] = useState<string>('');

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

  const [showTasksModal, setShowTasksModal] = useState<boolean>(false);
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskDueDate, setNewTaskDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newTaskIsReminder, setNewTaskIsReminder] = useState<boolean>(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState<boolean>(false);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [customSubPhases, setCustomSubPhases] = useState<PhaseStructure[]>([]);
  const [showContextMenu, setShowContextMenu] = useState<{ categoryId: string; categoryName: string; x: number; y: number } | null>(null);
  const [showAddSubPhaseModal, setShowAddSubPhaseModal] = useState<string | null>(null);
  const [newSubPhaseName, setNewSubPhaseName] = useState<string>('');
  const [showRenameModal, setShowRenameModal] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [customMainCategories, setCustomMainCategories] = useState<CustomMainCategory[]>([]);
  const [showAddMainCategoryModal, setShowAddMainCategoryModal] = useState<string | null>(null);
  const [newMainCategoryName, setNewMainCategoryName] = useState<string>('');
  const [newMainCategoryColor, setNewMainCategoryColor] = useState<string>('#2563EB');

  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [sharePassword, setSharePassword] = useState<string>('');
  const [shareExpiry, setShareExpiry] = useState<string>('');
  const [shareLinkCopied, setShareLinkCopied] = useState<boolean>(false);
  const [editClientVisibleNote, setEditClientVisibleNote] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [hoveredTask, setHoveredTask] = useState<ScheduledTask | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const dateHeaderRef = useRef<ScrollView>(null);
  const gridHRef = useRef<ScrollView>(null);
  const bodyScrollRef = useRef<ScrollView>(null);
  const ganttAreaRef = useRef<View>(null);
  const isPanningRef = useRef<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number; scrollX: number; scrollY: number }>({ x: 0, y: 0, scrollX: 0, scrollY: 0 });
  const currentScrollXRef = useRef<number>(0);
  const currentScrollYRef = useRef<number>(0);
  const pendingZoomScrollRef = useRef<{ x: number; y: number } | null>(null);

  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  useEffect(() => {
    if (selectedProject) loadScheduledTasks(selectedProject);
  }, [selectedProject]);

  useEffect(() => {
    const projectContextTasks = contextScheduledTasks.filter(t => t.projectId === selectedProject);
    if (projectContextTasks.length > 0) {
      setScheduledTasksLocal(prev => {
        const otherTasks = prev.filter(t => t.projectId !== selectedProject);
        return [...otherTasks, ...projectContextTasks];
      });
    }
  }, [contextScheduledTasks, selectedProject]);

  const dayWidth = useMemo(() => Math.round(DAY_WIDTH * zoomLevel), [zoomLevel]);
  const rowHeight = useMemo(() => Math.round(ROW_HEIGHT * zoomLevel), [zoomLevel]);
  const barHeight = useMemo(() => Math.round(BAR_HEIGHT * zoomLevel), [zoomLevel]);

  // Pinch-to-zoom (iPad / Android)
  const zoomLevelRef = useRef(zoomLevel);
  useEffect(() => { zoomLevelRef.current = zoomLevel; }, [zoomLevel]);
  const pinchBaseZoomRef = useRef(1.0);
  const pinchGesture = useMemo(() =>
    Gesture.Pinch()
      .enabled(Platform.OS !== 'web')
      .runOnJS(true)
      .onStart(() => {
        pinchBaseZoomRef.current = zoomLevelRef.current;
      })
      .onUpdate((e) => {
        const next = parseFloat(
          Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchBaseZoomRef.current * e.scale)).toFixed(2)
        );
        setZoomLevel(next);
      }),
    []
  );

  const projectTasks = useMemo(
    () => scheduledTasks.filter(t => t.projectId === selectedProject),
    [scheduledTasks, selectedProject]
  );
  const projectDailyLogs = (dailyLogs && Array.isArray(dailyLogs)) ? dailyLogs.filter(log => log.projectId === selectedProject) : [];
  const dailyTaskReminders = getDailyTaskReminders();
  const activeTasks = dailyTaskReminders.filter(t => !t.completed);
  const completedTasks = dailyTaskReminders.filter(t => t.completed);

  const dates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start: earliest task startDate (with 7-day lead buffer), min 14 days back
    let start = new Date(today);
    start.setDate(today.getDate() - 14);
    projectTasks.forEach(t => {
      const s = new Date(t.startDate);
      s.setHours(0, 0, 0, 0);
      s.setDate(s.getDate() - 7);
      if (s < start) start = new Date(s);
    });

    // End: latest task end (with 14-day tail buffer), min 90 days forward
    let end = new Date(today);
    end.setDate(today.getDate() + 90);
    projectTasks.forEach(t => {
      const e = new Date(t.startDate);
      e.setHours(0, 0, 0, 0);
      e.setDate(e.getDate() + (t.duration || 1) + 14);
      if (e > end) end = new Date(e);
    });

    const result: Date[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      result.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }, [projectTasks]);

  // Auto-scroll to today after dates recompute (placed after dates/dayWidth declarations to avoid TDZ)
  useEffect(() => {
    if (Platform.OS !== 'web' || dates.length === 0) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIdx = dates.findIndex(d => d.getTime() === today.getTime());
    if (todayIdx < 0) return;
    const scrollX = Math.max(0, todayIdx * dayWidth - 200);
    const timer = setTimeout(() => {
      gridHRef.current?.scrollTo({ x: scrollX, animated: false });
      dateHeaderRef.current?.scrollTo({ x: scrollX, animated: false });
    }, 200);
    return () => clearTimeout(timer);
  }, [selectedProject, dates.length]);

  const allPhases = useMemo(() => {
    const phases: PhaseStructure[] = [];

    const addCustomMainsAfter = (afterId: string) => {
      const mains = customMainCategories.filter(cm => cm.insertAfterId === afterId);
      mains.forEach(cm => {
        phases.push({
          id: cm.id,
          name: cm.name,
          color: cm.color,
          icon: cm.icon,
          isSubPhase: false,
        });
        if (expandedCategories.has(cm.id)) {
          const subs = customSubPhases.filter(sp => sp.parentId === cm.id);
          phases.push(...subs);
        }
        addCustomMainsAfter(cm.id);
      });
    };

    CONSTRUCTION_CATEGORIES.forEach((cat, idx) => {
      const mainPhase: PhaseStructure = {
        id: `main-${idx}`,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        isSubPhase: false,
      };
      phases.push(mainPhase);
      
      if (expandedCategories.has(mainPhase.id)) {
        const predefinedSubPhaseNames = PREDEFINED_SUB_PHASES[cat.name] || [];
        predefinedSubPhaseNames.forEach((subPhaseName, subIdx) => {
          phases.push({
            id: `predefined-${idx}-${subIdx}`,
            name: subPhaseName,
            color: cat.color,
            icon: cat.icon,
            isSubPhase: true,
            parentId: mainPhase.id,
          });
        });
        
        const customSubs = customSubPhases.filter(sp => sp.parentId === mainPhase.id);
        phases.push(...customSubs);
      }

      addCustomMainsAfter(mainPhase.id);
    });
    return phases;
  }, [customSubPhases, expandedCategories, customMainCategories]);

  const GRID_WIDTH = dates.length * dayWidth;

  // Per-column dynamic widths: expand a column if it has a 1-day task whose
  // label is wider than the default dayWidth so content never gets truncated.
  const colWidths = useMemo(() => {
    const CHAR_W = 5.5;   // avg px per char at zoom=1.0
    const OVERHEAD = 76;  // handles (18+18) + badge (~28) + padding (~12) at zoom=1.0
    const widths = dates.map(() => dayWidth);
    projectTasks.forEach(task => {
      if (task.duration !== 1) return;
      const taskStart = new Date(task.startDate);
      taskStart.setHours(0, 0, 0, 0);
      const idx = dates.findIndex(d => {
        const dd = new Date(d);
        dd.setHours(0, 0, 0, 0);
        return dd.getTime() === taskStart.getTime();
      });
      if (idx === -1) return;
      const needed = Math.ceil((task.category.length * CHAR_W + OVERHEAD) * zoomLevel);
      widths[idx] = Math.max(widths[idx], needed);
    });
    return widths;
  }, [dates, dayWidth, projectTasks, zoomLevel]);

  // colXOffsets[i] = left edge (px) of column i; last entry = total grid width
  const colXOffsets = useMemo(() => {
    const offsets: number[] = [];
    let x = 0;
    colWidths.forEach(w => { offsets.push(x); x += w; });
    offsets.push(x); // sentinel
    return offsets;
  }, [colWidths]);

  const effectiveGridWidth = colXOffsets.length > 1
    ? colXOffsets[colXOffsets.length - 1]
    : GRID_WIDTH;

  // ── Lane system: stack overlapping tasks in the same phase row ─────────────
  // For each task, assign it the lowest lane (0-based) that doesn't conflict.
  const taskLanes = useMemo(() => {
    const lanes = new Map<string, number>(); // task.id → lane
    const byPhase = new Map<string, ScheduledTask[]>();
    projectTasks.forEach(t => {
      const list = byPhase.get(t.category) || [];
      list.push(t);
      byPhase.set(t.category, list);
    });
    byPhase.forEach(tasks => {
      const sorted = [...tasks].sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      );
      const laneEnds: Date[] = [];
      sorted.forEach(task => {
        const start = new Date(task.startDate);
        start.setHours(0, 0, 0, 0);
        let laneIdx = laneEnds.findIndex(e => start >= e);
        if (laneIdx === -1) laneIdx = laneEnds.length;
        const end = new Date(start);
        end.setDate(start.getDate() + task.duration);
        laneEnds[laneIdx] = end;
        lanes.set(task.id, laneIdx);
      });
    });
    return lanes;
  }, [projectTasks]);

  // Lane count per phase (min 1)
  const phaseLaneCounts = useMemo(() => {
    const counts = new Map<string, number>();
    allPhases.forEach(p => {
      const phaseTasks = projectTasks.filter(t => t.category === p.name);
      if (phaseTasks.length === 0) { counts.set(p.name, 1); return; }
      const max = Math.max(...phaseTasks.map(t => taskLanes.get(t.id) ?? 0));
      counts.set(p.name, max + 1);
    });
    return counts;
  }, [allPhases, projectTasks, taskLanes]);

  // Cumulative y-offset for each phase row
  const phaseRowTops = useMemo(() => {
    const tops = new Map<string, number>();
    let y = 0;
    allPhases.forEach(p => {
      tops.set(p.name, y);
      y += (phaseLaneCounts.get(p.name) ?? 1) * rowHeight;
    });
    return tops;
  }, [allPhases, phaseLaneCounts, rowHeight]);

  const GRID_HEIGHT = allPhases.reduce(
    (sum, p) => sum + (phaseLaneCounts.get(p.name) ?? 1) * rowHeight, 0
  );

  const formatDate = (date: Date): string => {
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const handleSelectPhase = useCallback((phaseName: string) => {
    setSelectedPhase(prev => prev === phaseName ? null : phaseName);
  }, []);

  const toggleCategoryExpanded = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  const handleAddSubPhase = useCallback((parentId: string) => {
    if (!newSubPhaseName.trim()) return;
    
    const parent = allPhases.find(p => p.id === parentId);
    if (!parent) return;

    const newSubPhase: PhaseStructure = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newSubPhaseName.trim(),
      color: parent.color,
      icon: parent.icon,
      isSubPhase: true,
      parentId: parentId,
    };

    setCustomSubPhases(prev => [...prev, newSubPhase]);
    setExpandedCategories(prev => new Set(prev).add(parentId));
    setNewSubPhaseName('');
    setShowAddSubPhaseModal(null);
    console.log('[Schedule] Added sub-phase:', newSubPhase.name, 'under', parent.name);
  }, [newSubPhaseName, allPhases]);

  const handleDeletePhase = useCallback((phaseId: string) => {
    const phase = allPhases.find(p => p.id === phaseId);
    if (!phase || !phase.isSubPhase) return;

    Alert.alert(
      'Delete Sub-Phase',
      `Are you sure you want to delete "${phase.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setCustomSubPhases(prev => prev.filter(sp => sp.id !== phaseId));
            setScheduledTasks(prev => prev.filter(t => t.category !== phase.name));
            console.log('[Schedule] Deleted sub-phase:', phase.name);
          },
        },
      ]
    );
  }, [allPhases]);

  const handleRenamePhase = useCallback((phaseId: string) => {
    if (!renameValue.trim()) return;
    
    const phase = allPhases.find(p => p.id === phaseId);
    if (!phase) return;

    if (phase.isSubPhase) {
      setCustomSubPhases(prev => prev.map(sp => 
        sp.id === phaseId ? { ...sp, name: renameValue.trim() } : sp
      ));
    } else if (phaseId.startsWith('custom-main-')) {
      setCustomMainCategories(prev => prev.map(cm => 
        cm.id === phaseId ? { ...cm, name: renameValue.trim() } : cm
      ));
    }
    
    setScheduledTasks(prev => prev.map(t => 
      t.category === phase.name ? { ...t, category: renameValue.trim() } : t
    ));
    
    setRenameValue('');
    setShowRenameModal(null);
    console.log('[Schedule] Renamed phase:', phase.name, 'to', renameValue.trim());
  }, [renameValue, allPhases]);

  const handleAddMainCategory = useCallback(() => {
    if (!newMainCategoryName.trim() || !showAddMainCategoryModal) return;
    
    const newCategory: CustomMainCategory = {
      id: `custom-main-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newMainCategoryName.trim(),
      color: newMainCategoryColor,
      icon: Layers,
      insertAfterId: showAddMainCategoryModal,
    };
    
    setCustomMainCategories(prev => [...prev, newCategory]);
    setNewMainCategoryName('');
    setNewMainCategoryColor('#2563EB');
    setShowAddMainCategoryModal(null);
    console.log('[Schedule] Added main category:', newCategory.name, 'after', showAddMainCategoryModal);
  }, [newMainCategoryName, newMainCategoryColor, showAddMainCategoryModal]);

  const handleDeleteMainCategory = useCallback((categoryId: string) => {
    const category = customMainCategories.find(cm => cm.id === categoryId);
    if (!category) return;
    
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category.name}" and all its sub-phases?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setCustomMainCategories(prev => prev.filter(cm => cm.id !== categoryId));
            setCustomSubPhases(prev => prev.filter(sp => sp.parentId !== categoryId));
            setScheduledTasks(prev => prev.filter(t => t.category !== category.name));
            console.log('[Schedule] Deleted main category:', category.name);
          },
        },
      ]
    );
  }, [customMainCategories]);

  const openContextMenu = useCallback((phase: PhaseStructure, x?: number, y?: number) => {
    if (phase.isSubPhase) return;
    console.log('[Schedule] Opening context menu for:', phase.name);
    setShowContextMenu({
      categoryId: phase.id,
      categoryName: phase.name,
      x: x ?? 0,
      y: y ?? 0,
    });
  }, []);

  const handleLongPress = useCallback((phase: PhaseStructure, event: any) => {
    if (Platform.OS === 'web') return;
    openContextMenu(phase);
  }, [openContextMenu]);

  const handleRightClick = useCallback((phase: PhaseStructure, event: any) => {
    if (Platform.OS !== 'web') return;
    if (phase.isSubPhase) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    openContextMenu(phase, event.clientX, event.clientY);
  }, [openContextMenu]);

  const handleGridTap = useCallback((locationX: number) => {
    if (!selectedPhase || !selectedProject) return;

    const phase = allPhases.find(p => p.name === selectedPhase);
    if (!phase) return;
    
    const phaseIdx = allPhases.findIndex(p => p.name === selectedPhase);
    if (phaseIdx === -1) return;
    // Find which column was tapped using cumulative offsets (handles variable-width columns)
    let dayIdx = -1;
    for (let i = 0; i < colXOffsets.length - 1; i++) {
      if (locationX >= colXOffsets[i] && locationX < colXOffsets[i + 1]) {
        dayIdx = i;
        break;
      }
    }
    if (dayIdx < 0 || dayIdx >= dates.length) return;

    const targetDate = dates[dayIdx];
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 1);

    // Block if this date is already occupied by a task in the same phase
    const occupied = projectTasks.some(t => {
      if (t.category !== phase.name) return false;
      const tStart = new Date(t.startDate);
      tStart.setHours(0, 0, 0, 0);
      const tEnd = new Date(tStart);
      tEnd.setDate(tStart.getDate() + t.duration);
      return startDate >= tStart && startDate < tEnd;
    });
    if (occupied) return;

    const newTask: ScheduledTask = {
      id: Date.now().toString(),
      projectId: selectedProject,
      category: phase.name,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      duration: 1,
      workType: 'in-house',
      notes: '',
      color: phase.color,
      row: phaseIdx,
      rowSpan: 1,
    };

    setScheduledTasks(prev => [...prev, newTask]);
    setSelectedPhase(null);
    console.log('[Schedule] Created phase block:', phase.name, 'at', formatDate(targetDate));
  }, [selectedPhase, selectedProject, dates, dayWidth, allPhases, projectTasks, colXOffsets]);

  const handleDeleteTask = useCallback((taskId: string) => {
    setScheduledTasks(prev => prev.filter(t => t.id !== taskId));
    console.log('[Schedule] Deleted task:', taskId);
  }, []);

  const handleEditTask = useCallback((task: ScheduledTask) => {
    setEditingTask(task);
    setEditNoteText(task.notes || '');
    setEditWorkType(task.workType);
    setEditDuration(String(task.duration));
    setEditClientVisibleNote(task.visibleToClient ?? false);
    setEditCompleted(task.completed ?? false);
    // Normalize completedAt to YYYY-MM-DD regardless of whether it's a full ISO datetime from DB
    const rawDate = task.completed && task.completedAt ? task.completedAt : new Date().toISOString();
    setEditCompletedDate(rawDate.split('T')[0]);
  }, []);

  const scheduledTasksRef = useRef<ScheduledTask[]>(scheduledTasks);
  useEffect(() => { scheduledTasksRef.current = scheduledTasks; }, [scheduledTasks]);

  const handleSaveEdit = useCallback(() => {
    if (!editingTask) return;

    // Guard: completion date must not be before the task's start date
    if (editCompleted && editCompletedDate) {
      const startDay = editingTask.startDate.split('T')[0];
      if (editCompletedDate < startDay) {
        const startFormatted = new Date(startDay + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        if (Platform.OS === 'web') {
          (window as any).alert(`Completion date cannot be before the task start date (${startFormatted}).`);
        } else {
          Alert.alert('Invalid Date', `Completion date cannot be before the task start date (${startFormatted}).`);
        }
        return;
      }
    }

    const newDuration = Math.max(1, parseInt(editDuration) || 1);
    const startDate = new Date(editingTask.startDate);
    const newEndDate = new Date(startDate);
    newEndDate.setDate(startDate.getDate() + newDuration);

    const updatedTask: ScheduledTask = {
      ...editingTask,
      notes: editNoteText,
      workType: editWorkType,
      duration: newDuration,
      endDate: newEndDate.toISOString(),
      visibleToClient: editClientVisibleNote,
      completed: editCompleted,
      completedAt: editCompleted ? editCompletedDate : (null as any),
    };

    // Update local state directly — guarantees immediate pill expansion on chart
    setScheduledTasksLocal(prev => prev.map(t => t.id === editingTask.id ? updatedTask : t));
    setEditingTask(null);

    // Sync full array to context + Supabase (bypasses pendingSyncRef for reliability)
    const updatedAll = scheduledTasksRef.current.map(t => t.id === editingTask.id ? updatedTask : t);
    updateScheduledTasks(updatedAll);

    console.log('[Schedule] Updated task:', editingTask.category, `duration: ${newDuration}d`, editCompleted ? '(completed)' : '');
  }, [editingTask, editNoteText, editWorkType, editDuration, editClientVisibleNote, editCompleted, editCompletedDate, updateScheduledTasks]);

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
    if (sharedWith.includes(shareEmail.trim())) return;
    setSharedWith([...sharedWith, shareEmail.trim()]);
    setShareEmail('');
  };

  const handleRemoveTeamMember = (email: string) => {
    setSharedWith(prev => prev.filter(e => e !== email));
  };

  const handleSaveDailyLog = () => {
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
    addDailyLog(log);
    if (sharedWith.length > 0) {
      console.log('[Share] Daily log shared with:', sharedWith.join(', '));
    }
    setShowDailyLogsModal(false);
    console.log('[Daily Log] Created with', tasks.length, 'tasks and', photos.length, 'photos');
  };

  const handleExportPDF = useCallback(() => {
    if (!selectedProject) return;
    const project = projects.find(p => p.id === selectedProject);
    if (!project) return;

    setIsExportingPdf(true);
    console.log('[Schedule] Exporting PDF for project:', project.name);

    const tasksForProject = scheduledTasks.filter(t => t.projectId === selectedProject);

    const tasksByPhase: Record<string, ScheduledTask[]> = {};
    tasksForProject.forEach(task => {
      if (!tasksByPhase[task.category]) {
        tasksByPhase[task.category] = [];
      }
      tasksByPhase[task.category].push(task);
    });

    const sortedTasks = [...tasksForProject].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    const dateStr = (d: Date) =>
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dayName = (d: Date) =>
      d.toLocaleDateString('en-US', { weekday: 'short' });
    const fmtDate = (iso: string) =>
      new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    for (const t of sortedTasks) {
      const s = new Date(t.startDate);
      const e = new Date(t.endDate);
      if (!minDate || s < minDate) minDate = s;
      if (!maxDate || e > maxDate) maxDate = e;
    }
    const minDateStr = minDate ? fmtDate(minDate.toISOString()) : 'N/A';
    const maxDateStr = maxDate ? fmtDate(maxDate.toISOString()) : 'N/A';

    const pdfDates: Date[] = [];
    if (minDate && maxDate) {
      const current = new Date(minDate);
      current.setDate(current.getDate() - 1);
      const end = new Date(maxDate);
      end.setDate(end.getDate() + 1);
      while (current <= end) {
        pdfDates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
    }

    const phasesWithTasks = allPhases.filter(p => tasksByPhase[p.name]?.length > 0);

    const ganttColWidth = Math.max(36, Math.min(52, 900 / Math.max(pdfDates.length, 1)));

    const ganttHeaderCells = pdfDates
      .map(
        d =>
          `<th style="min-width:${ganttColWidth}px;max-width:${ganttColWidth}px;font-size:8px;text-align:center;padding:3px 1px;border:1px solid #ddd;background:#f8fafc;">${dateStr(d)}<br/><span style="color:#94a3b8;font-size:7px;">${dayName(d)}</span></th>`
      )
      .join('');

    const ganttRows = phasesWithTasks
      .map(phase => {
        const phaseTasks = tasksByPhase[phase.name] || [];
        const cells = pdfDates
          .map(d => {
            const dTime = new Date(d).setHours(0, 0, 0, 0);
            const active = phaseTasks.find(t => {
              const s = new Date(t.startDate).setHours(0, 0, 0, 0);
              const e = new Date(t.endDate).setHours(0, 0, 0, 0);
              return dTime >= s && dTime < e;
            });
            if (active) {
              return `<td style="min-width:${ganttColWidth}px;max-width:${ganttColWidth}px;background:${hexToRgba(active.color, 0.22)};border:1px solid ${hexToRgba(active.color, 0.35)};padding:0;"></td>`;
            }
            return `<td style="min-width:${ganttColWidth}px;max-width:${ganttColWidth}px;border:1px solid #eee;padding:0;"></td>`;
          })
          .join('');
        return `<tr><td style="padding:6px 10px;font-size:11px;font-weight:600;border:1px solid #ddd;white-space:nowrap;background:#fafbfc;"><span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${phase.color};margin-right:6px;"></span>${phase.isSubPhase ? '&nbsp;&nbsp;' : ''}${phase.name}</td>${cells}</tr>`;
      })
      .join('');

    const completedCount = sortedTasks.filter(t => t.completed).length;

    const taskRows = sortedTasks
      .map(
        t => {
          const statusBadge = t.completed
            ? `<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#DCFCE7;color:#166534;">✓ Completed${t.completedAt ? ' ' + fmtDate(t.completedAt) : ''}</span>`
            : `<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#FEF3C7;color:#92400E;">In Progress</span>`;
          return `
        <tr${t.completed ? ' style="background:#f0fdf4;"' : ''}>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${t.completed ? '#16a34a' : t.color};margin-right:8px;vertical-align:middle;"></span>
            <span style="font-weight:600;color:#1e293b;">${t.category}</span>
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#475569;">${fmtDate(t.startDate)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#475569;">${(() => { const e = new Date(t.endDate); e.setDate(e.getDate() - 1); return fmtDate(e.toISOString()); })()}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center;">${t.duration}d</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">${statusBadge}</td>
        </tr>`;
        }
      )
      .join('');

    const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<title>${project.name} – Schedule</title>
<style>
  @page { size: landscape; margin: 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1e293b; background: #fff; padding: 24px; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #1e3a5f; padding-bottom: 14px; margin-bottom: 24px; }
  .header h1 { font-size: 22px; color: #1e3a5f; }
  .header .meta { text-align: right; color: #64748b; font-size: 12px; }
  .section-title { font-size: 15px; font-weight: 700; color: #1e3a5f; margin: 28px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .detail-table th { text-align: left; padding: 10px 14px; background: #f1f5f9; color: #475569; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #cbd5e1; }
  .gantt-wrap { overflow-x: auto; margin-bottom: 8px; }
  .gantt-table { border-collapse: collapse; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
  .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; }
  .summary-card .val { font-size: 22px; font-weight: 700; color: #1e3a5f; }
  .summary-card .lbl { font-size: 11px; color: #64748b; margin-top: 2px; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
  }
</style>
</head><body>

<div class="no-print" style="text-align:right;margin-bottom:16px;">
  <button onclick="window.print()" style="padding:10px 24px;background:#1e3a5f;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Print / Save as PDF</button>
</div>

<div class="header">
  <div>
    <h1>${project.name}</h1>
    <div style="color:#64748b;font-size:13px;margin-top:4px;">Project Schedule</div>
  </div>
  <div class="meta">
    <div>Exported: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
    <div>Status: <strong style="color:${project.status === 'active' ? '#16a34a' : '#64748b'};">${project.status.charAt(0).toUpperCase() + project.status.slice(1)}</strong></div>
  </div>
</div>

<div class="summary-grid">
  <div class="summary-card"><div class="val">${tasksForProject.length}</div><div class="lbl">Scheduled Phases</div></div>
  <div class="summary-card"><div class="val">${completedCount} / ${tasksForProject.length}</div><div class="lbl">Completed</div></div>
  <div class="summary-card"><div class="val">${minDateStr}</div><div class="lbl">Earliest Start</div></div>
  <div class="summary-card"><div class="val">${maxDateStr}</div><div class="lbl">Latest End</div></div>
</div>

${pdfDates.length > 0 ? `
<div class="section-title">Gantt Chart</div>
<div class="gantt-wrap">
  <table class="gantt-table">
    <thead><tr><th style="min-width:140px;padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #ddd;background:#f1f5f9;color:#475569;">Phase</th>${ganttHeaderCells}</tr></thead>
    <tbody>${ganttRows}</tbody>
  </table>
</div>
` : ''}

<div class="section-title">Phase Details</div>
<table class="detail-table">
  <thead><tr><th>Phase</th><th>Start Date</th><th>End Date</th><th style="text-align:center;">Duration</th><th>Status</th></tr></thead>
  <tbody>${taskRows.length > 0 ? taskRows : '<tr><td colspan="5" style="padding:24px;text-align:center;color:#94a3b8;">No scheduled phases yet</td></tr>'}</tbody>
</table>

<div class="footer">Generated from Project Schedule &mdash; ${new Date().toLocaleString()}</div>

</body></html>`;

    try {
      if (Platform.OS === 'web') {
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(html);
          win.document.close();
          console.log('[Schedule] PDF export window opened');
        } else {
          Alert.alert('Pop-up Blocked', 'Please allow pop-ups to export the schedule as PDF.');
        }
      } else {
        Alert.alert(
          'Export Schedule',
          'PDF export is best used on the web version. Open your project on web to use Print / Save as PDF.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('[Schedule] PDF export error:', error);
      Alert.alert('Error', 'Could not generate PDF. Please try again.');
    } finally {
      setIsExportingPdf(false);
    }
  }, [selectedProject, projects, scheduledTasks, allPhases]);

  const getTaskPosition = useCallback((task: ScheduledTask) => {
    const taskStartDate = new Date(task.startDate);
    taskStartDate.setHours(0, 0, 0, 0);

    const startIdx = dates.findIndex(d => {
      const dateToCompare = new Date(d);
      dateToCompare.setHours(0, 0, 0, 0);
      return dateToCompare.getTime() === taskStartDate.getTime();
    });

    if (startIdx === -1) return null;

    const rowTop = phaseRowTops.get(task.category);
    if (rowTop === undefined) return null;

    const lane = taskLanes.get(task.id) ?? 0;

    // Use cumulative column offsets so expanded columns are reflected in position
    const endIdx = Math.min(startIdx + task.duration, colXOffsets.length - 1);
    const left = colXOffsets[startIdx] + 2;
    const width = Math.max(colXOffsets[endIdx] - colXOffsets[startIdx] - 4, colWidths[startIdx] - 4);

    return {
      left,
      width,
      top: rowTop + lane * rowHeight + (rowHeight - barHeight) / 2,
      height: barHeight,
    };
  }, [dates, dayWidth, rowHeight, barHeight, phaseRowTops, taskLanes, colXOffsets, colWidths]);

  const createResizePanResponder = (task: ScheduledTask, type: 'left' | 'right') => {
    let initialDuration = task.duration;
    let initialStartDate = new Date(task.startDate);

    return PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        // Set ref immediately (sync) so scrollEnabled flips before any move event
        resizingTaskRef.current = { id: task.id, type };
        return true;
      },
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        setResizingTaskSync({ id: task.id, type });
        setTouchingHandle({ id: task.id, type });
        initialDuration = task.duration;
        initialStartDate = new Date(task.startDate);
      },
      onPanResponderMove: (_, gs) => {
        const daysDelta = Math.round(gs.dx / dayWidth);
        if (type === 'right') {
          const newDuration = Math.max(1, initialDuration + daysDelta);
          const newEndDate = new Date(task.startDate);
          newEndDate.setDate(newEndDate.getDate() + newDuration);
          setScheduledTasks(prev => prev.map(t =>
            t.id === task.id ? { ...t, duration: newDuration, endDate: newEndDate.toISOString() } : t
          ));
        } else {
          const newDuration = Math.max(1, initialDuration - daysDelta);
          const newStartDate = new Date(initialStartDate);
          newStartDate.setDate(initialStartDate.getDate() + daysDelta);
          const newEndDate = new Date(newStartDate);
          newEndDate.setDate(newStartDate.getDate() + newDuration);
          setScheduledTasks(prev => prev.map(t =>
            t.id === task.id ? {
              ...t,
              duration: newDuration,
              startDate: newStartDate.toISOString(),
              endDate: newEndDate.toISOString(),
            } : t
          ));
        }
      },
      onPanResponderRelease: () => {
        setResizingTaskSync(null);
        setTouchingHandle(null);
      },
    });
  };

  // Web-only: document-level mouse drag for smooth, ScrollView-independent resize
  const handleResizeMouseDown = useCallback((task: ScheduledTask, type: 'left' | 'right', clientX: number) => {
    const initialDuration = task.duration;
    const initialStartDate = new Date(task.startDate);
    const startX = clientX;
    const snapDayWidth = dayWidth;

    setResizingTaskSync({ id: task.id, type });
    setTouchingHandle({ id: task.id, type });

    const onMove = (me: MouseEvent) => {
      me.preventDefault();
      const daysDelta = Math.round((me.clientX - startX) / snapDayWidth);
      if (type === 'right') {
        const newDuration = Math.max(1, initialDuration + daysDelta);
        const newEndDate = new Date(initialStartDate);
        newEndDate.setDate(initialStartDate.getDate() + newDuration);
        setScheduledTasks(prev => prev.map(t =>
          t.id === task.id ? { ...t, duration: newDuration, endDate: newEndDate.toISOString() } : t
        ));
      } else {
        const newDuration = Math.max(1, initialDuration - daysDelta);
        const newStart = new Date(initialStartDate);
        newStart.setDate(initialStartDate.getDate() + daysDelta);
        const newEnd = new Date(newStart);
        newEnd.setDate(newStart.getDate() + newDuration);
        setScheduledTasks(prev => prev.map(t =>
          t.id === task.id ? { ...t, duration: newDuration, startDate: newStart.toISOString(), endDate: newEnd.toISOString() } : t
        ));
      }
    };

    const onUp = () => {
      setResizingTaskSync(null);
      setTouchingHandle(null);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [dayWidth, setScheduledTasks]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (pendingZoomScrollRef.current) {
      const { x, y } = pendingZoomScrollRef.current;
      gridHRef.current?.scrollTo({ x, animated: false });
      dateHeaderRef.current?.scrollTo({ x, animated: false });
      bodyScrollRef.current?.scrollTo({ y, animated: false });
      currentScrollXRef.current = x;
      currentScrollYRef.current = y;
      pendingZoomScrollRef.current = null;
    }
  }, [zoomLevel]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!selectedProject) return;
    const node = ganttAreaRef.current as unknown as HTMLElement;
    if (!node) return;

    const handleContextMenu = (e: Event) => {
      e.preventDefault();
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        const target = e.target as HTMLElement;
        const sidebar = node.querySelector('[data-sidebar="true"]');
        if (sidebar && sidebar.contains(target)) {
          return;
        }
        e.preventDefault();
        isPanningRef.current = true;
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          scrollX: currentScrollXRef.current,
          scrollY: currentScrollYRef.current,
        };
        node.style.cursor = 'grabbing';
        console.log('[Schedule] Pan started');
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return;
      e.preventDefault();
      const dx = panStartRef.current.x - e.clientX;
      const dy = panStartRef.current.y - e.clientY;
      const newScrollX = Math.max(0, panStartRef.current.scrollX + dx);
      const newScrollY = Math.max(0, panStartRef.current.scrollY + dy);
      gridHRef.current?.scrollTo({ x: newScrollX, animated: false });
      dateHeaderRef.current?.scrollTo({ x: newScrollX, animated: false });
      bodyScrollRef.current?.scrollTo({ y: newScrollY, animated: false });
      currentScrollXRef.current = newScrollX;
      currentScrollYRef.current = newScrollY;
    };

    const handleMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        node.style.cursor = 'default';
        console.log('[Schedule] Pan ended');
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = node.getBoundingClientRect();
        const cursorX = e.clientX - rect.left - SIDEBAR_WIDTH;
        const scrollX = currentScrollXRef.current;
        const scrollY = currentScrollYRef.current;
        const contentX = scrollX + Math.max(0, cursorX);

        setZoomLevel(prev => {
          const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
          const raw = prev + delta;
          const newZoom = parseFloat(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, raw)).toFixed(1));
          if (newZoom === prev) return prev;

          const scale = newZoom / prev;
          const newScrollX = Math.max(0, contentX * scale - Math.max(0, cursorX));
          const newScrollY = Math.max(0, scrollY * scale);

          pendingZoomScrollRef.current = { x: newScrollX, y: newScrollY };
          console.log('[Schedule] Zoom:', Math.round(newZoom * 100) + '%');
          return newZoom;
        });
      }
    };

    node.addEventListener('contextmenu', handleContextMenu);
    node.addEventListener('mousedown', handleMouseDown as EventListener);
    window.addEventListener('mousemove', handleMouseMove as EventListener);
    window.addEventListener('mouseup', handleMouseUp);
    node.addEventListener('wheel', handleWheel as EventListener, { passive: false });

    return () => {
      node.removeEventListener('contextmenu', handleContextMenu);
      node.removeEventListener('mousedown', handleMouseDown as EventListener);
      window.removeEventListener('mousemove', handleMouseMove as EventListener);
      window.removeEventListener('mouseup', handleMouseUp);
      node.removeEventListener('wheel', handleWheel as EventListener);
    };
  }, [selectedProject]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Schedule</Text>
        {selectedProject && (
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowTasksModal(true)}>
              <CheckSquare size={14} color="#0EA5E9" />
              <Text style={styles.headerBtnText}>Tasks</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.headerBtn, styles.headerBtnLog]} onPress={handleOpenDailyLogs}>
              <BookOpen size={14} color="#2563EB" />
              <Text style={[styles.headerBtnText, { color: '#2563EB' }]}>Log</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.historyBtn} onPress={() => setShowHistoryModal(true)}>
              <History size={14} color="#059669" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportPdfBtn} onPress={handleExportPDF} disabled={isExportingPdf}>
              <Printer size={14} color="#1E3A5F" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} onPress={() => setShowShareModal(true)}>
              <Share2 size={14} color="#7C3AED" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.projectSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {projects.filter(p => p.status === 'active').map(project => (
            <TouchableOpacity
              key={project.id}
              style={[styles.projectChip, selectedProject === project.id && styles.projectChipActive]}
              onPress={() => setSelectedProject(project.id)}
            >
              <Text style={[styles.projectChipText, selectedProject === project.id && styles.projectChipTextActive]}>
                {project.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {!selectedProject ? (
        <View style={styles.emptyState}>
          <Calendar size={48} color="#9CA3AF" />
          <Text style={styles.emptyText}>Select a project to view schedule</Text>
        </View>
      ) : (
        <>
          {selectedPhase && (
            <View style={styles.instructionBar}>
              <View style={[styles.instrDot, { backgroundColor: allPhases.find(p => p.name === selectedPhase)?.color || '#999' }]} />
              <Text style={styles.instructionText}>
                Tap on the calendar to place{' '}
                <Text style={{ fontWeight: '700' as const }}>{selectedPhase}</Text>
              </Text>
              <TouchableOpacity onPress={() => setSelectedPhase(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={16} color="#78350F" />
              </TouchableOpacity>
            </View>
          )}

          <GestureDetector gesture={pinchGesture}>
          <View style={styles.ganttArea} ref={ganttAreaRef}>
            <View style={styles.dateHeaderRow}>
              <View style={styles.cornerCell}>
                <Text style={styles.cornerText}>PHASES</Text>
              </View>
              <ScrollView
                ref={dateHeaderRef}
                horizontal
                scrollEnabled={false}
                showsHorizontalScrollIndicator={false}
                style={styles.dateHeaderScroll}
              >
                <View style={styles.dateHeaderContent}>
                  {dates.map((date, i) => (
                    <View key={i} style={[styles.dateCell, { width: colWidths[i] ?? dayWidth }, isToday(date) && styles.dateCellToday]}>
                      <Text style={[styles.dateCellText, isToday(date) && styles.dateCellTextToday]}>
                        {formatDate(date)}
                      </Text>
                      <Text style={[styles.dateCellDay, isToday(date) && styles.dateCellDayToday]}>
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>

            <ScrollView
              ref={bodyScrollRef}
              style={styles.ganttBody}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled
              scrollEventThrottle={16}
              scrollEnabled={!resizingTask}
              onScroll={(e) => {
                currentScrollYRef.current = e.nativeEvent.contentOffset.y;
              }}
            >
              <View style={styles.ganttBodyRow}>
                <View style={styles.sidebar} data-sidebar="true">
                  {allPhases.map((phase, i) => {
                    const hasTask = projectTasks.some(t => t.category === phase.name);
                    const predefinedSubPhases = phase.isSubPhase ? [] : (PREDEFINED_SUB_PHASES[phase.name] || []);
                    const customSubs = customSubPhases.filter(sp => sp.parentId === phase.id);
                    const hasSubPhases = predefinedSubPhases.length > 0 || customSubs.length > 0;
                    const isExpanded = expandedCategories.has(phase.id);
                    const IconComponent = phase.icon;
                    
                    return (
                      <View key={phase.id} style={{ position: 'relative' }}>
                        <TouchableOpacity
                          style={[
                            styles.sidebarItem,
                            { height: (phaseLaneCounts.get(phase.name) ?? 1) * rowHeight },
                            selectedPhase === phase.name && styles.sidebarItemActive,
                            i % 2 === 0 ? styles.sidebarItemEven : styles.sidebarItemOdd,
                            phase.isSubPhase && styles.sidebarItemIndented,
                          ]}
                          onPress={() => handleSelectPhase(phase.name)}
                          onLongPress={(e) => handleLongPress(phase, e)}
                          {...(Platform.OS === 'web' ? { onContextMenu: (e: any) => handleRightClick(phase, e) } as any : {})}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.sidebarStripe, { backgroundColor: phase.color }]} />
                          {!phase.isSubPhase && hasSubPhases && (
                            <TouchableOpacity
                              style={styles.expandIndicator}
                              onPress={(e) => {
                                e.stopPropagation();
                                toggleCategoryExpanded(phase.id);
                              }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              {isExpanded ? (
                                <ChevronDown size={12} color="#000000" />
                              ) : (
                                <ChevronRight size={12} color="#000000" />
                              )}
                            </TouchableOpacity>
                          )}
                          {!phase.isSubPhase && !hasSubPhases && <View style={{ width: 16 }} />}
                          <View style={[styles.sidebarContent, phase.isSubPhase && styles.sidebarContentSubPhase]}>
                            <IconComponent size={phase.isSubPhase ? 10 : 13} color={phase.color} />
                            <Text
                              style={[
                                styles.sidebarLabel,
                                selectedPhase === phase.name && styles.sidebarLabelActive,
                                hasTask && styles.sidebarLabelHasTask,
                                phase.isSubPhase && styles.sidebarLabelSubPhase,
                              ]}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {phase.name}
                            </Text>
                          </View>
                          {!phase.isSubPhase && (
                            <TouchableOpacity
                              style={styles.mainPhaseMenuBtn}
                              onPress={(e) => {
                                e.stopPropagation?.();
                                console.log('[Schedule] + button pressed for:', phase.name);
                                openContextMenu(phase);
                              }}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <Plus size={10} color="#6B7280" />
                            </TouchableOpacity>
                          )}
                          {phase.isSubPhase && (
                            <TouchableOpacity
                              style={styles.subPhaseMenuBtn}
                              onPress={(e) => {
                                e.stopPropagation?.();
                                Alert.alert(
                                  phase.name,
                                  'Choose an action',
                                  [
                                    {
                                      text: 'Rename',
                                      onPress: () => {
                                        setRenameValue(phase.name);
                                        setShowRenameModal({ id: phase.id, name: phase.name });
                                      },
                                    },
                                    {
                                      text: 'Delete',
                                      style: 'destructive',
                                      onPress: () => handleDeletePhase(phase.id),
                                    },
                                    { text: 'Cancel', style: 'cancel' },
                                  ]
                                );
                              }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Text style={styles.subPhaseMenuBtnText}>⋯</Text>
                            </TouchableOpacity>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>

                <GHScrollView
                  ref={gridHRef as any}
                  horizontal
                  showsHorizontalScrollIndicator={true}
                  scrollEventThrottle={16}
                  scrollEnabled={!resizingTask}
                  onScroll={(e) => {
                    const x = e.nativeEvent.contentOffset.x;
                    currentScrollXRef.current = x;
                    dateHeaderRef.current?.scrollTo({ x, animated: false });
                  }}
                  style={styles.gridScroll}
                  nestedScrollEnabled
                >
                  <Pressable
                    onPress={(e) => {
                      const lx = (e.nativeEvent as any).locationX ?? (e.nativeEvent as any).offsetX ?? 0;
                      handleGridTap(lx);
                    }}
                    style={{ width: effectiveGridWidth, height: GRID_HEIGHT }}
                  >
                    <View style={[styles.gridContent, { width: effectiveGridWidth, height: GRID_HEIGHT }]}>
                      {allPhases.map((phase, rowIdx) => {
                        const rowTop = phaseRowTops.get(phase.name) ?? rowIdx * rowHeight;
                        const rowH = (phaseLaneCounts.get(phase.name) ?? 1) * rowHeight;
                        return (
                          <View
                            key={`row-${rowIdx}`}
                            style={[
                              styles.gridRow,
                              { top: rowTop, height: rowH },
                              rowIdx % 2 === 0 ? styles.gridRowEven : styles.gridRowOdd,
                              selectedPhase === phase.name && styles.gridRowHighlight,
                            ]}
                          />
                        );
                      })}

                      {dates.map((date, colIdx) =>
                        isToday(date) ? (
                          <View
                            key={`today-${colIdx}`}
                            style={[styles.todayColumn, { left: colXOffsets[colIdx] ?? colIdx * dayWidth, width: colWidths[colIdx] ?? dayWidth, height: GRID_HEIGHT }]}
                          />
                        ) : null
                      )}

                      {dates.map((_, colIdx) => (
                        <View
                          key={`col-${colIdx}`}
                          style={[styles.gridColLine, { left: colXOffsets[colIdx + 1] ?? (colIdx + 1) * dayWidth, height: GRID_HEIGHT }]}
                        />
                      ))}

                      {projectTasks.map(task => {
                        const pos = getTaskPosition(task);
                        if (!pos) return null;

                        const isLeftTouching = touchingHandle?.id === task.id && touchingHandle?.type === 'left';
                        const isRightTouching = touchingHandle?.id === task.id && touchingHandle?.type === 'right';

                        // RNGH Pan gestures for native (iOS/Android) — coordinates with GHScrollView
                        // to block horizontal scroll while a handle drag is in progress
                        const makeNativeHandleGesture = (type: 'left' | 'right') => {
                          let initDur = task.duration;
                          let initStart = new Date(task.startDate);
                          return Gesture.Pan()
                            .runOnJS(true)
                            .minDistance(2)
                            .onStart(() => {
                              initDur = task.duration;
                              initStart = new Date(task.startDate);
                              setResizingTaskSync({ id: task.id, type });
                              setTouchingHandle({ id: task.id, type });
                            })
                            .onUpdate((e) => {
                              const dd = Math.round(e.translationX / dayWidth);
                              if (type === 'right') {
                                const nd = Math.max(1, initDur + dd);
                                const ne = new Date(initStart);
                                ne.setDate(initStart.getDate() + nd);
                                setScheduledTasks(prev => prev.map(t =>
                                  t.id === task.id ? { ...t, duration: nd, endDate: ne.toISOString() } : t
                                ));
                              } else {
                                const nd = Math.max(1, initDur - dd);
                                const ns = new Date(initStart);
                                ns.setDate(initStart.getDate() + dd);
                                const ne = new Date(ns);
                                ne.setDate(ns.getDate() + nd);
                                setScheduledTasks(prev => prev.map(t =>
                                  t.id === task.id ? { ...t, duration: nd, startDate: ns.toISOString(), endDate: ne.toISOString() } : t
                                ));
                              }
                            })
                            .onEnd(() => {
                              setResizingTaskSync(null);
                              setTouchingHandle(null);
                            });
                        };
                        const leftNativeGesture = Platform.OS !== 'web' ? makeNativeHandleGesture('left') : null;
                        const rightNativeGesture = Platform.OS !== 'web' ? makeNativeHandleGesture('right') : null;

                        const phase = allPhases.find(p => p.name === task.category);
                        
                        const isCompleted = task.completed === true;

                        return (
                          <View
                            key={task.id}
                            style={[
                              styles.taskBar,
                              {
                                left: pos.left,
                                top: pos.top,
                                width: pos.width,
                                height: pos.height,
                                backgroundColor: isCompleted ? hexToRgba('#16A34A', 0.14) : hexToRgba(task.color, 0.18),
                                borderRadius: barHeight / 2,
                                borderWidth: 1.5,
                                borderColor: isCompleted ? hexToRgba('#16A34A', 0.5) : hexToRgba(task.color, 0.5),
                              },
                              resizingTask?.id === task.id && styles.taskBarResizing,
                            ]}
                          >
                            {Platform.OS !== 'web' ? (
                              <GestureDetector gesture={leftNativeGesture!}>
                                <View
                                  hitSlop={{ top: 10, bottom: 10, left: 14, right: 6 }}
                                  style={[styles.resizeHandle, styles.resizeHandleLeft, isLeftTouching && styles.resizeHandleTouching]}
                                >
                                  <View style={styles.resizeDot} />
                                </View>
                              </GestureDetector>
                            ) : (
                              <View
                                hitSlop={{ top: 10, bottom: 10, left: 14, right: 6 }}
                                style={[styles.resizeHandle, styles.resizeHandleLeft, { cursor: 'w-resize', userSelect: 'none' } as any]}
                                onMouseDown={(e: any) => { e.preventDefault(); e.stopPropagation(); handleResizeMouseDown(task, 'left', e.clientX); }}
                              >
                                <View style={styles.resizeDot} />
                              </View>
                            )}

                            <TouchableOpacity
                              style={styles.taskBarBody}
                              onPress={() => handleEditTask(task)}
                              activeOpacity={0.8}
                              {...(Platform.OS === 'web' ? {
                                onMouseEnter: (e: any) => { setHoveredTask(task); setTooltipPos({ x: e.clientX, y: e.clientY }); },
                                onMouseMove: (e: any) => { setTooltipPos({ x: e.clientX, y: e.clientY }); },
                                onMouseLeave: () => { setHoveredTask(null); setTooltipPos(null); },
                              } as any : {})}
                            >
                              {(() => {
                                const IconComp = phase?.icon;
                                const workLabel = task.workType === 'subcontractor' ? 'Sub' : 'In-House';
                                const scaledIcon = Math.max(10, Math.round(11 * zoomLevel));
                                const scaledFont = Math.max(7, Math.round(8 * zoomLevel));
                                const scaledSmall = Math.max(6, Math.round(7 * zoomLevel));
                                const isNarrow = pos.width < Math.round(2.2 * dayWidth);

                                if (isNarrow) {
                                  return (
                                    <View style={styles.taskBarContentNarrow}>
                                      {isCompleted && <CircleCheck size={Math.max(8, Math.round(10 * zoomLevel))} color="#16A34A" />}
                                      <Text style={[styles.taskBarTextNarrow, { fontSize: Math.max(7, Math.round(9 * zoomLevel)), color: isCompleted ? '#15803D' : '#1F2937' }]} numberOfLines={2}>
                                        {task.category}
                                      </Text>
                                      <View style={[styles.taskBarWorkBadgeNarrow, { backgroundColor: hexToRgba(task.color, 0.25) }, task.workType === 'subcontractor' && styles.taskBarWorkBadgeSub]}>
                                        <Text style={[styles.taskBarWorkText, { fontSize: Math.max(5, Math.round(5.5 * zoomLevel)), color: '#1F2937' }]}>
                                          {workLabel}
                                        </Text>
                                      </View>
                                      {task.visibleToClient === false && (
                                        <EyeOff size={Math.max(11, Math.round(12 * zoomLevel))} color="#DC2626" strokeWidth={2.5} />
                                      )}
                                    </View>
                                  );
                                }

                                return (
                                  <View style={styles.taskBarContent}>
                                    <View style={styles.taskBarLine1}>
                                      {isCompleted ? (
                                        <CircleCheck size={scaledIcon} color="#16A34A" />
                                      ) : IconComp ? (
                                        <IconComp size={scaledIcon} color={task.color} />
                                      ) : null}
                                      <Text style={[styles.taskBarText, { fontSize: scaledFont, color: isCompleted ? '#15803D' : '#1F2937' }]} numberOfLines={1}>
                                        {task.category}
                                      </Text>
                                      <View style={[styles.taskBarWorkBadge, { backgroundColor: hexToRgba(task.color, 0.25) }, task.workType === 'subcontractor' && styles.taskBarWorkBadgeSub]}>
                                        <Text style={[styles.taskBarWorkText, { fontSize: Math.max(5, Math.round(6 * zoomLevel)), color: '#1F2937' }]}>
                                          {workLabel}
                                        </Text>
                                      </View>
                                      {task.visibleToClient === false && (
                                        <EyeOff size={Math.max(12, Math.round(13 * zoomLevel))} color="#DC2626" strokeWidth={2.5} />
                                      )}
                                      {isCompleted && task.completedAt && (
                                        <Text style={[styles.taskBarCompletedDate, { fontSize: scaledSmall }]}>
                                          ✓ {new Date(task.completedAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </Text>
                                      )}
                                      {!isCompleted && task.duration > 1 && (
                                        <Text style={[styles.taskBarDuration, { fontSize: scaledSmall, color: '#374151' }]}>{task.duration}d</Text>
                                      )}
                                    </View>
                                    {task.notes ? (
                                      <Text style={[styles.taskBarNote, { fontSize: scaledSmall, color: '#4B5563' }]} numberOfLines={1}>
                                        {task.notes}
                                      </Text>
                                    ) : null}
                                  </View>
                                );
                              })()}
                            </TouchableOpacity>

                            {Platform.OS !== 'web' ? (
                              <GestureDetector gesture={rightNativeGesture!}>
                                <View
                                  hitSlop={{ top: 10, bottom: 10, left: 6, right: 14 }}
                                  style={[styles.resizeHandle, styles.resizeHandleRight, isRightTouching && styles.resizeHandleTouching]}
                                >
                                  <View style={styles.resizeDot} />
                                </View>
                              </GestureDetector>
                            ) : (
                              <View
                                hitSlop={{ top: 10, bottom: 10, left: 6, right: 14 }}
                                style={[styles.resizeHandle, styles.resizeHandleRight, { cursor: 'ew-resize', userSelect: 'none' } as any]}
                                onMouseDown={(e: any) => { e.preventDefault(); e.stopPropagation(); handleResizeMouseDown(task, 'right', e.clientX); }}
                              >
                                <View style={styles.resizeDot} />
                              </View>
                            )}


                          </View>
                        );
                      })}
                    </View>
                  </Pressable>
                </GHScrollView>
              </View>
            </ScrollView>
            {(Platform.OS === 'web' || Platform.OS === 'ios') && (
              <View style={styles.zoomControls}>
                <TouchableOpacity
                  style={styles.zoomBtn}
                  onPress={() => setZoomLevel(prev => parseFloat(Math.max(MIN_ZOOM, prev - ZOOM_STEP).toFixed(1)))}
                >
                  <Text style={styles.zoomBtnText}>−</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.zoomIndicator}
                  onPress={() => setZoomLevel(1.0)}
                >
                  <Text style={styles.zoomIndicatorText}>{Math.round(zoomLevel * 100)}%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.zoomBtn}
                  onPress={() => setZoomLevel(prev => parseFloat(Math.min(MAX_ZOOM, prev + ZOOM_STEP).toFixed(1)))}
                >
                  <Text style={styles.zoomBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          </GestureDetector>
        </>
      )}

      {/* Edit Task Modal */}
      <Modal visible={!!editingTask} transparent animationType="slide" onRequestClose={() => setEditingTask(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.editModalDot, { backgroundColor: editingTask?.color || '#999' }]} />
                <Text style={styles.editModalTitle}>{editingTask?.category}</Text>
              </View>
              <TouchableOpacity onPress={() => setEditingTask(null)}>
                <X size={22} color="#1F2937" />
              </TouchableOpacity>
            </View>

            {editingTask && (
              <ScrollView
                style={styles.editModalBody}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.editLabel}>Date Range</Text>
                {(() => {
                  const dur = Math.max(1, parseInt(editDuration) || 1);
                  const d = new Date(editingTask.startDate);
                  // dur - 1 converts exclusive end to inclusive last day
                  d.setDate(d.getDate() + dur - 1);
                  const durationChanged = dur !== editingTask.duration;
                  return (
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                      <Text style={styles.editDateText}>
                        {formatDate(new Date(editingTask.startDate))} → {formatDate(d)}
                      </Text>
                      {durationChanged && (
                        <View style={{ backgroundColor: '#DBEAFE', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 11, color: '#1D4ED8' }}>preview</Text>
                        </View>
                      )}
                    </View>
                  );
                })()}

                <Text style={styles.editLabel}>Duration (days)</Text>
                <TextInput
                  style={styles.editInput}
                  value={editDuration}
                  onChangeText={setEditDuration}
                  keyboardType="number-pad"
                  placeholder="1"
                  placeholderTextColor="#9CA3AF"
                />

                <Text style={styles.editLabel}>Work Type</Text>
                <View style={styles.workTypeRow}>
                  <TouchableOpacity
                    style={[styles.workTypeChip, editWorkType === 'in-house' && styles.workTypeChipActive]}
                    onPress={() => setEditWorkType('in-house')}
                  >
                    <Text style={[styles.workTypeText, editWorkType === 'in-house' && styles.workTypeTextActive]}>🏠 In-House</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.workTypeChip, editWorkType === 'subcontractor' && styles.workTypeChipActive]}
                    onPress={() => setEditWorkType('subcontractor')}
                  >
                    <Text style={[styles.workTypeText, editWorkType === 'subcontractor' && styles.workTypeTextActive]}>👷 Subcontractor</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.editLabel}>Notes</Text>
                <TextInput
                  style={styles.editTextarea}
                  value={editNoteText}
                  onChangeText={setEditNoteText}
                  placeholder="Add notes visible on the block..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                />

                <View style={styles.clientVisibleRow}>
                  <View style={styles.clientVisibleLeft}>
                    {editClientVisibleNote ? (
                      <Eye size={16} color="#059669" />
                    ) : (
                      <EyeOff size={16} color="#9CA3AF" />
                    )}
                    <View>
                      <Text style={styles.clientVisibleLabel}>Visible to Client</Text>
                      <Text style={styles.clientVisibleHint}>
                        {editClientVisibleNote ? 'Phase visible on shared client link' : 'Phase hidden from shared client link'}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={editClientVisibleNote}
                    onValueChange={setEditClientVisibleNote}
                    trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                    thumbColor={editClientVisibleNote ? '#059669' : '#F3F4F6'}
                  />
                </View>

                <View style={styles.completionSection}>
                  <TouchableOpacity
                    style={[styles.completionToggle, editCompleted && styles.completionToggleActive]}
                    onPress={() => {
                      const newVal = !editCompleted;
                      setEditCompleted(newVal);
                      if (newVal && !editCompletedDate) {
                        const today = new Date().toISOString().split('T')[0];
                        const startDay = editingTask?.startDate.split('T')[0] ?? today;
                        // Completion date cannot be before task start — default to start if today is earlier
                        setEditCompletedDate(today >= startDay ? today : startDay);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.completionCheckbox, editCompleted && styles.completionCheckboxActive]}>
                      {editCompleted && <Check size={14} color="#FFFFFF" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.completionLabel, editCompleted && styles.completionLabelActive]}>
                        {editCompleted ? 'Phase Completed' : 'Mark as Completed'}
                      </Text>
                      {editCompleted && editCompletedDate && (
                        <Text style={styles.completionDateDisplay}>
                          Completed: {new Date(editCompletedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  {editCompleted && (
                    <View style={styles.completionDateRow}>
                      <Text style={styles.completionDateLabel}>Completion Date</Text>
                      {Platform.OS === 'web' ? (
                        <input
                          type="date"
                          value={editCompletedDate}
                          min={editingTask?.startDate.split('T')[0]}
                          onChange={(e: any) => setEditCompletedDate(e.target.value)}
                          style={{ border: '1px solid #D1D5DB', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: '#111827', background: '#fff', outline: 'none' } as any}
                        />
                      ) : (
                        <DateTimePicker
                          value={editCompletedDate ? new Date(editCompletedDate + 'T00:00:00') : new Date()}
                          mode="date"
                          display="compact"
                          minimumDate={editingTask ? new Date(editingTask.startDate.split('T')[0] + 'T00:00:00') : undefined}
                          onChange={(_: any, date?: Date) => {
                            if (date) setEditCompletedDate(date.toISOString().split('T')[0]);
                          }}
                        />
                      )}
                    </View>
                  )}
                </View>
              </ScrollView>
            )}

            <View style={styles.editModalFooter}>
              <TouchableOpacity
                style={styles.editDeleteBtn}
                onPress={() => {
                  if (!editingTask) return;
                  const doDelete = () => {
                    handleDeleteTask(editingTask.id);
                    setEditingTask(null);
                  };
                  if (Platform.OS === 'web') {
                    // Alert.alert multi-button callbacks don't fire on web — use window.confirm instead
                    if ((window as any).confirm(`Delete "${editingTask.category}"? This cannot be undone.`)) {
                      doDelete();
                    }
                  } else {
                    Alert.alert(
                      'Delete Schedule',
                      `Are you sure you want to delete this scheduled phase?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: doDelete },
                      ]
                    );
                  }
                }}
              >
                <Trash2 size={18} color="#EF4444" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.editCancelBtn} onPress={() => setEditingTask(null)}>
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editSaveBtn} onPress={handleSaveEdit}>
                <Check size={16} color="#FFFFFF" />
                <Text style={styles.editSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Daily Logs Modal */}
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
                <TouchableOpacity style={styles.toggleRow} onPress={() => setEquipmentExpanded(!equipmentExpanded)}>
                  {equipmentExpanded ? <ChevronDown size={20} color="#2563EB" /> : <ChevronRight size={20} color="#6B7280" />}
                  <Text style={styles.toggleLabel}>🚜 Equipment</Text>
                </TouchableOpacity>
                {equipmentExpanded && (
                  <TextInput style={styles.oneLineInput} value={equipmentNote} onChangeText={setEquipmentNote} placeholder="Quick note about equipment..." placeholderTextColor="#9CA3AF" />
                )}
              </View>

              <View style={styles.toggleSection}>
                <TouchableOpacity style={styles.toggleRow} onPress={() => setMaterialExpanded(!materialExpanded)}>
                  {materialExpanded ? <ChevronDown size={20} color="#2563EB" /> : <ChevronRight size={20} color="#6B7280" />}
                  <Text style={styles.toggleLabel}>📦 Material</Text>
                </TouchableOpacity>
                {materialExpanded && (
                  <TextInput style={styles.oneLineInput} value={materialNote} onChangeText={setMaterialNote} placeholder="Quick note about materials..." placeholderTextColor="#9CA3AF" />
                )}
              </View>

              <View style={styles.toggleSection}>
                <TouchableOpacity style={styles.toggleRow} onPress={() => setOfficialExpanded(!officialExpanded)}>
                  {officialExpanded ? <ChevronDown size={20} color="#2563EB" /> : <ChevronRight size={20} color="#6B7280" />}
                  <Text style={styles.toggleLabel}>📋 Official</Text>
                </TouchableOpacity>
                {officialExpanded && (
                  <TextInput style={styles.oneLineInput} value={officialNote} onChangeText={setOfficialNote} placeholder="Quick note about official matters..." placeholderTextColor="#9CA3AF" />
                )}
              </View>

              <View style={styles.toggleSection}>
                <TouchableOpacity style={styles.toggleRow} onPress={() => setSubsExpanded(!subsExpanded)}>
                  {subsExpanded ? <ChevronDown size={20} color="#2563EB" /> : <ChevronRight size={20} color="#6B7280" />}
                  <Text style={styles.toggleLabel}>👷 Subs</Text>
                </TouchableOpacity>
                {subsExpanded && (
                  <TextInput style={styles.oneLineInput} value={subsNote} onChangeText={setSubsNote} placeholder="Quick note about subcontractors..." placeholderTextColor="#9CA3AF" />
                )}
              </View>

              <View style={styles.toggleSection}>
                <TouchableOpacity style={styles.toggleRow} onPress={() => setEmployeesExpanded(!employeesExpanded)}>
                  {employeesExpanded ? <ChevronDown size={20} color="#2563EB" /> : <ChevronRight size={20} color="#6B7280" />}
                  <Text style={styles.toggleLabel}>👥 Employees</Text>
                </TouchableOpacity>
                {employeesExpanded && (
                  <TextInput style={styles.oneLineInput} value={employeesNote} onChangeText={setEmployeesNote} placeholder="Quick note about employees..." placeholderTextColor="#9CA3AF" />
                )}
              </View>

              <View style={styles.divider} />

              <Text style={styles.label}>Work Performed</Text>
              <TextInput style={styles.textArea} value={workPerformed} onChangeText={setWorkPerformed} placeholder="Describe what was completed today..." placeholderTextColor="#9CA3AF" multiline numberOfLines={3} />

              <Text style={styles.label}>Issues</Text>
              <TextInput style={styles.textArea} value={issues} onChangeText={setIssues} placeholder="Any issues or concerns..." placeholderTextColor="#9CA3AF" multiline numberOfLines={3} />

              <Text style={styles.label}>General Notes</Text>
              <TextInput style={styles.textArea} value={generalNotes} onChangeText={setGeneralNotes} placeholder="Additional notes..." placeholderTextColor="#9CA3AF" multiline numberOfLines={3} />

              <View style={styles.divider} />

              <View style={styles.photoSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={styles.label}>Photo Attachments</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={styles.photoButton} onPress={handleTakePhoto}>
                      <Camera size={18} color="#2563EB" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.photoButton} onPress={handlePickPhoto}>
                      <ImageIcon size={18} color="#2563EB" />
                    </TouchableOpacity>
                  </View>
                </View>
                {photos.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.photosList}>
                      {photos.map((photo) => (
                        <View key={photo.id} style={styles.photoItem}>
                          <Image source={{ uri: photo.uri }} style={styles.photoThumbnail} />
                          <TouchableOpacity style={styles.photoRemoveButton} onPress={() => handleRemovePhoto(photo.id)}>
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
                  <TouchableOpacity style={styles.addTaskButton} onPress={handleAddTask}>
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
                  <TouchableOpacity style={styles.addShareButton} onPress={handleAddTeamMember}>
                    <Plus size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowDailyLogsModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveDailyLog}>
                <Text style={styles.saveButtonText}>Save Log</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* History Modal */}
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
                            {new Date(log.logDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </Text>
                          <Text style={styles.historyCreatedBy}>By {log.createdBy}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            console.log('[Export] Daily log exported');
                            alert('Export functionality: This will be available to share via email/SMS in production.');
                          }}
                          style={styles.exportButton}
                        >
                          <Download size={18} color="#2563EB" />
                        </TouchableOpacity>
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
                                  <Image source={{ uri: photo.uri }} style={styles.historyPhotoImage} />
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
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowHistoryModal(false)}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
              {projectDailyLogs.length > 0 && (
                <TouchableOpacity
                  style={styles.exportAllButton}
                  onPress={() => {
                    console.log('[Export All] Daily logs exported');
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

      {/* Tasks Modal */}
      <Modal
        visible={showTasksModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTasksModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <CheckSquare size={24} color="#0EA5E9" />
                <Text style={styles.modalTitle}>Daily Tasks & Reminders</Text>
              </View>
              <TouchableOpacity onPress={() => setShowTasksModal(false)}>
                <X size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.addTaskSection}>
                <Text style={styles.label}>Add New Task/Reminder</Text>
                <TextInput
                  style={styles.oneLineInput}
                  value={newTaskTitle}
                  onChangeText={setNewTaskTitle}
                  placeholder="Task or reminder title..."
                  placeholderTextColor="#9CA3AF"
                />

                <View style={styles.taskOptionsRow}>
                  <View style={styles.dueDateSection}>
                    <Text style={styles.smallLabel}>Due Date</Text>
                    <View style={styles.dateInputContainer}>
                      {Platform.OS === 'web' ? (
                        <>
                          <TextInput
                            style={styles.dateInput}
                            value={newTaskDueDate}
                            onChangeText={setNewTaskDueDate}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor="#9CA3AF"
                          />
                          <TouchableOpacity
                            style={styles.calendarIconButton}
                            onPress={() => {
                              const dateInput = document.createElement('input');
                              dateInput.type = 'date';
                              dateInput.value = newTaskDueDate;
                              dateInput.onchange = (e) => {
                                const target = e.target as HTMLInputElement;
                                if (target.value) {
                                  setNewTaskDueDate(target.value);
                                }
                              };
                              dateInput.click();
                            }}
                          >
                            <Calendar size={20} color="#0EA5E9" />
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <TextInput
                            style={styles.dateInput}
                            value={newTaskDueDate}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor="#9CA3AF"
                            editable={false}
                          />
                          <TouchableOpacity
                            style={[styles.calendarIconButton, showDatePicker && styles.calendarIconButtonActive]}
                            onPress={() => setShowDatePicker(!showDatePicker)}
                          >
                            <Calendar size={20} color={showDatePicker ? "#FFFFFF" : "#0EA5E9"} />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                    {showDatePicker && Platform.OS !== 'web' && (
                      <View style={styles.inlineDatePickerContainer}>
                        <View style={styles.inlineDatePickerHeader}>
                          <Text style={styles.inlineDatePickerTitle}>Select Due Date</Text>
                          <TouchableOpacity style={styles.inlineDatePickerCloseButton} onPress={() => setShowDatePicker(false)}>
                            <X size={20} color="#6B7280" />
                          </TouchableOpacity>
                        </View>
                        <DateTimePicker
                          value={new Date(newTaskDueDate)}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(event, selectedDate) => {
                            if (Platform.OS === 'android') setShowDatePicker(false);
                            if (selectedDate) setNewTaskDueDate(selectedDate.toISOString().split('T')[0]);
                          }}
                          style={{ width: '100%' }}
                        />
                        {Platform.OS === 'ios' && (
                          <TouchableOpacity style={styles.inlineDatePickerDoneButton} onPress={() => setShowDatePicker(false)}>
                            <Text style={styles.inlineDatePickerDoneText}>Done</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>

                  <View style={styles.reminderToggle}>
                    <Bell size={18} color={newTaskIsReminder ? '#F59E0B' : '#9CA3AF'} />
                    <Text style={styles.reminderLabel}>Reminder</Text>
                    <Switch
                      value={newTaskIsReminder}
                      onValueChange={setNewTaskIsReminder}
                      trackColor={{ false: '#D1D5DB', true: '#FCD34D' }}
                      thumbColor={newTaskIsReminder ? '#F59E0B' : '#F3F4F6'}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.addTaskButtonLarge}
                  onPress={async () => {
                    if (newTaskTitle.trim()) {
                      const newTask: DailyTaskReminder = {
                        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        title: newTaskTitle,
                        dueDate: newTaskDueDate,
                        completed: false,
                        isReminder: newTaskIsReminder,
                        createdAt: new Date().toISOString(),
                      };
                      await addDailyTaskReminder(newTask);
                      setNewTaskTitle('');
                      setNewTaskDueDate(new Date().toISOString().split('T')[0]);
                      setNewTaskIsReminder(false);
                      console.log('[Tasks] Added task:', newTask.title);
                    }
                  }}
                >
                  <Plus size={20} color="#FFFFFF" />
                  <Text style={styles.addTaskButtonLargeText}>Add Task</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              <View style={styles.tasksListSection}>
                <View style={styles.tasksListHeader}>
                  <Text style={styles.label}>Your Tasks</Text>
                  <TouchableOpacity style={styles.toggleHistoryButton} onPress={() => setShowCompletedTasks(!showCompletedTasks)}>
                    <History size={16} color="#6B7280" />
                    <Text style={styles.toggleHistoryText}>{showCompletedTasks ? 'Hide' : 'Show'} History</Text>
                  </TouchableOpacity>
                </View>

                {activeTasks.length === 0 && completedTasks.length === 0 ? (
                  <View style={styles.emptyTasksState}>
                    <CheckSquare size={40} color="#D1D5DB" />
                    <Text style={styles.emptyTasksText}>No tasks yet</Text>
                    <Text style={styles.emptyTasksSubtext}>Add tasks and reminders to stay organized</Text>
                  </View>
                ) : (
                  <View style={styles.tasksList}>
                    {activeTasks
                      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                      .map((task) => (
                      <View key={task.id} style={styles.dailyTaskCard}>
                        <View style={styles.dailyTaskHeader}>
                          <TouchableOpacity
                            onPress={async () => {
                              await updateDailyTaskReminder(task.id, { completed: !task.completed });
                              console.log('[Tasks]', task.completed ? 'Uncompleted' : 'Completed', 'task:', task.title);
                            }}
                            style={[styles.taskCheckboxLarge, task.completed && styles.taskCheckboxLargeCompleted]}
                          >
                            {task.completed && <Check size={18} color="#FFFFFF" />}
                          </TouchableOpacity>
                          <View style={styles.taskInfoSection}>
                            <Text style={[styles.taskTitleText, task.completed && styles.taskTitleCompleted]}>{task.title}</Text>
                            <View style={styles.taskMetaRow}>
                              <Text style={styles.taskDueDateText}>
                                📅 {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </Text>
                              {task.isReminder && (
                                <View style={styles.reminderBadge}>
                                  <Bell size={12} color="#F59E0B" />
                                  <Text style={styles.reminderBadgeText}>Reminder</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.taskCreatedText}>
                              ⏰ Created: {new Date(task.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={async () => {
                              await deleteDailyTaskReminder(task.id);
                              console.log('[Tasks] Deleted task:', task.title);
                            }}
                            style={styles.deleteTaskIconButton}
                          >
                            <Trash2 size={18} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}

                    {showCompletedTasks && completedTasks.length > 0 && (
                      <View style={styles.completedSection}>
                        <Text style={styles.completedSectionTitle}>Completed Tasks</Text>
                        {completedTasks
                          .sort((a, b) => {
                            const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
                            const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
                            return bTime - aTime;
                          })
                          .map((task) => (
                          <View key={task.id} style={[styles.dailyTaskCard, styles.completedTaskCard]}>
                            <View style={styles.dailyTaskHeader}>
                              <TouchableOpacity
                                onPress={async () => {
                                  await updateDailyTaskReminder(task.id, { completed: false });
                                  console.log('[Tasks] Uncompleted task:', task.title);
                                }}
                                style={[styles.taskCheckboxLarge, styles.taskCheckboxLargeCompleted]}
                              >
                                <Check size={18} color="#FFFFFF" />
                              </TouchableOpacity>
                              <View style={styles.taskInfoSection}>
                                <Text style={[styles.taskTitleText, styles.taskTitleCompleted]}>{task.title}</Text>
                                <View style={styles.taskMetaRow}>
                                  <Text style={styles.taskDueDateText}>
                                    📅 {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </Text>
                                  {task.isReminder && (
                                    <View style={styles.reminderBadge}>
                                      <Bell size={12} color="#F59E0B" />
                                      <Text style={styles.reminderBadgeText}>Reminder</Text>
                                    </View>
                                  )}
                                </View>
                                <Text style={styles.taskCreatedText}>
                                  ⏰ Created: {new Date(task.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                </Text>
                                {task.completedAt && (
                                  <Text style={styles.taskCompletedText}>
                                    ✅ Completed: {new Date(task.completedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                  </Text>
                                )}
                              </View>
                              <TouchableOpacity
                                onPress={async () => {
                                  await deleteDailyTaskReminder(task.id);
                                  console.log('[Tasks] Deleted completed task:', task.title);
                                }}
                                style={styles.deleteTaskIconButton}
                              >
                                <Trash2 size={18} color="#EF4444" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.closeButtonFull} onPress={() => setShowTasksModal(false)}>
                <Text style={styles.closeButtonFullText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Context Menu Modal */}
      <Modal
        visible={!!showContextMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContextMenu(null)}
      >
        <Pressable
          style={styles.contextMenuOverlay}
          onPress={() => {
            console.log('[Schedule] Context menu overlay tapped, closing');
            setShowContextMenu(null);
          }}
        >
          <View
            style={[
              styles.contextMenu,
              Platform.OS === 'web' && showContextMenu && showContextMenu.x > 0
                ? { left: showContextMenu.x, top: showContextMenu.y }
                : styles.contextMenuCentered,
            ]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.contextMenuTitle}>{showContextMenu?.categoryName}</Text>
            <View style={styles.contextMenuDivider} />
            <Pressable
              style={({ pressed }) => [styles.contextMenuItem, pressed && styles.contextMenuItemPressed]}
              onPress={() => {
                const categoryId = showContextMenu?.categoryId;
                console.log('[Schedule] Add Sub-Phase pressed, categoryId:', categoryId);
                setShowContextMenu(null);
                if (categoryId) {
                  setTimeout(() => setShowAddSubPhaseModal(categoryId), 100);
                }
              }}
            >
              <Plus size={18} color="#2563EB" />
              <Text style={styles.contextMenuText}>Add Sub-Phase</Text>
            </Pressable>
            <View style={styles.contextMenuDivider} />
            <Pressable
              style={({ pressed }) => [styles.contextMenuItem, pressed && styles.contextMenuItemPressed]}
              onPress={() => {
                const categoryId = showContextMenu?.categoryId;
                console.log('[Schedule] Insert Main Category pressed, categoryId:', categoryId);
                setShowContextMenu(null);
                if (categoryId) {
                  setTimeout(() => setShowAddMainCategoryModal(categoryId), 100);
                }
              }}
            >
              <Layers size={18} color="#059669" />
              <Text style={styles.contextMenuText}>Insert Main Category</Text>
            </Pressable>
            {showContextMenu?.categoryId.startsWith('custom-main-') && (
              <>
                <View style={styles.contextMenuDivider} />
                <Pressable
                  style={({ pressed }) => [styles.contextMenuItem, pressed && styles.contextMenuItemPressed]}
                  onPress={() => {
                    const categoryId = showContextMenu?.categoryId;
                    const categoryName = showContextMenu?.categoryName;
                    console.log('[Schedule] Rename pressed, categoryId:', categoryId);
                    setShowContextMenu(null);
                    if (categoryId && categoryName) {
                      setTimeout(() => {
                        setRenameValue(categoryName);
                        setShowRenameModal({ id: categoryId, name: categoryName });
                      }, 100);
                    }
                  }}
                >
                  <Pencil size={18} color="#D97706" />
                  <Text style={styles.contextMenuText}>Rename</Text>
                </Pressable>
                <View style={styles.contextMenuDivider} />
                <Pressable
                  style={({ pressed }) => [styles.contextMenuItem, pressed && styles.contextMenuItemPressed]}
                  onPress={() => {
                    const categoryId = showContextMenu?.categoryId;
                    console.log('[Schedule] Delete pressed, categoryId:', categoryId);
                    setShowContextMenu(null);
                    if (categoryId) {
                      setTimeout(() => handleDeleteMainCategory(categoryId), 100);
                    }
                  }}
                >
                  <Trash2 size={18} color="#EF4444" />
                  <Text style={[styles.contextMenuText, { color: '#EF4444' }]}>Delete</Text>
                </Pressable>
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Add Sub-Phase Modal */}
      <Modal
        visible={!!showAddSubPhaseModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowAddSubPhaseModal(null);
          setNewSubPhaseName('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.subPhaseModalContent}>
            <View style={styles.subPhaseModalHeader}>
              <Text style={styles.subPhaseModalTitle}>Add Sub-Phase</Text>
              <TouchableOpacity onPress={() => {
                setShowAddSubPhaseModal(null);
                setNewSubPhaseName('');
              }}>
                <X size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>
            <View style={styles.subPhaseModalBody}>
              <Text style={styles.label}>Sub-Phase Name</Text>
              <TextInput
                style={styles.oneLineInput}
                value={newSubPhaseName}
                onChangeText={setNewSubPhaseName}
                placeholder="e.g., Excavation, Demolition, Staking..."
                placeholderTextColor="#9CA3AF"
                autoFocus
              />
            </View>
            <View style={styles.subPhaseModalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddSubPhaseModal(null);
                  setNewSubPhaseName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, !newSubPhaseName.trim() && { opacity: 0.5 }]}
                onPress={() => showAddSubPhaseModal && handleAddSubPhase(showAddSubPhaseModal)}
                disabled={!newSubPhaseName.trim()}
              >
                <Text style={styles.saveButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rename Sub-Phase Modal */}
      <Modal
        visible={!!showRenameModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowRenameModal(null);
          setRenameValue('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.subPhaseModalContent}>
            <View style={styles.subPhaseModalHeader}>
              <Text style={styles.subPhaseModalTitle}>{showRenameModal?.id.startsWith('custom-main-') ? 'Rename Category' : 'Rename Sub-Phase'}</Text>
              <TouchableOpacity onPress={() => {
                setShowRenameModal(null);
                setRenameValue('');
              }}>
                <X size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>
            <View style={styles.subPhaseModalBody}>
              <Text style={styles.label}>New Name</Text>
              <TextInput
                style={styles.oneLineInput}
                value={renameValue}
                onChangeText={setRenameValue}
                placeholder="Enter new name..."
                placeholderTextColor="#9CA3AF"
                autoFocus
              />
            </View>
            <View style={styles.subPhaseModalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowRenameModal(null);
                  setRenameValue('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, !renameValue.trim() && { opacity: 0.5 }]}
                onPress={() => showRenameModal && handleRenamePhase(showRenameModal.id)}
                disabled={!renameValue.trim()}
              >
                <Text style={styles.saveButtonText}>Rename</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Main Category Modal */}
      <Modal
        visible={!!showAddMainCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowAddMainCategoryModal(null);
          setNewMainCategoryName('');
          setNewMainCategoryColor('#2563EB');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.subPhaseModalContent}>
            <View style={styles.subPhaseModalHeader}>
              <Text style={styles.subPhaseModalTitle}>Insert Main Category</Text>
              <TouchableOpacity onPress={() => {
                setShowAddMainCategoryModal(null);
                setNewMainCategoryName('');
                setNewMainCategoryColor('#2563EB');
              }}>
                <X size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>
            <View style={styles.subPhaseModalBody}>
              <Text style={styles.label}>Category Name</Text>
              <TextInput
                style={styles.oneLineInput}
                value={newMainCategoryName}
                onChangeText={setNewMainCategoryName}
                placeholder="e.g., Landscaping, Safety, Cleanup..."
                placeholderTextColor="#9CA3AF"
                autoFocus
              />
              <Text style={[styles.label, { marginTop: 16 }]}>Color</Text>
              <View style={styles.colorPickerRow}>
                {MAIN_CATEGORY_COLORS.map(color => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorPickerItem,
                      { backgroundColor: color },
                      newMainCategoryColor === color && styles.colorPickerItemActive,
                    ]}
                    onPress={() => setNewMainCategoryColor(color)}
                  >
                    {newMainCategoryColor === color && <Check size={14} color="#FFFFFF" />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.subPhaseModalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddMainCategoryModal(null);
                  setNewMainCategoryName('');
                  setNewMainCategoryColor('#2563EB');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, !newMainCategoryName.trim() && { opacity: 0.5 }]}
                onPress={handleAddMainCategory}
                disabled={!newMainCategoryName.trim()}
              >
                <Text style={styles.saveButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Share Schedule Modal */}
      <Modal
        visible={showShareModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.shareModalContent}>
            <View style={styles.shareModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <View style={styles.shareModalIconBg}>
                  <Share2 size={20} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.shareModalTitle}>Share Schedule</Text>
                  <Text style={styles.shareModalSubtitle} numberOfLines={1}>
                    {projects.find(p => p.id === selectedProject)?.name ?? 'Selected Project'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => { setShowShareModal(false); setShareLinkCopied(false); }}
                style={{ padding: 4 }}
              >
                <X size={22} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.shareModalBody} showsVerticalScrollIndicator={false}>
              {(() => {
                const existingLink = selectedProject ? getShareLinkByProject(selectedProject) : undefined;
                const isActive = existingLink?.enabled && (!existingLink?.expiresAt || new Date(existingLink.expiresAt) > new Date());
                const baseUrl = Platform.OS === 'web' ? window.location.origin : 'https://app.example.com';
                const fullUrl = existingLink ? `${baseUrl}/schedule-view/${existingLink.token}` : '';

                return (
                  <>
                    <View style={styles.shareProjectBadge}>
                      <View style={[styles.shareProjectDot, { backgroundColor: '#1E3A5F' }]} />
                      <Text style={styles.shareProjectBadgeText} numberOfLines={1}>
                        {projects.find(p => p.id === selectedProject)?.name ?? 'Unknown Project'}
                      </Text>
                    </View>

                    {existingLink && isActive ? (
                      <View style={styles.shareLinkActiveCard}>
                        <View style={styles.shareLinkStatusRow}>
                          <View style={styles.shareLinkStatusDot} />
                          <Text style={styles.shareLinkStatusText}>Link Active</Text>
                          {existingLink.password && (
                            <View style={styles.shareLinkPasswordBadge}>
                              <Lock size={10} color="#7C3AED" />
                              <Text style={styles.shareLinkPasswordBadgeText}>Password</Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.shareLinkUrlBox}>
                          <Link size={14} color="#64748B" />
                          <Text style={styles.shareLinkUrlText} numberOfLines={1} ellipsizeMode="middle">
                            {fullUrl}
                          </Text>
                        </View>

                        <View style={styles.shareLinkActions}>
                          <TouchableOpacity
                            style={[styles.shareLinkActionBtn, shareLinkCopied && styles.shareLinkActionBtnSuccess]}
                            onPress={async () => {
                              await Clipboard.setStringAsync(fullUrl);
                              setShareLinkCopied(true);
                              setTimeout(() => setShareLinkCopied(false), 2000);
                              console.log('[ShareLink] Copied to clipboard');
                            }}
                          >
                            {shareLinkCopied ? (
                              <Check size={14} color="#FFFFFF" />
                            ) : (
                              <Copy size={14} color="#7C3AED" />
                            )}
                            <Text style={[styles.shareLinkActionText, shareLinkCopied && { color: '#FFFFFF' }]}>
                              {shareLinkCopied ? 'Copied!' : 'Copy Link'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.shareLinkActionBtnOutline}
                            onPress={async () => {
                              if (!selectedProject) return;
                              await regenerateShareLink(selectedProject, sharePassword || undefined, shareExpiry || undefined);
                              setShareLinkCopied(false);
                              console.log('[ShareLink] Regenerated');
                            }}
                          >
                            <RefreshCw size={14} color="#64748B" />
                            <Text style={styles.shareLinkActionTextOutline}>Regenerate</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.shareLinkDisableBtn}
                            onPress={async () => {
                              const tokenToDisable = existingLink?.token;
                              if (!tokenToDisable) return;
                              const doDisable = async () => {
                                const ok = await disableShareLink(tokenToDisable);
                                if (!ok) {
                                  if (Platform.OS === 'web') {
                                    (window as any).alert('Failed to disable the link. Please try again.');
                                  } else {
                                    Alert.alert('Error', 'Failed to disable the link. Please try again.');
                                  }
                                }
                              };
                              if (Platform.OS === 'web') {
                                if ((window as any).confirm('Disable this share link? Anyone using it will lose access.')) {
                                  doDisable();
                                }
                              } else {
                                Alert.alert(
                                  'Disable Link',
                                  'This will revoke access for anyone using this link. Continue?',
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    { text: 'Disable', style: 'destructive', onPress: doDisable },
                                  ]
                                );
                              }
                            }}
                          >
                            <ShieldOff size={14} color="#EF4444" />
                            <Text style={styles.shareLinkDisableText}>Disable</Text>
                          </TouchableOpacity>
                        </View>

                        {existingLink.expiresAt && (
                          <Text style={styles.shareLinkExpiryText}>
                            Expires: {new Date(existingLink.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <View style={styles.shareNoLinkCard}>
                        <Link size={24} color="#CBD5E1" />
                        <Text style={styles.shareNoLinkText}>No active share link</Text>
                        <Text style={styles.shareNoLinkSubtext}>Generate a link to share the schedule with your client</Text>
                      </View>
                    )}

                    <View style={styles.shareOptionsDivider} />

                    <Text style={styles.shareOptionsTitle}>Link Settings</Text>

                    <View style={styles.shareOptionRow}>
                      <Lock size={16} color="#64748B" />
                      <Text style={styles.shareOptionLabel}>Password (optional)</Text>
                    </View>
                    <TextInput
                      style={styles.shareOptionInput}
                      value={sharePassword}
                      onChangeText={setSharePassword}
                      placeholder="Leave empty for no password"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry
                    />

                    <View style={styles.shareOptionRow}>
                      <Calendar size={16} color="#64748B" />
                      <Text style={styles.shareOptionLabel}>Expiration date (optional)</Text>
                    </View>
                    <TextInput
                      style={styles.shareOptionInput}
                      value={shareExpiry}
                      onChangeText={setShareExpiry}
                      placeholder="YYYY-MM-DD or leave empty"
                      placeholderTextColor="#9CA3AF"
                    />
                  </>
                );
              })()}
            </ScrollView>

            <View style={styles.shareModalFooter}>
              <TouchableOpacity
                style={styles.shareModalCancelBtn}
                onPress={() => { setShowShareModal(false); setShareLinkCopied(false); }}
              >
                <Text style={styles.shareModalCancelText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shareModalGenerateBtn}
                onPress={async () => {
                  if (!selectedProject) return;
                  const expiry = shareExpiry.trim() || undefined;
                  const pass = sharePassword.trim() || undefined;
                  await generateShareLink(selectedProject, pass, expiry);
                  setShareLinkCopied(false);
                  console.log('[ShareLink] Generated new link');
                }}
              >
                <Link size={16} color="#FFFFFF" />
                <Text style={styles.shareModalGenerateText}>Generate New Link</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Hover tooltip — web only */}
      {Platform.OS === 'web' && hoveredTask && tooltipPos && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: tooltipPos.x + 16,
            top: Math.max(8, tooltipPos.y - 110),
            backgroundColor: '#FFFFFF',
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.14,
            shadowRadius: 14,
            zIndex: 99999,
            minWidth: 190,
            maxWidth: 300,
            borderWidth: 1,
            borderColor: '#E5E7EB',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: hoveredTask.color }} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827', flexShrink: 1 }}>{hoveredTask.category}</Text>
          </View>
          <Text style={{ fontSize: 11, color: '#6B7280', marginBottom: 2 }}>
            {formatDate(new Date(hoveredTask.startDate))} → {(() => {
              const d = new Date(hoveredTask.startDate);
              // duration - 1: show inclusive last day, not exclusive end
              d.setDate(d.getDate() + hoveredTask.duration - 1);
              return formatDate(d);
            })()} · {hoveredTask.duration}d
          </Text>
          <Text style={{ fontSize: 11, color: '#6B7280' }}>
            {hoveredTask.workType === 'subcontractor' ? '👷 Subcontractor' : '🏠 In-House'}
            {hoveredTask.completed ? '  ✓ Completed' : ''}
          </Text>
          {hoveredTask.notes ? (
            <Text style={{ fontSize: 11, color: '#374151', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F3F4F6' }} numberOfLines={3}>
              {hoveredTask.notes}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#1E3A5F',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F0F9FF',
  },
  headerBtnLog: {
    backgroundColor: '#EFF6FF',
  },
  headerBtnText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#0EA5E9',
  },
  historyBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
  },
  projectSelector: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  projectChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
  },
  projectChipActive: {
    backgroundColor: '#1E3A5F',
  },
  projectChipText: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: '#475569',
  },
  projectChipTextActive: {
    color: '#FFFFFF',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: '#FFFFFF',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  instructionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  instrDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  instructionText: {
    flex: 1,
    fontSize: 12,
    color: '#78350F',
  },
  ganttArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  dateHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  cornerCell: {
    width: SIDEBAR_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 5,
    borderRightWidth: 1,
    borderRightColor: '#CBD5E1',
    backgroundColor: '#F1F5F9',
  },
  cornerText: {
    fontSize: 8,
    fontWeight: '700' as const,
    color: '#64748B',
    letterSpacing: 1,
  },
  dateHeaderScroll: {
    flex: 1,
  },
  dateHeaderContent: {
    flexDirection: 'row',
  },
  dateCell: {
    width: DAY_WIDTH,
    paddingVertical: 5,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  dateCellToday: {
    backgroundColor: '#DBEAFE',
  },
  dateCellText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#334155',
  },
  dateCellTextToday: {
    color: '#1D4ED8',
    fontWeight: '700' as const,
  },
  dateCellDay: {
    fontSize: 8,
    color: '#94A3B8',
    marginTop: 1,
  },
  dateCellDayToday: {
    color: '#3B82F6',
    fontWeight: '600' as const,
  },
  ganttBody: {
    flex: 1,
  },
  ganttBodyRow: {
    flexDirection: 'row',
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    borderRightWidth: 1,
    borderRightColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  sidebarItem: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2E8F0',
  },
  sidebarItemActive: {
    backgroundColor: '#FEF3C7',
  },
  sidebarItemEven: {
    backgroundColor: '#FFFFFF',
  },
  sidebarItemOdd: {
    backgroundColor: '#F8FAFC',
  },
  sidebarStripe: {
    width: 3,
    height: '100%' as const,
    marginRight: 4,
  },
  sidebarContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    overflow: 'hidden' as const,
  },
  sidebarContentSubPhase: {
    paddingLeft: 14,
  },
  sidebarLabel: {
    fontSize: 10,
    fontWeight: '500' as const,
    color: '#475569',
    flex: 1,
  },
  sidebarLabelActive: {
    fontWeight: '700' as const,
    color: '#78350F',
  },
  sidebarLabelHasTask: {
    fontWeight: '600' as const,
    color: '#1E293B',
  },
  gridScroll: {
    flex: 1,
  },
  gridContent: {
    position: 'relative',
  },
  gridRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_HEIGHT,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2E8F0',
  },
  gridRowEven: {
    backgroundColor: '#FFFFFF',
  },
  gridRowOdd: {
    backgroundColor: '#FAFBFC',
  },
  gridRowHighlight: {
    backgroundColor: '#FFFBEB',
  },
  todayColumn: {
    position: 'absolute',
    top: 0,
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    zIndex: 1,
  },
  gridColLine: {
    position: 'absolute',
    top: 0,
    width: 1,
    backgroundColor: '#F1F5F9',
  },
  taskBar: {
    position: 'absolute',
    borderRadius: BAR_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
  },
  taskBarResizing: {
    opacity: 0.85,
    shadowOpacity: 0.3,
  },
  taskBarBody: {
    flex: 1,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  taskBarContent: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 1,
  },
  taskBarContentNarrow: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingHorizontal: 1,
  },
  taskBarLine1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  taskBarText: {
    fontSize: 8,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    flexShrink: 1,
  },
  taskBarWorkBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  taskBarWorkBadgeNarrow: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
    marginTop: 1,
  },
  taskBarTextNarrow: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center' as const,
    lineHeight: 11,
  },
  taskBarWorkBadgeSub: {
    backgroundColor: 'rgba(255,200,50,0.35)',
  },
  taskBarWorkText: {
    fontSize: 6,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  taskBarNote: {
    fontSize: 7,
    fontWeight: '400' as const,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 14,
  },
  taskBarDuration: {
    fontSize: 7,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.75)',
    marginLeft: 2,
  },
  resizeHandle: {
    width: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    zIndex: 20,
  },
  resizeHandleLeft: {
    // flex item — no absolute positioning
  },
  resizeHandleRight: {
    // flex item — no absolute positioning
  },
  resizeHandleTouching: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderRadius: 4,
  },
  resizeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.25)',
  },
  taskDeleteBtn: {
    position: 'absolute',
    top: -8,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  editModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '70%',
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  editModalDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  editModalBody: {
    padding: 16,
  },
  editLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginBottom: 4,
    marginTop: 12,
  },
  editDateText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500' as const,
  },
  editInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#1F2937',
  },
  workTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  workTypeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  workTypeChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  workTypeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  workTypeTextActive: {
    color: '#2563EB',
  },
  editTextarea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#1F2937',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  editModalFooter: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  editDeleteBtn: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCancelText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#4B5563',
  },
  editSaveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#10B981',
  },
  editSaveText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
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
  addTaskSection: {
    marginBottom: 16,
  },
  taskOptionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    marginBottom: 16,
  },
  dueDateSection: {
    flex: 1,
  },
  smallLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginBottom: 6,
  },
  dateInputContainer: {
    position: 'relative',
  },
  dateInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    paddingRight: 44,
    fontSize: 14,
    color: '#1F2937',
  },
  calendarIconButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    padding: 4,
    backgroundColor: '#E0F2FE',
    borderRadius: 6,
  },
  calendarIconButtonActive: {
    backgroundColor: '#0EA5E9',
  },
  reminderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  reminderLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#92400E',
  },
  addTaskButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#0EA5E9',
    borderRadius: 8,
  },
  addTaskButtonLargeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  tasksListSection: {
    marginBottom: 16,
  },
  emptyTasksState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTasksText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginTop: 12,
  },
  emptyTasksSubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  tasksList: {
    gap: 12,
  },
  dailyTaskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dailyTaskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  taskCheckboxLarge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#0EA5E9',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  taskCheckboxLargeCompleted: {
    backgroundColor: '#0EA5E9',
  },
  taskInfoSection: {
    flex: 1,
  },
  taskTitleText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 6,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  taskDueDateText: {
    fontSize: 12,
    color: '#6B7280',
  },
  reminderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  reminderBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#F59E0B',
  },
  deleteTaskIconButton: {
    padding: 4,
  },
  closeButtonFull: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
  },
  closeButtonFullText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  tasksListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  toggleHistoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  toggleHistoryText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  taskCreatedText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  taskCompletedText: {
    fontSize: 11,
    color: '#10B981',
    marginTop: 2,
    fontWeight: '600' as const,
  },
  completedSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  completedSectionTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  completedTaskCard: {
    backgroundColor: '#F9FAFB',
    borderColor: '#D1D5DB',
    opacity: 0.8,
  },
  inlineDatePickerContainer: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inlineDatePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  inlineDatePickerTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  inlineDatePickerCloseButton: {
    padding: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  inlineDatePickerDoneButton: {
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: '#0EA5E9',
    borderRadius: 8,
    alignItems: 'center',
  },
  inlineDatePickerDoneText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  zoomControls: {
    position: 'absolute' as const,
    bottom: 12,
    right: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 50,
  },
  zoomBtn: {
    width: Platform.OS === 'ios' ? 36 : 28,
    height: Platform.OS === 'ios' ? 36 : 28,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  zoomBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#475569',
    lineHeight: 20,
  },
  zoomIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 48,
    alignItems: 'center' as const,
  },
  zoomIndicatorText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#334155',
  },
  sidebarItemIndented: {
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 2,
    borderLeftColor: '#CBD5E1',
  },
  sidebarLabelSubPhase: {
    fontSize: 9,
    fontWeight: '400' as const,
    color: '#64748B',
  },
  expandIndicator: {
    marginLeft: 1,
    marginRight: 3,
    padding: 2,
  },
  subPhaseMenuBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  subPhaseMenuBtnText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#9CA3AF',
    lineHeight: 14,
  },
  contextMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  contextMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    minWidth: 220,
    paddingVertical: 6,
    overflow: 'hidden' as const,
  },
  contextMenuCentered: {
  },
  contextMenuTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#6B7280',
    paddingHorizontal: 16,
    paddingVertical: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  contextMenuItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  contextMenuItemPressed: {
    backgroundColor: '#F3F4F6',
  },
  contextMenuDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 0,
  },
  contextMenuText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#1F2937',
  },
  mainPhaseMenuBtn: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 1,
  },
  subPhaseModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  subPhaseModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  subPhaseModalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  subPhaseModalBody: {
    padding: 20,
  },
  subPhaseModalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  colorPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  colorPickerItem: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorPickerItemActive: {
    borderColor: '#1F2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  shareBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: '#F3E8FF',
  },
  exportPdfBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  clientVisibleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  clientVisibleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  clientVisibleLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#334155',
  },
  clientVisibleHint: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  shareModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  shareModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  shareModalIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareModalTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#1E293B',
  },
  shareModalSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  shareModalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  shareProjectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  shareProjectDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  shareProjectBadgeText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#1E3A5F',
    flex: 1,
  },
  shareLinkActiveCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  shareLinkStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  shareLinkStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  shareLinkStatusText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#16A34A',
    flex: 1,
  },
  shareLinkPasswordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  shareLinkPasswordBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#7C3AED',
  },
  shareLinkUrlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  shareLinkUrlText: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  shareLinkActions: {
    flexDirection: 'row',
    gap: 8,
  },
  shareLinkActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#EDE9FE',
    borderRadius: 8,
    paddingVertical: 10,
  },
  shareLinkActionBtnSuccess: {
    backgroundColor: '#22C55E',
  },
  shareLinkActionText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#7C3AED',
  },
  shareLinkActionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shareLinkActionTextOutline: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#64748B',
  },
  shareLinkDisableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  shareLinkDisableText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#EF4444',
  },
  shareLinkExpiryText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 10,
  },
  shareNoLinkCard: {
    alignItems: 'center',
    paddingVertical: 28,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  shareNoLinkText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#475569',
    marginTop: 10,
  },
  shareNoLinkSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 3,
  },
  shareOptionsDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 16,
  },
  shareOptionsTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#334155',
    marginBottom: 12,
  },
  shareOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  shareOptionLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#475569',
  },
  shareOptionInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E293B',
    marginBottom: 14,
  },
  shareModalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  shareModalCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  shareModalCancelText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#64748B',
  },
  shareModalGenerateBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    borderRadius: 10,
    paddingVertical: 13,
  },
  shareModalGenerateText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  completionSection: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden' as const,
  },
  completionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#F8FAFC',
  },
  completionToggleActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  completionCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#FFFFFF',
  },
  completionCheckboxActive: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  completionLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#475569',
  },
  completionLabelActive: {
    color: '#15803D',
  },
  completionDateDisplay: {
    fontSize: 11,
    color: '#16A34A',
    marginTop: 2,
    fontWeight: '500' as const,
  },
  completionDateRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FAFFFE',
  },
  completionDateLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#475569',
    marginBottom: 6,
  },
  completionDateInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1E293B',
  },
  taskBarCompletedDate: {
    color: '#15803D',
    fontWeight: '700' as const,
    marginLeft: 2,
  },
});

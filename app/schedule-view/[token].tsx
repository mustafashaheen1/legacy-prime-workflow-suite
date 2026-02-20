import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useMemo, useEffect } from 'react';
import { ScheduledTask } from '@/types';
import {
  Calendar,
  Lock,
  Shield,
  AlertTriangle,
  FileText,
  Shovel,
  Mountain,
  Home,
  Droplets,
  Hammer,
  Triangle,
  DoorOpen,
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
  ChevronDown,
  ChevronRight,
  Eye,
  CircleCheck,
} from 'lucide-react-native';

const getApiBaseUrl = (): string => {
  const rorkApi = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  if (rorkApi) return rorkApi;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:8081';
};

interface ShareLinkData {
  id: string;
  projectId: string;
  companyId: string;
  token: string;
  enabled: boolean;
  password?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

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

const SIDEBAR_WIDTH = 150;
const ROW_HEIGHT = 44;
const BAR_HEIGHT = 32;
const DAY_WIDTH = 72;

interface PhaseStructure {
  id: string;
  name: string;
  color: string;
  icon: any;
  isSubPhase: boolean;
  parentId?: string;
}

export default function ScheduleViewScreen() {
  const { token } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [shareLink, setShareLink] = useState<ShareLinkData | null>(null);
  const [projectTasks, setProjectTasks] = useState<ScheduledTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [linkNotFound, setLinkNotFound] = useState(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<boolean>(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [hoveredTask, setHoveredTask] = useState<ScheduledTask | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!token) { setLinkNotFound(true); setIsLoading(false); return; }
    const base = getApiBaseUrl();
    (async () => {
      try {
        const linkRes = await fetch(`${base}/api/get-schedule-share-link?token=${encodeURIComponent(token as string)}`);
        if (!linkRes.ok) { setLinkNotFound(true); setIsLoading(false); return; }
        const linkData = await linkRes.json();
        const link: ShareLinkData = linkData.link;
        setShareLink(link);
        if (link?.enabled) {
          const tasksRes = await fetch(`${base}/api/get-scheduled-tasks?projectId=${link.projectId}`);
          if (tasksRes.ok) {
            const tasksData = await tasksRes.json();
            // Show all tasks — visibleToClient only controls whether notes are shown
            setProjectTasks(tasksData.scheduledTasks ?? []);
          }
        }
      } catch (e) {
        console.error('[ScheduleView] fetch error', e);
        setLinkNotFound(true);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [token]);

  const isExpired = useMemo(() => {
    if (!shareLink?.expiresAt) return false;
    return new Date(shareLink.expiresAt) < new Date();
  }, [shareLink]);

  const needsPassword = useMemo(() => {
    return !!shareLink?.password && !authenticated;
  }, [shareLink, authenticated]);

  const allPhases = useMemo(() => {
    const phases: PhaseStructure[] = [];
    const taskCategories = new Set(projectTasks.map(t => t.category));

    CONSTRUCTION_CATEGORIES.forEach((cat, idx) => {
      const mainId = `main-${idx}`;
      const subPhaseNames = PREDEFINED_SUB_PHASES[cat.name] || [];
      const hasScheduledMain = taskCategories.has(cat.name);
      const hasScheduledSub = subPhaseNames.some(sp => taskCategories.has(sp));

      if (hasScheduledMain || hasScheduledSub) {
        phases.push({
          id: mainId,
          name: cat.name,
          color: cat.color,
          icon: cat.icon,
          isSubPhase: false,
        });

        if (expandedCategories.has(mainId) && hasScheduledSub) {
          subPhaseNames.forEach((sp, si) => {
            if (taskCategories.has(sp)) {
              phases.push({
                id: `predefined-${idx}-${si}`,
                name: sp,
                color: cat.color,
                icon: cat.icon,
                isSubPhase: true,
                parentId: mainId,
              });
            }
          });
        }
      }
    });

    projectTasks.forEach(task => {
      if (!phases.find(p => p.name === task.category)) {
        phases.push({
          id: `custom-${task.id}`,
          name: task.category,
          color: task.color,
          icon: Layers,
          isSubPhase: false,
        });
      }
    });

    return phases;
  }, [projectTasks, expandedCategories]);

  const dates = useMemo(() => {
    if (projectTasks.length === 0) {
      const result: Date[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        result.push(d);
      }
      return result;
    }

    let minDate = new Date();
    let maxDate = new Date();
    projectTasks.forEach(t => {
      const s = new Date(t.startDate);
      const e = new Date(t.endDate);
      if (s < minDate) minDate = new Date(s);
      if (e > maxDate) maxDate = new Date(e);
    });

    minDate.setDate(minDate.getDate() - 3);
    maxDate.setDate(maxDate.getDate() + 7);
    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(0, 0, 0, 0);

    const result: Date[] = [];
    const cur = new Date(minDate);
    while (cur <= maxDate) {
      result.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }, [projectTasks]);

  const GRID_WIDTH = dates.length * DAY_WIDTH;
  const GRID_HEIGHT = allPhases.length * ROW_HEIGHT;

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

  const getTaskPosition = (task: ScheduledTask) => {
    const taskStartDate = new Date(task.startDate);
    taskStartDate.setHours(0, 0, 0, 0);
    const startIdx = dates.findIndex(d => {
      const dc = new Date(d);
      dc.setHours(0, 0, 0, 0);
      return dc.getTime() === taskStartDate.getTime();
    });
    if (startIdx === -1) return null;
    const rowIdx = allPhases.findIndex(p => p.name === task.category);
    if (rowIdx === -1) return null;
    return {
      left: startIdx * DAY_WIDTH + 2,
      width: Math.max(task.duration * DAY_WIDTH - 4, DAY_WIDTH - 4),
      top: rowIdx * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2,
      height: BAR_HEIGHT,
    };
  };

  const handlePasswordSubmit = () => {
    if (passwordInput === shareLink?.password) {
      setAuthenticated(true);
      setPasswordError(false);
      console.log('[ClientView] Password authenticated');
    } else {
      setPasswordError(true);
    }
  };

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <View style={[s.container, s.errorContainer, { paddingTop: insets.top }]}>
        <Text style={[s.errorSubtitle, { marginTop: 0 }]}>Loading schedule…</Text>
      </View>
    );
  }

  if (linkNotFound || !shareLink || !shareLink.enabled) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.errorContainer}>
          <View style={s.errorIconBg}>
            <AlertTriangle size={32} color="#DC2626" />
          </View>
          <Text style={s.errorTitle}>Link Unavailable</Text>
          <Text style={s.errorSubtitle}>
            This schedule link has been disabled or does not exist.
          </Text>
        </View>
      </View>
    );
  }

  if (isExpired) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.errorContainer}>
          <View style={[s.errorIconBg, { backgroundColor: '#FEF3C7' }]}>
            <Calendar size={32} color="#D97706" />
          </View>
          <Text style={s.errorTitle}>Link Expired</Text>
          <Text style={s.errorSubtitle}>
            This schedule link has expired. Please request a new link from the project manager.
          </Text>
        </View>
      </View>
    );
  }

  if (needsPassword) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.passwordContainer}>
          <View style={s.passwordIconBg}>
            <Lock size={28} color="#1E3A5F" />
          </View>
          <Text style={s.passwordTitle}>Protected Schedule</Text>
          <Text style={s.passwordSubtitle}>
            Enter the password to view the project schedule.
          </Text>
          <TextInput
            style={[s.passwordInput, passwordError && s.passwordInputError]}
            value={passwordInput}
            onChangeText={(t) => { setPasswordInput(t); setPasswordError(false); }}
            placeholder="Enter password"
            placeholderTextColor="#94A3B8"
            secureTextEntry
            autoFocus
            onSubmitEditing={handlePasswordSubmit}
          />
          {passwordError && (
            <Text style={s.passwordErrorText}>Incorrect password. Please try again.</Text>
          )}
          <TouchableOpacity style={s.passwordBtn} onPress={handlePasswordSubmit}>
            <Text style={s.passwordBtnText}>View Schedule</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.clientHeader}>
        <View style={s.clientHeaderLeft}>
          <View style={s.clientLogoBg}>
            <Calendar size={18} color="#FFFFFF" />
          </View>
          <View>
            <Text style={s.clientProjectName} numberOfLines={1}>
              Project Schedule
            </Text>
          </View>
        </View>
        <View style={s.clientBadge}>
          <Eye size={12} color="#059669" />
          <Text style={s.clientBadgeText}>View Only</Text>
        </View>
      </View>

      {projectTasks.length === 0 ? (
        <View style={s.emptyState}>
          <Calendar size={48} color="#CBD5E1" />
          <Text style={s.emptyTitle}>No Schedule Yet</Text>
          <Text style={s.emptySubtitle}>
            The project schedule has not been set up yet. Check back later.
          </Text>
        </View>
      ) : (
        <View style={s.ganttArea}>
          <View style={s.dateHeaderRow}>
            <View style={s.cornerCell}>
              <Text style={s.cornerText}>PHASE</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.dateHeaderScroll}
            >
              <View style={s.dateHeaderContent}>
                {dates.map((date, i) => (
                  <View key={i} style={[s.dateCell, { width: DAY_WIDTH }, isToday(date) && s.dateCellToday]}>
                    <Text style={[s.dateCellText, isToday(date) && s.dateCellTextToday]}>
                      {formatDate(date)}
                    </Text>
                    <Text style={[s.dateCellDay, isToday(date) && s.dateCellDayToday]}>
                      {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>

          <ScrollView style={s.ganttBody} showsVerticalScrollIndicator>
            <View style={s.ganttBodyRow}>
              <View style={s.sidebar}>
                {allPhases.map((phase, i) => {
                  const subPhaseNames = phase.isSubPhase ? [] : (PREDEFINED_SUB_PHASES[phase.name] || []);
                  const taskCats = new Set(projectTasks.map(t => t.category));
                  const hasExpandableSubs = !phase.isSubPhase && subPhaseNames.some(sp => taskCats.has(sp));
                  const isExpanded = expandedCategories.has(phase.id);
                  const IconComponent = phase.icon;

                  return (
                    <TouchableOpacity
                      key={phase.id}
                      style={[
                        s.sidebarItem,
                        { height: ROW_HEIGHT },
                        i % 2 === 0 ? s.sidebarItemEven : s.sidebarItemOdd,
                        phase.isSubPhase && s.sidebarItemIndented,
                      ]}
                      onPress={() => hasExpandableSubs && toggleCategory(phase.id)}
                      activeOpacity={hasExpandableSubs ? 0.7 : 1}
                    >
                      <View style={[s.sidebarStripe, { backgroundColor: phase.color }]} />
                      {!phase.isSubPhase && hasExpandableSubs && (
                        <View style={s.expandIndicator}>
                          {isExpanded ? (
                            <ChevronDown size={12} color="#64748B" />
                          ) : (
                            <ChevronRight size={12} color="#64748B" />
                          )}
                        </View>
                      )}
                      {!phase.isSubPhase && !hasExpandableSubs && <View style={{ width: 16 }} />}
                      <View style={[s.sidebarContent, phase.isSubPhase && s.sidebarContentSub]}>
                        <IconComponent size={phase.isSubPhase ? 10 : 13} color={phase.color} />
                        <Text
                          style={[s.sidebarLabel, phase.isSubPhase && s.sidebarLabelSub]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {phase.name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator
                style={s.gridScroll}
              >
                <View style={[s.gridContent, { width: GRID_WIDTH, height: GRID_HEIGHT }]}>
                  {allPhases.map((phase, rowIdx) => (
                    <View
                      key={`row-${rowIdx}`}
                      style={[
                        s.gridRow,
                        { top: rowIdx * ROW_HEIGHT, height: ROW_HEIGHT },
                        rowIdx % 2 === 0 ? s.gridRowEven : s.gridRowOdd,
                      ]}
                    />
                  ))}

                  {dates.map((date, colIdx) =>
                    isToday(date) ? (
                      <View
                        key={`today-${colIdx}`}
                        style={[s.todayColumn, { left: colIdx * DAY_WIDTH, height: GRID_HEIGHT }]}
                      />
                    ) : null
                  )}

                  {dates.map((_, colIdx) => (
                    <View
                      key={`col-${colIdx}`}
                      style={[s.gridColLine, { left: (colIdx + 1) * DAY_WIDTH, height: GRID_HEIGHT }]}
                    />
                  ))}

                  {projectTasks.map(task => {
                    const pos = getTaskPosition(task);
                    if (!pos) return null;

                    const phase = allPhases.find(p => p.name === task.category);
                    const IconComp = phase?.icon;
                    const isNarrow = task.duration <= 1;
                    const isCompleted = task.completed === true;

                    return (
                      <View
                        key={task.id}
                        style={[
                          s.taskBar,
                          {
                            left: pos.left,
                            top: pos.top,
                            width: pos.width,
                            height: pos.height,
                            backgroundColor: isCompleted ? '#16A34A' : task.color,
                            borderRadius: BAR_HEIGHT / 2,
                          },
                        ]}
                        {...(Platform.OS === 'web' ? {
                          onMouseEnter: (e: any) => { setHoveredTask(task); setTooltipPos({ x: e.clientX, y: e.clientY }); },
                          onMouseMove: (e: any) => { setTooltipPos({ x: e.clientX, y: e.clientY }); },
                          onMouseLeave: () => { setHoveredTask(null); setTooltipPos(null); },
                        } : {})}
                      >
                        <View style={s.taskBarBody}>
                          {isNarrow ? (
                            <View style={s.taskBarContentNarrow}>
                              {isCompleted && <CircleCheck size={9} color="#FFFFFF" />}
                              <Text style={s.taskBarTextNarrow} numberOfLines={2}>
                                {task.category}
                              </Text>
                            </View>
                          ) : (
                            <View style={s.taskBarContentWide}>
                              <View style={s.taskBarLine1}>
                                {isCompleted ? (
                                  <CircleCheck size={11} color="rgba(255,255,255,0.9)" />
                                ) : IconComp ? (
                                  <IconComp size={11} color="rgba(255,255,255,0.9)" />
                                ) : null}
                                <Text style={s.taskBarText} numberOfLines={1}>{task.category}</Text>
                                {isCompleted && task.completedAt && (
                                  <Text style={s.taskBarCompletedLabel}>
                                    Done {new Date(task.completedAt + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </Text>
                                )}
                                {!isCompleted && task.duration > 1 && (
                                  <Text style={s.taskBarDuration}>{task.duration}d</Text>
                                )}
                              </View>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      )}

      <View style={[s.clientFooter, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <Shield size={12} color="#94A3B8" />
        <Text style={s.footerText}>
          Read-only view · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </Text>
      </View>

      {Platform.OS === 'web' && hoveredTask && tooltipPos && (
        <View
          pointerEvents="none"
          style={[
            {
              position: 'absolute' as const,
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
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: hoveredTask.color }} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827', flexShrink: 1 }}>
              {hoveredTask.category}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: '#6B7280', marginBottom: 2 }}>
            {formatDate(new Date(hoveredTask.startDate))} → {(() => {
              const d = new Date(hoveredTask.startDate);
              d.setDate(d.getDate() + hoveredTask.duration - 1);
              return formatDate(d);
            })()} · {hoveredTask.duration}d
          </Text>
          <Text style={{ fontSize: 11, color: '#6B7280' }}>
            {hoveredTask.workType === 'subcontractor' ? '👷 Subcontractor' : '🏠 In-House'}
            {hoveredTask.completed ? '  ✓ Completed' : ''}
          </Text>
          {hoveredTask.notes && hoveredTask.visibleToClient !== false ? (
            <Text
              style={{
                fontSize: 11,
                color: '#374151',
                marginTop: 6,
                paddingTop: 6,
                borderTopWidth: 1,
                borderTopColor: '#F3F4F6',
              }}
            >
              {hoveredTask.notes}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#1E293B',
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center' as const,
    lineHeight: 22,
    maxWidth: 300,
  },
  passwordContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  passwordIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  passwordTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#1E293B',
    marginBottom: 6,
  },
  passwordSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center' as const,
    marginBottom: 24,
    maxWidth: 280,
  },
  passwordInput: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1E293B',
    textAlign: 'center' as const,
  },
  passwordInputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  passwordErrorText: {
    fontSize: 13,
    color: '#EF4444',
    marginTop: 8,
  },
  passwordBtn: {
    marginTop: 20,
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 14,
  },
  passwordBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  clientHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  clientLogoBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1E3A5F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientProjectName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1E293B',
  },
  clientCompanyName: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  clientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  clientBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#059669',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#334155',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center' as const,
    marginTop: 6,
    maxWidth: 260,
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
    fontSize: 9,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2E8F0',
  },
  sidebarItemEven: {
    backgroundColor: '#FFFFFF',
  },
  sidebarItemOdd: {
    backgroundColor: '#F8FAFC',
  },
  sidebarItemIndented: {
    paddingLeft: 4,
  },
  sidebarStripe: {
    width: 3,
    height: '100%' as const,
    marginRight: 4,
  },
  expandIndicator: {
    width: 16,
    alignItems: 'center',
  },
  sidebarContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    overflow: 'hidden' as const,
  },
  sidebarContentSub: {
    paddingLeft: 14,
  },
  sidebarLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#334155',
    flex: 1,
  },
  sidebarLabelSub: {
    fontWeight: '500' as const,
    color: '#64748B',
    fontSize: 9,
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
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2E8F0',
  },
  gridRowEven: {
    backgroundColor: '#FFFFFF',
  },
  gridRowOdd: {
    backgroundColor: '#FAFBFC',
  },
  todayColumn: {
    position: 'absolute',
    top: 0,
    width: DAY_WIDTH,
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
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 10,
  },
  taskBarBody: {
    flex: 1,
    paddingHorizontal: 8,
    justifyContent: 'center',
    height: '100%' as const,
  },
  taskBarContentNarrow: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingHorizontal: 1,
  },
  taskBarTextNarrow: {
    fontSize: 8,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center' as const,
    lineHeight: 10,
  },
  taskBarWorkBadgeNarrow: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
    marginTop: 1,
  },
  taskBarContentWide: {
    flex: 1,
    justifyContent: 'center',
    gap: 1,
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
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 14,
  },
  taskBarDuration: {
    fontSize: 7,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.75)',
    marginLeft: 2,
  },
  taskBarCompletedLabel: {
    fontSize: 7,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.85)',
    marginLeft: 3,
  },
  clientFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 11,
    color: '#94A3B8',
  },
});

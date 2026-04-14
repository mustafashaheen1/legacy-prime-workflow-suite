import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SkeletonBox from '@/components/SkeletonBox';
import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import ClockInOutComponent from '@/components/ClockInOutComponent';
import { ArrowLeft, Briefcase, ChevronDown, Clock } from 'lucide-react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';

const isWeb = Platform.OS === 'web';

const OFFICE_ROLES = [
  'Project Manager',
  'Bookkeeper',
  'Accountant',
  'Sales',
  'Marketing',
  'Office Assistant',
  'Receptionist',
  'Project Coordinator',
];

export default function ClockScreen() {
  const { projects, user, setUser, isLoading, isCompanyReloading, clockEntries } = useApp();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedOfficeRole, setSelectedOfficeRole] = useState<string | null>(null);
  const params = useLocalSearchParams();

  // Re-sync hourlyRate from DB every time this tab is opened
  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      supabase
        .from('users')
        .select('hourly_rate, rate_change_request')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (!data) return;
          setUser({
            ...user,
            hourlyRate: data.hourly_rate != null ? Number(data.hourly_rate) : undefined,
            rateChangeRequest: data.rate_change_request ?? undefined,
          });
        });
    }, [user?.id])
  );

  useEffect(() => {
    if (params.projectId && typeof params.projectId === 'string') {
      setSelectedProjectId(params.projectId);
    }
  }, [params.projectId]);

  const activeProjects = projects.filter(p => p.status === 'active');
  const selectedProject = selectedProjectId ? projects.find(p => p.id === selectedProjectId) : null;

  // Check if user already has an open clock entry (any type)
  const activeEntry = clockEntries.find(e => e.employeeId === user?.id && !e.clockOut);

  // If user is already clocked in and hasn't manually selected something,
  // auto-route them to the clock-out screen for their active entry
  const autoProjectId = !selectedProjectId && !selectedOfficeRole && activeEntry?.projectId ? activeEntry.projectId : null;
  const autoOfficeRole = !selectedProjectId && !selectedOfficeRole && activeEntry?.officeRole ? activeEntry.officeRole : null;

  const effectiveProjectId = selectedProjectId || autoProjectId;
  const effectiveOfficeRole = selectedOfficeRole || autoOfficeRole;
  const effectiveProject = effectiveProjectId ? projects.find(p => p.id === effectiveProjectId) : null;

  // ─── Project/Role Selection Screen ───────────────────────────────────────────
  if (!effectiveProject && !effectiveOfficeRole) {
    const mobileContent = (
      <>

        <View style={styles.employeeCard}>
          <Text style={styles.cardLabel}>Employee</Text>
          <Text style={styles.cardValue}>{user?.name || 'Unknown Employee'}</Text>
        </View>

        {/* Active Projects */}
        <View style={styles.projectListCard}>
          <Text style={styles.projectListTitle}>Active Projects</Text>
          {(isLoading || isCompanyReloading) && activeProjects.length === 0 ? (
            [0, 1, 2, 3].map(i => (
              <View key={i} style={{ padding: 14, marginBottom: 8, backgroundColor: '#F3F4F6', borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <SkeletonBox width="60%" height={15} borderRadius={4} />
                <SkeletonBox width={20} height={20} borderRadius={4} />
              </View>
            ))
          ) : activeProjects.length > 0 ? (
            activeProjects.map((project) => (
              <TouchableOpacity
                key={project.id}
                style={styles.projectItem}
                onPress={() => setSelectedProjectId(project.id)}
              >
                <View style={styles.projectInfo}>
                  <Text style={styles.projectName}>{project.name}</Text>
                </View>
                <View style={{ transform: [{ rotate: '-90deg' }] }}>
                  <ChevronDown size={20} color="#6B7280" />
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.noProjectsText}>No active projects available</Text>
          )}
        </View>

        {/* Office / Business Operations */}
        <View style={styles.projectListCard}>
          <View style={styles.officeSectionHeader}>
            <View style={styles.officeIconWrap}>
              <Briefcase size={16} color="#2563EB" />
            </View>
            <View>
              <Text style={styles.projectListTitle}>Office / Business Operations</Text>
              <Text style={styles.officeSectionSubtitle}>Clock in as office staff</Text>
            </View>
          </View>
          {OFFICE_ROLES.map((role) => (
            <TouchableOpacity
              key={role}
              style={styles.projectItem}
              onPress={() => setSelectedOfficeRole(role)}
            >
              <View style={styles.projectInfo}>
                <Text style={styles.projectName}>{role}</Text>
              </View>
              <View style={{ transform: [{ rotate: '-90deg' }] }}>
                <ChevronDown size={20} color="#6B7280" />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </>
    );

    const webContent = (
      <View style={styles.webLayout}>
        {/* Left sidebar */}
        <View style={styles.webSidebar}>
          <View style={styles.sidebarCard}>
            <Text style={styles.sidebarSectionLabel}>Logged In As</Text>
            <Text style={styles.sidebarEmployeeName}>{user?.name || 'Unknown Employee'}</Text>
            <View style={styles.sidebarDivider} />
            <Text style={styles.sidebarHint}>Select a project or office role to begin tracking your time.</Text>
          </View>
        </View>

        {/* Right: lists */}
        <View style={styles.webMain}>
          <View style={styles.projectListCard}>
            <Text style={styles.projectListTitle}>Active Projects</Text>
            {activeProjects.map((project) => (
              <TouchableOpacity
                key={project.id}
                style={[styles.projectItem, styles.projectItemWeb]}
                onPress={() => setSelectedProjectId(project.id)}
              >
                <Text style={styles.projectName}>{project.name}</Text>
                <View style={{ transform: [{ rotate: '-90deg' }] }}>
                  <ChevronDown size={20} color="#6B7280" />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.projectListCard}>
            <View style={styles.officeSectionHeader}>
              <View style={styles.officeIconWrap}>
                <Briefcase size={16} color="#2563EB" />
              </View>
              <View>
                <Text style={styles.projectListTitle}>Office / Business Operations</Text>
                <Text style={styles.officeSectionSubtitle}>Clock in as office staff</Text>
              </View>
            </View>
            {OFFICE_ROLES.map((role) => (
              <TouchableOpacity
                key={role}
                style={[styles.projectItem, styles.projectItemWeb]}
                onPress={() => setSelectedOfficeRole(role)}
              >
                <Text style={styles.projectName}>{role}</Text>
                <View style={{ transform: [{ rotate: '-90deg' }] }}>
                  <ChevronDown size={20} color="#6B7280" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );

    return (
      <View style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={isWeb ? styles.scrollContentWeb : undefined} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">
          <View style={isWeb ? styles.webWrapper : undefined}>
            <View style={[styles.header, isWeb && styles.headerWeb]}>
              <View style={styles.headerTop}>
                <View style={styles.headerTitleRow}>
                  {isWeb && <Clock size={22} color="#2563EB" style={{ marginRight: 10 }} />}
                  <View>
                    <Text style={[styles.title, isWeb && styles.titleWeb]}>Clock In/Out</Text>
                    <Text style={styles.subtitle}>Select a project or office role</Text>
                  </View>
                </View>
              </View>
            </View>
            {isWeb ? webContent : mobileContent}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─── Clock In/Out Screen ─────────────────────────────────────────────────────
  const contextLabel = effectiveOfficeRole ?? effectiveProject?.name ?? '';
  const onChangeSelection = () => {
    setSelectedProjectId(null);
    setSelectedOfficeRole(null);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={isWeb ? styles.scrollContentWeb : undefined} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">
        <View style={isWeb ? styles.webWrapper : undefined}>
          <View style={[styles.header, isWeb && styles.headerWeb]}>
            {isWeb ? (
              <View style={styles.headerTop}>
                <TouchableOpacity onPress={onChangeSelection} style={styles.backBtn}>
                  <ArrowLeft size={20} color="#2563EB" />
                </TouchableOpacity>
                <View style={styles.headerTitleRow}>
                  <Clock size={22} color="#2563EB" style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, styles.titleWeb]}>Clock In/Out</Text>
                    <Text style={styles.subtitle} numberOfLines={1}>{contextLabel}</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.headerTop}>
                <TouchableOpacity onPress={onChangeSelection} style={styles.backBtn}>
                  <ArrowLeft size={22} color="#2563EB" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>Clock In/Out</Text>
                  <Text style={styles.subtitle} numberOfLines={2}>{contextLabel}</Text>
                </View>
              </View>
            )}
          </View>

          {isWeb ? (
            <View style={styles.webLayout}>
              <View style={styles.webSidebar}>
                <View style={styles.sidebarCard}>
                  <Text style={styles.sidebarSectionLabel}>Employee</Text>
                  <Text style={styles.sidebarEmployeeName}>{user?.name || 'Unknown'}</Text>
                  <View style={styles.sidebarDivider} />
                  <Text style={styles.sidebarSectionLabel}>{effectiveOfficeRole ? 'Office Role' : 'Project'}</Text>
                  <Text style={styles.sidebarProjectName}>{contextLabel}</Text>
                </View>
              </View>
              <View style={styles.webMain}>
                <ClockInOutComponent
                  projectId={effectiveProject?.id}
                  projectName={effectiveProject?.name}
                  officeRole={effectiveOfficeRole ?? undefined}
                />
              </View>
            </View>
          ) : (
            <View style={styles.clockContent}>
              <ClockInOutComponent
                projectId={selectedProject?.id}
                projectName={selectedProject?.name}
                officeRole={selectedOfficeRole ?? undefined}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  scrollView: { flex: 1 },
  scrollContentWeb: { flexGrow: 1 },
  webWrapper: { maxWidth: 1100, width: '100%', alignSelf: 'center' },
  headerWeb: { borderRadius: 0, marginBottom: 0 },
  titleWeb: { fontSize: 22 },
  webLayout: { flexDirection: 'row', gap: 24, padding: 24, alignItems: 'flex-start' },
  webSidebar: { width: 240, flexShrink: 0 },
  webMain: { flex: 1, minWidth: 0 },
  sidebarCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  sidebarSectionLabel: { fontSize: 11, fontWeight: '600' as const, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4 },
  sidebarEmployeeName: { fontSize: 18, fontWeight: '700' as const, color: '#1F2937', marginBottom: 16 },
  sidebarProjectName: { fontSize: 15, fontWeight: '600' as const, color: '#1F2937' },
  sidebarDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  sidebarHint: { fontSize: 13, color: '#6B7280', lineHeight: 20 },
  header: { padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  title: { fontSize: 24, fontWeight: '700' as const, color: '#1F2937', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6B7280' },
  backBtn: { padding: 8, marginRight: 8, borderRadius: 8, backgroundColor: '#EFF6FF' },
  employeeCard: { backgroundColor: '#FFFFFF', margin: 16, padding: 20, borderRadius: 12 },
  cardLabel: { fontSize: 14, fontWeight: '600' as const, color: '#6B7280', marginBottom: 8 },
  cardValue: { fontSize: 18, fontWeight: '600' as const, color: '#1F2937' },
  projectListCard: { backgroundColor: '#FFFFFF', marginHorizontal: 16, marginBottom: 16, padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  projectListTitle: { fontSize: 18, fontWeight: '700' as const, color: '#1F2937', marginBottom: 4 },
  projectItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  projectItemWeb: { paddingVertical: 14, cursor: 'pointer' as any },
  projectInfo: { flex: 1 },
  projectName: { fontSize: 16, fontWeight: '600' as const, color: '#1F2937' },
  noProjectsText: { fontSize: 14, color: '#9CA3AF', fontStyle: 'italic' as const, textAlign: 'center' as const, paddingVertical: 20 },
  clockContent: { padding: 16 },
  officeSectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  officeIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  officeSectionSubtitle: { fontSize: 13, color: '#6B7280' },
  conflictBanner: { backgroundColor: '#FEF2F2', borderRadius: 10, padding: 14, marginHorizontal: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#EF4444' },
  conflictText: { fontSize: 13, color: '#991B1B', lineHeight: 20 },
});

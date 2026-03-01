import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import ClockInOutComponent from '@/components/ClockInOutComponent';
import { ChevronDown, Clock } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';

const isWeb = Platform.OS === 'web';

export default function ClockScreen() {
  const { projects, user } = useApp();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const params = useLocalSearchParams();

  useEffect(() => {
    if (params.projectId && typeof params.projectId === 'string') {
      setSelectedProjectId(params.projectId);
    }
  }, [params.projectId]);

  const activeProjects = projects.filter(p => p.status !== 'archived');
  const selectedProject = selectedProjectId ? projects.find(p => p.id === selectedProjectId) : null;

  // ─── Project Selection Screen ────────────────────────────────────────────────
  if (!selectedProject) {
    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={isWeb ? styles.scrollContentWeb : undefined}
          showsVerticalScrollIndicator={false}
        >
          <View style={isWeb ? styles.webWrapper : undefined}>
            {/* Page header */}
            <View style={[styles.header, isWeb && styles.headerWeb]}>
              <View style={styles.headerTop}>
                <View style={styles.headerTitleRow}>
                  {isWeb && <Clock size={22} color="#2563EB" style={{ marginRight: 10 }} />}
                  <View>
                    <Text style={[styles.title, isWeb && styles.titleWeb]}>Clock In/Out</Text>
                    <Text style={styles.subtitle}>Select a project to start tracking time</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Web: side-by-side, Mobile: stacked */}
            {isWeb ? (
              <View style={styles.webLayout}>
                {/* Left sidebar */}
                <View style={styles.webSidebar}>
                  <View style={styles.sidebarCard}>
                    <Text style={styles.sidebarSectionLabel}>Logged In As</Text>
                    <Text style={styles.sidebarEmployeeName}>{user?.name || 'Unknown Employee'}</Text>
                    <View style={styles.sidebarDivider} />
                    <Text style={styles.sidebarHint}>
                      Select a project on the right to begin tracking your time.
                    </Text>
                  </View>
                </View>

                {/* Right: project list */}
                <View style={styles.webMain}>
                  <View style={styles.projectListCard}>
                    <Text style={styles.projectListTitle}>Active Projects</Text>
                    {activeProjects.length > 0 ? (
                      activeProjects.map((project) => (
                        <TouchableOpacity
                          key={project.id}
                          style={[styles.projectItem, isWeb && styles.projectItemWeb]}
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
                </View>
              </View>
            ) : (
              <>
                <View style={styles.employeeCard}>
                  <Text style={styles.cardLabel}>Employee</Text>
                  <Text style={styles.cardValue}>{user?.name || 'Unknown Employee'}</Text>
                </View>

                <View style={styles.projectListCard}>
                  <Text style={styles.projectListTitle}>Active Projects</Text>
                  {activeProjects.length > 0 ? (
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
              </>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─── Clock In/Out Screen ─────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={isWeb ? styles.scrollContentWeb : undefined}
        showsVerticalScrollIndicator={false}
      >
        <View style={isWeb ? styles.webWrapper : undefined}>
          {/* Page header */}
          <View style={[styles.header, isWeb && styles.headerWeb]}>
            <View style={styles.headerTop}>
              <View style={styles.headerTitleRow}>
                {isWeb && <Clock size={22} color="#2563EB" style={{ marginRight: 10 }} />}
                <View>
                  <Text style={[styles.title, isWeb && styles.titleWeb]}>Clock In/Out</Text>
                  <Text style={styles.subtitle}>{selectedProject.name}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.changeProjectButton}
                onPress={() => setSelectedProjectId(null)}
              >
                <Text style={styles.changeProjectText}>Change Project</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Web: 2-column layout, Mobile: stacked */}
          {isWeb ? (
            <View style={styles.webLayout}>
              {/* Left sidebar: context info */}
              <View style={styles.webSidebar}>
                <View style={styles.sidebarCard}>
                  <Text style={styles.sidebarSectionLabel}>Employee</Text>
                  <Text style={styles.sidebarEmployeeName}>{user?.name || 'Unknown'}</Text>
                  <View style={styles.sidebarDivider} />
                  <Text style={styles.sidebarSectionLabel}>Project</Text>
                  <Text style={styles.sidebarProjectName}>{selectedProject.name}</Text>
                </View>
              </View>

              {/* Right: clock component */}
              <View style={styles.webMain}>
                <ClockInOutComponent
                  projectId={selectedProject.id}
                  projectName={selectedProject.name}
                />
              </View>
            </View>
          ) : (
            <View style={styles.clockContent}>
              <ClockInOutComponent
                projectId={selectedProject.id}
                projectName={selectedProject.name}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollView: {
    flex: 1,
  },
  // ─── Web-specific layout ────────────────────────────────────────────────────
  scrollContentWeb: {
    flexGrow: 1,
  },
  webWrapper: {
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
  headerWeb: {
    borderRadius: 0,
    marginBottom: 0,
  },
  titleWeb: {
    fontSize: 22,
  },
  webLayout: {
    flexDirection: 'row',
    gap: 24,
    padding: 24,
    alignItems: 'flex-start',
  },
  webSidebar: {
    width: 240,
    flexShrink: 0,
  },
  webMain: {
    flex: 1,
    minWidth: 0,
  },
  sidebarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sidebarSectionLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sidebarEmployeeName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 16,
  },
  sidebarProjectName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  sidebarHint: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
  },
  // ─── Shared / Mobile styles ─────────────────────────────────────────────────
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  changeProjectButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
  },
  changeProjectText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  employeeCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  projectListCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  projectListTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 16,
  },
  projectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  projectItemWeb: {
    paddingVertical: 14,
    cursor: 'pointer' as any,
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  noProjectsText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic' as const,
    textAlign: 'center',
    paddingVertical: 20,
  },
  clockContent: {
    padding: 16,
  },
});

import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import ClockInOutComponent from '@/components/ClockInOutComponent';
import { ChevronDown } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';

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

  if (!selectedProject) {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Clock In/Out</Text>
            <Text style={styles.subtitle}>Select a project to start tracking time</Text>
          </View>

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
                  <ChevronDown size={20} color="#6B7280" style={{ transform: [{ rotate: '-90deg' }] }} />
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.noProjectsText}>No active projects available</Text>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.title}>Clock In/Out</Text>
              <Text style={styles.subtitle}>{selectedProject.name}</Text>
            </View>
            <TouchableOpacity
              style={styles.changeProjectButton}
              onPress={() => {
                setSelectedProjectId(null);
              }}
            >
              <Text style={styles.changeProjectText}>Change Project</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.clockContent}>
          <ClockInOutComponent projectId={selectedProject.id} projectName={selectedProject.name} />
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
  projectInfo: {
    flex: 1,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  projectBudget: {
    fontSize: 14,
    color: '#6B7280',
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

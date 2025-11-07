import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { MessageSquare, Plus, Clock, Trash2, X } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AIChatSession } from '@/types';
import GlobalAIChat from './GlobalAIChat';

interface ChatHistoryWrapperProps {
  currentPageContext?: string;
  inline?: boolean;
}

const STORAGE_KEY = 'ai_chat_sessions';

export default function ChatHistoryWrapper({ currentPageContext, inline = false }: ChatHistoryWrapperProps) {
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [sessions, setSessions] = useState<AIChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState<number>(0);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSessions(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error('[ChatHistory] Error loading sessions:', error);
    }
  };

  const saveSessions = async (updatedSessions: AIChatSession[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions));
      setSessions(updatedSessions);
    } catch (error) {
      console.error('[ChatHistory] Error saving sessions:', error);
    }
  };

  const createNewSession = () => {
    const newSession: AIChatSession = {
      id: `session-${Date.now()}`,
      title: `Chat ${sessions.length + 1}`,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [newSession, ...sessions];
    saveSessions(updated);
    setCurrentSessionId(newSession.id);
    setShowHistory(false);
    setChatKey(prev => prev + 1);
  };

  const loadSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setShowHistory(false);
    setChatKey(prev => prev + 1);
  };

  const deleteSession = async (sessionId: string) => {
    const updated = sessions.filter(s => s.id !== sessionId);
    await saveSessions(updated);
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setChatKey(prev => prev + 1);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  if (inline) {
    return (
      <View style={styles.container}>
        <View style={styles.historyHeader}>
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => setShowHistory(true)}
          >
            <Clock size={20} color="#6B7280" />
            <Text style={styles.historyButtonText}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.newChatButton}
            onPress={createNewSession}
          >
            <Plus size={20} color="#2563EB" />
            <Text style={styles.newChatButtonText}>New Chat</Text>
          </TouchableOpacity>
        </View>
        
        <GlobalAIChat key={chatKey} currentPageContext={currentPageContext} inline={inline} />

        <Modal
          visible={showHistory}
          animationType="slide"
          transparent
          onRequestClose={() => setShowHistory(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.historyModal}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <MessageSquare size={24} color="#2563EB" />
                  <Text style={styles.modalTitle}>Chat History</Text>
                </View>
                <TouchableOpacity onPress={() => setShowHistory(false)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.sessionsList}>
                {sessions.length === 0 ? (
                  <View style={styles.emptyState}>
                    <MessageSquare size={48} color="#D1D5DB" />
                    <Text style={styles.emptyStateText}>No chat history yet</Text>
                    <Text style={styles.emptyStateSubtext}>
                      Start a conversation to see it here
                    </Text>
                  </View>
                ) : (
                  sessions.map((session) => (
                    <View key={session.id} style={styles.sessionItem}>
                      <TouchableOpacity
                        style={[
                          styles.sessionContent,
                          currentSessionId === session.id && styles.sessionContentActive,
                        ]}
                        onPress={() => loadSession(session.id)}
                      >
                        <View style={styles.sessionInfo}>
                          <Text style={styles.sessionTitle}>{session.title}</Text>
                          <Text style={styles.sessionDate}>{formatDate(session.updatedAt)}</Text>
                        </View>
                        <Text style={styles.sessionMessageCount}>
                          {session.messages.length} messages
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => deleteSession(session.id)}
                      >
                        <Trash2 size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.createNewButton}
                  onPress={() => {
                    createNewSession();
                    setShowHistory(false);
                  }}
                >
                  <Plus size={20} color="#FFFFFF" />
                  <Text style={styles.createNewButtonText}>Start New Chat</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={styles.historyFloatingButton}
        onPress={() => setShowHistory(true)}
      >
        <Clock size={22} color="#FFFFFF" />
      </TouchableOpacity>

      <GlobalAIChat key={chatKey} currentPageContext={currentPageContext} inline={inline} />

      <Modal
        visible={showHistory}
        animationType="slide"
        transparent
        onRequestClose={() => setShowHistory(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.historyModal}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <MessageSquare size={24} color="#2563EB" />
                <Text style={styles.modalTitle}>Chat History</Text>
              </View>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sessionsList}>
              {sessions.length === 0 ? (
                <View style={styles.emptyState}>
                  <MessageSquare size={48} color="#D1D5DB" />
                  <Text style={styles.emptyStateText}>No chat history yet</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Start a conversation to see it here
                  </Text>
                </View>
              ) : (
                sessions.map((session) => (
                  <View key={session.id} style={styles.sessionItem}>
                    <TouchableOpacity
                      style={[
                        styles.sessionContent,
                        currentSessionId === session.id && styles.sessionContentActive,
                      ]}
                      onPress={() => loadSession(session.id)}
                    >
                      <View style={styles.sessionInfo}>
                        <Text style={styles.sessionTitle}>{session.title}</Text>
                        <Text style={styles.sessionDate}>{formatDate(session.updatedAt)}</Text>
                      </View>
                      <Text style={styles.sessionMessageCount}>
                        {session.messages.length} messages
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => deleteSession(session.id)}
                    >
                      <Trash2 size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.createNewButton}
                onPress={() => {
                  createNewSession();
                  setShowHistory(false);
                }}
              >
                <Plus size={20} color="#FFFFFF" />
                <Text style={styles.createNewButtonText}>Start New Chat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  newChatButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  historyFloatingButton: {
    position: 'absolute' as const,
    bottom: 160,
    left: 16,
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 997,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  historyModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '70%',
    maxHeight: 600,
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
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  sessionsList: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sessionContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  sessionContentActive: {
    backgroundColor: '#EFF6FF',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  sessionDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  sessionMessageCount: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  createNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#2563EB',
  },
  createNewButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});

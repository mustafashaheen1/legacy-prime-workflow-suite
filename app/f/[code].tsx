import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform, Linking } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Download, FileText, AlertCircle, Clock } from 'lucide-react-native';

interface FileInfo {
  fileName: string;
  fileType: string;
  fileSize: number;
  s3Url: string;
  expiresAt: string;
  viewCount: number;
}

export default function FileDownloadPage() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);

  useEffect(() => {
    if (!code) {
      setError('Invalid link');
      setLoading(false);
      return;
    }

    fetchFileInfo();
  }, [code]);

  const fetchFileInfo = async () => {
    try {
      const baseUrl = Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : process.env.EXPO_PUBLIC_API_URL || '';

      const response = await fetch(`${baseUrl}/api/resolve-file-link?code=${code}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load file');
      }

      setFileInfo(data);
    } catch (err: any) {
      console.error('[FileDownload] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!fileInfo?.s3Url) return;

    try {
      if (Platform.OS === 'web') {
        // Open in new tab for web
        window.open(fileInfo.s3Url, '_blank');
      } else {
        // Open with system handler for mobile
        await Linking.openURL(fileInfo.s3Url);
      }
    } catch (err) {
      console.error('[Download] Error:', err);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Loading File...' }} />
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading file...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Error' }} />
        <AlertCircle size={64} color="#EF4444" />
        <Text style={styles.errorTitle}>Unable to Load File</Text>
        <Text style={styles.errorText}>{error}</Text>
        {error.includes('expired') && (
          <Text style={styles.errorHint}>
            This link has expired. Please request a new link from the sender.
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Download File' }} />

      <View style={styles.iconContainer}>
        <FileText size={64} color="#2563EB" />
      </View>

      <Text style={styles.title}>File Ready for Download</Text>

      <View style={styles.fileInfoCard}>
        <Text style={styles.fileName}>{fileInfo?.fileName}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Size:</Text>
          <Text style={styles.metaValue}>
            {fileInfo?.fileSize ? formatFileSize(fileInfo.fileSize) : 'Unknown'}
          </Text>
        </View>

        {fileInfo?.fileType && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Type:</Text>
            <Text style={styles.metaValue}>{fileInfo.fileType}</Text>
          </View>
        )}

        {fileInfo?.expiresAt && (
          <View style={styles.expiryContainer}>
            <Clock size={16} color="#F59E0B" />
            <Text style={styles.expiryText}>
              Link expires: {formatDate(fileInfo.expiresAt)}
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
        <Download size={20} color="#FFFFFF" />
        <Text style={styles.downloadButtonText}>Download File</Text>
      </TouchableOpacity>

      <Text style={styles.viewCountText}>
        This file has been viewed {fileInfo?.viewCount || 0} time{fileInfo?.viewCount !== 1 ? 's' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F9FAFB',
  },
  iconContainer: {
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center' as const,
  },
  errorHint: {
    marginTop: 12,
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center' as const,
    fontStyle: 'italic' as const,
  },
  title: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: '#1F2937',
    textAlign: 'center' as const,
    marginBottom: 24,
  },
  fileInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fileName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1F2937',
    textAlign: 'center' as const,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  metaLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500' as const,
  },
  metaValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600' as const,
  },
  expiryContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  expiryText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '500' as const,
  },
  downloadButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: '#2563EB',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  viewCountText: {
    marginTop: 16,
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center' as const,
  },
});

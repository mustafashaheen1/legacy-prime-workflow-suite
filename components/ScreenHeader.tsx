import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  rightComponent?: React.ReactNode;
  showBackButton?: boolean;
}

export default function ScreenHeader({
  title,
  onBack,
  rightComponent,
  showBackButton = true
}: ScreenHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      // Fallback to dashboard if no history
      router.replace('/(tabs)/dashboard');
    }
  };

  return (
    <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 8 }]}>
      <View style={styles.headerContent}>
        {showBackButton && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color="#1F2937" />
          </TouchableOpacity>
        )}
        <Text style={[styles.headerTitle, !showBackButton && styles.headerTitleCentered]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.rightContainer}>
          {rightComponent}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 44,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  headerTitleCentered: {
    textAlign: 'center',
    marginLeft: 0,
  },
  rightContainer: {
    marginLeft: 8,
    minWidth: 40,
    alignItems: 'flex-end',
  },
});

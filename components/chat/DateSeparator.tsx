import { View, Text, StyleSheet } from 'react-native';

interface Props {
  label: string;
}

export function formatDateLabel(date: Date): string {
  const now = new Date();
  // Compare calendar dates (not exact time diff) for "Today" / "Yesterday"
  const todayStr = now.toDateString();
  const dateStr = date.toDateString();

  if (dateStr === todayStr) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dateStr === yesterday.toDateString()) return 'Yesterday';

  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'long' });

  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DateSeparator({ label }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <View style={styles.pill}>
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D1D5DB',
  },
  pill: {
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
});

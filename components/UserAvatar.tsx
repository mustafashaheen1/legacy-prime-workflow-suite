import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';

export default function UserAvatar() {
  const { user } = useApp();
  const router = useRouter();

  if (!user) {
    return null;
  }

  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handlePress = () => {
    router.push('/profile');
  };

  return (
    <TouchableOpacity style={styles.container} activeOpacity={0.8} onPress={handlePress}>
      {user.avatar ? (
        <Image
          source={{ uri: user.avatar }}
          style={styles.avatar}
          contentFit="cover"
        />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginLeft: 16,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1E40AF',
  },
  initials: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700' as const,
  },
});

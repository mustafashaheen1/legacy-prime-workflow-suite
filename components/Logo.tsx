import { Image, StyleSheet, View } from 'react-native';

interface LogoProps {
  size?: number;
  style?: any;
}

export default function Logo({ size = 120, style }: LogoProps) {
  return (
    <View style={[styles.container, style]}>
      <Image
        source={require('@/assets/images/logo.png')}
        style={[styles.logo, { width: size, height: size }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    // Size is set dynamically via props
  },
});

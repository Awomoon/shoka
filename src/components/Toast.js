import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import { spacing, type, radius } from '../theme';

export default function Toast({ message, onHide, duration = 2000, bottom = 120 }) {
  const { colors } = useTheme();

  useEffect(() => {
    const t = setTimeout(onHide, duration);
    return () => clearTimeout(t);
  }, [message, duration, onHide]);

  return (
    <Animated.View
      entering={FadeInUp.duration(180)}
      exiting={FadeOut.duration(180)}
      pointerEvents="none"
      style={[styles.toast, { backgroundColor: colors.toastBg, bottom }]}
    >
      <Text style={[styles.text, { color: colors.toastText }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    zIndex: 50,
    elevation: 6,
  },
  text: {
    fontSize: type.body,
    fontWeight: '600',
  },
});

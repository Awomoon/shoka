import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import { spacing, type, radius } from '../theme';

interface SuccessOverlayProps {
  message: string;
  onDone: () => void;
  duration?: number;
}

// The "ka-ching" moment: checkmark pops in, auto-dismisses after ~1.2s.
export default function SuccessOverlay({ message, onDone, duration = 1200 }: SuccessOverlayProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
  }, [duration, onDone]);

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(200)}
      style={[styles.backdrop, { backgroundColor: colors.overlay }]}
      pointerEvents="auto"
    >
      <Animated.View
        entering={reduceMotion ? FadeIn.duration(150) : ZoomIn.springify().damping(12)}
        style={styles.content}
      >
        <View style={[styles.circle, { backgroundColor: colors.primary }]}>
          <Text style={[styles.check, { color: colors.onPrimary }]}>✓</Text>
        </View>
        <Text style={[styles.message, { color: colors.overlayText }]}>{message}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 10,
  },
  content: {
    alignItems: 'center',
  },
  circle: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    fontSize: 48,
    fontWeight: '700',
    lineHeight: 56,
  },
  message: {
    marginTop: spacing.lg,
    fontSize: type.title,
    fontWeight: '700',
  },
});

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import { spacing, type, radius } from '../theme';

const EASE = Easing.out(Easing.cubic);

interface SuccessOverlayProps {
  message: string;
  onDone: () => void;
  duration?: number;
}

// The "ka-ching" moment: fades and settles from 0.95 to 1 in 200ms — smooth,
// no pop — holds, then the backdrop fades everything out in 150ms.
export default function SuccessOverlay({ message, onDone, duration = 1200 }: SuccessOverlayProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
  }, [duration, onDone]);

  // Driven by a shared value, not an entering animation, so opacity and
  // transform live on a node with no layout animation to fight.
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = reduceMotion ? 1 : withTiming(1, { duration: 200, easing: EASE });
  }, [progress, reduceMotion]);
  const contentStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.95 + 0.05 * progress.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      style={[styles.backdrop, { backgroundColor: colors.overlay }]}
      pointerEvents="auto"
    >
      <Animated.View style={[styles.content, contentStyle]}>
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

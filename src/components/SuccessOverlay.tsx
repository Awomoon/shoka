import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { spacing, type, touch, radius } from '../theme';
import PressableScale from './PressableScale';

const EASE = Easing.out(Easing.cubic);

interface SuccessOverlayProps {
  message: string;
  onDone: () => void;
  duration?: number;
  actionLabel?: string; // e.g. "Send receipt" — overlay stays up longer when present
  onAction?: () => void;
}

// The "ka-ching" moment: fades and settles from 0.95 to 1 in 200ms — smooth,
// no pop — holds, then the backdrop fades everything out in 150ms.
export default function SuccessOverlay({
  message,
  onDone,
  duration,
  actionLabel,
  onAction,
}: SuccessOverlayProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const holdFor = duration ?? (actionLabel ? 4000 : 1200);

  useEffect(() => {
    const t = setTimeout(onDone, holdFor);
    return () => clearTimeout(t);
  }, [holdFor, onDone]);

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
      {/* Tap anywhere to move on — the timeout below is only the fallback,
          so a queue never waits on the celebration. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />
      <Animated.View style={[styles.content, contentStyle]} pointerEvents="box-none">
        <View style={[styles.circle, { backgroundColor: colors.primary }]}>
          <Ionicons name="checkmark" size={52} color={colors.onPrimary} />
        </View>
        <Text style={[styles.message, { color: colors.overlayText }]}>{message}</Text>
        {actionLabel && onAction ? (
          <PressableScale
            onPress={() => {
              onAction();
              onDone();
            }}
            style={[styles.actionBtn, { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.actionText, { color: colors.onAccent }]}>{actionLabel}</Text>
          </PressableScale>
        ) : null}
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
  message: {
    marginTop: spacing.lg,
    fontSize: type.title,
    fontWeight: '700',
  },
  actionBtn: {
    marginTop: spacing.lg,
    minHeight: touch.minTarget,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: type.body,
    fontWeight: '800',
  },
});

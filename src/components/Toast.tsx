import React, { useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import { spacing, type, radius } from '../theme';
import PressableScale from './PressableScale';

interface ToastProps {
  message: string;
  onHide: () => void;
  duration?: number;
  bottom?: number;
  actionLabel?: string; // e.g. "Undo" — the toast lingers longer when present
  onAction?: () => void;
}

export default function Toast({ message, onHide, duration, bottom = 120, actionLabel, onAction }: ToastProps) {
  const { colors } = useTheme();
  const hideAfter = duration ?? (actionLabel ? 3500 : 2000);

  useEffect(() => {
    const t = setTimeout(onHide, hideAfter);
    return () => clearTimeout(t);
  }, [message, hideAfter, onHide]);

  return (
    <Animated.View
      entering={FadeInUp.duration(180)}
      exiting={FadeOut.duration(180)}
      pointerEvents={actionLabel ? 'box-none' : 'none'}
      style={[styles.toast, { backgroundColor: colors.toastBg, bottom }]}
    >
      <View style={styles.row}>
        <Text style={[styles.text, { color: colors.toastText }]}>{message}</Text>
        {actionLabel && onAction ? (
          <PressableScale
            hitSlop={8}
            onPress={() => {
              onAction();
              onHide();
            }}
          >
            <Text style={[styles.action, { color: colors.accent }]}>{actionLabel}</Text>
          </PressableScale>
        ) : null}
      </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  text: {
    fontSize: type.body,
    fontWeight: '600',
    flexShrink: 1,
  },
  action: {
    fontSize: type.body,
    fontWeight: '800',
  },
});

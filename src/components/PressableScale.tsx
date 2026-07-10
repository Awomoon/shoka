import React from 'react';
import { Pressable } from 'react-native';
import type { Insets } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';

const EASE = Easing.out(Easing.cubic);

// Style prop of Animated.View — accepts plain styles, animated styles, and
// nested arrays of either, which is exactly what callers pass in.
type AnimatedViewStyle = React.ComponentProps<typeof Animated.View>['style'];

interface PressableScaleProps {
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: AnimatedViewStyle;
  children?: React.ReactNode;
  scaleTo?: number;
  hitSlop?: number | Insets;
}

// Shared press feedback: smooth timing scale — 100ms down, 150ms back.
// No springs anywhere in the app; nothing overshoots or bounces.
export default function PressableScale({
  onPress,
  onLongPress,
  disabled,
  style,
  children,
  scaleTo = 0.97,
  hitSlop,
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => {
        if (!reduceMotion) scale.value = withTiming(scaleTo, { duration: 100, easing: EASE });
      }}
      onPressOut={() => {
        if (!reduceMotion) scale.value = withTiming(1, { duration: 150, easing: EASE });
      }}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

import React from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';

const SPRING = { damping: 20, stiffness: 400 };

// Shared press feedback: scales to 0.96 with a spring. Under 300ms, never blocks.
export default function PressableScale({
  onPress,
  onLongPress,
  disabled,
  style,
  children,
  scaleTo = 0.96,
  hitSlop,
}) {
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
        if (!reduceMotion) scale.value = withSpring(scaleTo, SPRING);
      }}
      onPressOut={() => {
        if (!reduceMotion) scale.value = withSpring(1, SPRING);
      }}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

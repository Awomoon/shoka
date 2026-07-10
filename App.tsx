import React, { useEffect, useRef } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { type } from './src/theme';
import SellScreen from './src/screens/SellScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import type { RootTabParamList } from './src/navigation/types';

SplashScreen.preventAutoHideAsync().catch(() => {});

const Tab = createBottomTabNavigator<RootTabParamList>();

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.tabIcon}>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      <View
        style={[
          styles.tabDot,
          { backgroundColor: focused ? colors.primary : 'transparent' },
        ]}
      />
    </View>
  );
}

function ThemedApp() {
  const { colors, resolved } = useTheme();
  const reduceMotion = useReducedMotion();

  // ~200ms cross-fade when the theme switches, so the change feels smooth.
  const opacity = useSharedValue(1);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (reduceMotion) return;
    opacity.value = 0.4;
    opacity.value = withTiming(1, { duration: 200 });
  }, [resolved, reduceMotion, opacity]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Keep the root window background in step (overscroll, keyboard gaps).
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  const base = resolved === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
  };

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: colors.background }, fadeStyle]}>
      <NavigationContainer theme={navTheme}>
        <BottomSheetModalProvider>
          <Tab.Navigator
            screenOptions={{
              // Screens render their own headers (ScreenHeader / GreetingHeader).
              headerShown: false,
              // Quick fade between tabs — slides feel slow when switching often.
              animation: reduceMotion ? 'none' : 'fade',
              transitionSpec: { animation: 'timing', config: { duration: 150 } },
              tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
              tabBarActiveTintColor: colors.primary,
              tabBarInactiveTintColor: colors.muted,
              tabBarLabelStyle: { fontSize: type.label, fontWeight: '600' },
              tabBarItemStyle: { paddingVertical: 4 },
            }}
          >
            <Tab.Screen
              name="Sell"
              component={SellScreen}
              options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🛒" focused={focused} /> }}
            />
            <Tab.Screen
              name="Stock"
              component={InventoryScreen}
              options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📦" focused={focused} /> }}
            />
            <Tab.Screen
              name="Reports"
              component={ReportsScreen}
              options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} /> }}
            />
          </Tab.Navigator>
        </BottomSheetModalProvider>
      </NavigationContainer>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
    </Animated.View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedApp />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  tabIcon: {
    alignItems: 'center',
  },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});

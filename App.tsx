import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { type } from './src/theme';
import SellScreen from './src/screens/SellScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import RecoveryScreen from './src/screens/RecoveryScreen';
import { getDb, getSetting } from './src/db/database';
import { installNotificationHandler } from './src/utils/notifications';
import type { RootTabParamList, RootStackParamList } from './src/navigation/types';

SplashScreen.preventAutoHideAsync().catch(() => {});
installNotificationHandler();

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

interface TabIconProps {
  name: keyof typeof Ionicons.glyphMap;
  focusedName: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string;
}

// Vector icons render crisply at any density and match the theme colors —
// emoji vary wildly across Android OEM fonts.
function TabIcon({ name, focusedName, focused, color }: TabIconProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.tabIcon}>
      <Ionicons name={focused ? focusedName : name} size={22} color={color} />
      <View
        style={[
          styles.tabDot,
          { backgroundColor: focused ? colors.primary : 'transparent' },
        ]}
      />
    </View>
  );
}

function Tabs() {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  return (
    <Tab.Navigator
      screenListeners={{
        // A tiny tick on tab change — the same feedback grammar as the cart.
        tabPress: () => {
          Haptics.selectionAsync().catch(() => {});
        },
      }}
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
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="cart-outline" focusedName="cart" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Stock"
        component={InventoryScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="cube-outline" focusedName="cube" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="stats-chart-outline" focusedName="stats-chart" focused={focused} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

type BootState = 'loading' | 'failed' | 'welcome' | 'ready';

// Opens the database before any screen renders: a failure shows the recovery
// screen instead of a white screen, and a first launch (no shop name, welcome
// never completed) gets the one-time welcome.
function BootGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BootState>('loading');

  const boot = useCallback(async () => {
    setState('loading');
    try {
      await getDb();
      const [welcomeDone, shopName] = await Promise.all([
        getSetting('welcomeDone'),
        getSetting('shopName'),
      ]);
      setState(welcomeDone === '1' || (shopName && shopName.length > 0) ? 'ready' : 'welcome');
    } catch (e) {
      setState('failed');
    }
  }, []);

  useEffect(() => {
    boot();
  }, [boot]);

  // The splash stays up until we know what to show.
  useEffect(() => {
    if (state !== 'loading') SplashScreen.hideAsync().catch(() => {});
  }, [state]);

  if (state === 'loading') return null;
  if (state === 'failed') return <RecoveryScreen onRetry={boot} onRecovered={boot} />;
  if (state === 'welcome') return <WelcomeScreen onDone={() => setState('ready')} />;
  return <>{children}</>;
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
    opacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
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
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Tabs" component={Tabs} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
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
          <BootGate>
            <ThemedApp />
          </BootGate>
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

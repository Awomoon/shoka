import type { NavigatorScreenParams } from '@react-navigation/native';

// Param list for the bottom-tab navigator. None of the tabs take params.
export type RootTabParamList = {
  Sell: undefined;
  Stock: undefined;
  Reports: undefined;
};

// Root stack: the tabs plus full-screen pages pushed over them.
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<RootTabParamList> | undefined;
  Settings: undefined;
};

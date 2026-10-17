import type { NavigatorScreenParams } from '@react-navigation/native';

// Param list for the bottom-tab navigator. Stock accepts an optional name to
// prefill the add-product sheet (used by the Sell screen's empty search).
export type RootTabParamList = {
  Sell: undefined;
  Stock: { prefillName?: string } | undefined;
  Reports: undefined;
};

// Root stack: the tabs plus full-screen pages pushed over them.
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<RootTabParamList> | undefined;
  Settings: undefined;
};

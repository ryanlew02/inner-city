import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";

import { HabitsProvider } from "../context/HabitsContext";
import { BuildingProvider } from "../context/BuildingContext";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(drawer)",
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <HabitsProvider>
      <BuildingProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(drawer)" />
          <Stack.Screen
            name="habit-form"
            options={{
              presentation: "modal",
              headerShown: false,
            }}
          />
        </Stack>
      </BuildingProvider>
    </HabitsProvider>
  );
}

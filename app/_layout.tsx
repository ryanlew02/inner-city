import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar } from "react-native";
import "react-native-reanimated";

import { HabitsProvider } from "../context/HabitsContext";
import { BuildingProvider } from "../context/BuildingContext";
import { ThemeProvider, useTheme } from "../context/ThemeContext";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(drawer)",
};

SplashScreen.preventAutoHideAsync();

function ThemedStatusBar() {
  const { theme } = useTheme();
  return (
    <StatusBar
      barStyle={theme === "dark" ? "light-content" : "dark-content"}
      backgroundColor="transparent"
      translucent
    />
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider>
      <HabitsProvider>
        <BuildingProvider>
          <ThemedStatusBar />
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
    </ThemeProvider>
  );
}

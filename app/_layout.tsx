import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar } from "react-native";
import "react-native-reanimated";

import { HabitsProvider, useHabits } from "../context/HabitsContext";
import { BuildingProvider, useBuildings } from "../context/BuildingContext";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { SoundProvider } from "../context/SoundContext";
import { LanguageProvider } from "../context/LanguageContext";

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

function AppContent() {
  const { loading: habitsLoading } = useHabits();
  const { loading: buildingLoading } = useBuildings();

  useEffect(() => {
    if (!habitsLoading && !buildingLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [habitsLoading, buildingLoading]);

  return (
    <>
      <ThemedStatusBar />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(drawer)" />
        <Stack.Screen
          name="habit-form"
          options={{
            presentation: "modal",
            headerShown: true,
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <SoundProvider>
          <HabitsProvider>
            <BuildingProvider>
              <AppContent />
            </BuildingProvider>
          </HabitsProvider>
        </SoundProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

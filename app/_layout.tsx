import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { StatusBar, Text, TextInput } from "react-native";
import "react-native-reanimated";
import { useFonts } from "expo-font";
import {
  Nunito_300Light,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from "@expo-google-fonts/nunito";

import { HabitsProvider, useHabits } from "../context/HabitsContext";
import { BuildingProvider, useBuildings } from "../context/BuildingContext";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { SoundProvider } from "../context/SoundContext";
import { LanguageProvider } from "../context/LanguageContext";

// Apply Nunito as the default font for all Text and TextInput components
(Text as any).defaultProps = { ...(Text as any).defaultProps, style: { fontFamily: "Nunito_400Regular" } };
(TextInput as any).defaultProps = { ...(TextInput as any).defaultProps, style: { fontFamily: "Nunito_400Regular" } };

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "drawer",
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
  const [fontsLoaded, fontError] = useFonts({
    Nunito_300Light,
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const [fontTimeout, setFontTimeout] = useState(false);

  // Safety valve: never let font loading block the splash screen forever
  useEffect(() => {
    const timer = setTimeout(() => setFontTimeout(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!habitsLoading && !buildingLoading && (fontsLoaded || fontError || fontTimeout)) {
      SplashScreen.hideAsync().catch((e) => { __DEV__ && console.warn('SplashScreen.hideAsync failed:', e); });
    }
  }, [habitsLoading, buildingLoading, fontsLoaded, fontError, fontTimeout]);

  return (
    <>
      <ThemedStatusBar />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="drawer" />
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

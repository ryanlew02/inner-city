import { Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StatusBar, Text, TextInput, View } from "react-native";
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

  const dataLoading = habitsLoading || buildingLoading;
  const fontsReady = fontsLoaded || !!fontError;

  if (dataLoading || !fontsReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#121218', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  return (
    <>
      <ThemedStatusBar />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
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

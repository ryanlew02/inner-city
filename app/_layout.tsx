import { Stack } from "expo-router";
import { ActivityIndicator, StatusBar, Text, TextInput, View } from "react-native";
import { useFonts } from "expo-font";
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";

import { HabitsProvider, useHabits } from "../context/HabitsContext";
import { BuildingProvider, useBuildings } from "../context/BuildingContext";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { SoundProvider } from "../context/SoundContext";
import { LanguageProvider } from "../context/LanguageContext";

(Text as any).defaultProps = { ...(Text as any).defaultProps, style: { fontFamily: "Inter_400Regular" } };
(TextInput as any).defaultProps = { ...(TextInput as any).defaultProps, style: { fontFamily: "Inter_400Regular" } };

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
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  if (habitsLoading || buildingLoading || (!fontsLoaded && !fontError)) {
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

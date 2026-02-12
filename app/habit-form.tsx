import { Stack } from "expo-router";
import HabitFormScreen from "../screens/HabitFormScreen";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";

export default function HabitFormRoute() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  return (
    <>
      <Stack.Screen
        options={{
          title: t('habitForm.newHabit'),
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          presentation: "modal",
        }}
      />
      <HabitFormScreen />
    </>
  );
}

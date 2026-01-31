import { Stack } from "expo-router";
import HabitFormScreen from "../screens/HabitFormScreen";

export default function HabitFormRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          title: "New Habit",
          headerShown: true,
          headerStyle: { backgroundColor: "#F2F4F7" },
          headerTintColor: "#111827",
          presentation: "modal",
        }}
      />
      <HabitFormScreen />
    </>
  );
}

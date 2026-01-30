import { Drawer } from "expo-router/drawer";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function DrawerLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        screenOptions={{
          headerShown: true,
          drawerStyle: { backgroundColor: "#1a1a2e" },
          headerStyle: { backgroundColor: "#1a1a2e" },
          headerTintColor: "#ffffff",
          drawerActiveTintColor: "#4CAF50",
          drawerInactiveTintColor: "#888",
        }}
      >
        <Drawer.Screen
          name="index"
          options={{ title: "City", drawerLabel: "City" }}
        />
        <Drawer.Screen
          name="habits"
          options={{ title: "Habits", drawerLabel: "Habits" }}
        />
        <Drawer.Screen
          name="stats"
          options={{ title: "Stats", drawerLabel: "Stats" }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}

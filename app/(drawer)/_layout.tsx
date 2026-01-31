import { Drawer } from "expo-router/drawer";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function DrawerLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        initialRouteName="habits"
        screenOptions={{
          headerShown: true,
          drawerStyle: { backgroundColor: "#F2F4F7" },
          headerStyle: { backgroundColor: "#F2F4F7" },
          headerTintColor: "#111827",
          drawerActiveTintColor: "#3B82F6",
          drawerInactiveTintColor: "#64748B",
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

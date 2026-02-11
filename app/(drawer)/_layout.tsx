import { Drawer } from "expo-router/drawer";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useTheme } from "../../context/ThemeContext";

export default function DrawerLayout() {
  const { colors } = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        initialRouteName="habits"
        screenOptions={{
          headerShown: true,
          drawerStyle: { backgroundColor: colors.drawerBackground, width: '65%' },
          headerStyle: { backgroundColor: colors.headerBackground },
          headerTintColor: colors.text,
          drawerActiveTintColor: colors.drawerActiveText,
          drawerInactiveTintColor: colors.drawerInactiveText,
          swipeEnabled: false,
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
        <Drawer.Screen
          name="settings"
          options={{ title: "Settings", drawerLabel: "Settings" }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}

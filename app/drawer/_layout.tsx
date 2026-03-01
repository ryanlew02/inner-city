import { Drawer } from "expo-router/drawer";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";

export default function DrawerLayout() {
  const { colors } = useTheme();
  const { t } = useLanguage();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        initialRouteName="habits"
        screenOptions={{
          headerShown: true,
          drawerStyle: { backgroundColor: colors.drawerBackground, width: '40%' },
          headerStyle: { backgroundColor: colors.headerBackground },
          headerTintColor: colors.text,
          headerTitle: () => null,
          drawerActiveTintColor: colors.drawerActiveText,
          drawerInactiveTintColor: colors.drawerInactiveText,
          drawerActiveBackgroundColor: colors.accentLight,
          drawerItemStyle: { borderRadius: 8, marginHorizontal: 8 },
          drawerLabelStyle: { fontWeight: '500', fontSize: 15 },
          swipeEnabled: false,
        }}
      >
        <Drawer.Screen
          name="index"
          options={{ title: t("drawer.city"), drawerLabel: t("drawer.city") }}
        />
        <Drawer.Screen
          name="habits"
          options={{ title: t("drawer.habits"), drawerLabel: t("drawer.habits") }}
        />
        <Drawer.Screen
          name="stats"
          options={{ title: t("drawer.stats"), drawerLabel: t("drawer.stats") }}
        />
        <Drawer.Screen
          name="settings"
          options={{ title: t("drawer.settings"), drawerLabel: t("drawer.settings") }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}

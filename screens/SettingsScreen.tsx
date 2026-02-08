import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useBuildings } from "../context/BuildingContext";
import { useHabits } from "../context/HabitsContext";
import { useTheme } from "../context/ThemeContext";
import { ThemePreference } from "../services/database/themeService";
import { ThemeColors } from "../constants/Colors";

const THEME_OPTIONS: { value: ThemePreference; label: string; description: string }[] = [
  { value: "system", label: "System", description: "Follow device setting" },
  { value: "light", label: "Light", description: "Always light" },
  { value: "dark", label: "Dark", description: "Always dark" },
];

export default function SettingsScreen() {
  const { resetCity, tokens } = useBuildings();
  const { habits } = useHabits();
  const { colors, preference, setPreference } = useTheme();

  const handleResetCity = () => {
    Alert.alert(
      "Reset City",
      "This will destroy all buildings. Your tokens will be kept. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: resetCity,
        },
      ]
    );
  };

  const styles = createStyles(colors);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.themeOptions}>
          {THEME_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.themeOption,
                preference === option.value && styles.themeOptionSelected,
              ]}
              onPress={() => setPreference(option.value)}
              activeOpacity={0.7}
            >
              <View style={styles.themeOptionRadio}>
                {preference === option.value && (
                  <View style={styles.themeOptionRadioInner} />
                )}
              </View>
              <View style={styles.themeOptionText}>
                <Text style={styles.themeOptionLabel}>{option.label}</Text>
                <Text style={styles.themeOptionDescription}>{option.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>City</Text>
        <TouchableOpacity style={styles.dangerButton} onPress={handleResetCity}>
          <Text style={styles.dangerButtonText}>Reset City</Text>
          <Text style={styles.dangerButtonSubtext}>Remove all buildings</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Version</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return {
    container: {
      flex: 1,
      backgroundColor: colors.background,
    } as const,
    content: {
      padding: 20,
    } as const,
    section: {
      marginBottom: 32,
    } as const,
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600" as const,
      color: colors.textSecondary,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    themeOptions: {
      borderRadius: 12,
      overflow: "hidden" as const,
    },
    themeOption: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.card,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    themeOptionSelected: {
      backgroundColor: colors.accentLight,
    },
    themeOptionRadio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.accent,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginRight: 14,
    },
    themeOptionRadioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.accent,
    },
    themeOptionText: {
      flex: 1,
    },
    themeOptionLabel: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.text,
    },
    themeOptionDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    dangerButton: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
    },
    dangerButtonText: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.danger,
    },
    dangerButtonSubtext: {
      fontSize: 13,
      color: colors.textTertiary,
      marginTop: 2,
    },
    infoRow: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
    },
    infoLabel: {
      fontSize: 16,
      color: colors.text,
    },
    infoValue: {
      fontSize: 16,
      color: colors.textSecondary,
    },
  };
}

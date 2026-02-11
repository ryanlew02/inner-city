import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  SafeAreaView,
  Linking,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useBuildings } from "../context/BuildingContext";
import { useHabits } from "../context/HabitsContext";
import { useTheme } from "../context/ThemeContext";
import { useSound } from "../context/SoundContext";
import { ThemePreference } from "../services/database/themeService";
import { ThemeColors } from "../constants/Colors";
import { exportAllData, importAllData } from "../services/database/dataExportService";

const THEME_OPTIONS: { value: ThemePreference; label: string; description: string }[] = [
  { value: "system", label: "System", description: "Follow device setting" },
  { value: "light", label: "Light", description: "Always light" },
  { value: "dark", label: "Dark", description: "Always dark" },
];

const PREFERENCE_LABELS: Record<ThemePreference, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

type ResetTarget = "city" | "habits" | null;

const RESET_INFO: Record<"city" | "habits", { title: string; warning: string; buttonLabel: string }> = {
  city: {
    title: "Reset City",
    warning: "This will permanently destroy all placed buildings. Your tokens will be kept. This action cannot be undone.",
    buttonLabel: "Reset City",
  },
  habits: {
    title: "Reset Habit Data",
    warning: "This will permanently delete all habits and their history. Your city and tokens will be kept. This action cannot be undone.",
    buttonLabel: "Reset Habit Data",
  },
};

export default function SettingsScreen() {
  const { resetCity } = useBuildings();
  const { resetHabitData } = useHabits();
  const { colors, preference, setPreference } = useTheme();
  const { soundEnabled, setSoundEnabled } = useSound();

  const [appearanceVisible, setAppearanceVisible] = useState(false);
  const [resetPickerVisible, setResetPickerVisible] = useState(false);
  const [resetTarget, setResetTarget] = useState<ResetTarget>(null);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleResetConfirm = async () => {
    if (resetTarget === "city") {
      await resetCity();
    } else if (resetTarget === "habits") {
      await resetHabitData();
    }
    setResetTarget(null);
    setConfirmText("");
  };

  const handleResetClose = () => {
    setResetTarget(null);
    setConfirmText("");
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportAllData();
    } catch (e: any) {
      Alert.alert("Export Failed", e.message || "An error occurred while exporting.");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = () => {
    Alert.alert(
      "Import Data",
      "This will replace all existing data with the backup. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Import",
          style: "destructive",
          onPress: async () => {
            setImporting(true);
            try {
              await importAllData();
              Alert.alert("Success", "Your data has been restored. Please close and restart the app for changes to take effect.");
            } catch (e: any) {
              if (e.message !== "cancelled") {
                Alert.alert("Import Failed", e.message || "An error occurred while importing.");
              }
            } finally {
              setImporting(false);
            }
          },
        },
      ]
    );
  };

  const styles = createStyles(colors);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Menu Rows */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>General</Text>
        <View style={styles.menuGroup}>
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.6}
            onPress={() => setAppearanceVisible(true)}
          >
            <View style={styles.menuRowLeft}>
              <Text style={styles.menuRowLabel}>App Appearance</Text>
              <Text style={styles.menuRowSubtitle}>{PREFERENCE_LABELS[preference]}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.menuRow}>
            <View style={styles.menuRowLeft}>
              <Text style={styles.menuRowLabel}>Sounds</Text>
              <Text style={styles.menuRowSubtitle}>{soundEnabled ? "On" : "Off"}</Text>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={setSoundEnabled}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#FFFFFF"
            />
          </View>

          <TouchableOpacity
            style={[styles.menuRow, styles.menuRowLast]}
            activeOpacity={0.6}
            onPress={() => setResetPickerVisible(true)}
          >
            <View style={styles.menuRowLeft}>
              <Text style={styles.menuRowLabelDanger}>Reset Data</Text>
              <Text style={styles.menuRowSubtitle}>Reset city or habit data</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data</Text>
        <View style={styles.menuGroup}>
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.6}
            onPress={handleExport}
            disabled={exporting || importing}
          >
            <View style={styles.menuRowLeft}>
              <Text style={styles.menuRowLabel}>Export Data</Text>
              <Text style={styles.menuRowSubtitle}>Save a backup of all your data</Text>
            </View>
            {exporting ? (
              <ActivityIndicator size="small" color={colors.textTertiary} />
            ) : (
              <Text style={styles.chevron}>›</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuRow, styles.menuRowLast]}
            activeOpacity={0.6}
            onPress={handleImport}
            disabled={exporting || importing}
          >
            <View style={styles.menuRowLeft}>
              <Text style={styles.menuRowLabel}>Import Data</Text>
              <Text style={styles.menuRowSubtitle}>Restore from a backup file</Text>
            </View>
            {importing ? (
              <ActivityIndicator size="small" color={colors.textTertiary} />
            ) : (
              <Text style={styles.chevron}>›</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.menuGroup}>
          <View style={styles.menuRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.6}
            onPress={() => setPrivacyVisible(true)}
          >
            <View style={styles.menuRowLeft}>
              <Text style={styles.menuRowLabel}>Privacy Policy</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuRow, styles.menuRowLast]}
            activeOpacity={0.6}
            onPress={() => Linking.openURL("mailto:innercity.habit@gmail.com")}
          >
            <View style={styles.menuRowLeft}>
              <Text style={styles.menuRowLabel}>Contact Us</Text>
              <Text style={styles.menuRowSubtitle}>innercity.habit@gmail.com</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* App Appearance Modal */}
      <Modal
        visible={appearanceVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAppearanceVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setAppearanceVisible(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>App Appearance</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.themeOptions}>
              {THEME_OPTIONS.map((option, i) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.themeOption,
                    preference === option.value && styles.themeOptionSelected,
                    i === THEME_OPTIONS.length - 1 && styles.themeOptionLast,
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
        </SafeAreaView>
      </Modal>

      {/* Reset Picker Modal */}
      <Modal
        visible={resetPickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setResetPickerVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setResetPickerVisible(false)}>
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Reset Data</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.resetOptions}>
              <TouchableOpacity
                style={styles.resetOptionRow}
                activeOpacity={0.6}
                onPress={() => {
                  setResetPickerVisible(false);
                  setResetTarget("city");
                }}
              >
                <View style={styles.menuRowLeft}>
                  <Text style={styles.menuRowLabelDanger}>Reset City</Text>
                  <Text style={styles.menuRowSubtitle}>Remove all placed buildings</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.resetOptionRow, styles.menuRowLast]}
                activeOpacity={0.6}
                onPress={() => {
                  setResetPickerVisible(false);
                  setResetTarget("habits");
                }}
              >
                <View style={styles.menuRowLeft}>
                  <Text style={styles.menuRowLabelDanger}>Reset Habit Data</Text>
                  <Text style={styles.menuRowSubtitle}>Delete all habits and history</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Reset Confirmation Modal */}
      {resetTarget && (
        <Modal
          visible={true}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={handleResetClose}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleResetClose}>
                <Text style={styles.modalClose}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{RESET_INFO[resetTarget].title}</Text>
              <View style={styles.modalHeaderSpacer} />
            </View>

            <View style={styles.modalContent}>
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  {RESET_INFO[resetTarget].warning}
                </Text>
              </View>

              <Text style={styles.confirmLabel}>Type "confirm" to proceed</Text>
              <TextInput
                style={styles.confirmInput}
                value={confirmText}
                onChangeText={setConfirmText}
                placeholder="confirm"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[
                  styles.resetButton,
                  confirmText.toLowerCase() !== "confirm" && styles.resetButtonDisabled,
                ]}
                onPress={handleResetConfirm}
                disabled={confirmText.toLowerCase() !== "confirm"}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.resetButtonText,
                    confirmText.toLowerCase() !== "confirm" && styles.resetButtonTextDisabled,
                  ]}
                >
                  {RESET_INFO[resetTarget].buttonLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      )}
      {/* Privacy Policy Modal */}
      <Modal
        visible={privacyVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPrivacyVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setPrivacyVisible(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Privacy Policy</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <ScrollView style={styles.policyScroll} contentContainerStyle={styles.policyContent}>
            <Text style={styles.policyMeta}>Effective Date: February 10, 2026</Text>

            <Text style={styles.policySectionTitle}>1. Information We Collect</Text>
            <Text style={styles.policyBody}>
              Inner City is designed to help users build habits and track progress. We collect only the minimum information needed to provide the app.
            </Text>
            <Text style={styles.policySubTitle}>a. Information You Provide</Text>
            <Text style={styles.policyBullet}>- Habit names or goals you enter</Text>
            <Text style={styles.policyBullet}>- Notes or custom habit settings</Text>
            <Text style={styles.policySubTitle}>b. Automatically Collected Information</Text>
            <Text style={styles.policyBody}>
              Inner City does not collect analytics, ads data, or login information. All habit and progress data is stored locally on your device.
            </Text>

            <Text style={styles.policySectionTitle}>2. How We Use Your Information</Text>
            <Text style={styles.policyBody}>We use the information you enter only to:</Text>
            <Text style={styles.policyBullet}>- Provide core app functionality</Text>
            <Text style={styles.policyBullet}>- Save your habit and city progress on your device</Text>
            <Text style={styles.policyBody}>We do not sell, share, or upload your personal data.</Text>

            <Text style={styles.policySectionTitle}>3. Data Storage and Security</Text>
            <Text style={styles.policyBody}>
              All data is stored locally on your phone. Inner City does not use cloud storage or external servers. You may delete the app at any time to remove all stored data.
            </Text>

            <Text style={styles.policySectionTitle}>4. Third-Party Services</Text>
            <Text style={styles.policyBody}>
              Inner City does not use third-party advertising, analytics, or tracking services.
            </Text>

            <Text style={styles.policySectionTitle}>5. Children's Privacy</Text>
            <Text style={styles.policyBody}>
              Inner City is not intended for children under the age of 13. We do not knowingly collect personal information from children.
            </Text>

            <Text style={styles.policySectionTitle}>6. Changes to This Privacy Policy</Text>
            <Text style={styles.policyBody}>
              We may update this Privacy Policy from time to time. Updates will be posted with a revised effective date.
            </Text>

            <Text style={styles.policySectionTitle}>7. Contact Us</Text>
            <Text style={styles.policyBody}>
              If you have questions about this Privacy Policy, you can contact us at:
            </Text>
            <Text style={styles.policyBody}>Email: innercity.habit@gmail.com</Text>
            <Text style={styles.policyBody}>Developer: Ryan Lewandowski</Text>
            <Text style={styles.policyBody}>Location: United States</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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

    // Menu rows
    menuGroup: {
      borderRadius: 12,
      overflow: "hidden" as const,
    },
    menuRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      backgroundColor: colors.card,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    menuRowLast: {
      borderBottomWidth: 0,
    },
    menuRowLeft: {
      flex: 1,
    },
    menuRowLabel: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.text,
    },
    menuRowLabelDanger: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.danger,
    },
    menuRowSubtitle: {
      fontSize: 13,
      color: colors.textTertiary,
      marginTop: 2,
    },
    chevron: {
      fontSize: 22,
      color: colors.textTertiary,
      marginLeft: 8,
    },

    // About info row
    infoLabel: {
      fontSize: 16,
      color: colors.text,
    },
    infoValue: {
      fontSize: 16,
      color: colors.textSecondary,
    },

    // Modal
    modalContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modalHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalClose: {
      fontSize: 16,
      color: colors.accent,
      fontWeight: "500" as const,
      minWidth: 60,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: "600" as const,
      color: colors.text,
    },
    modalHeaderSpacer: {
      minWidth: 60,
    },
    modalContent: {
      padding: 20,
    },

    // Theme options (reused in modal)
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
    themeOptionLast: {
      borderBottomWidth: 0,
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

    // Reset picker
    resetOptions: {
      borderRadius: 12,
      overflow: "hidden" as const,
    },
    resetOptionRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      backgroundColor: colors.card,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },

    // Reset confirmation modal
    warningBox: {
      backgroundColor: colors.dangerLight,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
    },
    warningText: {
      fontSize: 15,
      color: colors.danger,
      lineHeight: 22,
    },
    confirmLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    confirmInput: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      color: colors.text,
      marginBottom: 20,
    },
    resetButton: {
      backgroundColor: colors.danger,
      borderRadius: 10,
      padding: 16,
      alignItems: "center" as const,
    },
    resetButtonDisabled: {
      backgroundColor: colors.buttonBackgroundDisabled,
    },
    resetButtonText: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: "#FFFFFF",
    },
    resetButtonTextDisabled: {
      color: colors.textTertiary,
    },

    // Privacy policy modal
    policyScroll: {
      flex: 1,
    },
    policyContent: {
      padding: 20,
      paddingBottom: 40,
    },
    policyMeta: {
      fontSize: 13,
      color: colors.textTertiary,
      marginBottom: 20,
    },
    policySectionTitle: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.text,
      marginTop: 20,
      marginBottom: 8,
    },
    policySubTitle: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: colors.text,
      marginTop: 12,
      marginBottom: 4,
    },
    policyBody: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 21,
      marginBottom: 4,
    },
    policyBullet: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 21,
      paddingLeft: 8,
    },
  };
}

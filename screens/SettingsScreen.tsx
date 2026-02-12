import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Linking,
  Alert,
  ActivityIndicator,
  Switch,
  Share,
  Platform,
} from "react-native";
import { useBuildings } from "../context/BuildingContext";
import { useHabits } from "../context/HabitsContext";
import { useTheme } from "../context/ThemeContext";
import { useSound } from "../context/SoundContext";
import { useLanguage, LANGUAGE_OPTIONS } from "../context/LanguageContext";
import { ThemePreference } from "../services/database/themeService";
import { ThemeColors } from "../constants/Colors";
import { exportAllData, importAllData } from "../services/database/dataExportService";

type ResetTarget = "city" | "habits" | null;

export default function SettingsScreen() {
  const { resetCity } = useBuildings();
  const { resetHabitData } = useHabits();
  const { colors, preference, setPreference } = useTheme();
  const { soundEnabled, setSoundEnabled } = useSound();
  const { t, language, setLanguage } = useLanguage();

  const [appearanceVisible, setAppearanceVisible] = useState(false);
  const [languageVisible, setLanguageVisible] = useState(false);
  const [resetPickerVisible, setResetPickerVisible] = useState(false);
  const [resetTarget, setResetTarget] = useState<ResetTarget>(null);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [confirmText, setConfirmText] = useState("");
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
    try {
      await exportAllData();
    } catch (e: any) {
      Alert.alert(t('settings.exportFailed'), e.message || "An error occurred while exporting.");
    }
  };

  const handleImport = () => {
    Alert.alert(
      t('settings.importConfirmTitle'),
      t('settings.importConfirmMessage'),
      [
        { text: t('settings.cancelButton'), style: "cancel" },
        {
          text: t('settings.importButton'),
          style: "destructive",
          onPress: async () => {
            setImporting(true);
            try {
              await importAllData();
              Alert.alert(t('settings.importSuccess'), t('settings.importSuccessMessage'));
            } catch (e: any) {
              if (e.message !== "cancelled") {
                Alert.alert(t('settings.importFailed'), e.message || "An error occurred while importing.");
              }
            } finally {
              setImporting(false);
            }
          },
        },
      ]
    );
  };

  const handleRate = () => {
    const storeUrl = Platform.select({
      ios: "https://apps.apple.com/app/id_PLACEHOLDER",
      android: "https://play.google.com/store/apps/details?id=com.anonymous.habitcitynew",
    });
    if (storeUrl) Linking.openURL(storeUrl);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: t('settings.shareMessage'),
      });
    } catch (_) {}
  };

  const styles = createStyles(colors);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Menu Rows */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.general')}</Text>
        <View style={styles.menuGroup}>
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.6}
            onPress={() => setAppearanceVisible(true)}
          >
            <View style={styles.menuRowLeft}>
              <Text style={styles.menuRowLabel}>{t('settings.appAppearance')}</Text>
              <Text style={styles.menuRowSubtitle}>{t(`settings.${preference}`)}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.6}
            onPress={() => setLanguageVisible(true)}
          >
            <View style={styles.menuRowLeft}>
              <Text style={styles.menuRowLabel}>{t('settings.language')}</Text>
              <Text style={styles.menuRowSubtitle}>{LANGUAGE_OPTIONS.find(l => l.code === language)?.nativeLabel || 'English'}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.menuRow}>
            <View style={styles.menuRowLeft}>
              <Text style={styles.menuRowLabel}>{t('settings.sounds')}</Text>
              <Text style={styles.menuRowSubtitle}>{soundEnabled ? t('settings.on') : t('settings.off')}</Text>
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
              <Text style={styles.menuRowLabelDanger}>{t('settings.resetData')}</Text>
              <Text style={styles.menuRowSubtitle}>{t('settings.resetDataSubtitle')}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.data')}</Text>
        <View style={styles.menuGroup}>
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.6}
            onPress={handleExport}
            disabled={importing}
          >
            <View style={styles.menuRowLeft}>
              <Text style={styles.menuRowLabel}>{t('settings.exportData')}</Text>
              <Text style={styles.menuRowSubtitle}>{t('settings.exportDataSubtitle')}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuRow, styles.menuRowLast]}
            activeOpacity={0.6}
            onPress={handleImport}
            disabled={importing}
          >
            <View style={styles.menuRowLeft}>
              <Text style={styles.menuRowLabel}>{t('settings.importData')}</Text>
              <Text style={styles.menuRowSubtitle}>{t('settings.importDataSubtitle')}</Text>
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
        <Text style={styles.sectionTitle}>{t('settings.about')}</Text>
        <View style={styles.menuGroup}>
          <View style={styles.menuRow}>
            <Text style={styles.infoLabel}>{t('settings.version')}</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.6}
            onPress={() => setPrivacyVisible(true)}
          >
            <View style={styles.menuRowLeft}>
              <Text style={styles.menuRowLabel}>{t('settings.privacyPolicy')}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.6}
            onPress={handleRate}
          >
            <View style={styles.menuRowLeft}>
              <Text style={styles.menuRowLabel}>{t('settings.rateApp')}</Text>
              <Text style={styles.menuRowSubtitle}>{t('settings.rateAppSubtitle')}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.6}
            onPress={handleShare}
          >
            <View style={styles.menuRowLeft}>
              <Text style={styles.menuRowLabel}>{t('settings.shareApp')}</Text>
              <Text style={styles.menuRowSubtitle}>{t('settings.shareAppSubtitle')}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuRow, styles.menuRowLast]}
            activeOpacity={0.6}
            onPress={() => Linking.openURL("mailto:innercity.habit@gmail.com")}
          >
            <View style={styles.menuRowLeft}>
              <Text style={styles.menuRowLabel}>{t('settings.contactUs')}</Text>
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
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setAppearanceVisible(false)}>
              <Text style={styles.modalClose}>{t('settings.doneButton')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('settings.appAppearance')}</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.themeOptions}>
              {([
                { value: "system" as ThemePreference, labelKey: "settings.system", descKey: "settings.systemDesc" },
                { value: "light" as ThemePreference, labelKey: "settings.light", descKey: "settings.lightDesc" },
                { value: "dark" as ThemePreference, labelKey: "settings.dark", descKey: "settings.darkDesc" },
              ]).map((option, i) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.themeOption,
                    preference === option.value && styles.themeOptionSelected,
                    i === 2 && styles.themeOptionLast,
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
                    <Text style={styles.themeOptionLabel}>{t(option.labelKey)}</Text>
                    <Text style={styles.themeOptionDescription}>{t(option.descKey)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Reset Picker Modal */}
      <Modal
        visible={resetPickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setResetPickerVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setResetPickerVisible(false)}>
              <Text style={styles.modalClose}>{t('settings.cancelButton')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('settings.resetData')}</Text>
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
                  <Text style={styles.menuRowLabelDanger}>{t('settings.resetCity')}</Text>
                  <Text style={styles.menuRowSubtitle}>{t('settings.resetCitySubtitle')}</Text>
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
                  <Text style={styles.menuRowLabelDanger}>{t('settings.resetHabitData')}</Text>
                  <Text style={styles.menuRowSubtitle}>{t('settings.resetHabitDataSubtitle')}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reset Confirmation Modal */}
      {resetTarget && (
        <Modal
          visible={true}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={handleResetClose}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleResetClose}>
                <Text style={styles.modalClose}>{t('settings.cancelButton')}</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{resetTarget === "city" ? t('settings.resetCity') : t('settings.resetHabitData')}</Text>
              <View style={styles.modalHeaderSpacer} />
            </View>

            <View style={styles.modalContent}>
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  {resetTarget === "city" ? t('settings.resetCityWarning') : t('settings.resetHabitDataWarning')}
                </Text>
              </View>

              <Text style={styles.confirmLabel}>{t('settings.typeConfirm')}</Text>
              <TextInput
                style={styles.confirmInput}
                value={confirmText}
                onChangeText={setConfirmText}
                placeholder={t('settings.confirmPlaceholder')}
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
                  {resetTarget === "city" ? t('settings.resetCity') : t('settings.resetHabitData')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
      {/* Privacy Policy Modal */}
      <Modal
        visible={privacyVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPrivacyVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setPrivacyVisible(false)}>
              <Text style={styles.modalClose}>{t('settings.doneButton')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('settings.privacyPolicy')}</Text>
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
        </View>
      </Modal>

      {/* Language Picker Modal */}
      <Modal
        visible={languageVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLanguageVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setLanguageVisible(false)}>
              <Text style={styles.modalClose}>{t('settings.doneButton')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('settings.language')}</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.themeOptions}>
              {LANGUAGE_OPTIONS.map((option, i) => (
                <TouchableOpacity
                  key={option.code}
                  style={[
                    styles.themeOption,
                    language === option.code && styles.themeOptionSelected,
                    i === LANGUAGE_OPTIONS.length - 1 && styles.themeOptionLast,
                  ]}
                  onPress={() => setLanguage(option.code)}
                  activeOpacity={0.7}
                >
                  <View style={styles.themeOptionRadio}>
                    {language === option.code && (
                      <View style={styles.themeOptionRadioInner} />
                    )}
                  </View>
                  <View style={styles.themeOptionText}>
                    <Text style={styles.themeOptionLabel}>{option.nativeLabel}</Text>
                    <Text style={styles.themeOptionDescription}>{option.label}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
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

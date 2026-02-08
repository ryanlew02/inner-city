import { useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
  Modal,
  Pressable,
  Alert,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import { ThemeColors } from "../constants/Colors";

const buildCoin = require("../assets/images/build_coin.png");
import {
  BuildingType,
  PlacedBuilding,
  PURCHASABLE_BUILDING_TYPES,
  BUILDING_COST,
  getDemolishRefund,
  getUpgradeCost,
  MAX_TIER,
} from "../context/BuildingContext";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.6;

interface BuildingSheetProps {
  visible: boolean;
  onClose: () => void;
  mode: "build" | "upgrade" | "autobuild";
  selectedBuilding?: PlacedBuilding;
  tokens: number;
  onSelectBuildingType: (type: BuildingType) => void;
  onUpgrade: () => void;
  onDemolish: () => void;
  onAutoBuildOne: () => void;
  onAutoBuildAll: () => void;
}

const BUILDING_LABELS: Record<BuildingType, string> = {
  apartment: "Apartments",
  house: "Houses",
  office: "Offices",
  factory: "Factory",
  solarpanel: "Solar Panels",
};

const BUILDING_ICONS: Record<BuildingType, string> = {
  apartment: "\u{1F3E2}",
  house: "\u{1F3E0}",
  office: "\u{1F3EC}",
  factory: "\u{1F3ED}",
  solarpanel: "\u2600\uFE0F",
};

export default function BuildingSheet({
  visible,
  onClose,
  mode,
  selectedBuilding,
  tokens,
  onSelectBuildingType,
  onUpgrade,
  onDemolish,
  onAutoBuildOne,
  onAutoBuildAll,
}: BuildingSheetProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 150,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SHEET_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const canAffordBuilding = tokens >= BUILDING_COST;
  const upgradeCost = selectedBuilding ? getUpgradeCost(selectedBuilding.tier) : 0;
  const canAffordUpgrade = tokens >= upgradeCost && upgradeCost > 0;
  const maxTier = selectedBuilding ? MAX_TIER[selectedBuilding.building_type] : 1;
  const isMaxTier = selectedBuilding ? selectedBuilding.tier >= maxTier : false;

  const buildingsCanAfford = Math.floor(tokens / BUILDING_COST);

  const handleBuildingSelect = (type: BuildingType) => {
    if (canAffordBuilding) {
      onSelectBuildingType(type);
    }
  };

  const handleRandomBuild = () => {
    if (canAffordBuilding) {
      const randomType = PURCHASABLE_BUILDING_TYPES[
        Math.floor(Math.random() * PURCHASABLE_BUILDING_TYPES.length)
      ];
      onSelectBuildingType(randomType);
    }
  };

  const handleUpgrade = () => {
    if (canAffordUpgrade) {
      onUpgrade();
    }
  };

  const demolishRefund = selectedBuilding ? getDemolishRefund(selectedBuilding.tier) : 0;

  const handleDemolish = () => {
    Alert.alert(
      "Demolish Building?",
      `This will destroy this building and refund ${demolishRefund} token${demolishRefund !== 1 ? 's' : ''}. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Demolish", style: "destructive", onPress: onDemolish },
      ]
    );
  };

  const handleAutoBuildAll = () => {
    Alert.alert(
      "Spend All Tokens?",
      `This will spend ${buildingsCanAfford * BUILDING_COST} tokens to build ${buildingsCanAfford} random building${buildingsCanAfford !== 1 ? 's' : ''}. This cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Build All",
          style: "destructive",
          onPress: onAutoBuildAll,
        },
      ]
    );
  };

  if (!visible) return null;

  const getTitle = () => {
    switch (mode) {
      case "build":
        return "Build New Building";
      case "upgrade":
        return "Upgrade Building";
      case "autobuild":
        return "Auto Build";
    }
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY }] },
          ]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <Text style={styles.title}>{getTitle()}</Text>
              <View style={styles.tokenBadge}>
                <Image source={buildCoin} style={styles.tokenIconImage} />
                <Text style={styles.tokenCount}>{tokens}</Text>
              </View>
            </View>

            {mode === "autobuild" && (
              <View style={styles.content}>
                <View style={styles.autobuildContent}>
                  <Text style={styles.autobuildDescription}>
                    Automatically place random buildings on empty plots.
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.autobuildButton,
                      !canAffordBuilding && styles.autobuildButtonDisabled,
                    ]}
                    onPress={onAutoBuildOne}
                    disabled={!canAffordBuilding}
                  >
                    <View style={styles.autobuildButtonContent}>
                      <Text style={styles.autobuildButtonEmoji}>{"\u{1F3D7}\uFE0F"}</Text>
                      <View style={styles.autobuildButtonText}>
                        <Text style={[
                          styles.autobuildButtonTitle,
                          !canAffordBuilding && styles.textDisabled,
                        ]}>
                          Build 1 Building
                        </Text>
                        <Text style={[
                          styles.autobuildButtonCost,
                          !canAffordBuilding && styles.textDisabled,
                        ]}>
                          {BUILDING_COST} tokens
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.autobuildButton,
                      styles.autobuildButtonAll,
                      buildingsCanAfford < 1 && styles.autobuildButtonDisabled,
                    ]}
                    onPress={handleAutoBuildAll}
                    disabled={buildingsCanAfford < 1}
                  >
                    <View style={styles.autobuildButtonContent}>
                      <Text style={styles.autobuildButtonEmoji}>{"\u{1F3D9}\uFE0F"}</Text>
                      <View style={styles.autobuildButtonText}>
                        <Text style={[
                          styles.autobuildButtonTitle,
                          buildingsCanAfford < 1 && styles.textDisabled,
                        ]}>
                          Build All ({buildingsCanAfford})
                        </Text>
                        <Text style={[
                          styles.autobuildButtonCost,
                          buildingsCanAfford < 1 && styles.textDisabled,
                        ]}>
                          {buildingsCanAfford * BUILDING_COST} tokens
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {!canAffordBuilding && (
                    <Text style={styles.insufficientTokens}>
                      Not enough tokens. Complete habits to earn more!
                    </Text>
                  )}
                </View>
              </View>
            )}

            {mode === "build" && (
              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.costInfo}>
                  Cost: {BUILDING_COST} tokens per building
                </Text>
                <View style={styles.buildingGrid}>
                  {PURCHASABLE_BUILDING_TYPES.slice(0, 3).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.buildingOption,
                        !canAffordBuilding && styles.buildingOptionDisabled,
                      ]}
                      onPress={() => handleBuildingSelect(type)}
                      disabled={!canAffordBuilding}
                    >
                      <Text style={styles.buildingIcon}>{BUILDING_ICONS[type]}</Text>
                      <Text style={[styles.buildingLabel, !canAffordBuilding && styles.textDisabled]}>{BUILDING_LABELS[type]}</Text>
                    </TouchableOpacity>
                  ))}
                  {PURCHASABLE_BUILDING_TYPES.slice(3, 4).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.buildingOption,
                        !canAffordBuilding && styles.buildingOptionDisabled,
                      ]}
                      onPress={() => handleBuildingSelect(type)}
                      disabled={!canAffordBuilding}
                    >
                      <Text style={styles.buildingIcon}>{BUILDING_ICONS[type]}</Text>
                      <Text style={[styles.buildingLabel, !canAffordBuilding && styles.textDisabled]}>{BUILDING_LABELS[type]}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[
                      styles.buildingOption,
                      !canAffordBuilding && styles.buildingOptionDisabled,
                    ]}
                    onPress={handleRandomBuild}
                    disabled={!canAffordBuilding}
                  >
                    <Text style={styles.buildingIcon}>{"\u{1F3B2}"}</Text>
                    <Text style={[styles.buildingLabel, !canAffordBuilding && styles.textDisabled]}>Auto Build</Text>
                  </TouchableOpacity>
                  {PURCHASABLE_BUILDING_TYPES.slice(4).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.buildingOption,
                        !canAffordBuilding && styles.buildingOptionDisabled,
                      ]}
                      onPress={() => handleBuildingSelect(type)}
                      disabled={!canAffordBuilding}
                    >
                      <Text style={styles.buildingIcon}>{BUILDING_ICONS[type]}</Text>
                      <Text style={[styles.buildingLabel, !canAffordBuilding && styles.textDisabled]}>{BUILDING_LABELS[type]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {!canAffordBuilding && (
                  <Text style={styles.insufficientTokens}>
                    Not enough tokens. Complete habits to earn more!
                  </Text>
                )}
              </ScrollView>
            )}

            {mode === "upgrade" && selectedBuilding && (
              <View style={styles.content}>
                <View style={styles.upgradeContentCompact}>
                  <View style={styles.buildingInfoRow}>
                    <Text style={styles.buildingIconMedium}>
                      {BUILDING_ICONS[selectedBuilding.building_type]}
                    </Text>
                    <View style={styles.buildingDetails}>
                      <Text style={styles.buildingNameCompact}>
                        {BUILDING_LABELS[selectedBuilding.building_type]}
                      </Text>
                      <View style={styles.tierBadgeSmall}>
                        <Text style={styles.tierTextSmall}>Tier {selectedBuilding.tier}</Text>
                      </View>
                      <Text style={styles.builtDate}>
                        Built {new Date(selectedBuilding.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>

                  {isMaxTier ? (
                    <View style={styles.maxTierMessageCompact}>
                      <Text style={styles.maxTierTextCompact}>Currently at Max Level</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.upgradeButtonCompact,
                        !canAffordUpgrade && styles.upgradeButtonDisabled,
                      ]}
                      onPress={handleUpgrade}
                      disabled={!canAffordUpgrade}
                    >
                      <View style={styles.upgradeButtonRow}>
                        <Text
                          style={[
                            styles.upgradeButtonText,
                            !canAffordUpgrade && styles.textDisabled,
                          ]}
                        >
                          Upgrade to Tier {selectedBuilding.tier + 1} for {upgradeCost}
                        </Text>
                        <Image source={buildCoin} style={styles.tokenIconImageSmall} />
                      </View>
                    </TouchableOpacity>
                  )}

                  {!canAffordUpgrade && !isMaxTier && (
                    <Text style={styles.insufficientTokensCompact}>
                      Need {upgradeCost - tokens} more tokens
                    </Text>
                  )}

                  <TouchableOpacity
                    style={styles.demolishButton}
                    onPress={handleDemolish}
                  >
                    <Text style={styles.demolishButtonText}>
                      Demolish (refund {demolishRefund} token{demolishRefund !== 1 ? 's' : ''})
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return {
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "flex-end" as const,
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: SHEET_HEIGHT,
      paddingBottom: 40,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.handleBar,
      borderRadius: 2,
      alignSelf: "center" as const,
      marginTop: 12,
      marginBottom: 8,
    },
    header: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    title: {
      fontSize: 20,
      fontWeight: "bold" as const,
      color: colors.text,
    },
    tokenBadge: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.tokenBadgeBackground,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    tokenIcon: {
      fontSize: 16,
      marginRight: 4,
    },
    tokenIconImage: {
      width: 18,
      height: 18,
      marginRight: 4,
    },
    tokenIconImageSmall: {
      width: 16,
      height: 16,
      marginLeft: 4,
    },
    upgradeButtonRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    tokenCount: {
      fontSize: 16,
      fontWeight: "bold" as const,
      color: colors.tokenBadgeText,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    costInfo: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center" as const,
      marginBottom: 16,
    },
    buildingGrid: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      justifyContent: "space-between" as const,
      paddingBottom: 16,
    },
    buildingOption: {
      width: "30%" as const,
      backgroundColor: colors.cardAlt,
      borderRadius: 12,
      padding: 12,
      alignItems: "center" as const,
      marginBottom: 12,
    },
    buildingOptionDisabled: {
      opacity: 0.5,
    },
    buildingIcon: {
      fontSize: 32,
      marginBottom: 8,
    },
    buildingLabel: {
      fontSize: 12,
      color: colors.text,
      textAlign: "center" as const,
    },
    textDisabled: {
      color: colors.textTertiary,
    },
    insufficientTokens: {
      fontSize: 14,
      color: colors.danger,
      textAlign: "center" as const,
      marginTop: 8,
      marginBottom: 16,
    },
    upgradeContentCompact: {
      paddingVertical: 8,
    },
    buildingInfoRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.cardAlt,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    buildingIconMedium: {
      fontSize: 48,
      marginRight: 16,
    },
    buildingDetails: {
      flex: 1,
    },
    buildingNameCompact: {
      fontSize: 18,
      fontWeight: "bold" as const,
      color: colors.text,
      marginBottom: 6,
    },
    tierBadgeSmall: {
      backgroundColor: colors.accent,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      alignSelf: "flex-start" as const,
      marginBottom: 6,
    },
    tierTextSmall: {
      color: colors.textInverse,
      fontWeight: "600" as const,
      fontSize: 12,
    },
    builtDate: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    upgradeButtonCompact: {
      backgroundColor: colors.accent,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center" as const,
    },
    upgradeButtonDisabled: {
      backgroundColor: colors.handleBar,
    },
    upgradeButtonText: {
      color: colors.textInverse,
      fontWeight: "bold" as const,
      fontSize: 16,
    },
    maxTierMessageCompact: {
      alignItems: "center" as const,
      padding: 16,
      backgroundColor: colors.successLight,
      borderRadius: 12,
    },
    maxTierTextCompact: {
      fontSize: 16,
      fontWeight: "bold" as const,
      color: colors.success,
    },
    insufficientTokensCompact: {
      fontSize: 13,
      color: colors.danger,
      textAlign: "center" as const,
      marginTop: 8,
    },
    closeButton: {
      marginHorizontal: 20,
      marginTop: 16,
      paddingVertical: 14,
      alignItems: "center" as const,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
    },
    closeButtonText: {
      fontSize: 16,
      color: colors.textSecondary,
      fontWeight: "500" as const,
    },
    demolishButton: {
      marginTop: 16,
      paddingVertical: 12,
      alignItems: "center" as const,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
      borderRadius: 12,
      backgroundColor: colors.dangerLight,
    },
    demolishButtonText: {
      fontSize: 14,
      color: colors.danger,
      fontWeight: "500" as const,
    },
    autobuildContent: {
      paddingVertical: 8,
    },
    autobuildDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center" as const,
      marginBottom: 24,
    },
    autobuildButton: {
      backgroundColor: colors.accent,
      borderRadius: 16,
      padding: 20,
      marginBottom: 12,
    },
    autobuildButtonAll: {
      backgroundColor: "#8B5CF6",
    },
    autobuildButtonDisabled: {
      backgroundColor: colors.handleBar,
    },
    autobuildButtonContent: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
    },
    autobuildButtonEmoji: {
      fontSize: 36,
      marginRight: 16,
    },
    autobuildButtonText: {
      flex: 1,
    },
    autobuildButtonTitle: {
      fontSize: 18,
      fontWeight: "bold" as const,
      color: colors.textInverse,
      marginBottom: 4,
    },
    autobuildButtonCost: {
      fontSize: 14,
      color: "rgba(255, 255, 255, 0.8)",
    },
  };
}

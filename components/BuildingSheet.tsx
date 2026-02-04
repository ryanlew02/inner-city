import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
  Modal,
  Pressable,
  Alert,
} from "react-native";
import {
  BuildingType,
  PlacedBuilding,
  PURCHASABLE_BUILDING_TYPES,
  BUILDING_COST,
  getUpgradeCost,
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
  onAutoBuildOne: () => void;
  onAutoBuildAll: () => void;
}

const BUILDING_LABELS: Record<BuildingType, string> = {
  residential: "Residential",
  shop: "Shop",
  office: "Office",
  cafe: "Cafe",
  restaurant: "Restaurant",
  factory: "Factory",
  hospital: "Hospital",
  school: "School",
  hotel: "Hotel",
  powerplant: "Power Plant",
  warehouse: "Warehouse",
  special: "Special",
};

const BUILDING_ICONS: Record<BuildingType, string> = {
  residential: "🏠",
  shop: "🏪",
  office: "🏢",
  cafe: "☕",
  restaurant: "🍽️",
  factory: "🏭",
  hospital: "🏥",
  school: "🏫",
  hotel: "🏨",
  powerplant: "⚡",
  warehouse: "📦",
  special: "⭐",
};

export default function BuildingSheet({
  visible,
  onClose,
  mode,
  selectedBuilding,
  tokens,
  onSelectBuildingType,
  onUpgrade,
  onAutoBuildOne,
  onAutoBuildAll,
}: BuildingSheetProps) {
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
  const isMaxTier = selectedBuilding?.tier === 3;

  const buildingsCanAfford = Math.floor(tokens / BUILDING_COST);

  const handleBuildingSelect = (type: BuildingType) => {
    if (canAffordBuilding) {
      onSelectBuildingType(type);
    }
  };

  const handleUpgrade = () => {
    if (canAffordUpgrade) {
      onUpgrade();
    }
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
                <Text style={styles.tokenIcon}>🪙</Text>
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
                      <Text style={styles.autobuildButtonEmoji}>🏗️</Text>
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
                      <Text style={styles.autobuildButtonEmoji}>🏙️</Text>
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
                  {PURCHASABLE_BUILDING_TYPES.map((type) => (
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
                      <Text
                        style={[
                          styles.buildingLabel,
                          !canAffordBuilding && styles.textDisabled,
                        ]}
                      >
                        {BUILDING_LABELS[type]}
                      </Text>
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
                      <Text style={styles.maxTierTextCompact}>Max Level Reached!</Text>
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
                      <Text
                        style={[
                          styles.upgradeButtonText,
                          !canAffordUpgrade && styles.textDisabled,
                        ]}
                      >
                        Upgrade to Tier {selectedBuilding.tier + 1} for {upgradeCost} 🪙
                      </Text>
                    </TouchableOpacity>
                  )}

                  {!canAffordUpgrade && !isMaxTier && (
                    <Text style={styles.insufficientTokensCompact}>
                      Need {upgradeCost - tokens} more tokens
                    </Text>
                  )}
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SHEET_HEIGHT,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
  },
  tokenBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tokenIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  tokenCount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#92400E",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  costInfo: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 16,
  },
  buildingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingBottom: 16,
  },
  buildingOption: {
    width: "30%",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
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
    color: "#374151",
    textAlign: "center",
  },
  textDisabled: {
    color: "#9CA3AF",
  },
  insufficientTokens: {
    fontSize: 14,
    color: "#DC2626",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  upgradeContentCompact: {
    paddingVertical: 8,
  },
  buildingInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
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
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 6,
  },
  tierBadgeSmall: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  tierTextSmall: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 12,
  },
  builtDate: {
    fontSize: 12,
    color: "#6B7280",
  },
  upgradeButtonCompact: {
    backgroundColor: "#3B82F6",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  upgradeButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
  upgradeButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  maxTierMessageCompact: {
    alignItems: "center",
    padding: 16,
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
  },
  maxTierTextCompact: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#059669",
  },
  insufficientTokensCompact: {
    fontSize: 13,
    color: "#DC2626",
    textAlign: "center",
    marginTop: 8,
  },
  closeButton: {
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
  },
  closeButtonText: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "500",
  },
  autobuildContent: {
    paddingVertical: 8,
  },
  autobuildDescription: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  autobuildButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  autobuildButtonAll: {
    backgroundColor: "#8B5CF6",
  },
  autobuildButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
  autobuildButtonContent: {
    flexDirection: "row",
    alignItems: "center",
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
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  autobuildButtonCost: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
  },
});

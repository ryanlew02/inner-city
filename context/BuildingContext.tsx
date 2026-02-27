import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { useAudioPlayer } from "expo-audio";
import {
  BUILDING_COST,
  BuildingType,
  canPlaceAtPosition,
  clearAllBuildings as clearAllBuildingsDb,
  demolishBuilding as demolishBuildingDb,
  getDemolishRefund,
  findBuildingAtPosition,
  findNextAvailablePosition,
  getPlacedBuildings,
  getUpgradeCost,
  MAX_TIER,
  MAX_VARIANTS,
  placeBuilding as placeBuildingDb,
  PlacedBuilding,
  PURCHASABLE_BUILDING_TYPES,
  upgradeBuilding as upgradeBuildingDb
} from "../services/database/buildingService";
import { generateUUID } from "../services/database/db";
import {
  addTokens as addTokensDb,
  getTokenCount,
  spendTokens as spendTokensDb,
} from "../services/database/tokenService";
import { useSound } from "./SoundContext";

type BuildingContextType = {
  buildings: PlacedBuilding[];
  tokens: number;
  loading: boolean;
  placeBuilding: (row: number, col: number, buildingType: BuildingType, gridRows: number, gridCols: number) => Promise<boolean>;
  autoBuildBuilding: (buildingType: BuildingType, gridRows: number, gridCols: number) => Promise<boolean>;
  upgradeBuilding: (buildingId: string) => Promise<boolean>;
  getBuildingAtPosition: (row: number, col: number) => PlacedBuilding | undefined;
  canAffordBuilding: () => boolean;
  canAffordUpgrade: (currentTier: number) => boolean;
  demolishBuilding: (buildingId: string) => Promise<boolean>;
  addTokens: (amount: number) => Promise<void>;
  refreshTokens: () => Promise<void>;
  resetCity: () => Promise<void>;
};

const BuildingContext = createContext<BuildingContextType | null>(null);

export function BuildingProvider({ children }: { children: ReactNode }) {
  const [buildings, setBuildings] = useState<PlacedBuilding[]>([]);
  const [tokens, setTokens] = useState(0);
  const [loading, setLoading] = useState(true);
  const { soundEnabled } = useSound();
  const useInMemory = useRef(false);
  const buildingsRef = useRef<PlacedBuilding[]>([]);
  const buildPlayer = useAudioPlayer(require("../assets/sounds/build.wav"));

  const playBuildSound = () => {
    if (!soundEnabled) return;
    buildPlayer.seekTo(0);
    buildPlayer.play();
  };

  const updateBuildings = (newBuildings: PlacedBuilding[]) => {
    buildingsRef.current = newBuildings;
    setBuildings(newBuildings);
  };

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    console.log('[DEBUG] BuildingContext: loadData start');
    try {
      const [loadedBuildings, loadedTokens] = await Promise.all([
        getPlacedBuildings(),
        getTokenCount(),
      ]);
      console.log('[DEBUG] BuildingContext: db loaded', loadedBuildings.length, 'buildings');
      updateBuildings(loadedBuildings);
      setTokens(loadedTokens);
    } catch (error) {
      console.error('[DEBUG] BuildingContext: loadData ERROR:', error);
      useInMemory.current = true;
      Alert.alert(
        'Data Error',
        'Unable to load your city data. Changes made this session will not be saved. Try restarting the app.',
      );
    } finally {
      console.log('[DEBUG] BuildingContext: setLoading(false)');
      setLoading(false);
    }
  }

  const refreshTokens = async () => {
    if (useInMemory.current) return;
    try {
      const count = await getTokenCount();
      setTokens(count);
    } catch (error) {
      __DEV__ && console.error('Failed to refresh tokens:', error);
    }
  };

  const addTokens = async (amount: number) => {
    if (useInMemory.current) {
      setTokens(prev => prev + amount);
      return;
    }

    try {
      const newCount = await addTokensDb(amount);
      setTokens(newCount);
    } catch (error) {
      __DEV__ && console.error('Failed to add tokens:', error);
    }
  };

  const canAffordBuilding = () => tokens >= BUILDING_COST;

  const canAffordUpgrade = (currentTier: number) => {
    const cost = getUpgradeCost(currentTier);
    return cost > 0 && tokens >= cost;
  };

  const getBuildingAtPositionFn = (row: number, col: number): PlacedBuilding | undefined => {
    return findBuildingAtPosition(row, col, buildingsRef.current);
  };

  const placeBuilding = async (row: number, col: number, buildingType: BuildingType, gridRows: number, gridCols: number): Promise<boolean> => {
    if (!canAffordBuilding()) return false;

    if (!canPlaceAtPosition(row, col, buildingsRef.current, gridRows, gridCols)) {
      return false;
    }

    const variant = Math.floor(Math.random() * MAX_VARIANTS[buildingType]) + 1;

    if (useInMemory.current) {
      const success = tokens >= BUILDING_COST;
      if (success) {
        setTokens(prev => prev - BUILDING_COST);
        const newBuilding: PlacedBuilding = {
          id: generateUUID(),
          grid_row: row,
          grid_col: col,
          building_type: buildingType,
          tier: 1,
          variant,
          size_x: 1,
          size_y: 1,
          created_at: Date.now(),
        };
        updateBuildings([...buildingsRef.current, newBuilding]);
        playBuildSound();
      }
      return success;
    }

    try {
      const spent = await spendTokensDb(BUILDING_COST);
      if (!spent) return false;

      const newBuilding = await placeBuildingDb(row, col, buildingType, variant);
      updateBuildings([...buildingsRef.current, newBuilding]);
      setTokens(prev => prev - BUILDING_COST);
      playBuildSound();
      return true;
    } catch (error) {
      __DEV__ && console.error('Failed to place building:', error);
      return false;
    }
  };

  const autoBuildBuilding = async (buildingType: BuildingType, gridRows: number, gridCols: number): Promise<boolean> => {
    if (!canAffordBuilding()) return false;

    const pos = findNextAvailablePosition(buildingsRef.current, gridRows, gridCols);
    if (!pos) return false;
    return placeBuilding(pos.row, pos.col, buildingType, gridRows, gridCols);
  };

  const upgradeBuilding = async (buildingId: string): Promise<boolean> => {
    const building = buildingsRef.current.find(b => b.id === buildingId);
    if (!building || building.tier >= MAX_TIER[building.building_type]) return false;

    const cost = getUpgradeCost(building.tier);
    if (tokens < cost) return false;

    if (useInMemory.current) {
      setTokens(prev => prev - cost);
      const newBuildings = buildingsRef.current.map(b =>
        b.id === buildingId ? { ...b, tier: b.tier + 1 } : b
      );
      updateBuildings(newBuildings);
      playBuildSound();
      return true;
    }

    try {
      const spent = await spendTokensDb(cost);
      if (!spent) return false;

      const upgraded = await upgradeBuildingDb(buildingId);
      if (!upgraded) return false;

      const newBuildings = buildingsRef.current.map(b =>
        b.id === buildingId ? { ...b, tier: upgraded.tier, variant: upgraded.variant } : b
      );
      updateBuildings(newBuildings);
      setTokens(prev => prev - cost);
      playBuildSound();
      return true;
    } catch (error) {
      __DEV__ && console.error('Failed to upgrade building:', error);
      return false;
    }
  };

  const demolishBuilding = async (buildingId: string): Promise<boolean> => {
    const building = buildingsRef.current.find(b => b.id === buildingId);
    if (!building) return false;

    const refund = getDemolishRefund(building.tier);

    if (useInMemory.current) {
      updateBuildings(buildingsRef.current.filter(b => b.id !== buildingId));
      setTokens(prev => prev + refund);
      return true;
    }

    try {
      await demolishBuildingDb(buildingId);
      const newCount = await addTokensDb(refund);
      updateBuildings(buildingsRef.current.filter(b => b.id !== buildingId));
      setTokens(newCount);
      return true;
    } catch (error) {
      __DEV__ && console.error('Failed to demolish building:', error);
      return false;
    }
  };

  const resetCity = async (): Promise<void> => {
    if (useInMemory.current) {
      updateBuildings([]);
      return;
    }

    try {
      await clearAllBuildingsDb();
      updateBuildings([]);
    } catch (error) {
      __DEV__ && console.error('Failed to reset city:', error);
    }
  };

  return (
    <BuildingContext.Provider
      value={{
        buildings,
        tokens,
        loading,
        placeBuilding,
        autoBuildBuilding,
        upgradeBuilding,
        demolishBuilding,
        getBuildingAtPosition: getBuildingAtPositionFn,
        canAffordBuilding,
        canAffordUpgrade,
        addTokens,
        refreshTokens,
        resetCity,
      }}
    >
      {children}
    </BuildingContext.Provider>
  );
}

export function useBuildings() {
  const context = useContext(BuildingContext);
  if (!context) {
    throw new Error("useBuildings must be used within a BuildingProvider");
  }
  return context;
}

export { BUILDING_COST, getDemolishRefund, getUpgradeCost, MAX_TIER, PURCHASABLE_BUILDING_TYPES };
export type { BuildingType, PlacedBuilding };

import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
import {
  BUILDING_COST,
  BuildingType,
  canPlaceBuilding,
  clearAllBuildings as clearAllBuildingsDb,
  findBuildingAtPlot,
  findValidAnchorForBuilding,
  getBuildingSize,
  getNextAvailablePlotIndex,
  getPlacedBuildings,
  getUpgradeCost,
  MAX_VARIANTS,
  placeBuilding as placeBuildingDb,
  PlacedBuilding,
  plotIndexToGridPosition,
  PURCHASABLE_BUILDING_TYPES,
  upgradeBuilding as upgradeBuildingDb
} from "../services/database/buildingService";
import { generateUUID } from "../services/database/db";
import {
  addTokens as addTokensDb,
  getTokenCount,
  spendTokens as spendTokensDb,
} from "../services/database/tokenService";

type BuildingContextType = {
  buildings: PlacedBuilding[];
  tokens: number;
  loading: boolean;
  placeBuilding: (plotIndex: number, buildingType: BuildingType, gridRows: number, gridCols: number) => Promise<boolean>;
  autoBuildBuilding: (buildingType: BuildingType, maxPlots: number, gridRows: number, gridCols: number) => Promise<boolean>;
  upgradeBuilding: (buildingId: string) => Promise<boolean>;
  getBuildingAtPlot: (plotIndex: number, gridRows: number, gridCols: number) => PlacedBuilding | undefined;
  canAffordBuilding: () => boolean;
  canAffordUpgrade: (currentTier: number) => boolean;
  addTokens: (amount: number) => Promise<void>;
  refreshTokens: () => Promise<void>;
  resetCity: () => Promise<void>;
};

const BuildingContext = createContext<BuildingContextType | null>(null);

export function BuildingProvider({ children }: { children: ReactNode }) {
  const [buildings, setBuildings] = useState<PlacedBuilding[]>([]);
  const [tokens, setTokens] = useState(0);
  const [loading, setLoading] = useState(true);
  const useInMemory = useRef(false);
  const buildingsRef = useRef<PlacedBuilding[]>([]); // Always-current buildings for validation

  // Keep ref in sync with state
  const updateBuildings = (newBuildings: PlacedBuilding[]) => {
    buildingsRef.current = newBuildings;
    setBuildings(newBuildings);
  };

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [loadedBuildings, loadedTokens] = await Promise.all([
        getPlacedBuildings(),
        getTokenCount(),
      ]);
      updateBuildings(loadedBuildings);
      setTokens(loadedTokens);
    } catch (error) {
      console.error('Failed to load building data, using in-memory fallback:', error);
      useInMemory.current = true;
    } finally {
      setLoading(false);
    }
  }

  const refreshTokens = async () => {
    if (useInMemory.current) return;
    try {
      const count = await getTokenCount();
      setTokens(count);
    } catch (error) {
      console.error('Failed to refresh tokens:', error);
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
      console.error('Failed to add tokens:', error);
    }
  };

  const canAffordBuilding = () => tokens >= BUILDING_COST;

  const canAffordUpgrade = (currentTier: number) => {
    const cost = getUpgradeCost(currentTier);
    return cost > 0 && tokens >= cost;
  };

  const getBuildingAtPlot = (plotIndex: number, gridRows: number, gridCols: number): PlacedBuilding | undefined => {
    return findBuildingAtPlot(plotIndex, buildingsRef.current, gridRows, gridCols);
  };

  const placeBuilding = async (plotIndex: number, buildingType: BuildingType, gridRows: number, gridCols: number): Promise<boolean> => {
    if (!canAffordBuilding()) return false;

    const size = getBuildingSize(buildingType);

    // Find valid anchor for this building using current ref (not stale state)
    const anchorPlot = findValidAnchorForBuilding(plotIndex, buildingType, buildingsRef.current, gridRows, gridCols);
    if (anchorPlot === null) {
      return false;
    }

    const variant = Math.floor(Math.random() * MAX_VARIANTS[buildingType]) + 1;

    if (useInMemory.current) {
      const success = tokens >= BUILDING_COST;
      if (success) {
        setTokens(prev => prev - BUILDING_COST);
        const newBuilding: PlacedBuilding = {
          id: generateUUID(),
          plot_index: anchorPlot,
          building_type: buildingType,
          tier: 1,
          variant,
          size_x: size.x,
          size_y: size.y,
          created_at: Date.now(),
        };
        const newBuildings = [...buildingsRef.current, newBuilding].sort((a, b) => a.plot_index - b.plot_index);
        updateBuildings(newBuildings);
      }
      return success;
    }

    try {
      const spent = await spendTokensDb(BUILDING_COST);
      if (!spent) return false;

      const newBuilding = await placeBuildingDb(anchorPlot, buildingType, variant);
      const newBuildings = [...buildingsRef.current, newBuilding].sort((a, b) => a.plot_index - b.plot_index);
      updateBuildings(newBuildings);
      setTokens(prev => prev - BUILDING_COST);
      return true;
    } catch (error) {
      console.error('Failed to place building:', error);
      return false;
    }
  };

  const autoBuildBuilding = async (buildingType: BuildingType, maxPlots: number, gridRows: number, gridCols: number): Promise<boolean> => {
    if (!canAffordBuilding()) return false;

    const size = getBuildingSize(buildingType);

    if (useInMemory.current) {
      const validPlots: { plotIndex: number; row: number; col: number }[] = [];
      for (let i = 0; i < maxPlots; i++) {
        if (!canPlaceBuilding(i, size.x, size.y, buildingsRef.current, gridRows, gridCols)) continue;
        const pos = plotIndexToGridPosition(i, gridRows, gridCols);
        if (!pos) continue;
        validPlots.push({ plotIndex: i, row: pos.row, col: pos.col });
      }
      if (validPlots.length === 0) return false;
      // Prefer top of grid first (smallest row), then left (smallest col)
      validPlots.sort((a, b) => a.row - b.row || a.col - b.col);
      return placeBuilding(validPlots[0].plotIndex, buildingType, gridRows, gridCols);
    }

    try {
      const nextPlot = await getNextAvailablePlotIndex(maxPlots, buildingType, gridRows, gridCols);
      if (nextPlot === null) return false;
      return placeBuilding(nextPlot, buildingType, gridRows, gridCols);
    } catch (error) {
      console.error('Failed to auto-build:', error);
      return false;
    }
  };

  const upgradeBuilding = async (buildingId: string): Promise<boolean> => {
    const building = buildingsRef.current.find(b => b.id === buildingId);
    if (!building || building.tier >= 3) return false;

    const cost = getUpgradeCost(building.tier);
    if (tokens < cost) return false;

    if (useInMemory.current) {
      setTokens(prev => prev - cost);
      const newBuildings = buildingsRef.current.map(b =>
        b.id === buildingId ? { ...b, tier: b.tier + 1 } : b
      );
      updateBuildings(newBuildings);
      return true;
    }

    try {
      const spent = await spendTokensDb(cost);
      if (!spent) return false;

      const upgraded = await upgradeBuildingDb(buildingId);
      if (!upgraded) return false;

      const newBuildings = buildingsRef.current.map(b =>
        b.id === buildingId ? { ...b, tier: upgraded.tier } : b
      );
      updateBuildings(newBuildings);
      setTokens(prev => prev - cost);
      return true;
    } catch (error) {
      console.error('Failed to upgrade building:', error);
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
      console.error('Failed to reset city:', error);
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
        getBuildingAtPlot,
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

export { BUILDING_COST, getUpgradeCost, PURCHASABLE_BUILDING_TYPES };
export type { BuildingType, PlacedBuilding };


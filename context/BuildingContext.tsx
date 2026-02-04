import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import {
  PlacedBuilding,
  BuildingType,
  getPlacedBuildings,
  placeBuilding as placeBuildingDb,
  upgradeBuilding as upgradeBuildingDb,
  getBuildingAt,
  getNextAvailablePlotIndex,
  BUILDING_COST,
  getUpgradeCost,
  PURCHASABLE_BUILDING_TYPES,
  MAX_VARIANTS,
} from "../services/database/buildingService";
import {
  getTokenCount,
  addTokens as addTokensDb,
  spendTokens as spendTokensDb,
} from "../services/database/tokenService";
import { generateUUID } from "../services/database/db";

type BuildingContextType = {
  buildings: PlacedBuilding[];
  tokens: number;
  loading: boolean;
  placeBuilding: (plotIndex: number, buildingType: BuildingType) => Promise<boolean>;
  autoBuildBuilding: (buildingType: BuildingType, maxPlots: number) => Promise<boolean>;
  upgradeBuilding: (buildingId: string) => Promise<boolean>;
  getBuildingAtPlot: (plotIndex: number) => PlacedBuilding | undefined;
  canAffordBuilding: () => boolean;
  canAffordUpgrade: (currentTier: number) => boolean;
  addTokens: (amount: number) => Promise<void>;
  refreshTokens: () => Promise<void>;
};

const BuildingContext = createContext<BuildingContextType | null>(null);

export function BuildingProvider({ children }: { children: ReactNode }) {
  const [buildings, setBuildings] = useState<PlacedBuilding[]>([]);
  const [tokens, setTokens] = useState(0);
  const [loading, setLoading] = useState(true);
  const useInMemory = useRef(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [loadedBuildings, loadedTokens] = await Promise.all([
        getPlacedBuildings(),
        getTokenCount(),
      ]);
      setBuildings(loadedBuildings);
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

  const getBuildingAtPlot = (plotIndex: number): PlacedBuilding | undefined => {
    return buildings.find(b => b.plot_index === plotIndex);
  };

  const placeBuilding = async (plotIndex: number, buildingType: BuildingType): Promise<boolean> => {
    if (!canAffordBuilding()) return false;

    const existingBuilding = getBuildingAtPlot(plotIndex);
    if (existingBuilding) return false;

    const variant = Math.floor(Math.random() * MAX_VARIANTS[buildingType]) + 1;

    if (useInMemory.current) {
      const success = tokens >= BUILDING_COST;
      if (success) {
        setTokens(prev => prev - BUILDING_COST);
        const newBuilding: PlacedBuilding = {
          id: generateUUID(),
          plot_index: plotIndex,
          building_type: buildingType,
          tier: 1,
          variant,
          created_at: Date.now(),
        };
        setBuildings(prev => [...prev, newBuilding].sort((a, b) => a.plot_index - b.plot_index));
      }
      return success;
    }

    try {
      const spent = await spendTokensDb(BUILDING_COST);
      if (!spent) return false;

      const newBuilding = await placeBuildingDb(plotIndex, buildingType, variant);
      setBuildings(prev => [...prev, newBuilding].sort((a, b) => a.plot_index - b.plot_index));
      setTokens(prev => prev - BUILDING_COST);
      return true;
    } catch (error) {
      console.error('Failed to place building:', error);
      return false;
    }
  };

  const autoBuildBuilding = async (buildingType: BuildingType, maxPlots: number): Promise<boolean> => {
    if (!canAffordBuilding()) return false;

    if (useInMemory.current) {
      const occupiedPlots = new Set(buildings.map(b => b.plot_index));
      let nextPlot: number | null = null;
      for (let i = 0; i < maxPlots; i++) {
        if (!occupiedPlots.has(i)) {
          nextPlot = i;
          break;
        }
      }
      if (nextPlot === null) return false;
      return placeBuilding(nextPlot, buildingType);
    }

    try {
      const nextPlot = await getNextAvailablePlotIndex(maxPlots);
      if (nextPlot === null) return false;
      return placeBuilding(nextPlot, buildingType);
    } catch (error) {
      console.error('Failed to auto-build:', error);
      return false;
    }
  };

  const upgradeBuilding = async (buildingId: string): Promise<boolean> => {
    const building = buildings.find(b => b.id === buildingId);
    if (!building || building.tier >= 3) return false;

    const cost = getUpgradeCost(building.tier);
    if (tokens < cost) return false;

    if (useInMemory.current) {
      setTokens(prev => prev - cost);
      setBuildings(prev =>
        prev.map(b =>
          b.id === buildingId ? { ...b, tier: b.tier + 1 } : b
        )
      );
      return true;
    }

    try {
      const spent = await spendTokensDb(cost);
      if (!spent) return false;

      const upgraded = await upgradeBuildingDb(buildingId);
      if (!upgraded) return false;

      setBuildings(prev =>
        prev.map(b =>
          b.id === buildingId ? { ...b, tier: upgraded.tier } : b
        )
      );
      setTokens(prev => prev - cost);
      return true;
    } catch (error) {
      console.error('Failed to upgrade building:', error);
      return false;
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

export { PURCHASABLE_BUILDING_TYPES, BUILDING_COST, getUpgradeCost };
export type { BuildingType, PlacedBuilding };

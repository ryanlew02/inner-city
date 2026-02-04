import { getDatabase, generateUUID } from './db';

export type BuildingType =
  | 'residential'
  | 'shop'
  | 'office'
  | 'cafe'
  | 'restaurant'
  | 'factory'
  | 'hospital'
  | 'school'
  | 'hotel'
  | 'powerplant'
  | 'warehouse'
  | 'special';

export interface PlacedBuilding {
  id: string;
  plot_index: number;
  building_type: BuildingType;
  tier: number;
  variant: number;
  created_at: number;
}

export const PURCHASABLE_BUILDING_TYPES: BuildingType[] = [
  'residential',
  'shop',
  'office',
  'cafe',
  'restaurant',
  'factory',
  'hospital',
  'school',
  'hotel',
  'powerplant',
  'warehouse',
];

export const BUILDING_COST = 3;
export const UPGRADE_COST_TIER2 = 3;
export const UPGRADE_COST_TIER3 = 5;

export const MAX_VARIANTS: Record<BuildingType, number> = {
  residential: 8,
  shop: 8,
  office: 8,
  cafe: 8,
  restaurant: 8,
  factory: 8,
  hospital: 8,
  school: 8,
  hotel: 8,
  powerplant: 8,
  warehouse: 8,
  special: 8,
};

export async function getPlacedBuildings(): Promise<PlacedBuilding[]> {
  const db = await getDatabase();
  const result = await db.getAllAsync<PlacedBuilding>(
    `SELECT * FROM placed_buildings ORDER BY plot_index ASC`
  );
  return result;
}

export async function getBuildingAt(plotIndex: number): Promise<PlacedBuilding | null> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<PlacedBuilding>(
    `SELECT * FROM placed_buildings WHERE plot_index = ${plotIndex}`
  );
  return result || null;
}

export async function getBuildingById(id: string): Promise<PlacedBuilding | null> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<PlacedBuilding>(
    `SELECT * FROM placed_buildings WHERE id = '${id}'`
  );
  return result || null;
}

export async function placeBuilding(
  plotIndex: number,
  buildingType: BuildingType,
  variant: number
): Promise<PlacedBuilding> {
  const db = await getDatabase();
  const id = generateUUID();
  const created_at = Date.now();

  await db.execAsync(`
    INSERT INTO placed_buildings (id, plot_index, building_type, tier, variant, created_at)
    VALUES ('${id}', ${plotIndex}, '${buildingType}', 1, ${variant}, ${created_at})
  `);

  return {
    id,
    plot_index: plotIndex,
    building_type: buildingType,
    tier: 1,
    variant,
    created_at,
  };
}

export async function upgradeBuilding(buildingId: string): Promise<PlacedBuilding | null> {
  const building = await getBuildingById(buildingId);
  if (!building || building.tier >= 3) {
    return null;
  }

  const newTier = building.tier + 1;
  const db = await getDatabase();
  await db.execAsync(
    `UPDATE placed_buildings SET tier = ${newTier} WHERE id = '${buildingId}'`
  );

  return {
    ...building,
    tier: newTier,
  };
}

export async function getNextAvailablePlotIndex(maxPlots: number): Promise<number | null> {
  const buildings = await getPlacedBuildings();
  const occupiedPlots = new Set(buildings.map(b => b.plot_index));

  for (let i = 0; i < maxPlots; i++) {
    if (!occupiedPlots.has(i)) {
      return i;
    }
  }

  return null;
}

export function getUpgradeCost(currentTier: number): number {
  if (currentTier === 1) return UPGRADE_COST_TIER2;
  if (currentTier === 2) return UPGRADE_COST_TIER3;
  return 0;
}

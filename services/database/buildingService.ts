import { generateUUID, getDatabase } from './db';

export type BuildingType =
  | 'apartment'
  | 'house'
  | 'office'
  | 'factory'
  | 'solarpanel';

export interface PlacedBuilding {
  id: string;
  grid_row: number;
  grid_col: number;
  building_type: BuildingType;
  tier: number;
  variant: number;
  size_x: number;  // Always 1
  size_y: number;  // Always 1
  created_at: number;
}

// All buildings are 1x1 (single plot) with the new assets
export const BUILDING_SIZES: Record<BuildingType, { x: 1; y: 1 }> = {
  apartment: { x: 1, y: 1 },
  house: { x: 1, y: 1 },
  office: { x: 1, y: 1 },
  factory: { x: 1, y: 1 },
  solarpanel: { x: 1, y: 1 },
};

export function getBuildingSize(type: BuildingType): { x: number; y: number } {
  return BUILDING_SIZES[type];
}

// Grid helper types
export interface GridPosition {
  row: number;
  col: number;
}

// Helper: Determine tile type at grid position
// Edges are always road; interior uses 3-cell blocks with roads at every 3rd row/col.
export function getGridTileType(row: number, col: number, gridRows: number, gridCols: number): 'plot' | 'road' {
  const isEdge = row === 0 || row === gridRows - 1 || col === 0 || col === gridCols - 1;
  if (isEdge) return 'road';
  if (row % 3 === 0 || col % 3 === 0) return 'road';
  return 'plot';
}

// Check if a position is a valid plot tile
function isPlotTile(row: number, col: number, gridRows: number, gridCols: number): boolean {
  return getGridTileType(row, col, gridRows, gridCols) === 'plot';
}

// Find the building at a specific grid position
export function findBuildingAtPosition(
  row: number,
  col: number,
  buildings: PlacedBuilding[]
): PlacedBuilding | undefined {
  return buildings.find(b => b.grid_row === row && b.grid_col === col);
}

// Check if a building can be placed at a grid position
export function canPlaceAtPosition(
  row: number,
  col: number,
  existingBuildings: PlacedBuilding[],
  gridRows: number,
  gridCols: number
): boolean {
  if (!isPlotTile(row, col, gridRows, gridCols)) return false;
  return !findBuildingAtPosition(row, col, existingBuildings);
}

// Find next available position for auto-building (top-left first)
export function findNextAvailablePosition(
  existingBuildings: PlacedBuilding[],
  gridRows: number,
  gridCols: number
): GridPosition | null {
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (canPlaceAtPosition(r, c, existingBuildings, gridRows, gridCols)) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

export const PURCHASABLE_BUILDING_TYPES: BuildingType[] = [
  'apartment',
  'house',
  'office',
  'factory',
  'solarpanel',
];

export const BUILDING_COST = 3;

// Max variants per building type based on new asset availability
export const MAX_VARIANTS: Record<BuildingType, number> = {
  apartment: 12,   // Apartments_level_1 (12 sprites)
  house: 6,        // 6 colors: green, orange, red, turquoise, wood, yellow
  office: 8,       // Offices_level_1 (8 sprites)
  factory: 2,      // factory_1, factory_2
  solarpanel: 2,   // solar_panels_1, solar_panels_2
};

export async function getPlacedBuildings(): Promise<PlacedBuilding[]> {
  const db = await getDatabase();
  const result = await db.getAllAsync<PlacedBuilding>(
    `SELECT * FROM placed_buildings ORDER BY created_at ASC`
  );
  return result
    .filter(building => building.building_type in BUILDING_SIZES)
    .map(building => ({
      ...building,
      size_x: building.size_x ?? BUILDING_SIZES[building.building_type].x,
      size_y: building.size_y ?? BUILDING_SIZES[building.building_type].y,
    }));
}

export async function getBuildingById(id: string): Promise<PlacedBuilding | null> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<PlacedBuilding>(
    `SELECT * FROM placed_buildings WHERE id = '${id}'`
  );
  return result || null;
}

export async function placeBuilding(
  row: number,
  col: number,
  buildingType: BuildingType,
  variant: number
): Promise<PlacedBuilding> {
  const db = await getDatabase();
  const id = generateUUID();
  const created_at = Date.now();
  const size = BUILDING_SIZES[buildingType];

  await db.execAsync(`
    INSERT INTO placed_buildings (id, plot_index, grid_row, grid_col, building_type, tier, variant, size_x, size_y, created_at)
    VALUES ('${id}', ${row * 1000 + col}, ${row}, ${col}, '${buildingType}', 1, ${variant}, ${size.x}, ${size.y}, ${created_at})
  `);

  return {
    id,
    grid_row: row,
    grid_col: col,
    building_type: buildingType,
    tier: 1,
    variant,
    size_x: size.x,
    size_y: size.y,
    created_at,
  };
}

export const MAX_TIER: Record<BuildingType, number> = {
  apartment: 1,
  house: 4,
  office: 2,
  factory: 1,
  solarpanel: 1,
};

// House variants map 1:1 to colors (1=green, 2=orange, 3=red, 4=turquoise, 5=wood, 6=yellow)
// On upgrade, keep the same color (variant stays the same)
function getRandomVariantSameColor(currentVariant: number): number {
  return currentVariant;
}

export async function upgradeBuilding(buildingId: string): Promise<PlacedBuilding | null> {
  const building = await getBuildingById(buildingId);
  if (!building || building.tier >= MAX_TIER[building.building_type]) {
    return null;
  }

  const newTier = building.tier + 1;
  const newVariant = building.building_type === 'house'
    ? getRandomVariantSameColor(building.variant)
    : building.variant;

  const db = await getDatabase();
  await db.execAsync(
    `UPDATE placed_buildings SET tier = ${newTier}, variant = ${newVariant} WHERE id = '${buildingId}'`
  );

  return {
    ...building,
    tier: newTier,
    variant: newVariant,
  };
}

export function getUpgradeCost(currentTier: number): number {
  if (currentTier === 1) return 3;
  if (currentTier === 2) return 5;
  if (currentTier === 3) return 8;
  return 0;
}

// Total tokens invested in a building at a given tier (build cost + all upgrades)
export function getTotalInvestment(tier: number): number {
  let total = BUILDING_COST; // initial build cost
  for (let t = 1; t < tier; t++) {
    total += getUpgradeCost(t);
  }
  return total;
}

// Refund for demolishing: 75% of total investment, integer division
export function getDemolishRefund(tier: number): number {
  return Math.floor(getTotalInvestment(tier) * 0.75);
}

export async function demolishBuilding(buildingId: string): Promise<boolean> {
  const db = await getDatabase();
  await db.execAsync(`DELETE FROM placed_buildings WHERE id = '${buildingId}'`);
  return true;
}

export async function clearAllBuildings(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`DELETE FROM placed_buildings`);
}

// --- Migration helpers ---

// getCitySize logic (duplicated from CityScreen to avoid circular deps)
function getCitySizeForMigration(buildingCount: number): { rows: number; cols: number } {
  const thresholds = [
    { threshold: 0, blocks: 1 },
    { threshold: 3, blocks: 2 },
    { threshold: 12, blocks: 3 },
    { threshold: 30, blocks: 4 },
    { threshold: 56, blocks: 5 },
  ];
  let blocksPerSide = 1;
  for (const t of thresholds) {
    if (buildingCount >= t.threshold) blocksPerSide = t.blocks;
  }
  const gridSize = 1 + blocksPerSide * 3;
  return { rows: gridSize, cols: gridSize };
}

// Old plot_index to grid position (row-major scan, the old broken way)
function oldPlotIndexToPosition(plotIndex: number, gridRows: number, gridCols: number): GridPosition | null {
  let count = 0;
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (getGridTileType(r, c, gridRows, gridCols) === 'plot') {
        if (count === plotIndex) return { row: r, col: c };
        count++;
      }
    }
  }
  return null;
}

// Migrate existing buildings from plot_index to grid_row/grid_col
export async function migrateToGridCoordinates(): Promise<void> {
  const db = await getDatabase();

  // Check if migration is needed (grid_row column has NULL values)
  const needsMigration = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM placed_buildings WHERE grid_row IS NULL`
  );
  if (!needsMigration || needsMigration.cnt === 0) return;

  // Load all buildings sorted by creation time
  const buildings = await db.getAllAsync<{ id: string; plot_index: number; created_at: number }>(
    `SELECT id, plot_index, created_at FROM placed_buildings ORDER BY created_at ASC`
  );

  // For each building, compute grid position using the grid size at the time it was placed
  for (let i = 0; i < buildings.length; i++) {
    const building = buildings[i];
    // When building i was placed, there were i existing buildings
    const { rows, cols } = getCitySizeForMigration(i);
    const pos = oldPlotIndexToPosition(building.plot_index, rows, cols);
    if (pos) {
      try {
        await db.execAsync(
          `UPDATE placed_buildings SET grid_row = ${pos.row}, grid_col = ${pos.col}, plot_index = ${pos.row * 1000 + pos.col} WHERE id = '${building.id}'`
        );
      } catch (e) {
        // If plot_index update fails (e.g. legacy unique constraint), just set grid coords
        await db.execAsync(
          `UPDATE placed_buildings SET grid_row = ${pos.row}, grid_col = ${pos.col} WHERE id = '${building.id}'`
        );
      }
    }
  }
}

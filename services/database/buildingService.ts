import { generateUUID, getDatabase } from './db';

export type BuildingType =
  | 'apartment'
  | 'house'
  | 'office'
  | 'factory'
  | 'solarpanel';

export interface PlacedBuilding {
  id: string;
  plot_index: number;
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

// Helper: Determine tile type at grid position (must match CityScreen getGridTileType)
// Edges (row 0, row gridRows-1, col 0, col gridCols-1) are always road; interior uses 3-cell blocks.
function getGridTileType(row: number, col: number, gridRows: number, gridCols: number): 'plot' | 'road' {
  const isEdge = row === 0 || row === gridRows - 1 || col === 0 || col === gridCols - 1;
  if (isEdge) return 'road';
  const isHorizontalRoadRow = row % 3 === 0;
  const isVerticalRoadCol = col % 3 === 0;
  if (isHorizontalRoadRow || isVerticalRoadCol) return 'road';
  return 'plot';
}

// Helper: Convert plot index to grid position
export function plotIndexToGridPosition(
  plotIndex: number,
  gridRows: number,
  gridCols: number
): GridPosition | null {
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

// Helper: Convert grid position to plot index
export function gridPositionToPlotIndex(
  row: number,
  col: number,
  gridRows: number,
  gridCols: number
): number | null {
  if (getGridTileType(row, col, gridRows, gridCols) !== 'plot') return null;

  let index = 0;
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (r === row && c === col) return index;
      if (getGridTileType(r, c, gridRows, gridCols) === 'plot') index++;
    }
  }
  return null;
}

// Helper: Get all plots occupied by a building at anchorPlot with given size
export function getOccupiedPlots(
  anchorPlot: number,
  sizeX: number,
  sizeY: number,
  gridRows: number,
  gridCols: number
): number[] {
  const anchor = plotIndexToGridPosition(anchorPlot, gridRows, gridCols);
  if (!anchor) return [];

  const plots: number[] = [];
  for (let dy = 0; dy < sizeY; dy++) {
    for (let dx = 0; dx < sizeX; dx++) {
      const targetRow = anchor.row + dy;
      const targetCol = anchor.col + dx;

      // Check bounds
      if (targetRow >= gridRows || targetCol >= gridCols) continue;

      const plot = gridPositionToPlotIndex(targetRow, targetCol, gridRows, gridCols);
      if (plot !== null) plots.push(plot);
    }
  }
  return plots;
}

// Helper: Check if a building can be placed at anchorPlot
export function canPlaceBuilding(
  anchorPlot: number,
  sizeX: number,
  sizeY: number,
  existingBuildings: PlacedBuilding[],
  gridRows: number,
  gridCols: number
): boolean {
  const requiredPlots = getOccupiedPlots(anchorPlot, sizeX, sizeY, gridRows, gridCols);

  // Check if we got all required plots (building fits in grid)
  if (requiredPlots.length !== sizeX * sizeY) {
    return false;
  }

  // Get all currently occupied plots
  const occupiedPlots = new Set<number>();
  for (const building of existingBuildings) {
    const buildingSize = BUILDING_SIZES[building.building_type];
    const plots = getOccupiedPlots(
      building.plot_index,
      buildingSize.x,
      buildingSize.y,
      gridRows,
      gridCols
    );
    plots.forEach(p => occupiedPlots.add(p));
  }

  // Check if any required plot is occupied
  for (const plot of requiredPlots) {
    if (occupiedPlots.has(plot)) {
      return false;
    }
  }

  return true;
}

// Helper: Find the building that occupies a specific plot (checking all occupied tiles)
export function findBuildingAtPlot(
  plotIndex: number,
  buildings: PlacedBuilding[],
  gridRows: number,
  gridCols: number
): PlacedBuilding | undefined {
  for (const building of buildings) {
    const size = BUILDING_SIZES[building.building_type];
    const occupiedPlots = getOccupiedPlots(
      building.plot_index,
      size.x,
      size.y,
      gridRows,
      gridCols
    );
    if (occupiedPlots.includes(plotIndex)) {
      return building;
    }
  }
  return undefined;
}

// All buildings are 1x1: the clicked plot is the anchor if it can be placed there.
export function findValidAnchorForBuilding(
  clickedPlot: number,
  buildingType: BuildingType,
  existingBuildings: PlacedBuilding[],
  gridRows: number,
  gridCols: number
): number | null {
  const size = BUILDING_SIZES[buildingType];
  if (canPlaceBuilding(clickedPlot, size.x, size.y, existingBuildings, gridRows, gridCols)) {
    return clickedPlot;
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
export const UPGRADE_COST_TIER2 = 3;
export const UPGRADE_COST_TIER3 = 5;

// Max variants per building type based on new asset availability
export const MAX_VARIANTS: Record<BuildingType, number> = {
  apartment: 12,   // Apartments_level_1 (12 sprites)
  house: 8,        // Colored houses across Green, Orange, Red, Turquoise, Wood, Yellow
  office: 8,       // Offices_level_1 (8 sprites)
  factory: 2,      // factory_1, factory_2
  solarpanel: 2,   // solar_panels_1, solar_panels_2
};

export async function getPlacedBuildings(): Promise<PlacedBuilding[]> {
  const db = await getDatabase();
  const result = await db.getAllAsync<PlacedBuilding>(
    `SELECT * FROM placed_buildings ORDER BY plot_index ASC`
  );
  // Ensure size_x and size_y have values (for legacy buildings)
  // Filter out buildings with old types that no longer exist
  return result
    .filter(building => building.building_type in BUILDING_SIZES)
    .map(building => ({
      ...building,
      size_x: building.size_x ?? BUILDING_SIZES[building.building_type].x,
      size_y: building.size_y ?? BUILDING_SIZES[building.building_type].y,
    }));
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
  const size = BUILDING_SIZES[buildingType];

  await db.execAsync(`
    INSERT INTO placed_buildings (id, plot_index, building_type, tier, variant, size_x, size_y, created_at)
    VALUES ('${id}', ${plotIndex}, '${buildingType}', 1, ${variant}, ${size.x}, ${size.y}, ${created_at})
  `);

  return {
    id,
    plot_index: plotIndex,
    building_type: buildingType,
    tier: 1,
    variant,
    size_x: size.x,
    size_y: size.y,
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

export async function getNextAvailablePlotIndex(
  maxPlots: number,
  buildingType: BuildingType,
  gridRows: number,
  gridCols: number
): Promise<number | null> {
  const buildings = await getPlacedBuildings();
  const size = BUILDING_SIZES[buildingType];

  // Prefer plots at the top of the grid first (smallest row), then left (smallest col)
  const validPlots: { plotIndex: number; row: number; col: number }[] = [];

  for (let i = 0; i < maxPlots; i++) {
    const pos = plotIndexToGridPosition(i, gridRows, gridCols);
    if (!pos || getGridTileType(pos.row, pos.col, gridRows, gridCols) !== 'plot') continue;
    if (!canPlaceBuilding(i, size.x, size.y, buildings, gridRows, gridCols)) continue;
    validPlots.push({ plotIndex: i, row: pos.row, col: pos.col });
  }

  if (validPlots.length === 0) return null;

  // Sort by row (top first), then by col (left first)
  validPlots.sort((a, b) => a.row - b.row || a.col - b.col);

  return validPlots[0].plotIndex;
}

export function getUpgradeCost(currentTier: number): number {
  if (currentTier === 1) return UPGRADE_COST_TIER2;
  if (currentTier === 2) return UPGRADE_COST_TIER3;
  return 0;
}

export async function clearAllBuildings(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`DELETE FROM placed_buildings`);
}

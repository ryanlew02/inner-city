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
  plot_index: number;  // Anchor plot (top-left of footprint)
  building_type: BuildingType;
  tier: number;
  variant: number;
  size_x: number;      // 1 or 2
  size_y: number;      // 1 or 2
  created_at: number;
}

// Building sizes - FIXED per building type (does not change with tier)
export const BUILDING_SIZES: Record<BuildingType, { x: 1 | 2; y: 1 | 2 }> = {
  residential: { x: 1, y: 1 },  // Houses - small homes
  shop: { x: 1, y: 2 },         // Shops - storefronts
  office: { x: 1, y: 2 },       // Office buildings
  cafe: { x: 1, y: 1 },         // Small cafes
  restaurant: { x: 1, y: 2 },   // Restaurants
  factory: { x: 2, y: 2 },      // Industrial
  hospital: { x: 2, y: 2 },     // Large public building
  school: { x: 2, y: 2 },       // Large public building
  hotel: { x: 1, y: 2 },        // Tall hotel
  powerplant: { x: 2, y: 2 },   // Industrial
  warehouse: { x: 1, y: 1 },    // Storage containers
  special: { x: 2, y: 2 },      // Landmarks (stadiums, etc.)
};

export function getBuildingSize(type: BuildingType): { x: number; y: number } {
  return BUILDING_SIZES[type];
}

// Grid helper types
export interface GridPosition {
  row: number;
  col: number;
}

// Helper: Determine tile type at grid position (matches CityScreen logic)
function getGridTileType(row: number, col: number, gridRows: number, gridCols: number): 'plot' | 'road' {
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

// Helper: Find a valid anchor plot for a building near the clicked plot
// For multi-tile buildings, this finds the top-left corner of the block containing the clicked plot
export function findValidAnchorForBuilding(
  clickedPlot: number,
  buildingType: BuildingType,
  existingBuildings: PlacedBuilding[],
  gridRows: number,
  gridCols: number
): number | null {
  const size = BUILDING_SIZES[buildingType];

  // If 1x1, the clicked plot is the anchor
  if (size.x === 1 && size.y === 1) {
    if (canPlaceBuilding(clickedPlot, size.x, size.y, existingBuildings, gridRows, gridCols)) {
      return clickedPlot;
    }
    return null;
  }

  const clickedPos = plotIndexToGridPosition(clickedPlot, gridRows, gridCols);
  if (!clickedPos) return null;

  // Find the top-left of the city block containing this plot
  // City blocks are 2x2 plot areas between roads
  // Roads are at row % 3 === 0 and col % 3 === 0
  // So block top-left is at row where (row-1) % 3 === 0, col where (col-1) % 3 === 0
  const blockStartRow = Math.floor((clickedPos.row - 1) / 3) * 3 + 1;
  const blockStartCol = Math.floor((clickedPos.col - 1) / 3) * 3 + 1;

  // Try anchoring at different positions within the block to fit the building
  for (let dr = 0; dr <= 2 - size.y; dr++) {
    for (let dc = 0; dc <= 2 - size.x; dc++) {
      const anchorRow = blockStartRow + dr;
      const anchorCol = blockStartCol + dc;
      const anchorPlot = gridPositionToPlotIndex(anchorRow, anchorCol, gridRows, gridCols);

      if (anchorPlot !== null && canPlaceBuilding(anchorPlot, size.x, size.y, existingBuildings, gridRows, gridCols)) {
        return anchorPlot;
      }
    }
  }

  return null;
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

// Max variants per building type based on new asset availability
export const MAX_VARIANTS: Record<BuildingType, number> = {
  residential: 8,  // Houses + Apartments variety
  shop: 8,         // Various shop types
  office: 8,       // Workplace types
  cafe: 4,         // Cafe and Bar with Front variants
  restaurant: 8,   // Various restaurant types
  factory: 7,      // Construction and industrial
  hospital: 4,     // Hospital and EmergencyRoom variants
  school: 2,       // School with/without roof (tier progression handles variety)
  hotel: 8,        // Apartments in different colors/sizes
  powerplant: 3,   // PowerPlant and WaterPlant
  warehouse: 8,    // Shipping containers
  special: 8,      // Stadiums, Cinema, Museum, etc.
};

export async function getPlacedBuildings(): Promise<PlacedBuilding[]> {
  const db = await getDatabase();
  const result = await db.getAllAsync<PlacedBuilding>(
    `SELECT * FROM placed_buildings ORDER BY plot_index ASC`
  );
  // Ensure size_x and size_y have values (for legacy buildings)
  return result.map(building => ({
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

  // Prefer plots at the "bottom" of blocks (higher row numbers within each block)
  // to avoid visual overlap with roads above
  const validPlots: { plotIndex: number; priority: number }[] = [];

  for (let i = 0; i < maxPlots; i++) {
    if (canPlaceBuilding(i, size.x, size.y, buildings, gridRows, gridCols)) {
      const pos = plotIndexToGridPosition(i, gridRows, gridCols);
      if (pos) {
        // Priority: prefer plots in row 2, 5, 8... (bottom of each block) over row 1, 4, 7... (top)
        // Within a block, row % 3 === 2 is bottom, row % 3 === 1 is top
        const rowInBlock = pos.row % 3; // 1 = top of block, 2 = bottom of block
        const priority = rowInBlock === 2 ? 0 : 1; // Lower priority number = preferred
        validPlots.push({ plotIndex: i, priority });
      }
    }
  }

  if (validPlots.length === 0) return null;

  // Sort by priority (prefer bottom plots), then by plot index
  validPlots.sort((a, b) => a.priority - b.priority || a.plotIndex - b.plotIndex);

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

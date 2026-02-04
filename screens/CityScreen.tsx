import { Text, View, StyleSheet, Image, ImageSourcePropType } from "react-native";
import { useHabits } from "../context/HabitsContext";

// Isometric tile dimensions
// The tile images are isometric diamonds - width is the full diamond width, height includes depth
const TILE_WIDTH = 64;
const TILE_HEIGHT = 64; // Includes the 3D depth portion
const ISO_TILE_HEIGHT = 32; // Just the top diamond portion (typically half of width for 2:1 isometric)

// Tile types
type TileType = "plot" | "road_h" | "road_v" | "road_cross" | "road_corner_nw" | "road_corner_ne" | "road_corner_sw" | "road_corner_se" | "road_t_north" | "road_t_south" | "road_t_east" | "road_t_west";

// City expansion configuration
// Each expansion tier adds a ring of blocks around the city
// Block = 2x2 plots, separated by roads every 3 tiles
interface CitySize {
  rows: number;
  cols: number;
  maxPlots: number;
  blocksPerSide: number;
}

// Calculate city size based on how many buildings have been completed
// Expansion happens when you're within 2 plots of filling the current tier
function getCitySize(completedCount: number): CitySize {
  // Tier 1: 1x1 blocks (4 plots) - 4x4 grid
  // Tier 2: 2x2 blocks (16 plots) - 7x7 grid
  // Tier 3: 3x3 blocks (36 plots) - 10x10 grid
  // Tier 4: 4x4 blocks (64 plots) - 13x13 grid
  // Tier 5: 5x5 blocks (100 plots) - 16x16 grid

  // Expand slightly before filling up to show "room to grow"
  const expansionThresholds = [
    { threshold: 0, blocks: 1 },   // Start with 1 block
    { threshold: 3, blocks: 2 },   // Expand at 3 buildings (before 4 is full)
    { threshold: 12, blocks: 3 },  // Expand at 12 buildings (before 16 is full)
    { threshold: 30, blocks: 4 },  // Expand at 30 buildings
    { threshold: 56, blocks: 5 },  // Expand at 56 buildings
  ];

  let blocksPerSide = 1;
  for (const tier of expansionThresholds) {
    if (completedCount >= tier.threshold) {
      blocksPerSide = tier.blocks;
    }
  }

  // Grid dimensions: roads at 0, 3, 6, 9... so grid = 1 + (blocksPerSide * 3)
  const gridSize = 1 + (blocksPerSide * 3);
  // Plots per side = blocksPerSide * 2
  const plotsPerSide = blocksPerSide * 2;
  const maxPlots = plotsPerSide * plotsPerSide;

  return {
    rows: gridSize,
    cols: gridSize,
    maxPlots,
    blocksPerSide,
  };
}

// Base grass tile - always rendered as the bottom layer
const grassTile = require("../assets/sprites/ground/emptytile.png");

// Road sprites - rendered on top of grass tiles
// road_straight.png goes NE-SW (for vertical roads)
// road_straight2.png goes NW-SE (for horizontal roads)
// Corners named by which edges have roads (e.g., sw_se = roads on SW and SE edges)
// T-junctions named by which edge is missing (e.g., missing_ne = no road on NE edge)
const roadSprites: Record<string, ImageSourcePropType> = {
  road_h: require("../assets/sprites/ground/road_straight2.png"),
  road_v: require("../assets/sprites/ground/road_straight.png"),
  road_cross: require("../assets/sprites/ground/road_cross.png"),
  // Corners - mapped by grid position to correct sprite
  road_corner_nw: require("../assets/sprites/ground/road_corner_sw_se.png"), // Top of diamond (0,0)
  road_corner_ne: require("../assets/sprites/ground/road_corner_nw_sw.png"), // Right of diamond (0,9)
  road_corner_sw: require("../assets/sprites/ground/road_corner_ne_se.png"), // Left of diamond (9,0)
  road_corner_se: require("../assets/sprites/ground/road_corner_nw_ne.png"), // Bottom of diamond (9,9)
  // T-junctions - mapped by which direction they open toward
  road_t_north: require("../assets/sprites/ground/road_t_missing_sw.png"), // Bottom edge, opens up
  road_t_south: require("../assets/sprites/ground/road_t_missing_ne.png"), // Top edge, opens down
  road_t_east: require("../assets/sprites/ground/road_t_missing_nw.png"),  // Left edge, opens right
  road_t_west: require("../assets/sprites/ground/road_t_missing_se.png"),  // Right edge, opens left
};

// Check if a tile type is a road
function isRoadTile(tileType: TileType): boolean {
  return tileType !== "plot";
}

// Building sprites - organized by type and tier
const buildingSprites = [
  // Residential
  require("../assets/sprites/buildings/residential_tier1_1.png"),
  require("../assets/sprites/buildings/residential_tier1_2.png"),
  require("../assets/sprites/buildings/residential_tier1_3.png"),
  require("../assets/sprites/buildings/residential_tier1_4.png"),
  // Shops
  require("../assets/sprites/buildings/shop_tier1_1.png"),
  require("../assets/sprites/buildings/shop_tier1_2.png"),
  // Offices
  require("../assets/sprites/buildings/office_tier1_1.png"),
  require("../assets/sprites/buildings/office_tier1_2.png"),
  // Cafes
  require("../assets/sprites/buildings/cafe_tier1_1.png"),
  require("../assets/sprites/buildings/cafe_tier1_2.png"),
  // Restaurants
  require("../assets/sprites/buildings/restaurant_tier1_1.png"),
  require("../assets/sprites/buildings/restaurant_tier1_2.png"),
  // Factories
  require("../assets/sprites/buildings/factory_tier1_1.png"),
  require("../assets/sprites/buildings/factory_tier1_2.png"),
  // Hospitals
  require("../assets/sprites/buildings/hospital_tier1_1.png"),
  // Schools
  require("../assets/sprites/buildings/school_tier1_1.png"),
];

// Grid layout: 2x2 building blocks with roads around them
// P = plot, R = road (type determined by position)
// Example for 3x3 blocks (10x10 grid, 36 plots):
//
// Row:  0    1    2    3    4    5    6    7    8    9
//  0:  NW   H    H    TS   H    H    TS   H    H    NE
//  1:  V    P    P    V    P    P    V    P    P    V
//  2:  V    P    P    V    P    P    V    P    P    V
//  3:  TE   H    H    X    H    H    X    H    H    TW
//  4:  V    P    P    V    P    P    V    P    P    V
//  5:  V    P    P    V    P    P    V    P    P    V
//  6:  TE   H    H    X    H    H    X    H    H    TW
//  7:  V    P    P    V    P    P    V    P    P    V
//  8:  V    P    P    V    P    P    V    P    P    V
//  9:  SW   H    H    TN   H    H    TN   H    H    SE

function getGridTileType(row: number, col: number, gridRows: number, gridCols: number): TileType | null {
  const isTopEdge = row === 0;
  const isBottomEdge = row === gridRows - 1;
  const isLeftEdge = col === 0;
  const isRightEdge = col === gridCols - 1;

  // Road rows: 0, 3, 6, 9... (every 3rd starting from 0)
  const isHorizontalRoadRow = row % 3 === 0;
  // Road cols: 0, 3, 6, 9...
  const isVerticalRoadCol = col % 3 === 0;

  // Corners
  if (isTopEdge && isLeftEdge) return "road_corner_nw";
  if (isTopEdge && isRightEdge) return "road_corner_ne";
  if (isBottomEdge && isLeftEdge) return "road_corner_sw";
  if (isBottomEdge && isRightEdge) return "road_corner_se";

  // T-junctions and crosses at intersections
  if (isHorizontalRoadRow && isVerticalRoadCol) {
    if (isTopEdge) return "road_t_south";
    if (isBottomEdge) return "road_t_north";
    if (isLeftEdge) return "road_t_east";
    if (isRightEdge) return "road_t_west";
    return "road_cross";
  }

  // Horizontal roads
  if (isHorizontalRoadRow) return "road_h";

  // Vertical roads
  if (isVerticalRoadCol) return "road_v";

  // Everything else is a building plot
  return "plot";
}

function buildPlotIndex(row: number, col: number, gridRows: number, gridCols: number): number | null {
  // Only plots (not roads) get an index
  const tileType = getGridTileType(row, col, gridRows, gridCols);
  if (tileType !== "plot") return null;

  // Count plots in reading order (left to right, top to bottom)
  let index = 0;
  for (let r = 0; r < row; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (getGridTileType(r, c, gridRows, gridCols) === "plot") index++;
    }
  }
  for (let c = 0; c < col; c++) {
    if (getGridTileType(row, c, gridRows, gridCols) === "plot") index++;
  }
  return index;
}

// Get rotation angle for road tiles - no rotation, all facing same way
function getTileRotation(tileType: TileType): string {
  return "0deg";
}

// Convert grid coordinates to isometric screen position
function gridToIso(row: number, col: number): { x: number; y: number } {
  // Isometric transformation:
  // - X moves right when col increases, left when row increases
  // - Y moves down when either row or col increases
  const x = (col - row) * (TILE_WIDTH / 2);
  const y = (col + row) * (ISO_TILE_HEIGHT / 2);
  return { x, y };
}

// Calculate the bounding box for the isometric grid
function getIsoBounds(rows: number, cols: number) {
  // Get corners of the grid in iso space
  const topLeft = gridToIso(0, 0);
  const topRight = gridToIso(0, cols - 1);
  const bottomLeft = gridToIso(rows - 1, 0);
  const bottomRight = gridToIso(rows - 1, cols - 1);

  const minX = Math.min(topLeft.x, bottomLeft.x);
  const maxX = Math.max(topRight.x, bottomRight.x) + TILE_WIDTH;
  const minY = Math.min(topLeft.y, topRight.y);
  const maxY = Math.max(bottomLeft.y, bottomRight.y) + TILE_HEIGHT;

  return {
    width: maxX - minX,
    height: maxY - minY,
    offsetX: -minX, // Offset to shift grid so it starts at 0
    offsetY: -minY,
  };
}

export default function CityScreen() {
  const { habits, completedCount } = useHabits();

  // Calculate dynamic city size based on completed buildings
  const citySize = getCitySize(completedCount);
  const { rows: GRID_ROWS, cols: GRID_COLS, maxPlots } = citySize;

  // Calculate isometric grid bounds
  const isoBounds = getIsoBounds(GRID_ROWS, GRID_COLS);

  const renderTile = (row: number, col: number) => {
    const tileType = getGridTileType(row, col, GRID_ROWS, GRID_COLS);
    if (!tileType) return null;

    const plotIndex = buildPlotIndex(row, col, GRID_ROWS, GRID_COLS);
    const hasBuilding = plotIndex !== null && plotIndex < completedCount;
    const rotation = getTileRotation(tileType);
    const isRoad = isRoadTile(tileType);

    // Get isometric position
    const isoPos = gridToIso(row, col);
    const screenX = isoPos.x + isoBounds.offsetX;
    const screenY = isoPos.y + isoBounds.offsetY;

    // Z-index for proper layering (tiles further down/right should be on top)
    const zIndex = row + col;

    return (
      <View
        key={`${row}-${col}`}
        style={[
          styles.tileContainer,
          {
            left: screenX,
            top: screenY,
            zIndex,
          },
        ]}
      >
        {/* Base grass tile - always rendered */}
        <Image source={grassTile} style={styles.tile} />

        {/* Road sprite on top of grass if this is a road tile */}
        {isRoad && (
          <Image
            source={roadSprites[tileType]}
            style={[styles.roadSprite, { transform: [{ rotate: rotation }] }]}
          />
        )}

        {/* Building sprite on top if this plot has a building */}
        {hasBuilding && (
          <Image
            source={buildingSprites[plotIndex! % buildingSprites.length]}
            style={styles.buildingSprite}
          />
        )}
      </View>
    );
  };

  const renderGrid = () => {
    const tiles = [];
    // Render in order for proper z-index layering (back to front)
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        tiles.push(renderTile(r, c));
      }
    }
    return tiles;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inner City</Text>
        <Text style={styles.subtitle}>Build your city, one habit at a time</Text>
      </View>

      <View style={styles.cityViewport}>
        <View
          style={[
            styles.gridContainer,
            {
              width: isoBounds.width,
              height: isoBounds.height,
            },
          ]}
        >
          {renderGrid()}
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{completedCount}</Text>
            <Text style={styles.statLabel}>Built</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{maxPlots}</Text>
            <Text style={styles.statLabel}>Plots</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{habits.length}</Text>
            <Text style={styles.statLabel}>Habits</Text>
          </View>
        </View>

        <Text style={styles.messageText}>
          {completedCount === 0
            ? "Complete habits to start building your city!"
            : completedCount >= maxPlots - 2
            ? "Your city is thriving! Keep building to expand!"
            : `${completedCount} building${completedCount !== 1 ? "s" : ""} constructed`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8ECEF",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1F2937",
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  cityViewport: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#87CEEB",
  },
  gridContainer: {
    position: "relative",
  },
  tileContainer: {
    position: "absolute",
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
  },
  tile: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
  },
  roadSprite: {
    position: "absolute",
    top: 0,
    left: 0,
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
  },
  buildingSprite: {
    position: "absolute",
    top: 0,
    left: 0,
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
  },
  statsContainer: {
    padding: 16,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statBox: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#3B82F6",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  messageText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 12,
  },
});

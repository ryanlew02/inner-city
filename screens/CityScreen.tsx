import { Text, View, StyleSheet, Image, ImageSourcePropType } from "react-native";
import { useHabits } from "../context/HabitsContext";

// Isometric tile dimensions
// The tile images are isometric diamonds - width is the full diamond width, height includes depth
const TILE_WIDTH = 64;
const TILE_HEIGHT = 64; // Includes the 3D depth portion
const ISO_TILE_HEIGHT = 32; // Just the top diamond portion (typically half of width for 2:1 isometric)

// Tile types
type TileType = "plot" | "road_h" | "road_v" | "road_cross" | "road_corner_nw" | "road_corner_ne" | "road_corner_sw" | "road_corner_se" | "road_t_north" | "road_t_south" | "road_t_east" | "road_t_west";

// Base grass tile - always rendered as the bottom layer
const grassTile = require("../assets/sprites/ground/emptytile.png");

// Road sprites - rendered on top of grass tiles
// road_straight.png goes NE-SW (for vertical roads)
// road_straight2.png goes NW-SE (for horizontal roads)
const roadSprites: Record<string, ImageSourcePropType> = {
  road_h: require("../assets/sprites/ground/road_straight2.png"),
  road_v: require("../assets/sprites/ground/road_straight.png"),
  road_cross: require("../assets/sprites/ground/road_cross.png"),
  road_corner_nw: require("../assets/sprites/ground/road_cross.png"),
  road_corner_ne: require("../assets/sprites/ground/road_cross.png"),
  road_corner_sw: require("../assets/sprites/ground/road_cross.png"),
  road_corner_se: require("../assets/sprites/ground/road_cross.png"),
  road_t_north: require("../assets/sprites/ground/road_cross.png"),
  road_t_south: require("../assets/sprites/ground/road_cross.png"),
  road_t_east: require("../assets/sprites/ground/road_cross.png"),
  road_t_west: require("../assets/sprites/ground/road_cross.png"),
};

// Check if a tile type is a road
function isRoadTile(tileType: TileType): boolean {
  return tileType !== "plot";
}

// Building sprites - organized by type and tier
const buildingSprites = [
  // Residential
  require("../assets/sprites/buildings/residential_tier1_1.jpg"),
  require("../assets/sprites/buildings/residential_tier1_2.jpg"),
  require("../assets/sprites/buildings/residential_tier1_3.jpg"),
  require("../assets/sprites/buildings/residential_tier1_4.jpg"),
  // Shops
  require("../assets/sprites/buildings/shop_tier1_1.jpg"),
  require("../assets/sprites/buildings/shop_tier1_2.jpg"),
  // Offices
  require("../assets/sprites/buildings/office_tier1_1.jpg"),
  require("../assets/sprites/buildings/office_tier1_2.jpg"),
  // Cafes
  require("../assets/sprites/buildings/cafe_tier1_1.jpg"),
  require("../assets/sprites/buildings/cafe_tier1_2.jpg"),
  // Restaurants
  require("../assets/sprites/buildings/restaurant_tier1_1.jpg"),
  require("../assets/sprites/buildings/restaurant_tier1_2.jpg"),
  // Factories
  require("../assets/sprites/buildings/factory_tier1_1.jpg"),
  require("../assets/sprites/buildings/factory_tier1_2.jpg"),
  // Hospitals
  require("../assets/sprites/buildings/hospital_tier1_1.jpg"),
  // Schools
  require("../assets/sprites/buildings/school_tier1_1.jpg"),
];

// Grid layout: 2x2 building blocks with roads around them
// P = plot, R = road (type determined by position)
// Layout for 25+ plots (6x6 = 36 plots arranged in 2x2 blocks)
//
// Row:  0    1    2    3    4    5    6    7    8
//  0:  NW   H    H    TS   H    H    TS   H    NE
//  1:  V    P    P    V    P    P    V    P    P    V
//  2:  V    P    P    V    P    P    V    P    P    V
//  3:  TE   H    H    X    H    H    X    H    H    TW
//  4:  V    P    P    V    P    P    V    P    P    V
//  5:  V    P    P    V    P    P    V    P    P    V
//  6:  TE   H    H    X    H    H    X    H    H    TW
//  7:  V    P    P    V    P    P    V    P    P    V
//  8:  V    P    P    V    P    P    V    P    P    V
//  9:  SW   H    H    TN   H    H    TN   H    SE

const GRID_ROWS = 10;
const GRID_COLS = 10;

function getGridTileType(row: number, col: number): TileType | null {
  const isTopEdge = row === 0;
  const isBottomEdge = row === GRID_ROWS - 1;
  const isLeftEdge = col === 0;
  const isRightEdge = col === GRID_COLS - 1;

  // Road rows: 0, 3, 6, 9 (every 3rd starting from 0)
  const isHorizontalRoadRow = row % 3 === 0;
  // Road cols: 0, 3, 6, 9
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

function buildPlotIndex(row: number, col: number): number | null {
  // Only plots (not roads) get an index
  const tileType = getGridTileType(row, col);
  if (tileType !== "plot") return null;

  // Count plots in reading order (left to right, top to bottom)
  let index = 0;
  for (let r = 0; r < row; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (getGridTileType(r, c) === "plot") index++;
    }
  }
  for (let c = 0; c < col; c++) {
    if (getGridTileType(row, c) === "plot") index++;
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

  // Calculate isometric grid bounds
  const isoBounds = getIsoBounds(GRID_ROWS, GRID_COLS);

  // Count total plots
  let totalPlots = 0;
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (getGridTileType(r, c) === "plot") totalPlots++;
    }
  }

  const renderTile = (row: number, col: number) => {
    const tileType = getGridTileType(row, col);
    if (!tileType) return null;

    const plotIndex = buildPlotIndex(row, col);
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
            <Text style={styles.statNumber}>{totalPlots}</Text>
            <Text style={styles.statLabel}>Plots</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{habits.length}</Text>
            <Text style={styles.statLabel}>Habits</Text>
          </View>
        </View>

        <Text style={styles.messageText}>
          {completedCount === 0
            ? "Complete habits to build on empty plots!"
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

import { useEffect, useRef, useState } from "react";
import { Image, ImageSourcePropType, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withDecay } from "react-native-reanimated";
import BuildingSheet from "../components/BuildingSheet";
import { BuildingType, PlacedBuilding, PURCHASABLE_BUILDING_TYPES, useBuildings } from "../context/BuildingContext";
import { useHabits } from "../context/HabitsContext";

// Isometric tile dimensions
const TILE_WIDTH = 64;
const TILE_HEIGHT = 64;
// Vertical step for isometric grid - controls how much tiles overlap vertically
// 32 was too close (tiles overlapped wrong), 48 was too far (gaps)
const ISO_TILE_HEIGHT = 37;

// All buildings are 1x1; sprite fills the tile and uses 'contain' to preserve aspect ratio.
const BUILDING_WIDTH = TILE_WIDTH - 12;
const BUILDING_HEIGHT = TILE_HEIGHT - 12;
const BUILDING_SPRITE_SIZE = {
  width: BUILDING_WIDTH,
  height: BUILDING_HEIGHT,
  offsetX: (TILE_WIDTH - BUILDING_WIDTH) / 2,
  offsetY: (TILE_HEIGHT - BUILDING_HEIGHT) / 2,
};
const PLOT_CONTAINER_EXTRA_TOP = 15;

// Check if a building variant uses a solar panel sprite
function isSolarPanel(building: PlacedBuilding): boolean {
  return building.building_type === "solarpanel";
}

function isFactorySprite(building: PlacedBuilding): boolean {
  return building.building_type === "factory";
}

function getBuildingSpriteStyle(building: PlacedBuilding): { width: number; height: number; top: number; left: number } {
  let top = 0;
  if (isSolarPanel(building)) {
    top = 7;
  } else if (isFactorySprite(building)) {
    top = -4;
  } else if (building.building_type === "office") {
    top = -4;
  } else if (building.building_type === "apartment") {
    top = -4;
  }
  // Solar panels - scale down
  if (building.building_type === "solarpanel") {
    const solarSize = BUILDING_SPRITE_SIZE.width - 8;
    return {
      width: solarSize,
      height: solarSize,
      top: top + 6,
      left: BUILDING_SPRITE_SIZE.offsetX + 4,
    };
  }
  // Houses are smaller buildings - scale them down
  if (building.building_type === "house") {
    const houseSize = BUILDING_SPRITE_SIZE.width - 8;
    return {
      width: houseSize,
      height: houseSize,
      top: top + 6,
      left: BUILDING_SPRITE_SIZE.offsetX + 4,
    };
  }
  return {
    width: BUILDING_SPRITE_SIZE.width,
    height: BUILDING_SPRITE_SIZE.height,
    top,
    left: BUILDING_SPRITE_SIZE.offsetX,
  };
}

// Build a lookup map of buildings by grid position for fast rendering
function buildBuildingMap(buildings: PlacedBuilding[]): Map<string, PlacedBuilding> {
  const map = new Map<string, PlacedBuilding>();
  for (const b of buildings) {
    map.set(`${b.grid_row},${b.grid_col}`, b);
  }
  return map;
}

// Tile types
type TileType = "plot" | "road_h" | "road_v" | "road_cross" | "road_corner_nw" | "road_corner_ne" | "road_corner_sw" | "road_corner_se" | "road_t_north" | "road_t_south" | "road_t_east" | "road_t_west";

interface CitySize {
  rows: number;
  cols: number;
  maxPlots: number;
  blocksPerSide: number;
}

function getCitySize(buildingCount: number): CitySize {
  const expansionThresholds = [
    { threshold: 0, blocks: 1 },
    { threshold: 3, blocks: 2 },
    { threshold: 12, blocks: 3 },
    { threshold: 30, blocks: 4 },
    { threshold: 56, blocks: 5 },
  ];

  let blocksPerSide = 1;
  for (const tier of expansionThresholds) {
    if (buildingCount >= tier.threshold) {
      blocksPerSide = tier.blocks;
    }
  }

  const gridSize = 1 + (blocksPerSide * 3);
  const plotsPerSide = blocksPerSide * 2;
  const maxPlots = plotsPerSide * plotsPerSide;

  return {
    rows: gridSize,
    cols: gridSize,
    maxPlots,
    blocksPerSide,
  };
}

const grassTile = require("../assets/Sprites/LandscapeTiles/grass.png");

// RoadTilesSimple: filenames without parentheses so Metro can resolve on Android
const roadSprites: Record<string, ImageSourcePropType> = {
  road_h: require("../assets/Sprites/RoadTilesSimple/road_2.png"),
  road_v: require("../assets/Sprites/RoadTilesSimple/road_1.png"),
  road_cross: require("../assets/Sprites/RoadTilesSimple/road_3.png"),
  road_corner_nw: require("../assets/Sprites/RoadTiles/road_asphalt_13.png"),
  road_corner_ne: require("../assets/Sprites/RoadTiles/road_asphalt_11.png"),
  road_corner_sw: require("../assets/Sprites/RoadTiles/road_asphalt_12.png"),
  road_corner_se: require("../assets/Sprites/RoadTiles/road_asphalt_14.png"),
  road_t_south: require("../assets/Sprites/RoadTilesSimple/road_7.png"),
  road_t_north: require("../assets/Sprites/RoadTiles/road_asphalt_10.png"),
  road_t_east: require("../assets/Sprites/RoadTilesSimple/road_8.png"),
  road_t_west: require("../assets/Sprites/RoadTiles/road_asphalt_9.png"),
};

function isRoadTile(tileType: TileType): boolean {
  return tileType !== "plot";
}

// New assets: 5 building categories. All paths static for Metro bundler.
const buildingSpriteMap: Record<string, ImageSourcePropType> = {
  // Apartments (12 variants, same sprites all tiers since only Level_1 exists)
  apartment_1_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_1.png"),
  apartment_1_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_2.png"),
  apartment_1_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_3.png"),
  apartment_1_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_4.png"),
  apartment_1_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_5.png"),
  apartment_1_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_6.png"),
  apartment_1_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_7.png"),
  apartment_1_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_8.png"),
  apartment_1_9: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_9.png"),
  apartment_1_10: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_10.png"),
  apartment_1_11: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_11.png"),
  apartment_1_12: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_12.png"),
  apartment_2_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_1.png"),
  apartment_2_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_2.png"),
  apartment_2_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_3.png"),
  apartment_2_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_4.png"),
  apartment_2_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_5.png"),
  apartment_2_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_6.png"),
  apartment_2_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_7.png"),
  apartment_2_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_8.png"),
  apartment_2_9: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_9.png"),
  apartment_2_10: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_10.png"),
  apartment_2_11: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_11.png"),
  apartment_2_12: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_12.png"),
  apartment_3_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_1.png"),
  apartment_3_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_2.png"),
  apartment_3_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_3.png"),
  apartment_3_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_4.png"),
  apartment_3_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_5.png"),
  apartment_3_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_6.png"),
  apartment_3_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_7.png"),
  apartment_3_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_8.png"),
  apartment_3_9: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_9.png"),
  apartment_3_10: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_10.png"),
  apartment_3_11: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_11.png"),
  apartment_3_12: require("../assets/Sprites/ModularBlocksTiles/Houses/Apartments_level_1/apartments_level_1_12.png"),

  // Houses (8 variants across colors, tiers map to levels 1-3)
  house_1_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_1/house_green_level_1_1.png"),
  house_1_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_1/house_green_level_1_2.png"),
  house_1_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Orange_houses/Level_1/house_orange_level_1_1.png"),
  house_1_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Red_houses/Level_1/house_red_level_1_1.png"),
  house_1_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise_houses/Level_1/house_turquoise_level_1_1.png"),
  house_1_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood_houses/Level_1/house_wood_level_1_1.png"),
  house_1_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_1/house_yellow_level_1_1.png"),
  house_1_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_1/house_yellow_level_1_2.png"),
  house_2_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_2/house_green_level_2_1.png"),
  house_2_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_2/house_green_level_2_2.png"),
  house_2_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Orange_houses/Level_2/house_orange_level_2_1.png"),
  house_2_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Red_houses/Level_2/house_red_level_2_1.png"),
  house_2_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise_houses/Level_2/house_turquoise_level_2_1.png"),
  house_2_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood_houses/Level_2/house_wood_level_2_1.png"),
  house_2_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_2/house_yellow_level_2_1.png"),
  house_2_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_2/house_yellow_level_2_2.png"),
  house_3_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_3/house_green_level_3_1.png"),
  house_3_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_3/house_green_level_3_2.png"),
  house_3_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Orange_houses/Level_3/house_orange_level_3_1.png"),
  house_3_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Red_houses/Level_3/house_red_level_3_1.png"),
  house_3_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise_houses/Level_3/house_turquoise_level_3_1.png"),
  house_3_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood_houses/Level_3/house_wood_level_3_1.png"),
  house_3_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_3/house_yellow_level_3_1.png"),
  house_3_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_3/house_yellow_level_3_2.png"),

  // Offices (8 variants, same sprites all tiers since only Level_1 exists)
  office_1_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_1.png"),
  office_1_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_2.png"),
  office_1_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_3.png"),
  office_1_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_4.png"),
  office_1_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_5.png"),
  office_1_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_6.png"),
  office_1_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_7.png"),
  office_1_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_8.png"),
  office_2_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_1.png"),
  office_2_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_2.png"),
  office_2_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_3.png"),
  office_2_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_4.png"),
  office_2_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_5.png"),
  office_2_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_6.png"),
  office_2_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_7.png"),
  office_2_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_8.png"),
  office_3_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_1.png"),
  office_3_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_2.png"),
  office_3_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_3.png"),
  office_3_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_4.png"),
  office_3_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_5.png"),
  office_3_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_6.png"),
  office_3_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_7.png"),
  office_3_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_8.png"),

  // Factory (2 variants, same sprites all tiers)
  factory_1_1: require("../assets/Sprites/ModularBlocksTiles/factory_1.png"),
  factory_1_2: require("../assets/Sprites/ModularBlocksTiles/factory_2.png"),
  factory_2_1: require("../assets/Sprites/ModularBlocksTiles/factory_1.png"),
  factory_2_2: require("../assets/Sprites/ModularBlocksTiles/factory_2.png"),
  factory_3_1: require("../assets/Sprites/ModularBlocksTiles/factory_1.png"),
  factory_3_2: require("../assets/Sprites/ModularBlocksTiles/factory_2.png"),

  // Solar Panels (2 variants, same sprites all tiers)
  solarpanel_1_1: require("../assets/Sprites/ModularBlocksTiles/solar_panels_1.png"),
  solarpanel_1_2: require("../assets/Sprites/ModularBlocksTiles/solar_panels_2.png"),
  solarpanel_2_1: require("../assets/Sprites/ModularBlocksTiles/solar_panels_1.png"),
  solarpanel_2_2: require("../assets/Sprites/ModularBlocksTiles/solar_panels_2.png"),
  solarpanel_3_1: require("../assets/Sprites/ModularBlocksTiles/solar_panels_1.png"),
  solarpanel_3_2: require("../assets/Sprites/ModularBlocksTiles/solar_panels_2.png"),
};

function getBuildingSprite(building: PlacedBuilding): ImageSourcePropType {
  const { building_type, tier, variant } = building;
  const key = `${building_type}_${tier}_${variant}`;

  // Try exact match first
  if (buildingSpriteMap[key]) {
    return buildingSpriteMap[key];
  }

  // Fall back to tier 1 if higher tier doesn't exist
  const fallbackKey = `${building_type}_1_${variant}`;
  if (buildingSpriteMap[fallbackKey]) {
    return buildingSpriteMap[fallbackKey];
  }

  // Final fallback to variant 1 tier 1
  const finalFallback = `${building_type}_1_1`;
  return buildingSpriteMap[finalFallback] || buildingSpriteMap["house_1_1"];
}

function getGridTileType(row: number, col: number, gridRows: number, gridCols: number): TileType | null {
  const isTopEdge = row === 0;
  const isBottomEdge = row === gridRows - 1;
  const isLeftEdge = col === 0;
  const isRightEdge = col === gridCols - 1;

  const isHorizontalRoadRow = row % 3 === 0;
  const isVerticalRoadCol = col % 3 === 0;

  if (isTopEdge && isLeftEdge) return "road_corner_nw";
  if (isTopEdge && isRightEdge) return "road_corner_ne";
  if (isBottomEdge && isLeftEdge) return "road_corner_sw";
  if (isBottomEdge && isRightEdge) return "road_corner_se";

  if (isHorizontalRoadRow && isVerticalRoadCol) {
    if (isTopEdge) return "road_t_south";
    if (isBottomEdge) return "road_t_north";
    if (isLeftEdge) return "road_t_east";
    if (isRightEdge) return "road_t_west";
    return "road_cross";
  }

  if (isHorizontalRoadRow) return "road_h";
  if (isVerticalRoadCol) return "road_v";

  return "plot";
}


function getTileRotation(_tileType: TileType): string {
  return "0deg";
}

function gridToIso(row: number, col: number): { x: number; y: number } {
  const x = (col - row) * (TILE_WIDTH / 2);
  const y = (col + row) * (ISO_TILE_HEIGHT / 2);
  return { x, y };
}

// Convert container coordinates (e.g. from tap) to grid cell.
// Uses inverse of gridToIso so the tapped plot is the one under the finger.
function isoToGrid(
  px: number,
  py: number,
  offsetX: number,
  offsetY: number,
  gridRows: number,
  gridCols: number
): { row: number; col: number } | null {
  // Offset by half a tile so the calculation is centered on each diamond
  const isoX = px - offsetX - TILE_WIDTH / 2;
  const isoY = py - offsetY - ISO_TILE_HEIGHT / 2;
  const halfW = TILE_WIDTH / 2;
  const halfH = ISO_TILE_HEIGHT / 2;
  const colMinusRow = isoX / halfW;
  const colPlusRow = isoY / halfH;
  const col = (colPlusRow + colMinusRow) / 2;
  const row = (colPlusRow - colMinusRow) / 2;
  const rowCell = Math.round(row);
  const colCell = Math.round(col);
  if (rowCell < 0 || rowCell >= gridRows || colCell < 0 || colCell >= gridCols) return null;
  return { row: rowCell, col: colCell };
}

function getIsoBounds(rows: number, cols: number) {
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
    offsetX: -minX,
    offsetY: -minY,
  };
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.0;

export default function CityScreen() {
  const { habits, completedCount, setOnTokenEarned } = useHabits();
  const {
    buildings,
    tokens,
    placeBuilding,
    autoBuildBuilding,
    upgradeBuilding,
    getBuildingAtPosition,
    refreshTokens,
    resetCity,
  } = useBuildings();

  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetMode, setSheetMode] = useState<"build" | "upgrade" | "autobuild">("build");
  const [selectedPlot, setSelectedPlot] = useState<{ row: number; col: number } | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<PlacedBuilding | undefined>(undefined);

  // Register callback to refresh tokens when habit is completed
  useEffect(() => {
    setOnTokenEarned(() => refreshTokens);
    return () => setOnTokenEarned(undefined);
  }, [setOnTokenEarned, refreshTokens]);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      focalX.value = event.focalX;
      focalY.value = event.focalY;
    })
    .onUpdate((event) => {
      const newScale = Math.min(Math.max(savedScale.value * event.scale, MIN_SCALE), MAX_SCALE);
      // Zoom around the focal point so it stays under your fingers
      const scaleRatio = newScale / savedScale.value;
      translateX.value = focalX.value - (focalX.value - savedTranslateX.value) * scaleRatio;
      translateY.value = focalY.value - (focalY.value - savedTranslateY.value) * scaleRatio;
      scale.value = newScale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd((event) => {
      // Momentum scrolling — continues in the direction of the flick
      translateX.value = withDecay({ velocity: event.velocityX, deceleration: 0.997 });
      translateY.value = withDecay({ velocity: event.velocityY, deceleration: 0.997 });
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const springConfig = { damping: 18, stiffness: 120 };
      scale.value = withSpring(1, springConfig);
      translateX.value = withSpring(0, springConfig);
      translateY.value = withSpring(0, springConfig);
      savedScale.value = 1;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    });

  const buildingCount = buildings.length;
  const citySize = getCitySize(buildingCount);
  const { rows: GRID_ROWS, cols: GRID_COLS, maxPlots } = citySize;
  const isoBounds = getIsoBounds(GRID_ROWS, GRID_COLS);

  const gridContainerRef = useRef<View>(null);

  const handleTapPosition = (ex: number, ey: number) => {
    // Tap coordinates are relative to the viewport.
    // The grid is centered in the viewport, and transforms (translate then scale)
    // are applied around the grid's center. Convert tap to grid content coords:
    //   contentX = (tapX - viewportCenterX - translateX) / scale + gridWidth/2
    //   contentY = (tapY - viewportCenterY - translateY) / scale + gridHeight/2
    const scaleVal = scale.value;
    const tx = translateX.value;
    const ty = translateY.value;
    const localX = (ex - viewportSize.width / 2 - tx) / scaleVal + isoBounds.width / 2;
    const localY = (ey - viewportSize.height / 2 - ty) / scaleVal + isoBounds.height / 2;

    const hit = isoToGrid(
      localX,
      localY,
      isoBounds.offsetX,
      isoBounds.offsetY,
      GRID_ROWS,
      GRID_COLS
    );
    if (hit && getGridTileType(hit.row, hit.col, GRID_ROWS, GRID_COLS) === "plot") {
      handlePlotPress(hit.row, hit.col);
    }
  };

  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .requireExternalGestureToFail(doubleTapGesture)
    .onEnd((e) => {
      runOnJS(handleTapPosition)(e.x, e.y);
    });

  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    doubleTapGesture,
    singleTapGesture
  );

  const animatedGridStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handlePlotPress = (row: number, col: number) => {
    const existingBuilding = getBuildingAtPosition(row, col);
    if (existingBuilding) {
      setSelectedBuilding(existingBuilding);
      setSheetMode("upgrade");
      setSheetVisible(true);
    } else {
      setSelectedPlot({ row, col });
      setSheetMode("build");
      setSheetVisible(true);
    }
  };

  const handleAutoBuild = () => {
    setSheetMode("autobuild");
    setSheetVisible(true);
  };

  const handleAutoBuildOne = async () => {
    const randomType = PURCHASABLE_BUILDING_TYPES[
      Math.floor(Math.random() * PURCHASABLE_BUILDING_TYPES.length)
    ];
    const success = await autoBuildBuilding(randomType, GRID_ROWS, GRID_COLS);
    if (success) {
      setSheetVisible(false);
    }
  };

  const handleAutoBuildAll = async () => {
    const buildingsCanAfford = Math.floor(tokens / 3);
    for (let i = 0; i < buildingsCanAfford; i++) {
      const randomType = PURCHASABLE_BUILDING_TYPES[
        Math.floor(Math.random() * PURCHASABLE_BUILDING_TYPES.length)
      ];
      const success = await autoBuildBuilding(randomType, GRID_ROWS, GRID_COLS);
      if (!success) break;
    }
    setSheetVisible(false);
  };

  const handleSelectBuildingType = async (type: BuildingType) => {
    let success = false;
    if (selectedPlot) {
      success = await placeBuilding(selectedPlot.row, selectedPlot.col, type, GRID_ROWS, GRID_COLS);
    } else {
      success = await autoBuildBuilding(type, GRID_ROWS, GRID_COLS);
    }
    if (success) {
      setSheetVisible(false);
      setSelectedPlot(null);
    }
  };

  const handleUpgrade = async () => {
    if (selectedBuilding) {
      const success = await upgradeBuilding(selectedBuilding.id);
      if (success) {
        setSheetVisible(false);
        setSelectedBuilding(undefined);
      }
    }
  };

  const handleSheetClose = () => {
    setSheetVisible(false);
    setSelectedPlot(null);
    setSelectedBuilding(undefined);
  };

  const buildingMap = buildBuildingMap(buildings);

  const renderTile = (row: number, col: number) => {
    const tileType = getGridTileType(row, col, GRID_ROWS, GRID_COLS);
    if (!tileType) return null;

    const building = tileType === "plot" ? buildingMap.get(`${row},${col}`) ?? null : null;
    const rotation = getTileRotation(tileType);
    const isPlot = tileType === "plot";

    const isoPos = gridToIso(row, col);
    const screenX = isoPos.x + isoBounds.offsetX;
    const screenY = isoPos.y + isoBounds.offsetY;
    const zIndex = (row + col) * 10;

    if (isPlot) {
      const spriteStyle = building ? getBuildingSpriteStyle(building) : null;

      const containerTop = screenY - PLOT_CONTAINER_EXTRA_TOP;
      const containerHeight = TILE_HEIGHT + PLOT_CONTAINER_EXTRA_TOP;
      const grassTop = PLOT_CONTAINER_EXTRA_TOP;
      const buildingTopInContainer = PLOT_CONTAINER_EXTRA_TOP > 0 ? 0 : BUILDING_SPRITE_SIZE.offsetY;

      return (
        <View
          key={`${row}-${col}`}
          pointerEvents="none"
          style={[
            styles.tileContainerBase,
            {
              left: screenX,
              top: containerTop,
              width: TILE_WIDTH,
              height: containerHeight,
              zIndex,
            },
          ]}
        >
          <Image source={grassTile} style={[styles.tile, { position: "absolute", left: 0, top: grassTop }]} />
          {building && spriteStyle && (
            <Image
              source={getBuildingSprite(building)}
              resizeMode="contain"
              style={[
                styles.buildingSpriteBase,
                {
                  width: spriteStyle.width,
                  height: spriteStyle.height,
                  top: buildingTopInContainer + spriteStyle.top,
                  left: spriteStyle.left,
                },
              ]}
            />
          )}
        </View>
      );
    }

    // Render road tiles
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
        <Image
          source={roadSprites[tileType]}
          style={[styles.tile, { transform: [{ rotate: rotation }] }]}
        />
      </View>
    );
  };

  const renderGrid = () => {
    const tiles = [];
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
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Inner City</Text>
            <Text style={styles.subtitle}>Build your city, one habit at a time</Text>
          </View>
          <View style={styles.tokenDisplay}>
            <Image source={require("../assets/images/build_coin.png")} style={styles.tokenIconImage} />
            <Text style={styles.tokenValue}>{tokens}</Text>
          </View>
        </View>
      </View>

      <GestureDetector gesture={composedGesture}>
        <View
          style={styles.cityViewport}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setViewportSize({ width, height });
          }}
        >
          <Animated.View
            ref={gridContainerRef as React.RefObject<View>}
            style={[
              styles.gridContainer,
              {
                width: isoBounds.width,
                height: isoBounds.height,
              },
              animatedGridStyle,
            ]}
          >
            {renderGrid()}
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{buildingCount}</Text>
            <Text style={styles.statLabel}>Built</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{completedCount}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{habits.length}</Text>
            <Text style={styles.statLabel}>Habits</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.autoBuildButton} onPress={handleAutoBuild}>
          <Text style={styles.autoBuildButtonText}>+ Auto Build</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resetButton} onPress={resetCity}>
          <Text style={styles.resetButtonText}>Reset City (Testing)</Text>
        </TouchableOpacity>

        <Text style={styles.messageText}>
          {buildingCount === 0
            ? "Tap an empty plot or use Auto Build to start!"
            : buildingCount >= maxPlots - 2
            ? "Your city is thriving! Keep building to expand!"
            : `Tap plots to build, tap buildings to upgrade`}
        </Text>
      </View>

      <BuildingSheet
        visible={sheetVisible}
        onClose={handleSheetClose}
        mode={sheetMode}
        selectedBuilding={selectedBuilding}
        tokens={tokens}
        onSelectBuildingType={handleSelectBuildingType}
        onUpgrade={handleUpgrade}
        onAutoBuildOne={handleAutoBuildOne}
        onAutoBuildAll={handleAutoBuildAll}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
  tokenDisplay: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tokenIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  tokenIconImage: {
    width: 26,
    height: 26,
    marginRight: 6,
  },
  tokenValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#92400E",
  },
  cityViewport: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#87CEEB", // Sky blue for a more vibrant look
    overflow: "hidden",
  },
  gridContainer: {
    position: "relative",
    overflow: "visible",
  },
  tileContainer: {
    position: "absolute",
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
  },
  tileContainerBase: {
    position: "absolute",
  },
  tileHitArea: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    position: "absolute",
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
  buildingSpriteBase: {
    position: "absolute",
    // Size and position set dynamically based on building footprint
  },
  statsContainer: {
    padding: 16,
    zIndex: 10,
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
  autoBuildButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  autoBuildButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  resetButton: {
    alignItems: "center",
    marginTop: 8,
    paddingVertical: 8,
  },
  resetButtonText: {
    color: "#EF4444",
    fontSize: 12,
  },
  messageText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 12,
  },
});

import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useCallback, useRef, useState, memo } from "react";
import { Image, ImageSourcePropType, Modal, Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withDecay } from "react-native-reanimated";
import BuildingSheet from "../components/BuildingSheet";
import { BuildingType, PlacedBuilding, PURCHASABLE_BUILDING_TYPES, useBuildings } from "../context/BuildingContext";
import { useHabits } from "../context/HabitsContext";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { ThemeColors } from "../constants/Colors";

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
    // Per-tier pixel adjustments (SE=top+left, NE=top-left, NW=top-left-, etc.)
    let shiftTop = 0;
    let shiftLeft = 0;
    if (building.tier === 2) {
      // NE 1px + NW 1px = top -2, left 0
      shiftTop = -2;
      shiftLeft = 0;
    } else if (building.tier === 3) {
      // N 1px
      shiftTop = -1;
      shiftLeft = 0;
    } else if (building.tier === 4) {
      // NW 2px + NE 1px = top -3, left -1
      shiftTop = -3;
      shiftLeft = -1;
    }
    return {
      width: houseSize,
      height: houseSize,
      top: top + 6 + shiftTop,
      left: BUILDING_SPRITE_SIZE.offsetX + 4 + shiftLeft,
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
  // Start at 1 block and keep expanding whenever plots fill up.
  // Each block tier has (blocksPerSide * 2)² plots.
  // Expand when buildings reach ~75% of current capacity.
  let blocksPerSide = 1;
  while (true) {
    const plotsPerSide = blocksPerSide * 2;
    const maxPlots = plotsPerSide * plotsPerSide;
    if (buildingCount < maxPlots || blocksPerSide >= 100) break;
    blocksPerSide++;
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

// Memoized tile components to avoid re-rendering every tile on pan/zoom
const PlotTile = memo(function PlotTile({ screenX, containerTop, grassTop, building, buildingTopInContainer, zIndex }: {
  screenX: number; containerTop: number; grassTop: number;
  building: PlacedBuilding | null; buildingTopInContainer: number; zIndex: number;
}) {
  if (!building) {
    // Empty plot — single Image, no wrapper View
    return (
      <Image
        source={grassTile}
        style={{
          position: "absolute" as const,
          width: TILE_WIDTH,
          height: TILE_HEIGHT,
          left: screenX,
          top: containerTop + grassTop,
          zIndex,
        }}
      />
    );
  }
  const spriteStyle = getBuildingSpriteStyle(building);
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute" as const,
        left: screenX,
        top: containerTop,
        width: TILE_WIDTH,
        height: TILE_HEIGHT + PLOT_CONTAINER_EXTRA_TOP,
        zIndex,
      }}
    >
      <Image source={grassTile} style={{ width: TILE_WIDTH, height: TILE_HEIGHT, position: "absolute", left: 0, top: grassTop }} />
      <Image
        source={getBuildingSprite(building)}
        resizeMode="contain"
        style={{
          position: "absolute" as const,
          width: spriteStyle.width,
          height: spriteStyle.height,
          top: buildingTopInContainer + spriteStyle.top,
          left: spriteStyle.left,
        }}
      />
    </View>
  );
});

// Road tile — single Image, no wrapper View
const RoadTile = memo(function RoadTile({ screenX, screenY, tileType, zIndex }: {
  screenX: number; screenY: number; tileType: string; zIndex: number;
}) {
  return (
    <Image
      source={roadSprites[tileType]}
      style={{
        position: "absolute" as const,
        width: TILE_WIDTH,
        height: TILE_HEIGHT,
        left: screenX,
        top: screenY,
        zIndex,
      }}
    />
  );
});

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
  // Apartments (12 variants, max tier 1)
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

  // Houses are handled separately via houseSprites array below

  // Offices (8 variants tier 1, 4 variants tier 2)
  office_1_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_1.png"),
  office_1_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_2.png"),
  office_1_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_3.png"),
  office_1_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_4.png"),
  office_1_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_5.png"),
  office_1_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_6.png"),
  office_1_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_7.png"),
  office_1_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_1/office_level_1_8.png"),
  office_2_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_2/offices_level_2_1.png"),
  office_2_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_2/offices_level_2_2.png"),
  office_2_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_2/offices_level_2_3.png"),
  office_2_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_2/offices_level_2_4.png"),
  office_2_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_2/offices_level_2_1.png"),
  office_2_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_2/offices_level_2_2.png"),
  office_2_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_2/offices_level_2_3.png"),
  office_2_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Offices_level_2/offices_level_2_4.png"),

  // Factory (2 variants, max tier 1)
  factory_1_1: require("../assets/Sprites/ModularBlocksTiles/factory_1.png"),
  factory_1_2: require("../assets/Sprites/ModularBlocksTiles/factory_2.png"),

  // Solar Panels (2 variants, max tier 1)
  solarpanel_1_1: require("../assets/Sprites/ModularBlocksTiles/solar_panels_1.png"),
  solarpanel_1_2: require("../assets/Sprites/ModularBlocksTiles/solar_panels_2.png"),
};

// House sprites organized by color (variant 1-6) and tier (1-4)
// Each color has 6 sprites at tier 1, 4 sprites at tiers 2-4
// houseSprites[colorIndex][tierIndex] = array of sprites
const houseSprites: ImageSourcePropType[][][] = [
  // variant 1 = green
  [
    [ // tier 1 (6 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_1/house_green_level_1_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_1/house_green_level_1_2.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_1/house_green_level_1_3.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_1/house_green_level_1_4.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_1/house_green_level_1_5.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_1/house_green_level_1_6.png"),
    ],
    [ // tier 2 (4 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_2/house_green_level_2_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_2/house_green_level_2_2.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_2/house_green_level_2_3.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_2/house_green_level_2_4.png"),
    ],
    [ // tier 3 (4 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_3/house_green_level_3_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_3/house_green_level_3_2.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_3/house_green_level_3_3.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_3/house_green_level_3_4.png"),
    ],
    [ // tier 4 (4 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_4/house_green_level_4_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_4/house_green_level_4_2.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_4/house_green_level_4_3.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Green_houses/Level_4/house_green_level_4_4.png"),
    ],
  ],
  // variant 2 = orange
  [
    [ // tier 1 (6 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Orange_houses/Level_1/house_orange_level_1_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Orange_houses/Level_1/house_orange_level_1_2.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Orange_houses/Level_1/house_orange_level_1_3.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Orange_houses/Level_1/house_orange_level_1_4.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Orange_houses/Level_1/house_orange_level_1_5.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Orange_houses/Level_1/house_orange_level_1_6.png"),
    ],
    [ // tier 2 (4 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Orange_houses/Level_2/house_orange_level_2_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Orange_houses/Level_2/house_orange_level_2_2.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Orange_houses/Level_2/house_orange_level_2_3.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Orange_houses/Level_2/house_orange_level_2_4.png"),
    ],
    [ // tier 3 (4 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Orange_houses/Level_3/house_orange_level_3_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Orange_houses/Level_3/house_orange_level_3_2.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Orange_houses/Level_3/house_orange_level_3_3.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Orange_houses/Level_3/house_orange_level_3_4.png"),
    ],
    [ // tier 4 (4 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Orange_houses/Level_4/house_orange_level_4_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Orange_houses/Level_4/house_orange_level_4_2.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Orange_houses/Level_4/house_orange_level_4_3.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Orange_houses/Level_4/house_orange_level_4_4.png"),
    ],
  ],
  // variant 3 = red
  [
    [ // tier 1 (6 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Red_houses/Level_1/house_red_level_1_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Red_houses/Level_1/house_red_level_1_2.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Red_houses/Level_1/house_red_level_1_3.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Red_houses/Level_1/house_red_level_1_4.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Red_houses/Level_1/house_red_level_1_5.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Red_houses/Level_1/house_red_level_1_6.png"),
    ],
    [ // tier 2 (4 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Red_houses/Level_2/house_red_level_2_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Red_houses/Level_2/house_red_level_2_2.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Red_houses/Level_2/house_red_level_2_3.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Red_houses/Level_2/house_red_level_2_4.png"),
    ],
    [ // tier 3 (4 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Red_houses/Level_3/house_red_level_3_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Red_houses/Level_3/house_red_level_3_2.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Red_houses/Level_3/house_red_level_3_3.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Red_houses/Level_3/house_red_level_3_4.png"),
    ],
    [ // tier 4 (3 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Red_houses/Level_4/house_red_level_4_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Red_houses/Level_4/house_red_level_4_2.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Red_houses/Level_4/house_red_level_4_3.png"),
    ],
  ],
  // variant 4 = turquoise
  [
    [ // tier 1 (6 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise_houses/Level_1/house_turquoise_level_1_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise_houses/Level_1/house_turquoise_level_1_2.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise_houses/Level_1/house_turquoise_level_1_3.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise_houses/Level_1/house_turquoise_level_1_4.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise_houses/Level_1/house_turquoise_level_1_5.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise_houses/Level_1/house_turquoise_level_1_6.png"),
    ],
    [ // tier 2 (4 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise_houses/Level_2/house_turquoise_level_2_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise_houses/Level_2/house_turquoise_level_2_2.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise_houses/Level_2/house_turquoise_level_2_3.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise_houses/Level_2/house_turquoise_level_2_4.png"),
    ],
    [ // tier 3 (4 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise_houses/Level_3/house_turquoise_level_3_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise_houses/Level_3/house_turquoise_level_3_2.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise_houses/Level_3/house_turquoise_level_3_3.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise_houses/Level_3/house_turquoise_level_3_4.png"),
    ],
    [ // tier 4 (4 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise_houses/Level_4/house_turquoise_level_4_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise_houses/Level_4/house_turquoise_level_4_2.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise_houses/Level_4/house_turquoise_level_4_3.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise_houses/Level_4/house_turquoise_level_4_4.png"),
    ],
  ],
  // variant 5 = wood
  [
    [ // tier 1 (6 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Wood_houses/Level_1/house_wood_level_1_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Wood_houses/Level_1/house_wood_level_1_2.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Wood_houses/Level_1/house_wood_level_1_3.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Wood_houses/Level_1/house_wood_level_1_4.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Wood_houses/Level_1/house_wood_level_1_5.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Wood_houses/Level_1/house_wood_level_1_6.png"),
    ],
    [ // tier 2 (4 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Wood_houses/Level_2/house_wood_level_2_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Wood_houses/Level_2/house_wood_level_2_2.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Wood_houses/Level_2/house_wood_level_2_3.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Wood_houses/Level_2/house_wood_level_2_4.png"),
    ],
    [ // tier 3 (2 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Wood_houses/Level_3/house_wood_level_3_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Wood_houses/Level_3/house_wood_level_3_2.png"),
    ],
    [ // tier 4 (4 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Wood_houses/Level_4/house_wood_level_4_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Wood_houses/Level_4/house_wood_level_4_2.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Wood_houses/Level_4/house_wood_level_4_3.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Wood_houses/Level_4/house_wood_level_4_4.png"),
    ],
  ],
  // variant 6 = yellow
  [
    [ // tier 1 (6 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_1/house_yellow_level_1_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_1/house_yellow_level_1_2.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_1/house_yellow_level_1_3.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_1/house_yellow_level_1_4.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_1/house_yellow_level_1_5.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_1/house_yellow_level_1_6.png"),
    ],
    [ // tier 2 (4 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_2/house_yellow_level_2_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_2/house_yellow_level_2_2.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_2/house_yellow_level_2_3.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_2/house_yellow_level_2_4.png"),
    ],
    [ // tier 3 (4 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_3/house_yellow_level_3_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_3/house_yellow_level_3_2.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_3/house_yellow_level_3_3.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_3/house_yellow_level_3_4.png"),
    ],
    [ // tier 4 (4 sprites)
      require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_4/house_yellow_level_4_1.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_4/house_yellow_level_4_2.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_4/house_yellow_level_4_3.png"),
      require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow_houses/Level_4/house_yellow_level_4_4.png"),
    ],
  ],
];

// Simple hash of building ID to get a deterministic sprite index
function hashBuildingId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getHouseSprite(building: PlacedBuilding): ImageSourcePropType {
  const colorIndex = Math.max(0, Math.min(5, building.variant - 1));
  const tierIndex = Math.max(0, Math.min(3, building.tier - 1));
  const sprites = houseSprites[colorIndex][tierIndex];
  const spriteIndex = hashBuildingId(building.id) % sprites.length;
  return sprites[spriteIndex];
}

function getBuildingSprite(building: PlacedBuilding): ImageSourcePropType {
  // Houses use the dedicated houseSprites array for much more variety
  if (building.building_type === 'house') {
    return getHouseSprite(building);
  }

  const { building_type, tier, variant } = building;
  const key = `${building_type}_${tier}_${variant}`;

  if (buildingSpriteMap[key]) {
    return buildingSpriteMap[key];
  }

  const fallbackKey = `${building_type}_1_${variant}`;
  if (buildingSpriteMap[fallbackKey]) {
    return buildingSpriteMap[fallbackKey];
  }

  const finalFallback = `${building_type}_1_1`;
  return buildingSpriteMap[finalFallback];
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

function SkyLight({ theme }: { theme: 'light' | 'dark' }) {
  if (theme === 'light') {
    // Sun: warm yellow core with two glow rings
    return (
      <View style={{ position: 'absolute', top: 28, right: 44, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,210,30,0.10)' }} />
        <View style={{ position: 'absolute', width: 82, height: 82, borderRadius: 41, backgroundColor: 'rgba(255,210,0,0.22)' }} />
        <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFE44D' }} />
      </View>
    );
  }
  // Moon: pale blue-white body with crescent shadow + soft glow rings
  return (
    <View style={{ position: 'absolute', top: 30, right: 48, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(180,215,255,0.05)' }} />
      <View style={{ position: 'absolute', width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(180,215,255,0.10)' }} />
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#D6EAFF' }}>
        {/* crescent: offset dark circle that bites into the moon */}
        <View style={{ position: 'absolute', width: 34, height: 34, borderRadius: 17, backgroundColor: '#050E1E', top: -4, left: 12 }} />
      </View>
    </View>
  );
}

export default function CityScreen() {
  const { colors, theme } = useTheme();
  const { t } = useLanguage();
  const { habits, completedCount, setOnTokenEarned } = useHabits();
  const {
    buildings,
    tokens,
    placeBuilding,
    autoBuildBuilding,
    upgradeBuilding,
    demolishBuilding,
    getBuildingAtPosition,
    refreshTokens,
  } = useBuildings();

  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [sheetVisible, setSheetVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
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

  const isPinching = useSharedValue(false);

  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      isPinching.value = true;
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
    .onEnd((event) => {
      isPinching.value = false;
      // Apply momentum to scale so zoom feels fluid after releasing
      const clampedVelocity = Math.min(Math.max(event.velocity, -5), 5);
      if (Math.abs(clampedVelocity) > 0.1) {
        scale.value = withDecay({
          velocity: clampedVelocity,
          deceleration: 0.985,
          clamp: [MIN_SCALE, MAX_SCALE],
        });
      }
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const panGesture = Gesture.Pan()
    .maxPointers(1)
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (isPinching.value) return;
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd((event) => {
      if (isPinching.value) return;
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
    .maxDistance(10)
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
    let built = 0;
    for (let i = 0; i < buildingsCanAfford; i++) {
      const randomType = PURCHASABLE_BUILDING_TYPES[
        Math.floor(Math.random() * PURCHASABLE_BUILDING_TYPES.length)
      ];
      // Recalculate grid size each iteration so the city expands as we build
      const currentSize = getCitySize(buildings.length + built);
      const success = await autoBuildBuilding(randomType, currentSize.rows, currentSize.cols);
      if (!success) break;
      built++;
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

  const handleDemolish = async () => {
    if (selectedBuilding) {
      const success = await demolishBuilding(selectedBuilding.id);
      if (success) {
        setSheetVisible(false);
        setSelectedBuilding(undefined);
        setSelectedPlot(null);
      }
    }
  };

  const handleSheetClose = () => {
    setSheetVisible(false);
    setSelectedPlot(null);
    setSelectedBuilding(undefined);
  };

  const buildingMap = useMemo(() => buildBuildingMap(buildings), [buildings]);
  const styles = createStyles(colors);

  const gridTiles = useMemo(() => {
    const tiles = [];
    const containerTop = -PLOT_CONTAINER_EXTRA_TOP;
    const grassTop = PLOT_CONTAINER_EXTRA_TOP;
    const buildingTopInContainer = PLOT_CONTAINER_EXTRA_TOP > 0 ? 0 : BUILDING_SPRITE_SIZE.offsetY;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const tileType = getGridTileType(r, c, GRID_ROWS, GRID_COLS);
        if (!tileType) continue;

        const isoPos = gridToIso(r, c);
        const screenX = isoPos.x + isoBounds.offsetX;
        const screenY = isoPos.y + isoBounds.offsetY;
        const zIndex = (r + c) * 10;

        if (tileType === "plot") {
          const building = buildingMap.get(`${r},${c}`) ?? null;
          tiles.push(
            <PlotTile
              key={`${r}-${c}`}
              screenX={screenX}
              containerTop={screenY + containerTop}
              grassTop={grassTop}
              building={building}
              buildingTopInContainer={buildingTopInContainer}
              zIndex={zIndex}
            />
          );
        } else {
          tiles.push(
            <RoadTile
              key={`${r}-${c}`}
              screenX={screenX}
              screenY={screenY}
              tileType={tileType}
              zIndex={zIndex}
            />
          );
        }
      }
    }
    return tiles;
  }, [GRID_ROWS, GRID_COLS, buildingMap, isoBounds]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>{t('city.title')}</Text>
            <Text style={styles.subtitle}>{t('city.subtitle')}</Text>
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
          <LinearGradient
            colors={theme === 'dark'
              ? ['#020609', '#0A1628', '#1A2E4A']
              : ['#2980B9', '#87CEEB', '#C8E8F5']}
            locations={[0, 0.5, 1]}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <SkyLight theme={theme} />
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
            {gridTiles}
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{buildingCount}</Text>
            <Text style={styles.statLabel}>{t('city.built')}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{completedCount}</Text>
            <Text style={styles.statLabel}>{t('city.today')}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{habits.length}</Text>
            <Text style={styles.statLabel}>{t('city.habits')}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.autoBuildButton} onPress={handleAutoBuild}>
          <Text style={styles.autoBuildButtonText}>{t('city.autoBuild')}</Text>
        </TouchableOpacity>

        <Text style={styles.messageText}>
          {buildingCount === 0
            ? t('city.emptyMessage')
            : buildingCount >= maxPlots - 2
            ? t('city.thrivingMessage')
            : t('city.defaultMessage')}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.infoButton}
        onPress={() => setInfoVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.infoButtonText}>i</Text>
      </TouchableOpacity>

      <Modal
        animationType="fade"
        transparent={true}
        visible={infoVisible}
        onRequestClose={() => setInfoVisible(false)}
      >
        <TouchableOpacity
          style={styles.infoModalOverlay}
          activeOpacity={1}
          onPress={() => setInfoVisible(false)}
        >
          <View style={styles.infoModalContent}>
            <Text style={styles.infoModalTitle}>{t('city.tipsTitle')}</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>tap</Text>
              <Text style={styles.infoText}>{t('city.tipTapEmpty')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>tap</Text>
              <Text style={styles.infoText}>{t('city.tipTapExisting')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>pinch</Text>
              <Text style={styles.infoText}>{t('city.tipPinch')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>drag</Text>
              <Text style={styles.infoText}>{t('city.tipDrag')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>2x</Text>
              <Text style={styles.infoText}>{t('city.tipDoubleTap')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>+</Text>
              <Text style={styles.infoText}>{t('city.tipAutoBuild')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>coin</Text>
              <Text style={styles.infoText}>{t('city.tipEarnTokens')}</Text>
            </View>
            <TouchableOpacity
              style={styles.infoCloseButton}
              onPress={() => setInfoVisible(false)}
            >
              <Text style={styles.infoCloseText}>{t('city.gotIt')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <BuildingSheet
        visible={sheetVisible}
        onClose={handleSheetClose}
        mode={sheetMode}
        selectedBuilding={selectedBuilding}
        tokens={tokens}
        onSelectBuildingType={handleSelectBuildingType}
        onUpgrade={handleUpgrade}
        onDemolish={handleDemolish}
        onAutoBuildOne={handleAutoBuildOne}
        onAutoBuildAll={handleAutoBuildAll}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return {
    container: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    } as const,
    header: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      zIndex: 10,
    } as const,
    headerTop: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
    },
    title: {
      fontSize: 28,
      fontWeight: "bold" as const,
      color: colors.text,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
    },
    tokenDisplay: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.tokenBadgeBackground,
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
      fontWeight: "bold" as const,
      color: colors.tokenBadgeText,
    },
    cityViewport: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      overflow: "hidden" as const,
    },
    gridContainer: {
      position: "relative" as const,
      overflow: "visible" as const,
    },
    tileContainer: {
      position: "absolute" as const,
      width: TILE_WIDTH,
      height: TILE_HEIGHT,
    },
    tileContainerBase: {
      position: "absolute" as const,
    },
    tileHitArea: {
      width: TILE_WIDTH,
      height: TILE_HEIGHT,
      position: "absolute" as const,
    },
    tile: {
      width: TILE_WIDTH,
      height: TILE_HEIGHT,
    },
    roadSprite: {
      position: "absolute" as const,
      top: 0,
      left: 0,
      width: TILE_WIDTH,
      height: TILE_HEIGHT,
    },
    buildingSpriteBase: {
      position: "absolute" as const,
    },
    statsContainer: {
      padding: 16,
      zIndex: 10,
    } as const,
    statsRow: {
      flexDirection: "row" as const,
      justifyContent: "space-around" as const,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    statBox: {
      alignItems: "center" as const,
    },
    statNumber: {
      fontSize: 24,
      fontWeight: "bold" as const,
      color: colors.accent,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    autoBuildButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center" as const,
      marginTop: 12,
    },
    autoBuildButtonText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: "bold" as const,
    },
    messageText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center" as const,
      marginTop: 12,
    },
    infoButton: {
      position: "absolute" as const,
      left: 16,
      bottom: 220,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      borderWidth: 1.5,
      borderColor: colors.border,
      zIndex: 20,
    },
    infoButtonText: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.textSecondary,
      fontStyle: "italic" as const,
    },
    infoModalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center" as const,
    },
    infoModalContent: {
      backgroundColor: colors.background,
      marginHorizontal: 30,
      borderRadius: 16,
      padding: 24,
    },
    infoModalTitle: {
      fontSize: 18,
      fontWeight: "700" as const,
      color: colors.text,
      marginBottom: 16,
    },
    infoRow: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      marginBottom: 14,
      gap: 12,
    },
    infoIcon: {
      fontSize: 12,
      color: colors.textSecondary,
      width: 34,
      textAlign: "center" as const,
      marginTop: 3,
      fontWeight: "700" as const,
    },
    infoText: {
      fontSize: 14,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 20,
    },
    infoCloseButton: {
      marginTop: 8,
      alignSelf: "center" as const,
      paddingVertical: 10,
      paddingHorizontal: 32,
      backgroundColor: colors.accent,
      borderRadius: 10,
    },
    infoCloseText: {
      color: colors.textInverse,
      fontSize: 15,
      fontWeight: "600" as const,
    },
  };
}

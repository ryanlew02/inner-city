import { useEffect, useRef, useState } from "react";
import { Image, ImageSourcePropType, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import BuildingSheet from "../components/BuildingSheet";
import { BuildingType, PlacedBuilding, PURCHASABLE_BUILDING_TYPES, useBuildings } from "../context/BuildingContext";
import { useHabits } from "../context/HabitsContext";

// Isometric tile dimensions
const TILE_WIDTH = 64;
const TILE_HEIGHT = 64;
// Vertical step for isometric grid - controls how much tiles overlap vertically
// 32 was too close (tiles overlapped wrong), 48 was too far (gaps)
const ISO_TILE_HEIGHT = 38;

// All buildings are 1x1; single sprite per plot. Small so the whole thing fits in the plot.
const BUILDING_WIDTH = 28;
const BUILDING_HEIGHT = 36;
const BUILDING_SPRITE_SIZE = {
  width: BUILDING_WIDTH,
  height: BUILDING_HEIGHT,
  offsetX: (TILE_WIDTH - BUILDING_WIDTH) / 2,
  offsetY: (TILE_HEIGHT - BUILDING_HEIGHT) / 2, // Centered in tile, fully inside
};
// No overflow needed when building fits in tile
const PLOT_CONTAINER_EXTRA_TOP = 0;

function getBuildingSpriteStyle(_building: PlacedBuilding): { width: number; height: number; top: number; left: number } {
  return {
    width: BUILDING_SPRITE_SIZE.width,
    height: BUILDING_SPRITE_SIZE.height,
    top: BUILDING_SPRITE_SIZE.offsetY,
    left: BUILDING_SPRITE_SIZE.offsetX,
  };
}

function getBuildingRenderTile(building: PlacedBuilding): number {
  return building.plot_index;
}

// Local helper functions (duplicated from buildingService to avoid circular deps)
function plotIndexToGridPositionLocal(plotIndex: number, gridRows: number, gridCols: number): { row: number; col: number } | null {
  let count = 0;
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (getGridTileType(r, c, gridRows, gridCols) === "plot") {
        if (count === plotIndex) return { row: r, col: c };
        count++;
      }
    }
  }
  return null;
}

function gridPositionToPlotIndexLocal(row: number, col: number, gridRows: number, gridCols: number): number | null {
  if (getGridTileType(row, col, gridRows, gridCols) !== "plot") return null;

  let index = 0;
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (r === row && c === col) return index;
      if (getGridTileType(r, c, gridRows, gridCols) === "plot") index++;
    }
  }
  return null;
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
  road_h: require("../assets/Sprites/RoadTilesSimple/road_3.png"),
  road_v: require("../assets/Sprites/RoadTilesSimple/road_3.png"),
  road_cross: require("../assets/Sprites/RoadTilesSimple/road_1.png"),
  road_corner_nw: require("../assets/Sprites/RoadTilesSimple/road_5.png"),
  road_corner_ne: require("../assets/Sprites/RoadTilesSimple/road_6.png"),
  road_corner_sw: require("../assets/Sprites/RoadTilesSimple/road_7.png"),
  road_corner_se: require("../assets/Sprites/RoadTilesSimple/road_8.png"),
  road_t_north: require("../assets/Sprites/RoadTilesSimple/road_1.png"),
  road_t_south: require("../assets/Sprites/RoadTilesSimple/road_1.png"),
  road_t_east: require("../assets/Sprites/RoadTilesSimple/road_1.png"),
  road_t_west: require("../assets/Sprites/RoadTilesSimple/road_1.png"),
};

function isRoadTile(tileType: TileType): boolean {
  return tileType !== "plot";
}

// New assets: Sprites/ModularBlocksTiles (1x1 only). All paths static for Metro bundler.
const buildingSpriteMap: Record<string, ImageSourcePropType> = {
  residential_1_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 1/house_yellow_level_1_1.png"),
  residential_1_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 1/house_yellow_level_1_2.png"),
  residential_1_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 1/house_yellow_level_1_3.png"),
  residential_1_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 1/house_yellow_level_1_4.png"),
  residential_1_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 1/house_yellow_level_1_5.png"),
  residential_1_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 1/house_yellow_level_1_6.png"),
  residential_1_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 1/house_red_level_1_1.png"),
  residential_1_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 1/house_red_level_1_2.png"),
  residential_2_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 2/house_green_level_2_1.png"),
  residential_2_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 2/house_green_level_2_2.png"),
  residential_2_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 2/house_green_level_2_3.png"),
  residential_2_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 2/house_green_level_2_4.png"),
  residential_2_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 2/house_red_level_2_1.png"),
  residential_2_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 2/house_red_level_2_2.png"),
  residential_2_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 2/house_red_level_2_3.png"),
  residential_2_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 2/house_red_level_2_4.png"),
  residential_3_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 3/house_green_level_3_1.png"),
  residential_3_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 3/house_green_level_3_2.png"),
  residential_3_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 3/house_green_level_3_3.png"),
  residential_3_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 3/house_green_level_3_4.png"),
  residential_3_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 3/house_yellow_level_3_1.png"),
  residential_3_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 3/house_yellow_level_3_2.png"),
  residential_3_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 3/house_yellow_level_3_3.png"),
  residential_3_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 3/house_yellow_level_3_4.png"),

  shop_1_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Orange houses/Level 1/house_orange_level_1_1.png"),
  shop_1_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Orange houses/Level 1/house_orange_level_1_2.png"),
  shop_1_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise houses/Level 1/house_turquoise_level_1_1.png"),
  shop_1_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise houses/Level 1/house_turquoise_level_1_2.png"),
  shop_1_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_1.png"),
  shop_1_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_2.png"),
  shop_1_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Orange houses/Level 1/house_orange_level_1_3.png"),
  shop_1_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise houses/Level 1/house_turquoise_level_1_3.png"),
  shop_2_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_1.png"),
  shop_2_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_2.png"),
  shop_2_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_3.png"),
  shop_2_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_4.png"),
  shop_2_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 2/house_green_level_2_1.png"),
  shop_2_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 2/house_green_level_2_2.png"),
  shop_2_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 2/house_green_level_2_3.png"),
  shop_2_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 2/house_green_level_2_4.png"),
  shop_3_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 4/house_yellow_level_4_1.png"),
  shop_3_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 4/house_yellow_level_4_2.png"),
  shop_3_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 4/house_yellow_level_4_3.png"),
  shop_3_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 4/house_yellow_level_4_4.png"),
  shop_3_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 4/house_green_level_4_1.png"),
  shop_3_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 4/house_green_level_4_2.png"),
  shop_3_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 4/house_green_level_4_3.png"),
  shop_3_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 4/house_green_level_4_4.png"),

  office_1_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Purple-yellow houses/house_purple_yellow_1.png"),
  office_1_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Purple-yellow houses/house_purple_yellow_2.png"),
  office_1_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow-blue houses/house_yellow_blue_1.png"),
  office_1_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow-blue houses/house_yellow_blue_2.png"),
  office_1_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Green-red houses/house_green_red_1.png"),
  office_1_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Green-red houses/house_green_red_2.png"),
  office_1_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Purple-yellow houses/house_yellow_purple_1.png"),
  office_1_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Purple-yellow houses/house_yellow_purple_2.png"),
  office_2_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 2/house_red_level_2_1.png"),
  office_2_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 2/house_red_level_2_2.png"),
  office_2_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 2/house_red_level_2_3.png"),
  office_2_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 2/house_red_level_2_4.png"),
  office_2_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_1.png"),
  office_2_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_2.png"),
  office_2_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_3.png"),
  office_2_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_4.png"),
  office_3_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 3/house_red_level_3_1.png"),
  office_3_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 3/house_red_level_3_2.png"),
  office_3_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 3/house_red_level_3_3.png"),
  office_3_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 3/house_red_level_3_4.png"),
  office_3_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 3/house_yellow_level_3_1.png"),
  office_3_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 3/house_yellow_level_3_2.png"),
  office_3_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 3/house_yellow_level_3_3.png"),
  office_3_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 3/house_yellow_level_3_4.png"),

  cafe_1_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_1.png"),
  cafe_1_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_2.png"),
  cafe_1_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_3.png"),
  cafe_1_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_4.png"),
  cafe_1_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_5.png"),
  cafe_1_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_6.png"),
  cafe_1_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_1.png"),
  cafe_1_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_2.png"),
  cafe_2_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_1.png"),
  cafe_2_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_2.png"),
  cafe_2_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_3.png"),
  cafe_2_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_4.png"),
  cafe_2_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 2/house_green_level_2_1.png"),
  cafe_2_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 2/house_green_level_2_2.png"),
  cafe_2_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 2/house_green_level_2_3.png"),
  cafe_2_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 2/house_green_level_2_4.png"),
  cafe_3_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 3/house_yellow_level_3_1.png"),
  cafe_3_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 3/house_yellow_level_3_2.png"),
  cafe_3_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 3/house_yellow_level_3_3.png"),
  cafe_3_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 3/house_yellow_level_3_4.png"),
  cafe_3_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 3/house_green_level_3_1.png"),
  cafe_3_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 3/house_green_level_3_2.png"),
  cafe_3_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 3/house_green_level_3_3.png"),
  cafe_3_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 3/house_green_level_3_4.png"),

  restaurant_1_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise houses/Level 1/house_turquoise_level_1_1.png"),
  restaurant_1_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise houses/Level 1/house_turquoise_level_1_2.png"),
  restaurant_1_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise houses/Level 1/house_turquoise_level_1_3.png"),
  restaurant_1_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Turquoise houses/Level 1/house_turquoise_level_1_4.png"),
  restaurant_1_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Orange houses/Level 1/house_orange_level_1_1.png"),
  restaurant_1_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Orange houses/Level 1/house_orange_level_1_2.png"),
  restaurant_1_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Orange houses/Level 1/house_orange_level_1_3.png"),
  restaurant_1_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Orange houses/Level 1/house_orange_level_1_4.png"),
  restaurant_2_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 2/house_green_level_2_1.png"),
  restaurant_2_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 2/house_green_level_2_2.png"),
  restaurant_2_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 2/house_green_level_2_3.png"),
  restaurant_2_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 2/house_green_level_2_4.png"),
  restaurant_2_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 2/house_red_level_2_1.png"),
  restaurant_2_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 2/house_red_level_2_2.png"),
  restaurant_2_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 2/house_red_level_2_3.png"),
  restaurant_2_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 2/house_red_level_2_4.png"),
  restaurant_3_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 3/house_green_level_3_1.png"),
  restaurant_3_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 3/house_green_level_3_2.png"),
  restaurant_3_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 3/house_green_level_3_3.png"),
  restaurant_3_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 3/house_green_level_3_4.png"),
  restaurant_3_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 3/house_yellow_level_3_1.png"),
  restaurant_3_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 3/house_yellow_level_3_2.png"),
  restaurant_3_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 3/house_yellow_level_3_3.png"),
  restaurant_3_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 3/house_yellow_level_3_4.png"),

  factory_1_1: require("../assets/Sprites/ModularBlocksTiles/factory_1.png"),
  factory_1_2: require("../assets/Sprites/ModularBlocksTiles/factory_2.png"),
  factory_1_3: require("../assets/Sprites/ModularBlocksTiles/factory_1.png"),
  factory_1_4: require("../assets/Sprites/ModularBlocksTiles/factory_2.png"),
  factory_1_5: require("../assets/Sprites/ModularBlocksTiles/solar_panels_1.png"),
  factory_1_6: require("../assets/Sprites/ModularBlocksTiles/solar_panels_2.png"),
  factory_1_7: require("../assets/Sprites/ModularBlocksTiles/factory_1.png"),
  factory_1_8: require("../assets/Sprites/ModularBlocksTiles/factory_2.png"),
  factory_2_1: require("../assets/Sprites/ModularBlocksTiles/factory_1.png"),
  factory_2_2: require("../assets/Sprites/ModularBlocksTiles/factory_2.png"),
  factory_2_3: require("../assets/Sprites/ModularBlocksTiles/solar_panels_1.png"),
  factory_2_4: require("../assets/Sprites/ModularBlocksTiles/solar_panels_2.png"),
  factory_2_5: require("../assets/Sprites/ModularBlocksTiles/factory_1.png"),
  factory_2_6: require("../assets/Sprites/ModularBlocksTiles/factory_2.png"),
  factory_2_7: require("../assets/Sprites/ModularBlocksTiles/factory_1.png"),
  factory_2_8: require("../assets/Sprites/ModularBlocksTiles/factory_2.png"),
  factory_3_1: require("../assets/Sprites/ModularBlocksTiles/factory_1.png"),
  factory_3_2: require("../assets/Sprites/ModularBlocksTiles/factory_2.png"),
  factory_3_3: require("../assets/Sprites/ModularBlocksTiles/solar_panels_1.png"),
  factory_3_4: require("../assets/Sprites/ModularBlocksTiles/solar_panels_2.png"),
  factory_3_5: require("../assets/Sprites/ModularBlocksTiles/factory_1.png"),
  factory_3_6: require("../assets/Sprites/ModularBlocksTiles/factory_2.png"),
  factory_3_7: require("../assets/Sprites/ModularBlocksTiles/factory_1.png"),
  factory_3_8: require("../assets/Sprites/ModularBlocksTiles/factory_2.png"),

  hospital_1_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 1/house_red_level_1_1.png"),
  hospital_1_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 1/house_red_level_1_2.png"),
  hospital_1_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 1/house_red_level_1_3.png"),
  hospital_1_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 1/house_red_level_1_4.png"),
  hospital_1_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 1/house_red_level_1_5.png"),
  hospital_1_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 1/house_red_level_1_6.png"),
  hospital_1_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 1/house_red_level_1_1.png"),
  hospital_1_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 1/house_red_level_1_2.png"),
  hospital_2_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 2/house_red_level_2_1.png"),
  hospital_2_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 2/house_red_level_2_2.png"),
  hospital_2_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 2/house_red_level_2_3.png"),
  hospital_2_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 2/house_red_level_2_4.png"),
  hospital_2_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 2/house_red_level_2_1.png"),
  hospital_2_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 2/house_red_level_2_2.png"),
  hospital_2_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 2/house_red_level_2_3.png"),
  hospital_2_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 2/house_red_level_2_4.png"),
  hospital_3_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 3/house_red_level_3_1.png"),
  hospital_3_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 3/house_red_level_3_2.png"),
  hospital_3_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 3/house_red_level_3_3.png"),
  hospital_3_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 3/house_red_level_3_4.png"),
  hospital_3_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 3/house_red_level_3_1.png"),
  hospital_3_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 3/house_red_level_3_2.png"),
  hospital_3_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 3/house_red_level_3_3.png"),
  hospital_3_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Red houses/Level 3/house_red_level_3_4.png"),

  school_1_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 1/house_yellow_level_1_1.png"),
  school_1_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 1/house_yellow_level_1_2.png"),
  school_1_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 1/house_yellow_level_1_3.png"),
  school_1_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 1/house_yellow_level_1_4.png"),
  school_1_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 1/house_yellow_level_1_5.png"),
  school_1_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 1/house_yellow_level_1_6.png"),
  school_1_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 1/house_yellow_level_1_1.png"),
  school_1_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 1/house_yellow_level_1_2.png"),
  school_2_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_1.png"),
  school_2_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_2.png"),
  school_2_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_3.png"),
  school_2_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_4.png"),
  school_2_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_1.png"),
  school_2_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_2.png"),
  school_2_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_3.png"),
  school_2_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_4.png"),
  school_3_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 4/house_yellow_level_4_1.png"),
  school_3_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 4/house_yellow_level_4_2.png"),
  school_3_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 4/house_yellow_level_4_3.png"),
  school_3_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 4/house_yellow_level_4_4.png"),
  school_3_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 4/house_yellow_level_4_1.png"),
  school_3_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 4/house_yellow_level_4_2.png"),
  school_3_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 4/house_yellow_level_4_3.png"),
  school_3_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 4/house_yellow_level_4_4.png"),

  hotel_1_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_1.png"),
  hotel_1_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_2.png"),
  hotel_1_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_3.png"),
  hotel_1_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_4.png"),
  hotel_1_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_5.png"),
  hotel_1_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_6.png"),
  hotel_1_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_1.png"),
  hotel_1_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_2.png"),
  hotel_2_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 4/house_grey_level_4_1.png"),
  hotel_2_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 4/house_grey_level_4_2.png"),
  hotel_2_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 4/house_white_level_4_1.png"),
  hotel_2_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 4/house_white_level_4_2.png"),
  hotel_2_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 4/house_grey_level_4_1.png"),
  hotel_2_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 4/house_grey_level_4_2.png"),
  hotel_2_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 4/house_white_level_4_1.png"),
  hotel_2_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 4/house_white_level_4_2.png"),
  hotel_3_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 5/house_grey_level_5_1.png"),
  hotel_3_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 5/house_grey_level_5_2.png"),
  hotel_3_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 5/house_white_level_5_1.png"),
  hotel_3_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 5/house_white_level_5_2.png"),
  hotel_3_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 5/house_grey_level_5_1.png"),
  hotel_3_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 5/house_white_level_5_1.png"),
  hotel_3_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 5/house_grey_level_5_2.png"),
  hotel_3_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 5/house_white_level_5_2.png"),

  powerplant_1_1: require("../assets/Sprites/ModularBlocksTiles/solar_panels_1.png"),
  powerplant_1_2: require("../assets/Sprites/ModularBlocksTiles/solar_panels_2.png"),
  powerplant_1_3: require("../assets/Sprites/ModularBlocksTiles/factory_1.png"),
  powerplant_1_4: require("../assets/Sprites/ModularBlocksTiles/factory_2.png"),
  powerplant_1_5: require("../assets/Sprites/ModularBlocksTiles/solar_panels_1.png"),
  powerplant_1_6: require("../assets/Sprites/ModularBlocksTiles/solar_panels_2.png"),
  powerplant_1_7: require("../assets/Sprites/ModularBlocksTiles/factory_1.png"),
  powerplant_1_8: require("../assets/Sprites/ModularBlocksTiles/factory_2.png"),
  powerplant_2_1: require("../assets/Sprites/ModularBlocksTiles/solar_panels_1.png"),
  powerplant_2_2: require("../assets/Sprites/ModularBlocksTiles/solar_panels_2.png"),
  powerplant_2_3: require("../assets/Sprites/ModularBlocksTiles/factory_1.png"),
  powerplant_2_4: require("../assets/Sprites/ModularBlocksTiles/factory_2.png"),
  powerplant_2_5: require("../assets/Sprites/ModularBlocksTiles/solar_panels_1.png"),
  powerplant_2_6: require("../assets/Sprites/ModularBlocksTiles/solar_panels_2.png"),
  powerplant_2_7: require("../assets/Sprites/ModularBlocksTiles/factory_1.png"),
  powerplant_2_8: require("../assets/Sprites/ModularBlocksTiles/factory_2.png"),
  powerplant_3_1: require("../assets/Sprites/ModularBlocksTiles/solar_panels_1.png"),
  powerplant_3_2: require("../assets/Sprites/ModularBlocksTiles/solar_panels_2.png"),
  powerplant_3_3: require("../assets/Sprites/ModularBlocksTiles/factory_1.png"),
  powerplant_3_4: require("../assets/Sprites/ModularBlocksTiles/factory_2.png"),
  powerplant_3_5: require("../assets/Sprites/ModularBlocksTiles/solar_panels_1.png"),
  powerplant_3_6: require("../assets/Sprites/ModularBlocksTiles/solar_panels_2.png"),
  powerplant_3_7: require("../assets/Sprites/ModularBlocksTiles/factory_1.png"),
  powerplant_3_8: require("../assets/Sprites/ModularBlocksTiles/factory_2.png"),

  warehouse_1_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_1.png"),
  warehouse_1_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_2.png"),
  warehouse_1_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_3.png"),
  warehouse_1_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_4.png"),
  warehouse_1_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_5.png"),
  warehouse_1_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_6.png"),
  warehouse_1_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_1.png"),
  warehouse_1_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Wood houses/Level 1/house_wood_level_1_2.png"),
  warehouse_2_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_1.png"),
  warehouse_2_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_2.png"),
  warehouse_2_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_3.png"),
  warehouse_2_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 2/house_yellow_level_2_4.png"),
  warehouse_2_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 2/house_green_level_2_1.png"),
  warehouse_2_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 2/house_green_level_2_2.png"),
  warehouse_2_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 2/house_green_level_2_3.png"),
  warehouse_2_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 2/house_green_level_2_4.png"),
  warehouse_3_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 3/house_yellow_level_3_1.png"),
  warehouse_3_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 3/house_yellow_level_3_2.png"),
  warehouse_3_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 3/house_yellow_level_3_3.png"),
  warehouse_3_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Yellow houses/Level 3/house_yellow_level_3_4.png"),
  warehouse_3_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 3/house_green_level_3_1.png"),
  warehouse_3_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 3/house_green_level_3_2.png"),
  warehouse_3_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 3/house_green_level_3_3.png"),
  warehouse_3_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Green houses/Level 3/house_green_level_3_4.png"),

  special_1_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_grey_level_6_1.png"),
  special_1_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_grey_level_6_2.png"),
  special_1_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_white_level_6_1.png"),
  special_1_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_white_level_6_2.png"),
  special_1_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_grey_level_6_1.png"),
  special_1_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_grey_level_6_2.png"),
  special_1_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_white_level_6_1.png"),
  special_1_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_white_level_6_2.png"),
  special_2_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_grey_level_6_1.png"),
  special_2_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_white_level_6_1.png"),
  special_2_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_grey_level_6_2.png"),
  special_2_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_white_level_6_2.png"),
  special_2_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_grey_level_6_1.png"),
  special_2_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_grey_level_6_2.png"),
  special_2_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_white_level_6_1.png"),
  special_2_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_white_level_6_2.png"),
  special_3_1: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_grey_level_6_1.png"),
  special_3_2: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_grey_level_6_2.png"),
  special_3_3: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_white_level_6_1.png"),
  special_3_4: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_white_level_6_2.png"),
  special_3_5: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_grey_level_6_1.png"),
  special_3_6: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_grey_level_6_2.png"),
  special_3_7: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_white_level_6_1.png"),
  special_3_8: require("../assets/Sprites/ModularBlocksTiles/Houses/Houses level 6/house_white_level_6_2.png"),
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
  return buildingSpriteMap[finalFallback] || buildingSpriteMap["residential_1_1"];
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

function buildPlotIndex(row: number, col: number, gridRows: number, gridCols: number): number | null {
  const tileType = getGridTileType(row, col, gridRows, gridCols);
  if (tileType !== "plot") return null;

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

function getTileRotation(tileType: TileType): string {
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
  const isoX = px - offsetX;
  const isoY = py - offsetY;
  const halfW = TILE_WIDTH / 2;
  const halfH = ISO_TILE_HEIGHT / 2;
  const colMinusRow = isoX / halfW;
  const colPlusRow = isoY / halfH;
  const col = (colPlusRow + colMinusRow) / 2;
  const row = (colPlusRow - colMinusRow) / 2;
  const rowCell = Math.floor(row);
  const colCell = Math.floor(col);
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
    getBuildingAtPlot,
    refreshTokens,
    resetCity,
  } = useBuildings();

  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetMode, setSheetMode] = useState<"build" | "upgrade" | "autobuild">("build");
  const [selectedPlotIndex, setSelectedPlotIndex] = useState<number | null>(null);
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

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      const newScale = savedScale.value * event.scale;
      scale.value = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withSpring(1);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      savedScale.value = 1;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    });

  const buildingCount = buildings.length;
  const citySize = getCitySize(buildingCount);
  const { rows: GRID_ROWS, cols: GRID_COLS, maxPlots } = citySize;
  const isoBounds = getIsoBounds(GRID_ROWS, GRID_COLS);

  const gridContainerRef = useRef<View>(null);

  const handleTapPosition = (absoluteX: number, absoluteY: number) => {
    gridContainerRef.current?.measureInWindow((winX, winY) => {
      const scaleVal = scale.value;
      const tx = translateX.value;
      const ty = translateY.value;
      const localX = (absoluteX - winX - tx) / scaleVal;
      const localY = (absoluteY - winY - ty) / scaleVal;
      const hit = isoToGrid(
        localX,
        localY,
        isoBounds.offsetX,
        isoBounds.offsetY,
        GRID_ROWS,
        GRID_COLS
      );
      if (hit && getGridTileType(hit.row, hit.col, GRID_ROWS, GRID_COLS) === "plot") {
        const plotIndex = buildPlotIndex(hit.row, hit.col, GRID_ROWS, GRID_COLS);
        if (plotIndex !== null) {
          handlePlotPress(plotIndex);
        }
      }
    });
  };

  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .requireExternalGestureToFail(doubleTapGesture)
    .onEnd((e) => {
      const x = e.absoluteX ?? e.x;
      const y = e.absoluteY ?? e.y;
      runOnJS(handleTapPosition)(x, y);
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

  const handlePlotPress = (plotIndex: number) => {
    const existingBuilding = getBuildingAtPlot(plotIndex, GRID_ROWS, GRID_COLS);
    if (existingBuilding) {
      // Open upgrade sheet
      setSelectedBuilding(existingBuilding);
      setSheetMode("upgrade");
      setSheetVisible(true);
    } else {
      // Open build sheet
      setSelectedPlotIndex(plotIndex);
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
    const success = await autoBuildBuilding(randomType, maxPlots, GRID_ROWS, GRID_COLS);
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
      const success = await autoBuildBuilding(randomType, maxPlots, GRID_ROWS, GRID_COLS);
      if (!success) break;
    }
    setSheetVisible(false);
  };

  const handleSelectBuildingType = async (type: BuildingType) => {
    let success = false;
    if (selectedPlotIndex !== null) {
      success = await placeBuilding(selectedPlotIndex, type, GRID_ROWS, GRID_COLS);
    } else {
      success = await autoBuildBuilding(type, maxPlots, GRID_ROWS, GRID_COLS);
    }
    if (success) {
      setSheetVisible(false);
      setSelectedPlotIndex(null);
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
    setSelectedPlotIndex(null);
    setSelectedBuilding(undefined);
  };

  const renderTile = (row: number, col: number) => {
    const tileType = getGridTileType(row, col, GRID_ROWS, GRID_COLS);
    if (!tileType) return null;

    const plotIndex = buildPlotIndex(row, col, GRID_ROWS, GRID_COLS);
    const building = plotIndex !== null ? getBuildingAtPlot(plotIndex, GRID_ROWS, GRID_COLS) : null;
    const rotation = getTileRotation(tileType);
    const isPlot = tileType === "plot";

    const isoPos = gridToIso(row, col);
    const screenX = isoPos.x + isoBounds.offsetX;
    const screenY = isoPos.y + isoBounds.offsetY;
    // Z-index based on screen Y position - tiles lower on screen (higher Y) should be in front
    // Multiply by 10 to give room for building height layers
    const zIndex = (row + col) * 10;

    // Render plot tiles (grass with optional buildings)
    // Use View + pointerEvents="none" so tap is handled by grid gesture with isometric hit-testing
    if (isPlot) {
      // Check if this tile should render the building sprite
      // For multi-tile buildings, we render from the bottom-right tile
      const renderTileIndex = building ? getBuildingRenderTile(building) : null;
      const shouldRenderBuilding = building && renderTileIndex === plotIndex;
      const spriteStyle = shouldRenderBuilding ? getBuildingSpriteStyle(building) : null;

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
          {shouldRenderBuilding && spriteStyle && (
            <Image
              source={getBuildingSprite(building)}
              style={[
                styles.buildingSpriteBase,
                {
                  width: spriteStyle.width,
                  height: spriteStyle.height,
                  top: buildingTopInContainer,
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
            <Text style={styles.tokenIcon}>🪙</Text>
            <Text style={styles.tokenValue}>{tokens}</Text>
          </View>
        </View>
      </View>

      <View style={styles.cityViewport}>
        <GestureDetector gesture={composedGesture}>
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
        </GestureDetector>
      </View>

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

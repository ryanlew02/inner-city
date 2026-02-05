import { useEffect, useState } from "react";
import { Image, ImageSourcePropType, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import BuildingSheet from "../components/BuildingSheet";
import { BuildingType, PlacedBuilding, PURCHASABLE_BUILDING_TYPES, useBuildings } from "../context/BuildingContext";
import { BUILDING_SIZES } from "../services/database/buildingService";
import { useHabits } from "../context/HabitsContext";

// Isometric tile dimensions
const TILE_WIDTH = 64;
const TILE_HEIGHT = 64;
// Vertical step for isometric grid - controls how much tiles overlap vertically
// 32 was too close (tiles overlapped wrong), 48 was too far (gaps)
const ISO_TILE_HEIGHT = 38;

// Building sprite dimensions based on asset sizes and footprint
// Asset dimensions: 1x1=512x1024, 1x2=768x1024, 2x2=1024x1280
// Display dimensions scaled to fit tile grid
// For multi-tile buildings, we render from the BOTTOM-RIGHT tile of the footprint
// so the sprite extends up and left (into the block, away from roads)
const BUILDING_SPRITE_SIZES: Record<string, { width: number; height: number; offsetX: number; offsetY: number }> = {
  "1x1": { width: 64, height: 128, offsetX: 0, offsetY: -64 },     // Render at anchor, extends up
  "1x2": { width: 96, height: 128, offsetX: -32, offsetY: -90 },   // Render at bottom tile, extends up-left
  "2x2": { width: 128, height: 160, offsetX: -64, offsetY: -122 }, // Render at bottom-right tile, extends up-left
};

function getBuildingSpriteStyle(building: PlacedBuilding): { width: number; height: number; top: number; left: number } {
  const sizeKey = `${building.size_x}x${building.size_y}`;
  const size = BUILDING_SPRITE_SIZES[sizeKey] || BUILDING_SPRITE_SIZES["1x1"];
  return {
    width: size.width,
    height: size.height,
    top: size.offsetY,
    left: size.offsetX,
  };
}

// For multi-tile buildings, determine which tile should render the sprite
// 1x1: render at anchor
// 1x2: render at bottom tile (anchor.row + 1)
// 2x2: render at bottom-right tile (anchor.row + 1, anchor.col + 1)
function getBuildingRenderTile(building: PlacedBuilding, gridRows: number, gridCols: number): number | null {
  if (building.size_x === 1 && building.size_y === 1) {
    return building.plot_index;
  }

  // Import helper to convert plot index to grid position
  const anchorPos = plotIndexToGridPositionLocal(building.plot_index, gridRows, gridCols);
  if (!anchorPos) return null;

  // Calculate bottom-right tile position
  const renderRow = anchorPos.row + building.size_y - 1;
  const renderCol = anchorPos.col + building.size_x - 1;

  return gridPositionToPlotIndexLocal(renderRow, renderCol, gridRows, gridCols);
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

const grassTile = require("../assets/Tiles/Grass.png");

// Road tiles mapping - new asset pack
// Tile1=cross, Tile2=straight NW-SE, Tile7=straight NE-SW
// Tile3=corner NE, Tile4=corner SE, Tile5=corner NW, Tile6=corner SW
const roadSprites: Record<string, ImageSourcePropType> = {
  road_h: require("../assets/Tiles/Road_Tile7.png"),     // Straight NE-SW (horizontal in grid)
  road_v: require("../assets/Tiles/Road_Tile2.png"),     // Straight NW-SE (vertical in grid)
  road_cross: require("../assets/Tiles/Road_Tile1.png"), // 4-way intersection
  road_corner_nw: require("../assets/Tiles/Road_Tile5.png"), // Corner: N to W
  road_corner_ne: require("../assets/Tiles/Road_Tile3.png"), // Corner: N to E
  road_corner_sw: require("../assets/Tiles/Road_Tile6.png"), // Corner: S to W
  road_corner_se: require("../assets/Tiles/Road_Tile4.png"), // Corner: S to E
  road_t_north: require("../assets/Tiles/Road_Tile1.png"),   // T-junction (using cross as fallback)
  road_t_south: require("../assets/Tiles/Road_Tile1.png"),   // T-junction (using cross as fallback)
  road_t_east: require("../assets/Tiles/Road_Tile1.png"),    // T-junction (using cross as fallback)
  road_t_west: require("../assets/Tiles/Road_Tile1.png"),    // T-junction (using cross as fallback)
};

function isRoadTile(tileType: TileType): boolean {
  return tileType !== "plot";
}

// Building sprites organized by type, tier, and variant
// New asset structure uses different folders and naming conventions
const buildingSpriteMap: Record<string, ImageSourcePropType> = {
  // Residential - Houses for tier 1, Apartments for tier 2-3
  // Tier 1: Small houses from Houses/ folder (different colors)
  "residential_1_1": require("../assets/Houses/Blue/House_Type1.png"),
  "residential_1_2": require("../assets/Houses/Brown/House_Type2.png"),
  "residential_1_3": require("../assets/Houses/Green/House_Type3.png"),
  "residential_1_4": require("../assets/Houses/Grey/House_Type4.png"),
  "residential_1_5": require("../assets/Houses/Pink/House_Type5.png"),
  "residential_1_6": require("../assets/Houses/Red/House_Type6.png"),
  "residential_1_7": require("../assets/Houses/Yellow/House_Type7.png"),
  "residential_1_8": require("../assets/Houses/Blue/House_Type8.png"),
  // Tier 2: Apartments Level 1 (1x1 size)
  "residential_2_1": require("../assets/Appartments/Appartment_Blue_1x1_Level1.png"),
  "residential_2_2": require("../assets/Appartments/Appartment_Green_1x1_Level1.png"),
  "residential_2_3": require("../assets/Appartments/Appartment_Grey_1x1_Level1.png"),
  "residential_2_4": require("../assets/Appartments/Appartment_Pink_1x1_Level1.png"),
  "residential_2_5": require("../assets/Appartments/Appartment_Red_1x1_Level1.png"),
  "residential_2_6": require("../assets/Appartments/Appartment_Yellow_1x1_Level1.png"),
  "residential_2_7": require("../assets/Appartments/Appartment_Blue_1x2_Level1.png"),
  "residential_2_8": require("../assets/Appartments/Appartment_Green_1x2_Level1.png"),
  // Tier 3: Apartments Level 3 (larger buildings)
  "residential_3_1": require("../assets/Appartments/Appartment_Blue_1x1_Level3.png"),
  "residential_3_2": require("../assets/Appartments/Appartment_Green_1x1_Level3.png"),
  "residential_3_3": require("../assets/Appartments/Appartment_Grey_1x1_Level3.png"),
  "residential_3_4": require("../assets/Appartments/Appartment_Pink_1x1_Level3.png"),
  "residential_3_5": require("../assets/Appartments/Appartment_Red_1x1_Level3.png"),
  "residential_3_6": require("../assets/Appartments/Appartment_Yellow_1x1_Level3.png"),
  "residential_3_7": require("../assets/Appartments/Appartment_Blue_2x2_Level3.png"),
  "residential_3_8": require("../assets/Appartments/Appartment_Green_2x2_Level3.png"),

  // Shop - Various shop types from Shopping/
  "shop_1_1": require("../assets/Shopping/Shop_Butcher_OneFloor.png"),
  "shop_1_2": require("../assets/Shopping/Shop_Clothing_OneFloor.png"),
  "shop_1_3": require("../assets/Shopping/Shop_Fish_OneFloor.png"),
  "shop_1_4": require("../assets/Shopping/Shop_Flowers_OneFloor.png"),
  "shop_1_5": require("../assets/Shopping/Shop_Music_OneFloor.png"),
  "shop_1_6": require("../assets/Shopping/Shop_Pets_OneFloor.png"),
  "shop_1_7": require("../assets/Shopping/Shop_Pharmacy_OneFloor.png"),
  "shop_1_8": require("../assets/Shopping/Shop_Tools_OneFloor.png"),
  // Tier 2: One floor roofed shops
  "shop_2_1": require("../assets/Shopping/Shop_Butcher_OneFloorRoofed.png"),
  "shop_2_2": require("../assets/Shopping/Shop_Clothing_OneFloorRoofed.png"),
  "shop_2_3": require("../assets/Shopping/Shop_Fish_OneFloorRoofed.png"),
  "shop_2_4": require("../assets/Shopping/Shop_Flowers_OneFloorRoofed.png"),
  "shop_2_5": require("../assets/Shopping/Shop_Music_OneFloorRoofed.png"),
  "shop_2_6": require("../assets/Shopping/Shop_Pets_OneFloorRoofed.png"),
  "shop_2_7": require("../assets/Shopping/Shop_Pharmacy_OneFloorRoofed.png"),
  "shop_2_8": require("../assets/Shopping/Shop_Tools_OneFloorRoofed.png"),
  // Tier 3: Two floor roofed shops
  "shop_3_1": require("../assets/Shopping/Shop_Butcher_TwoFloorsRoofed.png"),
  "shop_3_2": require("../assets/Shopping/Shop_Butcher_TwoFloors.png"),
  "shop_3_3": require("../assets/Shopping/Shop_Fish_TwoFloorsRoofed.png"),
  "shop_3_4": require("../assets/Shopping/Shop_Flowers_TwoFloorsRoofed.png"),
  "shop_3_5": require("../assets/Shopping/Shop_Music_TwoFloorsRoofed.png"),
  "shop_3_6": require("../assets/Shopping/Shop_Pets_TwoFloorsRoofed.png"),
  "shop_3_7": require("../assets/Shopping/Shop_Pharmacy_TwoFloorsRoofed.png"),
  "shop_3_8": require("../assets/Shopping/Shop_Tools_TwoFloorsRoofed.png"),

  // Office - Workplace buildings from Shopping/
  "office_1_1": require("../assets/Shopping/Workplace_Dentist_OneFloor.png"),
  "office_1_2": require("../assets/Shopping/Workplace_Electrician_OneFloor.png"),
  "office_1_3": require("../assets/Shopping/Workplace_Handyman_OneFloor.png"),
  "office_1_4": require("../assets/Shopping/Workplace_OneFloor_PestControl.png"),
  "office_1_5": require("../assets/Shopping/Workplace_Empty_OneFloor.png"),
  "office_1_6": require("../assets/Shopping/WorkSpace_Bank.png"),
  "office_1_7": require("../assets/Shopping/Groceries_Store.png"),
  "office_1_8": require("../assets/Shopping/Groceries_Market.png"),
  // Tier 2: Two floor workplaces
  "office_2_1": require("../assets/Shopping/Workplace_Dentist_TwoFloors.png"),
  "office_2_2": require("../assets/Shopping/Workplace_Electrician_TwoFloors.png"),
  "office_2_3": require("../assets/Shopping/Workplace_Handyman_TwoFloors.png"),
  "office_2_4": require("../assets/Shopping/Workplace_PestControl_TwoFloors.png"),
  "office_2_5": require("../assets/Shopping/Workplace_Empty_TwoFloors.png"),
  "office_2_6": require("../assets/Shopping/Groceries_Mall.png"),
  "office_2_7": require("../assets/Shopping/Groceries_Market_Front1.png"),
  "office_2_8": require("../assets/Shopping/Workplace_TwoFloorsRoofed_Clothing.png"),
  // Tier 3: Larger offices - use mall and special buildings
  "office_3_1": require("../assets/Shopping/Groceries_Mall.png"),
  "office_3_2": require("../assets/Shopping/Groceries_Mall_Front.png"),
  "office_3_3": require("../assets/Shopping/Groceries_Market_Front2.png"),
  "office_3_4": require("../assets/Shopping/Groceries_Market_Front3.png"),
  "office_3_5": require("../assets/Shopping/WorkSpace_Bank.png"),
  "office_3_6": require("../assets/Shopping/Groceries_Store.png"),
  "office_3_7": require("../assets/Shopping/Groceries_Mall.png"),
  "office_3_8": require("../assets/Shopping/Groceries_Market.png"),

  // Cafe - From Restaurants/ folder
  "cafe_1_1": require("../assets/Restaurants/Cafe.png"),
  "cafe_1_2": require("../assets/Restaurants/Cafe_Front.png"),
  "cafe_1_3": require("../assets/Restaurants/Bar.png"),
  "cafe_1_4": require("../assets/Restaurants/Bar_Front.png"),
  "cafe_1_5": require("../assets/Restaurants/Cafe.png"),
  "cafe_1_6": require("../assets/Restaurants/Cafe_Front.png"),
  "cafe_1_7": require("../assets/Restaurants/Bar.png"),
  "cafe_1_8": require("../assets/Restaurants/Bar_Front.png"),

  // Restaurant - Various restaurant types
  "restaurant_1_1": require("../assets/Restaurants/Restaurant_Burger.png"),
  "restaurant_1_2": require("../assets/Restaurants/Restaurant_Pizza.png"),
  "restaurant_1_3": require("../assets/Restaurants/Restaurant_Chinese.png"),
  "restaurant_1_4": require("../assets/Restaurants/Restaurant_Mexican.png"),
  "restaurant_1_5": require("../assets/Restaurants/Restaurant_Sushi.png"),
  "restaurant_1_6": require("../assets/Restaurants/Restaurant_Ramen.png"),
  "restaurant_1_7": require("../assets/Restaurants/Restaurant_Indian.png"),
  "restaurant_1_8": require("../assets/Restaurants/Restaurant_French.png"),
  // Tier 2: Front view restaurants
  "restaurant_2_1": require("../assets/Restaurants/Restaurant_Burger_Front.png"),
  "restaurant_2_2": require("../assets/Restaurants/Restaurant_Pizza_Front.png"),
  "restaurant_2_3": require("../assets/Restaurants/Restaurant_Chinese_Front.png"),
  "restaurant_2_4": require("../assets/Restaurants/Restaurant_Mexican_Front.png"),
  "restaurant_2_5": require("../assets/Restaurants/Restaurant_Sushi_Front.png"),
  "restaurant_2_6": require("../assets/Restaurants/Restaurant_Ramen_Front.png"),
  "restaurant_2_7": require("../assets/Restaurants/Restaurant_Indian_Front.png"),
  "restaurant_2_8": require("../assets/Restaurants/Restaurant_French_Front.png"),
  // Tier 3: More restaurant variety
  "restaurant_3_1": require("../assets/Restaurants/Restaurant_Grill.png"),
  "restaurant_3_2": require("../assets/Restaurants/Restaurant_Grill_Front.png"),
  "restaurant_3_3": require("../assets/Restaurants/Restaurant_Chicken.png"),
  "restaurant_3_4": require("../assets/Restaurants/Restaurant_Chicken_Front.png"),
  "restaurant_3_5": require("../assets/Restaurants/Restaurant_Breakfast.png"),
  "restaurant_3_6": require("../assets/Restaurants/Restaurant_Breakfast_Front.png"),
  "restaurant_3_7": require("../assets/Restaurants/Restaurant_Sandwich.png"),
  "restaurant_3_8": require("../assets/Restaurants/Restaurant_Sandwich_Front.png"),

  // Factory - Using emergency and industrial buildings (2x2)
  "factory_1_1": require("../assets/Public/Emergency_FireStation.png"),
  "factory_1_2": require("../assets/Public/Emergency_PoliceStation.png"),
  "factory_1_3": require("../assets/Public/Industrial_PowerPlant.png"),
  "factory_1_4": require("../assets/Public/Industrial_WaterPlant.png"),
  "factory_1_5": require("../assets/Public/Public_Townhall.png"),
  "factory_1_6": require("../assets/Public/PostOffice.png"),
  "factory_1_7": require("../assets/Public/RadioStation.png"),
  "factory_1_8": require("../assets/Public/Public_Library.png"),

  // Hospital - From Public/ folder
  "hospital_1_1": require("../assets/Public/Doctor_Hospital.png"),
  "hospital_1_2": require("../assets/Public/Doctor_EmergencyRoom.png"),
  "hospital_1_3": require("../assets/Public/Doctor_Office.png"),
  "hospital_1_4": require("../assets/Public/Doctor_Hospital.png"),
  "hospital_1_5": require("../assets/Public/Doctor_EmergencyRoom.png"),
  "hospital_1_6": require("../assets/Public/Doctor_Office.png"),
  "hospital_1_7": require("../assets/Public/Doctor_Hospital.png"),
  "hospital_1_8": require("../assets/Public/Doctor_EmergencyRoom.png"),

  // School - School → College → University progression for tiers
  "school_1_1": require("../assets/Public/Education_School.png"),
  "school_1_2": require("../assets/Public/Education_School.png"),
  "school_1_3": require("../assets/Public/Education_School.png"),
  "school_1_4": require("../assets/Public/Education_School.png"),
  "school_1_5": require("../assets/Public/Education_School.png"),
  "school_1_6": require("../assets/Public/Education_School.png"),
  "school_1_7": require("../assets/Public/Education_School.png"),
  "school_1_8": require("../assets/Public/Education_School.png"),
  // Tier 2: College
  "school_2_1": require("../assets/Public/Education_College.png"),
  "school_2_2": require("../assets/Public/Education_College.png"),
  "school_2_3": require("../assets/Public/Education_College.png"),
  "school_2_4": require("../assets/Public/Education_College.png"),
  "school_2_5": require("../assets/Public/Education_College.png"),
  "school_2_6": require("../assets/Public/Education_College.png"),
  "school_2_7": require("../assets/Public/Education_College.png"),
  "school_2_8": require("../assets/Public/Education_College.png"),
  // Tier 3: University
  "school_3_1": require("../assets/Public/Education_University.png"),
  "school_3_2": require("../assets/Public/Education_University.png"),
  "school_3_3": require("../assets/Public/Education_University.png"),
  "school_3_4": require("../assets/Public/Education_University.png"),
  "school_3_5": require("../assets/Public/Education_University.png"),
  "school_3_6": require("../assets/Public/Education_University.png"),
  "school_3_7": require("../assets/Public/Education_University.png"),
  "school_3_8": require("../assets/Public/Education_University.png"),

  // Hotel - Actual hotel buildings from Public/ (1x2 size)
  "hotel_1_1": require("../assets/Public/Hotel_OneFloor.png"),
  "hotel_1_2": require("../assets/Public/Hotel_Front.png"),
  "hotel_1_3": require("../assets/Public/Hotel_OneFloor.png"),
  "hotel_1_4": require("../assets/Public/Hotel_Front.png"),
  "hotel_1_5": require("../assets/Public/Hotel_OneFloor.png"),
  "hotel_1_6": require("../assets/Public/Hotel_Front.png"),
  "hotel_1_7": require("../assets/Public/Hotel_OneFloor.png"),
  "hotel_1_8": require("../assets/Public/Hotel_Front.png"),
  // Tier 2
  "hotel_2_1": require("../assets/Public/Hotel_TwoFloors.png"),
  "hotel_2_2": require("../assets/Public/Hotel_BarFront.png"),
  "hotel_2_3": require("../assets/Public/Hotel_TwoFloors.png"),
  "hotel_2_4": require("../assets/Public/Hotel_BarFront.png"),
  "hotel_2_5": require("../assets/Public/Hotel_TwoFloors.png"),
  "hotel_2_6": require("../assets/Public/Hotel_BarFront.png"),
  "hotel_2_7": require("../assets/Public/Hotel_TwoFloors.png"),
  "hotel_2_8": require("../assets/Public/Hotel_BarFront.png"),
  // Tier 3
  "hotel_3_1": require("../assets/Public/Hotel_ThreeFloors.png"),
  "hotel_3_2": require("../assets/Public/Hotel_RoofBar.png"),
  "hotel_3_3": require("../assets/Public/Hotel_ThreeFloors.png"),
  "hotel_3_4": require("../assets/Public/Hotel_RoofBar.png"),
  "hotel_3_5": require("../assets/Public/Hotel_ThreeFloors.png"),
  "hotel_3_6": require("../assets/Public/Hotel_RoofBar.png"),
  "hotel_3_7": require("../assets/Public/Hotel_ThreeFloors.png"),
  "hotel_3_8": require("../assets/Public/Hotel_RoofBar.png"),

  // Powerplant - From Public/ folder
  "powerplant_1_1": require("../assets/Public/Industrial_PowerPlant.png"),
  "powerplant_1_2": require("../assets/Public/Industrial_WaterPlant.png"),
  "powerplant_1_3": require("../assets/Public/Industrial_WaterPlant_Front.png"),
  "powerplant_1_4": require("../assets/Public/Industrial_PowerPlant.png"),
  "powerplant_1_5": require("../assets/Public/Industrial_WaterPlant.png"),
  "powerplant_1_6": require("../assets/Public/Industrial_WaterPlant_Front.png"),
  "powerplant_1_7": require("../assets/Public/Industrial_PowerPlant.png"),
  "powerplant_1_8": require("../assets/Public/Industrial_WaterPlant.png"),

  // Warehouse - Using gas stations and small buildings (1x1)
  "warehouse_1_1": require("../assets/Public/GasStation.png"),
  "warehouse_1_2": require("../assets/Public/GasStation_Front1.png"),
  "warehouse_1_3": require("../assets/Public/GasStation_Front2.png"),
  "warehouse_1_4": require("../assets/Public/PostOffice.png"),
  "warehouse_1_5": require("../assets/Public/GasStation.png"),
  "warehouse_1_6": require("../assets/Public/GasStation_Front1.png"),
  "warehouse_1_7": require("../assets/Public/GasStation_Front2.png"),
  "warehouse_1_8": require("../assets/Public/PostOffice.png"),

  // Special - Various landmark buildings from Public/ (2x2)
  "special_1_1": require("../assets/Public/Leasure_Cinema.png"),
  "special_1_2": require("../assets/Public/Leasure_Museum.png"),
  "special_1_3": require("../assets/Public/Leasure_Theater.png"),
  "special_1_4": require("../assets/Public/Stadium_FootballSocker.png"),
  "special_1_5": require("../assets/Public/Stadium_Baseball.png"),
  "special_1_6": require("../assets/Public/Stadium_Athletics.png"),
  "special_1_7": require("../assets/Public/Public_Trainstation.png"),
  "special_1_8": require("../assets/Public/Airport_Hangar.png"),
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

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture);

  const animatedGridStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const buildingCount = buildings.length;
  const citySize = getCitySize(buildingCount);
  const { rows: GRID_ROWS, cols: GRID_COLS, maxPlots } = citySize;
  const isoBounds = getIsoBounds(GRID_ROWS, GRID_COLS);

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
    if (isPlot) {
      // Check if this tile should render the building sprite
      // For multi-tile buildings, we render from the bottom-right tile
      const renderTileIndex = building ? getBuildingRenderTile(building, GRID_ROWS, GRID_COLS) : null;
      const shouldRenderBuilding = building && renderTileIndex === plotIndex;
      const spriteStyle = shouldRenderBuilding ? getBuildingSpriteStyle(building) : null;

      return (
        <TouchableOpacity
          key={`${row}-${col}`}
          activeOpacity={0.7}
          onPress={() => plotIndex !== null && handlePlotPress(plotIndex)}
          style={[
            styles.tileContainer,
            { left: screenX, top: screenY, zIndex }
          ]}
        >
          <Image source={grassTile} style={styles.tile} />
          {shouldRenderBuilding && spriteStyle && (
            <Image
              source={getBuildingSprite(building)}
              style={[
                styles.buildingSpriteBase,
                {
                  width: spriteStyle.width,
                  height: spriteStyle.height,
                  top: spriteStyle.top,
                  left: spriteStyle.left,
                }
              ]}
            />
          )}
        </TouchableOpacity>
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
  },
  tileContainer: {
    position: "absolute",
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
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

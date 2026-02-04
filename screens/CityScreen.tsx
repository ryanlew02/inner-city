import { useEffect, useState } from "react";
import { Image, ImageSourcePropType, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import BuildingSheet from "../components/BuildingSheet";
import { BuildingType, PlacedBuilding, PURCHASABLE_BUILDING_TYPES, useBuildings } from "../context/BuildingContext";
import { useHabits } from "../context/HabitsContext";

// Isometric tile dimensions
const TILE_WIDTH = 64;
const TILE_HEIGHT = 64;
const ISO_TILE_HEIGHT = 32;

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

const grassTile = require("../assets/sprites/ground/emptytile.png");

const roadSprites: Record<string, ImageSourcePropType> = {
  road_h: require("../assets/sprites/ground/road_straight2.png"),
  road_v: require("../assets/sprites/ground/road_straight.png"),
  road_cross: require("../assets/sprites/ground/road_cross.png"),
  road_corner_nw: require("../assets/sprites/ground/road_corner_sw_se.png"),
  road_corner_ne: require("../assets/sprites/ground/road_corner_nw_sw.png"),
  road_corner_sw: require("../assets/sprites/ground/road_corner_ne_se.png"),
  road_corner_se: require("../assets/sprites/ground/road_corner_nw_ne.png"),
  road_t_north: require("../assets/sprites/ground/road_t_missing_sw.png"),
  road_t_south: require("../assets/sprites/ground/road_t_missing_ne.png"),
  road_t_east: require("../assets/sprites/ground/road_t_missing_nw.png"),
  road_t_west: require("../assets/sprites/ground/road_t_missing_se.png"),
};

function isRoadTile(tileType: TileType): boolean {
  return tileType !== "plot";
}

// Building sprites organized by type, tier, and variant
// For types without tier2/3 sprites, we'll fall back to tier1
const buildingSpriteMap: Record<string, ImageSourcePropType> = {
  // Residential - has all tiers
  "residential_1_1": require("../assets/sprites/buildings/residential_tier1_1.png"),
  "residential_1_2": require("../assets/sprites/buildings/residential_tier1_2.png"),
  "residential_1_3": require("../assets/sprites/buildings/residential_tier1_3.png"),
  "residential_1_4": require("../assets/sprites/buildings/residential_tier1_4.png"),
  "residential_1_5": require("../assets/sprites/buildings/residential_tier1_5.png"),
  "residential_1_6": require("../assets/sprites/buildings/residential_tier1_6.png"),
  "residential_1_7": require("../assets/sprites/buildings/residential_tier1_7.png"),
  "residential_1_8": require("../assets/sprites/buildings/residential_tier1_8.png"),
  "residential_2_1": require("../assets/sprites/buildings/residential_tier2_1.png"),
  "residential_2_2": require("../assets/sprites/buildings/residential_tier2_2.png"),
  "residential_2_3": require("../assets/sprites/buildings/residential_tier2_3.png"),
  "residential_2_4": require("../assets/sprites/buildings/residential_tier2_4.png"),
  "residential_2_5": require("../assets/sprites/buildings/residential_tier2_5.png"),
  "residential_2_6": require("../assets/sprites/buildings/residential_tier2_6.png"),
  "residential_2_7": require("../assets/sprites/buildings/residential_tier2_7.png"),
  "residential_2_8": require("../assets/sprites/buildings/residential_tier2_8.png"),
  "residential_3_1": require("../assets/sprites/buildings/residential_tier3_1.png"),
  "residential_3_2": require("../assets/sprites/buildings/residential_tier3_2.png"),
  "residential_3_3": require("../assets/sprites/buildings/residential_tier3_3.png"),
  "residential_3_4": require("../assets/sprites/buildings/residential_tier3_4.png"),
  "residential_3_5": require("../assets/sprites/buildings/residential_tier3_5.png"),
  "residential_3_6": require("../assets/sprites/buildings/residential_tier3_6.png"),
  "residential_3_7": require("../assets/sprites/buildings/residential_tier3_7.png"),
  "residential_3_8": require("../assets/sprites/buildings/residential_tier3_8.png"),
  // Office - has all tiers
  "office_1_1": require("../assets/sprites/buildings/office_tier1_1.png"),
  "office_1_2": require("../assets/sprites/buildings/office_tier1_2.png"),
  "office_1_3": require("../assets/sprites/buildings/office_tier1_3.png"),
  "office_1_4": require("../assets/sprites/buildings/office_tier1_4.png"),
  "office_1_5": require("../assets/sprites/buildings/office_tier1_5.png"),
  "office_1_6": require("../assets/sprites/buildings/office_tier1_6.png"),
  "office_1_7": require("../assets/sprites/buildings/office_tier1_7.png"),
  "office_1_8": require("../assets/sprites/buildings/office_tier1_8.png"),
  "office_2_1": require("../assets/sprites/buildings/office_tier2_1.png"),
  "office_2_2": require("../assets/sprites/buildings/office_tier2_2.png"),
  "office_2_3": require("../assets/sprites/buildings/office_tier2_3.png"),
  "office_2_4": require("../assets/sprites/buildings/office_tier2_4.png"),
  "office_2_5": require("../assets/sprites/buildings/office_tier2_5.png"),
  "office_2_6": require("../assets/sprites/buildings/office_tier2_6.png"),
  "office_2_7": require("../assets/sprites/buildings/office_tier2_7.png"),
  "office_2_8": require("../assets/sprites/buildings/office_tier2_8.png"),
  "office_3_1": require("../assets/sprites/buildings/office_tier3_1.png"),
  "office_3_2": require("../assets/sprites/buildings/office_tier3_2.png"),
  "office_3_3": require("../assets/sprites/buildings/office_tier3_3.png"),
  "office_3_4": require("../assets/sprites/buildings/office_tier3_4.png"),
  "office_3_5": require("../assets/sprites/buildings/office_tier3_5.png"),
  "office_3_6": require("../assets/sprites/buildings/office_tier3_6.png"),
  "office_3_7": require("../assets/sprites/buildings/office_tier3_7.png"),
  "office_3_8": require("../assets/sprites/buildings/office_tier3_8.png"),
  // Shop - tier 1 only
  "shop_1_1": require("../assets/sprites/buildings/shop_tier1_1.png"),
  "shop_1_2": require("../assets/sprites/buildings/shop_tier1_2.png"),
  "shop_1_3": require("../assets/sprites/buildings/shop_tier1_3.png"),
  "shop_1_4": require("../assets/sprites/buildings/shop_tier1_4.png"),
  "shop_1_5": require("../assets/sprites/buildings/shop_tier1_5.png"),
  "shop_1_6": require("../assets/sprites/buildings/shop_tier1_6.png"),
  "shop_1_7": require("../assets/sprites/buildings/shop_tier1_7.png"),
  "shop_1_8": require("../assets/sprites/buildings/shop_tier1_8.png"),
  // Cafe - tier 1 only
  "cafe_1_1": require("../assets/sprites/buildings/cafe_tier1_1.png"),
  "cafe_1_2": require("../assets/sprites/buildings/cafe_tier1_2.png"),
  "cafe_1_3": require("../assets/sprites/buildings/cafe_tier1_3.png"),
  "cafe_1_4": require("../assets/sprites/buildings/cafe_tier1_4.png"),
  "cafe_1_5": require("../assets/sprites/buildings/cafe_tier1_5.png"),
  "cafe_1_6": require("../assets/sprites/buildings/cafe_tier1_6.png"),
  "cafe_1_7": require("../assets/sprites/buildings/cafe_tier1_7.png"),
  "cafe_1_8": require("../assets/sprites/buildings/cafe_tier1_8.png"),
  // Restaurant - tier 1 only
  "restaurant_1_1": require("../assets/sprites/buildings/restaurant_tier1_1.png"),
  "restaurant_1_2": require("../assets/sprites/buildings/restaurant_tier1_2.png"),
  "restaurant_1_3": require("../assets/sprites/buildings/restaurant_tier1_3.png"),
  "restaurant_1_4": require("../assets/sprites/buildings/restaurant_tier1_4.png"),
  "restaurant_1_5": require("../assets/sprites/buildings/restaurant_tier1_5.png"),
  "restaurant_1_6": require("../assets/sprites/buildings/restaurant_tier1_6.png"),
  "restaurant_1_7": require("../assets/sprites/buildings/restaurant_tier1_7.png"),
  "restaurant_1_8": require("../assets/sprites/buildings/restaurant_tier1_8.png"),
  // Factory - tier 1 only
  "factory_1_1": require("../assets/sprites/buildings/factory_tier1_1.png"),
  "factory_1_2": require("../assets/sprites/buildings/factory_tier1_2.png"),
  "factory_1_3": require("../assets/sprites/buildings/factory_tier1_3.png"),
  "factory_1_4": require("../assets/sprites/buildings/factory_tier1_4.png"),
  "factory_1_5": require("../assets/sprites/buildings/factory_tier1_5.png"),
  "factory_1_6": require("../assets/sprites/buildings/factory_tier1_6.png"),
  "factory_1_7": require("../assets/sprites/buildings/factory_tier1_7.png"),
  "factory_1_8": require("../assets/sprites/buildings/factory_tier1_8.png"),
  // Hospital - tier 1 only
  "hospital_1_1": require("../assets/sprites/buildings/hospital_tier1_1.png"),
  "hospital_1_2": require("../assets/sprites/buildings/hospital_tier1_2.png"),
  "hospital_1_3": require("../assets/sprites/buildings/hospital_tier1_3.png"),
  "hospital_1_4": require("../assets/sprites/buildings/hospital_tier1_4.png"),
  "hospital_1_5": require("../assets/sprites/buildings/hospital_tier1_5.png"),
  "hospital_1_6": require("../assets/sprites/buildings/hospital_tier1_6.png"),
  "hospital_1_7": require("../assets/sprites/buildings/hospital_tier1_7.png"),
  "hospital_1_8": require("../assets/sprites/buildings/hospital_tier1_8.png"),
  // School - tier 1 only
  "school_1_1": require("../assets/sprites/buildings/school_tier1_1.png"),
  "school_1_2": require("../assets/sprites/buildings/school_tier1_2.png"),
  "school_1_3": require("../assets/sprites/buildings/school_tier1_3.png"),
  "school_1_4": require("../assets/sprites/buildings/school_tier1_4.png"),
  "school_1_5": require("../assets/sprites/buildings/school_tier1_5.png"),
  "school_1_6": require("../assets/sprites/buildings/school_tier1_6.png"),
  "school_1_7": require("../assets/sprites/buildings/school_tier1_7.png"),
  "school_1_8": require("../assets/sprites/buildings/school_tier1_8.png"),
  // Hotel - tier 1 only
  "hotel_1_1": require("../assets/sprites/buildings/hotel_tier1_1.png"),
  "hotel_1_2": require("../assets/sprites/buildings/hotel_tier1_2.png"),
  "hotel_1_3": require("../assets/sprites/buildings/hotel_tier1_3.png"),
  "hotel_1_4": require("../assets/sprites/buildings/hotel_tier1_4.png"),
  "hotel_1_5": require("../assets/sprites/buildings/hotel_tier1_5.png"),
  "hotel_1_6": require("../assets/sprites/buildings/hotel_tier1_6.png"),
  "hotel_1_7": require("../assets/sprites/buildings/hotel_tier1_7.png"),
  "hotel_1_8": require("../assets/sprites/buildings/hotel_tier1_8.png"),
  // Powerplant - tier 1 only
  "powerplant_1_1": require("../assets/sprites/buildings/powerplant_tier1_1.png"),
  "powerplant_1_2": require("../assets/sprites/buildings/powerplant_tier1_2.png"),
  "powerplant_1_3": require("../assets/sprites/buildings/powerplant_tier1_3.png"),
  "powerplant_1_4": require("../assets/sprites/buildings/powerplant_tier1_4.png"),
  "powerplant_1_5": require("../assets/sprites/buildings/powerplant_tier1_5.png"),
  "powerplant_1_6": require("../assets/sprites/buildings/powerplant_tier1_6.png"),
  "powerplant_1_7": require("../assets/sprites/buildings/powerplant_tier1_7.png"),
  "powerplant_1_8": require("../assets/sprites/buildings/powerplant_tier1_8.png"),
  // Warehouse - tier 1 only
  "warehouse_1_1": require("../assets/sprites/buildings/warehouse_tier1_1.png"),
  "warehouse_1_2": require("../assets/sprites/buildings/warehouse_tier1_2.png"),
  "warehouse_1_3": require("../assets/sprites/buildings/warehouse_tier1_3.png"),
  "warehouse_1_4": require("../assets/sprites/buildings/warehouse_tier1_4.png"),
  "warehouse_1_5": require("../assets/sprites/buildings/warehouse_tier1_5.png"),
  "warehouse_1_6": require("../assets/sprites/buildings/warehouse_tier1_6.png"),
  "warehouse_1_7": require("../assets/sprites/buildings/warehouse_tier1_7.png"),
  "warehouse_1_8": require("../assets/sprites/buildings/warehouse_tier1_8.png"),
  // Special - tier 1 only
  "special_1_1": require("../assets/sprites/buildings/special_tier1_1.png"),
  "special_1_2": require("../assets/sprites/buildings/special_tier1_2.png"),
  "special_1_3": require("../assets/sprites/buildings/special_tier1_3.png"),
  "special_1_4": require("../assets/sprites/buildings/special_tier1_4.png"),
  "special_1_5": require("../assets/sprites/buildings/special_tier1_5.png"),
  "special_1_6": require("../assets/sprites/buildings/special_tier1_6.png"),
  "special_1_7": require("../assets/sprites/buildings/special_tier1_7.png"),
  "special_1_8": require("../assets/sprites/buildings/special_tier1_8.png"),
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
    const existingBuilding = getBuildingAtPlot(plotIndex);
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
    const success = await autoBuildBuilding(randomType, maxPlots);
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
      const success = await autoBuildBuilding(randomType, maxPlots);
      if (!success) break;
    }
    setSheetVisible(false);
  };

  const handleSelectBuildingType = async (type: BuildingType) => {
    let success = false;
    if (selectedPlotIndex !== null) {
      success = await placeBuilding(selectedPlotIndex, type);
    } else {
      success = await autoBuildBuilding(type, maxPlots);
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
    const building = plotIndex !== null ? getBuildingAtPlot(plotIndex) : null;
    const rotation = getTileRotation(tileType);
    const isRoad = isRoadTile(tileType);
    const isPlot = tileType === "plot";

    const isoPos = gridToIso(row, col);
    const screenX = isoPos.x + isoBounds.offsetX;
    const screenY = isoPos.y + isoBounds.offsetY;
    const zIndex = row + col;

    const tileContent = (
      <View
        style={[
          styles.tileContainer,
          {
            left: screenX,
            top: screenY,
            zIndex,
          },
        ]}
      >
        {!building && <Image source={grassTile} style={styles.tile} />}

        {isRoad && (
          <Image
            source={roadSprites[tileType]}
            style={[styles.roadSprite, { transform: [{ rotate: rotation }] }]}
          />
        )}

        {building && (
          <Image
            source={getBuildingSprite(building)}
            style={styles.buildingSprite}
          />
        )}
      </View>
    );

    if (isPlot) {
      return (
        <TouchableOpacity
          key={`${row}-${col}`}
          activeOpacity={0.7}
          onPress={() => plotIndex !== null && handlePlotPress(plotIndex)}
          style={{ position: "absolute", left: screenX, top: screenY, zIndex: zIndex + 1000 }}
        >
          <View style={styles.tileHitArea} />
          {tileContent.props.children}
        </TouchableOpacity>
      );
    }

    return (
      <View key={`${row}-${col}`}>
        {tileContent}
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
    backgroundColor: "#9CA3AF",
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
  buildingSprite: {
    position: "absolute",
    top: -13,
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
  messageText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 12,
  },
});

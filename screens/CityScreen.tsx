import { Text, View, StyleSheet } from "react-native";
import { useHabits } from "../context/HabitsContext";

const TILE_COLORS = ["#4CAF50", "#8BC34A", "#CDDC39", "#FFC107", "#FF9800"];

export default function CityScreen() {
  const { habits, completedCount } = useHabits();
  const totalTiles = completedCount;

  const renderCityGrid = () => {
    const gridSize = 5;
    const tiles = [];

    for (let row = 0; row < gridSize; row++) {
      const rowTiles = [];
      for (let col = 0; col < gridSize; col++) {
        const tileIndex = row * gridSize + col;
        const isBuilt = tileIndex < totalTiles;
        const colorIndex = tileIndex % TILE_COLORS.length;

        rowTiles.push(
          <View
            key={`${row}-${col}`}
            style={[
              styles.tile,
              isBuilt
                ? { backgroundColor: TILE_COLORS[colorIndex] }
                : styles.emptyTile,
            ]}
          >
            {isBuilt && <Text style={styles.tileIcon}>🏠</Text>}
          </View>
        );
      }
      tiles.push(
        <View key={row} style={styles.row}>
          {rowTiles}
        </View>
      );
    }
    return tiles;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inner City</Text>
        <Text style={styles.subtitle}>Build your city, one habit at a time</Text>
      </View>

      <View style={styles.cityContainer}>
        <View style={styles.cityGrid}>{renderCityGrid()}</View>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{completedCount}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{totalTiles}</Text>
            <Text style={styles.statLabel}>Tiles Built</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{habits.length}</Text>
            <Text style={styles.statLabel}>Habits</Text>
          </View>
        </View>
      </View>

      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>
          {completedCount === 0
            ? "Complete habits to build your city!"
            : completedCount === habits.length
            ? "Amazing! All habits completed!"
            : `${habits.length - completedCount} habits left today`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
  },
  subtitle: {
    fontSize: 14,
    color: "#888",
    marginTop: 2,
  },
  cityContainer: {
    backgroundColor: "#16213e",
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
  },
  cityGrid: {
    alignItems: "center",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
  },
  tile: {
    width: 50,
    height: 50,
    margin: 3,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTile: {
    backgroundColor: "#0f3460",
    borderWidth: 1,
    borderColor: "#1a4a7a",
    borderStyle: "dashed",
  },
  tileIcon: {
    fontSize: 24,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statBox: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#4CAF50",
  },
  statLabel: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  messageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  messageText: {
    fontSize: 18,
    color: "#888",
    textAlign: "center",
  },
});

import { Text, View, StyleSheet } from "react-native";
import { useHabits } from "../context/HabitsContext";

export default function StatsScreen() {
  const { habits, completedCount } = useHabits();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Stats</Text>
        <Text style={styles.subtitle}>Your progress</Text>
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.cardTitle}>Today's Progress</Text>
        <Text style={styles.statNumber}>
          {completedCount}/{habits.length}
        </Text>
        <Text style={styles.statLabel}>Habits Completed</Text>
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.cardTitle}>Completion Rate</Text>
        <Text style={styles.statNumber}>
          {habits.length > 0
            ? Math.round((completedCount / habits.length) * 100)
            : 0}
          %
        </Text>
        <Text style={styles.statLabel}>Today</Text>
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
  statsCard: {
    backgroundColor: "#16213e",
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 16,
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 14,
    color: "#888",
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#4CAF50",
  },
  statLabel: {
    fontSize: 16,
    color: "#ffffff",
    marginTop: 8,
  },
});

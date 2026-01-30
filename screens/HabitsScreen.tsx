import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useHabits } from "../context/HabitsContext";

export default function HabitsScreen() {
  const { habits, toggleHabit, completedCount } = useHabits();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Daily Habits</Text>
        <Text style={styles.subtitle}>
          {completedCount} of {habits.length} completed
        </Text>
      </View>

      <ScrollView style={styles.habitsList} contentContainerStyle={styles.habitsContent}>
        {habits.map((habit) => (
          <TouchableOpacity
            key={habit.id}
            style={[styles.habitItem, habit.completed && styles.habitCompleted]}
            onPress={() => toggleHabit(habit.id)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.checkbox,
                habit.completed && styles.checkboxChecked,
              ]}
            >
              {habit.completed && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text
              style={[
                styles.habitText,
                habit.completed && styles.habitTextCompleted,
              ]}
            >
              {habit.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {completedCount === habits.length && (
        <View style={styles.completedBanner}>
          <Text style={styles.completedText}>All habits completed! Great job!</Text>
        </View>
      )}
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
  habitsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  habitsContent: {
    paddingBottom: 20,
  },
  habitItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16213e",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  habitCompleted: {
    backgroundColor: "#1a3a2a",
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  checkboxChecked: {
    backgroundColor: "#4CAF50",
  },
  checkmark: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  habitText: {
    fontSize: 16,
    color: "#ffffff",
    flex: 1,
  },
  habitTextCompleted: {
    color: "#888",
    textDecorationLine: "line-through",
  },
  completedBanner: {
    backgroundColor: "#4CAF50",
    padding: 16,
    margin: 20,
    borderRadius: 12,
    alignItems: "center",
  },
  completedText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

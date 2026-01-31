import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { useHabits } from "../context/HabitsContext";
import { Habit, parseScheduleJson } from "../types/habit";

type HabitTileProps = {
  habit: Habit;
  completed: boolean;
  currentValue: number;
  isScheduledToday: boolean;
  onTap: () => void;
  onLongPress: () => void;
};

function HabitTile({ habit, completed, currentValue, isScheduledToday, onTap, onLongPress }: HabitTileProps) {
  const isProgressType = habit.target_type !== "check";
  const scheduleData = parseScheduleJson(habit.schedule_json);
  const isQuitHabit = scheduleData.habit_mode === 'quit';

  const progressPercent = isProgressType
    ? Math.min((currentValue / habit.target_value) * 100, 100)
    : (completed ? 100 : 0);

  const getUnitLabel = () => {
    if (habit.target_type === "minutes") return "min";
    if (habit.target_type === "hours") return "hr";
    return "";
  };

  return (
    <TouchableOpacity
      style={[
        styles.habitItem,
        { borderLeftColor: habit.color || "#22C55E" },
        !isScheduledToday && styles.habitItemDimmed,
      ]}
      onPress={onTap}
      onLongPress={onLongPress}
      delayLongPress={500}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.progressFill,
          {
            backgroundColor: habit.color ? `${habit.color}30` : "#22C55E30",
            width: `${progressPercent}%`,
          },
        ]}
      />

      {completed && (
        <View style={[styles.completedFill, { backgroundColor: habit.color ? `${habit.color}40` : "#22C55E40" }]} />
      )}

      <View
        style={[
          styles.checkbox,
          { borderColor: habit.color || "#22C55E" },
          completed && { backgroundColor: habit.color || "#22C55E" },
        ]}
      >
        {completed && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.habitInfo}>
        <View style={styles.habitHeader}>
          {habit.icon ? <Text style={styles.habitIcon}>{habit.icon}</Text> : null}
          <Text
            style={[
              styles.habitText,
              completed && styles.habitTextCompleted,
              !isScheduledToday && styles.habitTextDimmed,
            ]}
          >
            {habit.name}
          </Text>
          {isQuitHabit && <View style={styles.quitBadge}><Text style={styles.quitBadgeText}>QUIT</Text></View>}
        </View>
        {!isScheduledToday ? (
          <Text style={styles.notScheduledText}>Not scheduled for today</Text>
        ) : habit.target_type !== "check" ? (
          <Text style={styles.habitProgress}>
            {currentValue} {isQuitHabit ? '/' : '/'} {habit.target_value} {getUnitLabel()}
            {isQuitHabit && ` (limit)`}
          </Text>
        ) : habit.description ? (
          <Text style={styles.habitDescription} numberOfLines={1}>
            {habit.description}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function HabitsScreen() {
  const router = useRouter();
  const { habits, toggleHabit, completedCount, isHabitCompleted, isHabitScheduledForToday, archiveHabit, updateEntryValue, getEntryValue, loading } = useHabits();

  // Progress input modal state
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [progressValue, setProgressValue] = useState("");

  // Options modal state
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [optionsHabit, setOptionsHabit] = useState<Habit | null>(null);

  // Swipeable refs
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});
  const currentlyOpenSwipeable = useRef<string | null>(null);

  const handleHabitPress = (habit: Habit) => {
    if (habit.target_type === "check") {
      toggleHabit(habit.id);
    } else {
      setSelectedHabit(habit);
      setProgressValue(getEntryValue(habit.id).toString());
      setProgressModalVisible(true);
    }
  };

  const handleProgressSave = async () => {
    if (!selectedHabit) return;
    const value = parseInt(progressValue) || 0;
    await updateEntryValue(selectedHabit.id, value);
    setProgressModalVisible(false);
    setSelectedHabit(null);
    setProgressValue("");
  };

  const handleProgressCancel = () => {
    setProgressModalVisible(false);
    setSelectedHabit(null);
    setProgressValue("");
  };

  const handleOpenOptions = (habit: Habit) => {
    setOptionsHabit(habit);
    setOptionsModalVisible(true);
  };

  const handleCloseOptions = () => {
    setOptionsModalVisible(false);
    setOptionsHabit(null);
  };

  const handleDeleteHabit = () => {
    if (!optionsHabit) return;

    Alert.alert(
      "Delete Habit",
      `Are you sure you want to delete "${optionsHabit.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            archiveHabit(optionsHabit.id);
            handleCloseOptions();
          },
        },
      ]
    );
  };

  const handleEditHabit = () => {
    if (!optionsHabit) return;
    handleCloseOptions();
    router.push(`/habit-form?habitId=${optionsHabit.id}`);
  };

  const handleResetHabit = async (habit: Habit) => {
    await updateEntryValue(habit.id, 0);
    swipeableRefs.current[habit.id]?.close();
    currentlyOpenSwipeable.current = null;
  };

  const handleSwipeableOpen = (habitId: string) => {
    if (currentlyOpenSwipeable.current && currentlyOpenSwipeable.current !== habitId) {
      swipeableRefs.current[currentlyOpenSwipeable.current]?.close();
    }
    currentlyOpenSwipeable.current = habitId;
  };

  const renderRightActions = (habit: Habit) => {
    return (
      <TouchableOpacity
        style={styles.resetAction}
        onPress={() => handleResetHabit(habit)}
      >
        <Text style={styles.resetActionText}>Reset</Text>
      </TouchableOpacity>
    );
  };

  const handleQuickAdd = async (habit: Habit, amount: number) => {
    const currentValue = getEntryValue(habit.id);
    await updateEntryValue(habit.id, currentValue + amount);
    swipeableRefs.current[habit.id]?.close();
    currentlyOpenSwipeable.current = null;
  };

  const renderLeftActions = (habit: Habit) => {
    if (habit.target_type === "check") {
      return (
        <TouchableOpacity
          style={styles.completeAction}
          onPress={async () => {
            await toggleHabit(habit.id);
            swipeableRefs.current[habit.id]?.close();
            currentlyOpenSwipeable.current = null;
          }}
        >
          <Text style={styles.completeActionText}>
            {isHabitCompleted(habit.id) ? "Undo" : "Done"}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.swipeActionsContainerLeft}>
        <TouchableOpacity
          style={[styles.quickAddAction, styles.quickAddSmall]}
          onPress={() => handleQuickAdd(habit, 1)}
        >
          <Text style={styles.quickAddActionText}>+1</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickAddAction, styles.quickAddMedium]}
          onPress={() => handleQuickAdd(habit, 5)}
        >
          <Text style={styles.quickAddActionText}>+5</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickAddAction, styles.quickAddLarge]}
          onPress={() => handleQuickAdd(habit, 10)}
        >
          <Text style={styles.quickAddActionText}>+10</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickAddAction, styles.quickAddMax]}
          onPress={() => {
            const remaining = habit.target_value - getEntryValue(habit.id);
            if (remaining > 0) handleQuickAdd(habit, remaining);
          }}
        >
          <Text style={styles.quickAddActionText}>Max</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#22C55E" />
        <Text style={styles.loadingText}>Loading habits...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Daily Habits</Text>
        <Text style={styles.subtitle}>
          {completedCount} of {habits.length} completed
        </Text>
      </View>

      <ScrollView style={styles.habitsList} contentContainerStyle={styles.habitsContent}>
        {habits.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No habits yet</Text>
            <Text style={styles.emptySubtext}>Tap the + button to create your first habit</Text>
          </View>
        ) : (
          habits.map((habit) => {
            const completed = isHabitCompleted(habit.id);
            const isScheduledToday = isHabitScheduledForToday(habit.id);
            return (
              <Swipeable
                key={habit.id}
                ref={(ref) => { swipeableRefs.current[habit.id] = ref; }}
                renderRightActions={() => renderRightActions(habit)}
                renderLeftActions={() => renderLeftActions(habit)}
                onSwipeableWillOpen={() => handleSwipeableOpen(habit.id)}
                friction={2}
              >
                <HabitTile
                  habit={habit}
                  completed={completed}
                  currentValue={getEntryValue(habit.id)}
                  isScheduledToday={isScheduledToday}
                  onTap={() => handleHabitPress(habit)}
                  onLongPress={() => handleOpenOptions(habit)}
                />
              </Swipeable>
            );
          })
        )}
      </ScrollView>

      {completedCount === habits.length && habits.length > 0 && (
        <View style={styles.completedBanner}>
          <Text style={styles.completedText}>All habits completed! Great job!</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/habit-form')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Options Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={optionsModalVisible}
        onRequestClose={handleCloseOptions}
      >
        <TouchableOpacity
          style={styles.optionsModalOverlay}
          activeOpacity={1}
          onPress={handleCloseOptions}
        >
          <View style={styles.optionsModalContent}>
            <View style={styles.optionsHeader}>
              <Text style={styles.optionsTitle}>
                {optionsHabit?.icon} {optionsHabit?.name}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleEditHabit}
            >
              <Text style={styles.optionItemText}>Edit Habit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleDeleteHabit}
            >
              <Text style={styles.optionItemTextDanger}>Delete Habit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionItemCancel}
              onPress={handleCloseOptions}
            >
              <Text style={styles.optionItemText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Progress Input Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={progressModalVisible}
        onRequestClose={handleProgressCancel}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.progressModalOverlay}
        >
          <View style={styles.progressModalContent}>
            <Text style={styles.progressModalTitle}>
              {selectedHabit?.icon} {selectedHabit?.name}
            </Text>
            <Text style={styles.progressModalSubtitle}>
              Target: {selectedHabit?.target_value} {selectedHabit?.target_type === "minutes" ? "minutes" : ""}
            </Text>

            <View style={styles.progressInputRow}>
              <TouchableOpacity
                style={styles.progressButton}
                onPress={() => {
                  const current = parseInt(progressValue) || 0;
                  if (current > 0) setProgressValue((current - 1).toString());
                }}
              >
                <Text style={styles.progressButtonText}>-</Text>
              </TouchableOpacity>

              <TextInput
                style={styles.progressInput}
                value={progressValue}
                onChangeText={(text) => setProgressValue(text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                textAlign="center"
              />

              <TouchableOpacity
                style={styles.progressButton}
                onPress={() => {
                  const current = parseInt(progressValue) || 0;
                  setProgressValue((current + 1).toString());
                }}
              >
                <Text style={styles.progressButtonText}>+</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.progressUnitLabel}>
              {selectedHabit?.target_type === "minutes" ? "minutes" : selectedHabit?.target_type === "hours" ? "hours" : "times"}
            </Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleProgressCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleProgressSave}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F4F7",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F2F4F7",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#64748B",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 2,
  },
  habitsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  habitsContent: {
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#64748B",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 8,
  },
  habitItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    overflow: "hidden",
    position: "relative",
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 12,
  },
  completedFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    borderRadius: 12,
  },
  resetAction: {
    backgroundColor: "#F59E0B",
    justifyContent: "center",
    alignItems: "center",
    width: 70,
    borderRadius: 12,
    marginBottom: 10,
    marginLeft: 8,
  },
  resetActionText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 13,
  },
  swipeActionsContainerLeft: {
    flexDirection: "row",
    marginBottom: 10,
    marginRight: 8,
  },
  completeAction: {
    backgroundColor: "#22C55E",
    justifyContent: "center",
    alignItems: "center",
    width: 70,
    borderRadius: 12,
    marginBottom: 10,
    marginRight: 8,
  },
  completeActionText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 13,
  },
  quickAddAction: {
    justifyContent: "center",
    alignItems: "center",
    width: 46,
    borderRadius: 12,
    marginBottom: 10,
    marginRight: 4,
  },
  quickAddSmall: {
    backgroundColor: "#93C5FD",
  },
  quickAddMedium: {
    backgroundColor: "#60A5FA",
  },
  quickAddLarge: {
    backgroundColor: "#3B82F6",
  },
  quickAddMax: {
    backgroundColor: "#22C55E",
  },
  quickAddActionText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 12,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  checkmark: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  habitInfo: {
    flex: 1,
  },
  habitHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  habitIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  habitText: {
    fontSize: 16,
    color: "#111827",
    flex: 1,
  },
  habitTextCompleted: {
    color: "#64748B",
    textDecorationLine: "line-through",
  },
  habitDescription: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 4,
  },
  habitProgress: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
    fontWeight: "500",
  },
  completedBanner: {
    backgroundColor: "#22C55E",
    padding: 16,
    margin: 20,
    marginBottom: 80,
    borderRadius: 12,
    alignItems: "center",
  },
  completedText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#22C55E",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 32,
    color: "#fff",
    fontWeight: "300",
    marginTop: -2,
  },
  optionsModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  optionsModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  optionsHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  optionsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
  },
  optionItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  optionItemCancel: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  optionItemText: {
    fontSize: 16,
    color: "#374151",
    textAlign: "center",
  },
  optionItemTextDanger: {
    fontSize: 16,
    color: "#EF4444",
    textAlign: "center",
    fontWeight: "500",
  },
  habitItemDimmed: {
    opacity: 0.5,
  },
  habitTextDimmed: {
    color: "#9CA3AF",
  },
  notScheduledText: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
    fontStyle: "italic",
  },
  quitBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  quitBadgeText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "700",
  },
  progressModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  progressModalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "85%",
    maxWidth: 340,
    alignItems: "center",
  },
  progressModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  progressModalSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 24,
  },
  progressInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  progressButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  progressButtonText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#374151",
  },
  progressInput: {
    width: 100,
    fontSize: 32,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
    padding: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
  },
  progressUnitLabel: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 8,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#22C55E",
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});

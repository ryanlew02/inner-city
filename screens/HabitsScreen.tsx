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
import { useHabits } from "../context/HabitsContext";
import { Habit, parseScheduleJson, ScheduleData } from "../types/habit";

const PRESET_COLORS = [
  "#22C55E", // green
  "#3B82F6", // blue
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
];

const SUGGESTED_ICONS = ["💪", "📚", "💧", "🧘", "🏃", "🍎", "😴", "✍️"];


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

  // For quit habits with count/time, progress shows how much of the limit is used
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
      {/* Progress fill background */}
      <View
        style={[
          styles.progressFill,
          {
            backgroundColor: habit.color ? `${habit.color}30` : "#22C55E30",
            width: `${progressPercent}%`,
          },
        ]}
      />

      {/* Completed overlay */}
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

type NewHabitForm = {
  name: string;
  description: string;
  target_type: "check" | "count" | "minutes" | "hours";
  target_value: string;
  color: string;
  icon: string;
  schedule_type: "daily" | "specific_days" | "times_per_week";
  habit_mode: "build" | "quit";
  specific_days: number[];
  times_per_week: string;
};

const initialForm: NewHabitForm = {
  name: "",
  description: "",
  target_type: "check",
  target_value: "1",
  color: "#22C55E",
  icon: "💪",
  schedule_type: "daily",
  habit_mode: "build",
  specific_days: [],
  times_per_week: "3",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function HabitsScreen() {
  const { habits, toggleHabit, completedCount, isHabitCompleted, isHabitScheduledForToday, addHabit, updateHabit, archiveHabit, updateEntryValue, getEntryValue, loading } = useHabits();

  // Progress input modal state
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [progressValue, setProgressValue] = useState("");

  // Options modal state
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [optionsHabit, setOptionsHabit] = useState<Habit | null>(null);

  // Swipeable refs for managing open state
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});
  const currentlyOpenSwipeable = useRef<string | null>(null);

  const handleHabitPress = (habit: Habit) => {
    if (habit.target_type === "check") {
      toggleHabit(habit.id);
    } else {
      // Open progress modal for minutes/count habits
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

    // Parse schedule_json to populate form
    const scheduleData = parseScheduleJson(optionsHabit.schedule_json);

    // Determine schedule_type from schedule_json
    let schedule_type: "daily" | "specific_days" | "times_per_week" = "daily";
    if (scheduleData.specific_days && scheduleData.specific_days.length > 0) {
      schedule_type = "specific_days";
    } else if (scheduleData.times_per_week !== undefined) {
      schedule_type = "times_per_week";
    }

    // Pre-populate form with existing habit data
    setForm({
      name: optionsHabit.name,
      description: optionsHabit.description || "",
      target_type: optionsHabit.target_type,
      target_value: optionsHabit.target_value.toString(),
      color: optionsHabit.color || "#22C55E",
      icon: optionsHabit.icon || "",
      schedule_type,
      habit_mode: scheduleData.habit_mode || "build",
      specific_days: scheduleData.specific_days || [],
      times_per_week: scheduleData.times_per_week?.toString() || "3",
    });
    setEditingHabitId(optionsHabit.id);
    handleCloseOptions();
    setModalVisible(true);
  };

  const handleResetHabit = async (habit: Habit) => {
    await updateEntryValue(habit.id, 0);
    // Close the swipeable after reset
    swipeableRefs.current[habit.id]?.close();
    currentlyOpenSwipeable.current = null;
  };

  const handleSwipeableOpen = (habitId: string) => {
    // Close the previously open swipeable if different
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

  const renderLeftActions = (habit: Habit, progress: any, dragX: any) => {
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

    // For minutes/count types, show progressive add zones
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

  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<NewHabitForm>(initialForm);
  const [errors, setErrors] = useState<{ targetValue?: string }>({});
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const newErrors: { targetValue?: string } = {};

    if (form.target_type !== "check") {
      const num = parseInt(form.target_value);
      if (!form.target_value.trim() || isNaN(num) || num < 1) {
        newErrors.targetValue = "Please enter a valid number (1 or greater)";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (!validateForm()) return;

    const targetValue = form.target_type === "check" ? 1 : parseInt(form.target_value);

    // Build schedule_json from form data
    const scheduleData: ScheduleData = {
      habit_mode: form.habit_mode,
    };

    if (form.schedule_type === "specific_days" && form.specific_days.length > 0) {
      scheduleData.specific_days = form.specific_days;
    } else if (form.schedule_type === "times_per_week") {
      scheduleData.times_per_week = parseInt(form.times_per_week) || 3;
    }

    const schedule_json = JSON.stringify(scheduleData);

    // Map form schedule_type to stored schedule_type
    const storedScheduleType = form.schedule_type === "daily" ? "daily" : "custom";

    if (editingHabitId) {
      // Update existing habit
      await updateHabit(editingHabitId, {
        name: form.name.trim(),
        description: form.description.trim(),
        target_type: form.target_type,
        target_value: targetValue,
        color: form.color,
        icon: form.icon,
        schedule_type: storedScheduleType,
        schedule_json,
      });
    } else {
      // Create new habit
      await addHabit({
        name: form.name.trim(),
        description: form.description.trim(),
        target_type: form.target_type,
        target_value: targetValue,
        color: form.color,
        icon: form.icon,
        schedule_type: storedScheduleType,
        schedule_json,
      });
    }

    setForm(initialForm);
    setErrors({});
    setEditingHabitId(null);
    setModalVisible(false);
  };

  const handleCancel = () => {
    setForm(initialForm);
    setErrors({});
    setEditingHabitId(null);
    setModalVisible(false);
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
                renderLeftActions={(progress, dragX) => renderLeftActions(habit, progress, dragX)}
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
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleCancel}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editingHabitId ? "Edit Habit" : "New Habit"}</Text>

              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(text) => setForm({ ...form, name: text })}
                placeholder="e.g., Morning Exercise"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.description}
                onChangeText={(text) => setForm({ ...form, description: text })}
                placeholder="Optional description"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={2}
              />

              <Text style={styles.label}>Habit Mode</Text>
              <View style={styles.pickerRow}>
                {(["build", "quit"] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.pickerOption,
                      form.habit_mode === mode && styles.pickerOptionSelected,
                      mode === "quit" && form.habit_mode === mode && styles.pickerOptionQuit,
                    ]}
                    onPress={() => setForm({ ...form, habit_mode: mode })}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        form.habit_mode === mode && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {mode === "build" ? "Build" : "Quit"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.modeHint}>
                {form.habit_mode === "build"
                  ? "Build: Work toward completing a goal"
                  : "Quit: Track avoidance or staying under a limit"}
              </Text>

              <Text style={styles.label}>Target Type</Text>
              <View style={styles.pickerRow}>
                {(["check", "count", "minutes", "hours"] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.pickerOptionSmall,
                      form.target_type === type && styles.pickerOptionSelected,
                    ]}
                    onPress={() => setForm({ ...form, target_type: type })}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        form.target_type === type && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {form.target_type !== "check" && (
                <>
                  <Text style={styles.label}>
                    {form.habit_mode === "quit" ? "Maximum " : "Target "}
                    {form.target_type === "minutes" ? "(minutes)" : form.target_type === "hours" ? "(hours)" : "(count)"} *
                  </Text>
                  <TextInput
                    style={[styles.input, errors.targetValue && styles.inputError]}
                    value={form.target_value}
                    onChangeText={(text) => {
                      const filtered = text.replace(/[^0-9]/g, '');
                      setForm({ ...form, target_value: filtered });
                      if (errors.targetValue) {
                        setErrors({ ...errors, targetValue: undefined });
                      }
                    }}
                    keyboardType="numeric"
                    placeholder={form.habit_mode === "quit" ? "e.g., 2 (max hours)" : "e.g., 30"}
                    placeholderTextColor="#9CA3AF"
                  />
                  {errors.targetValue && (
                    <Text style={styles.errorText}>{errors.targetValue}</Text>
                  )}
                </>
              )}

              <Text style={styles.label}>Color</Text>
              <View style={styles.colorRow}>
                {PRESET_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorButton,
                      { backgroundColor: color },
                      form.color === color && styles.colorButtonSelected,
                    ]}
                    onPress={() => setForm({ ...form, color })}
                  />
                ))}
              </View>

              <Text style={styles.label}>Icon</Text>
              <View style={styles.iconRow}>
                {SUGGESTED_ICONS.map((icon) => (
                  <TouchableOpacity
                    key={icon}
                    style={[
                      styles.iconButton,
                      form.icon === icon && styles.iconButtonSelected,
                    ]}
                    onPress={() => setForm({ ...form, icon })}
                  >
                    <Text style={styles.iconText}>{icon}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.input}
                value={form.icon}
                onChangeText={(text) => setForm({ ...form, icon: text })}
                placeholder="Or type custom emoji"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.label}>Schedule</Text>
              <View style={styles.pickerRow}>
                {(["daily", "specific_days", "times_per_week"] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.pickerOption,
                      form.schedule_type === type && styles.pickerOptionSelected,
                    ]}
                    onPress={() => setForm({ ...form, schedule_type: type })}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        form.schedule_type === type && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {type === "daily" ? "Daily" : type === "specific_days" ? "Specific Days" : "X per Week"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {form.schedule_type === "specific_days" && (
                <>
                  <Text style={styles.label}>Select Days</Text>
                  <View style={styles.daysRow}>
                    {DAY_LABELS.map((label, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.dayButton,
                          form.specific_days.includes(index) && styles.dayButtonSelected,
                        ]}
                        onPress={() => {
                          const newDays = form.specific_days.includes(index)
                            ? form.specific_days.filter(d => d !== index)
                            : [...form.specific_days, index];
                          setForm({ ...form, specific_days: newDays });
                        }}
                      >
                        <Text
                          style={[
                            styles.dayButtonText,
                            form.specific_days.includes(index) && styles.dayButtonTextSelected,
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {form.schedule_type === "times_per_week" && (
                <>
                  <Text style={styles.label}>Times per Week</Text>
                  <TextInput
                    style={styles.input}
                    value={form.times_per_week}
                    onChangeText={(text) => {
                      const filtered = text.replace(/[^0-9]/g, '');
                      setForm({ ...form, times_per_week: filtered });
                    }}
                    keyboardType="numeric"
                    placeholder="e.g., 3"
                    placeholderTextColor="#9CA3AF"
                  />
                  <Text style={styles.modeHint}>
                    Complete this habit {form.times_per_week || "X"} times each week, any days you choose
                  </Text>
                </>
              )}

              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, !form.name.trim() && styles.saveButtonDisabled]}
                  onPress={handleSave}
                  disabled={!form.name.trim()}
                >
                  <Text style={styles.saveButtonText}>{editingHabitId ? "Update" : "Save"}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "90%",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#111827",
  },
  inputError: {
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 4,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  pickerRow: {
    flexDirection: "row",
    gap: 8,
  },
  pickerOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  pickerOptionSelected: {
    backgroundColor: "#22C55E",
  },
  pickerOptionText: {
    fontSize: 14,
    color: "#374151",
  },
  pickerOptionTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  colorButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  colorButtonSelected: {
    borderWidth: 3,
    borderColor: "#111827",
  },
  iconRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  iconButtonSelected: {
    backgroundColor: "#DCFCE7",
    borderWidth: 2,
    borderColor: "#22C55E",
  },
  iconText: {
    fontSize: 20,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    marginBottom: 20,
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
  saveButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
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
  // New styles for flexible habits
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
  pickerOptionSmall: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  pickerOptionQuit: {
    backgroundColor: "#EF4444",
  },
  modeHint: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
    fontStyle: "italic",
  },
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  dayButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  dayButtonSelected: {
    backgroundColor: "#22C55E",
  },
  dayButtonText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
  },
  dayButtonTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
});

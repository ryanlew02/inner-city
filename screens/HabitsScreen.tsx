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
import ColorPickerSimple from "../components/ColorPickerSimple";
import { useHabits } from "../context/HabitsContext";
import { Habit, parseScheduleJson, ScheduleData } from "../types/habit";

const PRESET_COLORS = [
  // Row 1 - Soft pastels
  "#86EFAC", // soft green
  "#93C5FD", // soft blue
  "#FCD34D", // soft yellow
  "#FCA5A5", // soft red
  "#C4B5FD", // soft purple
  "#F9A8D4", // soft pink
  "#67E8F9", // soft cyan
  "#FDBA74", // soft orange
  // Row 2 - Medium tones
  "#4ADE80", // green
  "#60A5FA", // blue
  "#FBBF24", // amber
  "#F87171", // red
  "#A78BFA", // purple
  "#F472B6", // pink
  "#22D3EE", // cyan
  "#FB923C", // orange
  // Row 3 - Rich tones
  "#22C55E", // emerald
  "#3B82F6", // royal blue
  "#EAB308", // gold
  "#EF4444", // crimson
  "#8B5CF6", // violet
  "#EC4899", // magenta
  "#06B6D4", // teal
  "#F97316", // tangerine
];

const SUGGESTED_ICONS = ["💪", "📚", "💧", "🧘", "🏃", "🍎", "😴", "✍️"];

// Get a random color from presets
const getRandomColor = () => PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];


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

  // Render habit tile
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
  schedule_type: "daily" | "specific_days" | "times_per_week" | "days_of_month";
  habit_mode: "build" | "quit";
  specific_days: number[]; // 0-6 for days of week
  times_per_week: string;
  days_of_month: number[]; // 1-31 for days of month
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
  days_of_month: [],
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

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
    let schedule_type: "daily" | "specific_days" | "times_per_week" | "days_of_month" = "daily";
    if (scheduleData.days_of_month && scheduleData.days_of_month.length > 0) {
      schedule_type = "days_of_month";
    } else if (scheduleData.specific_days && scheduleData.specific_days.length > 0) {
      schedule_type = "specific_days";
    } else if (scheduleData.times_per_week !== undefined) {
      schedule_type = "times_per_week";
    }

    // Pre-populate form with existing habit data
    const habitColor = optionsHabit.color || "#22C55E";
    const isCustomColor = !PRESET_COLORS.includes(habitColor);

    setForm({
      name: optionsHabit.name,
      description: optionsHabit.description || "",
      target_type: optionsHabit.target_type,
      target_value: optionsHabit.target_value.toString(),
      color: habitColor,
      icon: optionsHabit.icon || "",
      schedule_type,
      habit_mode: scheduleData.habit_mode || "build",
      specific_days: scheduleData.specific_days || [],
      times_per_week: scheduleData.times_per_week?.toString() || "3",
      days_of_month: scheduleData.days_of_month || [],
    });
    setEditingHabitId(optionsHabit.id);
    setShowCustomColorPicker(isCustomColor);
    setCustomColorInput(isCustomColor ? habitColor : "");
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
  const [colorPickerModalVisible, setColorPickerModalVisible] = useState(false);
  const [showCustomColorPicker, setShowCustomColorPicker] = useState(false);
  const [customColorInput, setCustomColorInput] = useState("");
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);

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
    } else if (form.schedule_type === "days_of_month" && form.days_of_month.length > 0) {
      scheduleData.days_of_month = form.days_of_month;
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
    setShowCustomColorPicker(false);
    setCustomColorInput("");
    setModalVisible(false);
  };

  const handleCancel = () => {
    setForm(initialForm);
    setErrors({});
    setEditingHabitId(null);
    setShowCustomColorPicker(false);
    setCustomColorInput("");
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
        onPress={() => {
          // Set random color for new habit
          setForm({ ...initialForm, color: getRandomColor() });
          setModalVisible(true);
        }}
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
                      form.habit_mode === mode && { backgroundColor: form.color },
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
                      form.target_type === type && { backgroundColor: form.color },
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
              <TouchableOpacity
                style={styles.colorPreviewButton}
                onPress={() => {
                  setCustomColorInput(form.color);
                  setColorPickerModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.colorPreviewSwatch, { backgroundColor: form.color }]} />
                <View style={styles.colorPreviewInfo}>
                  <Text style={styles.colorPreviewText}>Tap to change color</Text>
                  <Text style={styles.colorPreviewHex}>{form.color}</Text>
                </View>
                <Text style={styles.colorPreviewArrow}>›</Text>
              </TouchableOpacity>

              <Text style={styles.label}>Icon</Text>
              <View style={styles.iconRow}>
                {SUGGESTED_ICONS.map((icon) => (
                  <TouchableOpacity
                    key={icon}
                    style={[
                      styles.iconButton,
                      form.icon === icon && { backgroundColor: form.color + "30", borderWidth: 2, borderColor: form.color },
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
              <TouchableOpacity
                style={styles.schedulePreviewButton}
                onPress={() => setScheduleModalVisible(true)}
                activeOpacity={0.7}
              >
                <View style={[styles.schedulePreviewIcon, { backgroundColor: form.color + "20" }]}>
                  <Text style={styles.schedulePreviewIconText}>📅</Text>
                </View>
                <View style={styles.schedulePreviewInfo}>
                  <Text style={styles.schedulePreviewTitle}>
                    {form.schedule_type === "daily" && "Every Day"}
                    {form.schedule_type === "specific_days" && (
                      form.specific_days.length > 0
                        ? form.specific_days.sort((a, b) => a - b).map(d => DAY_LABELS[d]).join(", ")
                        : "Select days of the week"
                    )}
                    {form.schedule_type === "times_per_week" && `${form.times_per_week || "X"} times per week`}
                    {form.schedule_type === "days_of_month" && (
                      form.days_of_month.length > 0
                        ? `${form.days_of_month.length} day${form.days_of_month.length > 1 ? "s" : ""} per month`
                        : "Select days of the month"
                    )}
                  </Text>
                  <Text style={styles.schedulePreviewSubtitle}>Tap to change schedule</Text>
                </View>
                <Text style={styles.schedulePreviewArrow}>›</Text>
              </TouchableOpacity>

              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    { backgroundColor: form.color },
                    !form.name.trim() && styles.saveButtonDisabled,
                  ]}
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

      {/* Color Picker Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={colorPickerModalVisible}
        onRequestClose={() => setColorPickerModalVisible(false)}
      >
        <View style={styles.colorModalOverlay}>
          <View style={styles.colorModalContent}>
            <View style={styles.colorModalHeader}>
              <Text style={styles.colorModalTitle}>Choose Color</Text>
              <TouchableOpacity
                style={[styles.colorModalClose, { backgroundColor: form.color }]}
                onPress={() => {
                  setColorPickerModalVisible(false);
                  setShowCustomColorPicker(false);
                }}
              >
                <Text style={styles.colorModalCloseText}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Current color preview */}
              <View style={[styles.colorModalPreview, { backgroundColor: form.color }]}>
                <Text style={styles.colorModalPreviewText}>{form.color}</Text>
              </View>

              {/* Preset colors */}
              <Text style={styles.colorModalSectionTitle}>Preset Colors</Text>
              <View style={styles.colorModalGrid}>
                {PRESET_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorModalButton,
                      { backgroundColor: color },
                      form.color === color && styles.colorModalButtonSelected,
                    ]}
                    onPress={() => {
                      setForm({ ...form, color });
                      setShowCustomColorPicker(false);
                      setCustomColorInput(color);
                    }}
                  />
                ))}
              </View>

              {/* Custom color toggle */}
              <TouchableOpacity
                style={styles.customColorToggle}
                onPress={() => setShowCustomColorPicker(!showCustomColorPicker)}
              >
                <Text style={styles.customColorToggleText}>
                  {showCustomColorPicker ? "Hide Custom Color Picker" : "Create Custom Color"}
                </Text>
                <Text style={styles.customColorToggleArrow}>
                  {showCustomColorPicker ? "▲" : "▼"}
                </Text>
              </TouchableOpacity>

              {/* Custom color picker */}
              {showCustomColorPicker && (
                <View style={styles.customColorSection}>
                  <ColorPickerSimple
                    value={form.color}
                    onColorChange={(color) => {
                      setForm({ ...form, color });
                      setCustomColorInput(color);
                    }}
                  />

                  {/* Hex input */}
                  <View style={styles.hexInputRow}>
                    <Text style={styles.hexLabel}>HEX:</Text>
                    <TextInput
                      style={styles.hexInput}
                      value={customColorInput}
                      onChangeText={(text) => {
                        let value = text.toUpperCase();
                        if (value && !value.startsWith("#")) {
                          value = "#" + value;
                        }
                        setCustomColorInput(value);
                        if (/^#[0-9A-F]{6}$/i.test(value)) {
                          setForm({ ...form, color: value });
                        }
                      }}
                      placeholder="#FF5500"
                      placeholderTextColor="#9CA3AF"
                      maxLength={7}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Schedule Picker Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={scheduleModalVisible}
        onRequestClose={() => setScheduleModalVisible(false)}
      >
        <View style={styles.scheduleModalOverlay}>
          <View style={styles.scheduleModalContent}>
            <View style={styles.scheduleModalHeader}>
              <Text style={styles.scheduleModalTitle}>Schedule</Text>
              <TouchableOpacity
                style={[styles.scheduleModalClose, { backgroundColor: form.color }]}
                onPress={() => setScheduleModalVisible(false)}
              >
                <Text style={styles.scheduleModalCloseText}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Schedule type options */}
              <View style={styles.scheduleOptionsList}>
                {/* Every Day */}
                <TouchableOpacity
                  style={[
                    styles.scheduleOptionItem,
                    form.schedule_type === "daily" && { backgroundColor: form.color + "15", borderColor: form.color },
                  ]}
                  onPress={() => setForm({ ...form, schedule_type: "daily" })}
                >
                  <View style={styles.scheduleOptionLeft}>
                    <Text style={styles.scheduleOptionEmoji}>📅</Text>
                    <View>
                      <Text style={styles.scheduleOptionTitle}>Every Day</Text>
                      <Text style={styles.scheduleOptionDesc}>Repeat daily without exception</Text>
                    </View>
                  </View>
                  {form.schedule_type === "daily" && (
                    <View style={[styles.scheduleOptionCheck, { backgroundColor: form.color }]}>
                      <Text style={styles.scheduleOptionCheckText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Specific Days of Week */}
                <TouchableOpacity
                  style={[
                    styles.scheduleOptionItem,
                    form.schedule_type === "specific_days" && { backgroundColor: form.color + "15", borderColor: form.color },
                  ]}
                  onPress={() => setForm({ ...form, schedule_type: "specific_days" })}
                >
                  <View style={styles.scheduleOptionLeft}>
                    <Text style={styles.scheduleOptionEmoji}>🗓️</Text>
                    <View>
                      <Text style={styles.scheduleOptionTitle}>Specific Days of Week</Text>
                      <Text style={styles.scheduleOptionDesc}>Choose which days (Mon, Wed, Fri...)</Text>
                    </View>
                  </View>
                  {form.schedule_type === "specific_days" && (
                    <View style={[styles.scheduleOptionCheck, { backgroundColor: form.color }]}>
                      <Text style={styles.scheduleOptionCheckText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Days of Week selector */}
                {form.schedule_type === "specific_days" && (
                  <View style={styles.daysSelector}>
                    {DAY_LABELS.map((label, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.daySelectorButton,
                          form.specific_days.includes(index) && { backgroundColor: form.color },
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
                            styles.daySelectorText,
                            form.specific_days.includes(index) && styles.daySelectorTextSelected,
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* X Times Per Week */}
                <TouchableOpacity
                  style={[
                    styles.scheduleOptionItem,
                    form.schedule_type === "times_per_week" && { backgroundColor: form.color + "15", borderColor: form.color },
                  ]}
                  onPress={() => setForm({ ...form, schedule_type: "times_per_week" })}
                >
                  <View style={styles.scheduleOptionLeft}>
                    <Text style={styles.scheduleOptionEmoji}>🔢</Text>
                    <View>
                      <Text style={styles.scheduleOptionTitle}>X Times Per Week</Text>
                      <Text style={styles.scheduleOptionDesc}>Flexible - complete any days you choose</Text>
                    </View>
                  </View>
                  {form.schedule_type === "times_per_week" && (
                    <View style={[styles.scheduleOptionCheck, { backgroundColor: form.color }]}>
                      <Text style={styles.scheduleOptionCheckText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Times per week input */}
                {form.schedule_type === "times_per_week" && (
                  <View style={styles.timesPerWeekContainer}>
                    <Text style={styles.timesPerWeekLabel}>How many times per week?</Text>
                    <View style={styles.timesPerWeekRow}>
                      {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                        <TouchableOpacity
                          key={num}
                          style={[
                            styles.timesPerWeekButton,
                            form.times_per_week === num.toString() && { backgroundColor: form.color },
                          ]}
                          onPress={() => setForm({ ...form, times_per_week: num.toString() })}
                        >
                          <Text
                            style={[
                              styles.timesPerWeekButtonText,
                              form.times_per_week === num.toString() && styles.timesPerWeekButtonTextSelected,
                            ]}
                          >
                            {num}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Specific Days of Month */}
                <TouchableOpacity
                  style={[
                    styles.scheduleOptionItem,
                    form.schedule_type === "days_of_month" && { backgroundColor: form.color + "15", borderColor: form.color },
                  ]}
                  onPress={() => setForm({ ...form, schedule_type: "days_of_month" })}
                >
                  <View style={styles.scheduleOptionLeft}>
                    <Text style={styles.scheduleOptionEmoji}>📆</Text>
                    <View>
                      <Text style={styles.scheduleOptionTitle}>Specific Days of Month</Text>
                      <Text style={styles.scheduleOptionDesc}>Choose dates (1st, 15th, 30th...)</Text>
                    </View>
                  </View>
                  {form.schedule_type === "days_of_month" && (
                    <View style={[styles.scheduleOptionCheck, { backgroundColor: form.color }]}>
                      <Text style={styles.scheduleOptionCheckText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Days of Month selector */}
                {form.schedule_type === "days_of_month" && (
                  <View style={styles.monthDaysContainer}>
                    <Text style={styles.monthDaysLabel}>Select days of the month:</Text>
                    <View style={styles.monthDaysGrid}>
                      {MONTH_DAYS.map((day) => (
                        <TouchableOpacity
                          key={day}
                          style={[
                            styles.monthDayButton,
                            form.days_of_month.includes(day) && { backgroundColor: form.color },
                          ]}
                          onPress={() => {
                            const newDays = form.days_of_month.includes(day)
                              ? form.days_of_month.filter(d => d !== day)
                              : [...form.days_of_month, day];
                            setForm({ ...form, days_of_month: newDays });
                          }}
                        >
                          <Text
                            style={[
                              styles.monthDayText,
                              form.days_of_month.includes(day) && styles.monthDayTextSelected,
                            ]}
                          >
                            {day}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {form.days_of_month.length > 0 && (
                      <Text style={styles.monthDaysHint}>
                        Selected: {form.days_of_month.sort((a, b) => a - b).join(", ")}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
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
  // Color preview button in form
  colorPreviewButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 12,
  },
  colorPreviewSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  colorPreviewInfo: {
    flex: 1,
    marginLeft: 12,
  },
  colorPreviewText: {
    fontSize: 14,
    color: "#374151",
  },
  colorPreviewHex: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  colorPreviewArrow: {
    fontSize: 24,
    color: "#9CA3AF",
    marginRight: 4,
  },
  // Color picker modal
  colorModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  colorModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "85%",
  },
  colorModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  colorModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },
  colorModalClose: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#22C55E",
    borderRadius: 8,
  },
  colorModalCloseText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  colorModalPreview: {
    height: 60,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  colorModalPreviewText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  colorModalSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  colorModalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  colorModalButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  colorModalButtonSelected: {
    borderWidth: 3,
    borderColor: "#111827",
  },
  customColorToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  customColorToggleText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  customColorToggleArrow: {
    fontSize: 12,
    color: "#6B7280",
  },
  customColorSection: {
    padding: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    marginBottom: 20,
  },
  hexInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
  },
  hexLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  hexInput: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: "#111827",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    borderWidth: 1,
    borderColor: "#E5E7EB",
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
  // Schedule preview button styles
  schedulePreviewButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 12,
  },
  schedulePreviewIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  schedulePreviewIconText: {
    fontSize: 20,
  },
  schedulePreviewInfo: {
    flex: 1,
    marginLeft: 12,
  },
  schedulePreviewTitle: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
  },
  schedulePreviewSubtitle: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  schedulePreviewArrow: {
    fontSize: 24,
    color: "#9CA3AF",
    marginRight: 4,
  },
  // Schedule modal styles
  scheduleModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  scheduleModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "85%",
  },
  scheduleModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  scheduleModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },
  scheduleModalClose: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scheduleModalCloseText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  scheduleOptionsList: {
    gap: 8,
  },
  scheduleOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  scheduleOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  scheduleOptionEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  scheduleOptionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  scheduleOptionDesc: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  scheduleOptionCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  scheduleOptionCheckText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  // Days of week selector in schedule modal
  daysSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
    gap: 6,
  },
  daySelectorButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
  },
  daySelectorText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "600",
  },
  daySelectorTextSelected: {
    color: "#fff",
  },
  // Times per week selector
  timesPerWeekContainer: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  timesPerWeekLabel: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 10,
  },
  timesPerWeekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  timesPerWeekButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
  },
  timesPerWeekButtonText: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "600",
  },
  timesPerWeekButtonTextSelected: {
    color: "#fff",
  },
  // Days of month selector
  monthDaysContainer: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  monthDaysLabel: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 10,
  },
  monthDaysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  monthDayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  monthDayText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  monthDayTextSelected: {
    color: "#fff",
  },
  monthDaysHint: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 12,
    fontStyle: "italic",
  },
});

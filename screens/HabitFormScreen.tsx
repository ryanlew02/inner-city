import { useState, useEffect } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useHabits } from "../context/HabitsContext";
import { parseScheduleJson, ScheduleData } from "../types/habit";
import ColorPickerSimple from "../components/ColorPickerSimple";

const PRESET_COLORS = [
  // Row 1 - Soft pastels
  "#86EFAC", "#93C5FD", "#FCD34D", "#FCA5A5",
  "#C4B5FD", "#F9A8D4", "#67E8F9", "#FDBA74",
  // Row 2 - Medium tones
  "#4ADE80", "#60A5FA", "#FBBF24", "#F87171",
  "#A78BFA", "#F472B6", "#22D3EE", "#FB923C",
  // Row 3 - Rich tones
  "#22C55E", "#3B82F6", "#EAB308", "#EF4444",
  "#8B5CF6", "#EC4899", "#06B6D4", "#F97316",
];

const SUGGESTED_ICONS = ["💪", "📚", "💧", "🧘", "🏃", "🍎", "😴", "✍️"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

const getRandomColor = () => PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];

type HabitForm = {
  name: string;
  description: string;
  target_type: "check" | "count" | "minutes" | "hours";
  target_value: string;
  color: string;
  icon: string;
  schedule_type: "daily" | "specific_days" | "times_per_week" | "days_of_month";
  habit_mode: "build" | "quit";
  specific_days: number[];
  times_per_week: string;
  days_of_month: number[];
};

const initialForm: HabitForm = {
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

export default function HabitFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ habitId?: string }>();
  const { habits, addHabit, updateHabit } = useHabits();

  const editingHabitId = params.habitId || null;
  const isEditing = !!editingHabitId;

  const [form, setForm] = useState<HabitForm>(() => {
    if (editingHabitId) {
      return initialForm; // Will be populated in useEffect
    }
    return { ...initialForm, color: getRandomColor() };
  });

  const [errors, setErrors] = useState<{ targetValue?: string }>({});
  const [colorPickerModalVisible, setColorPickerModalVisible] = useState(false);
  const [showCustomColorPicker, setShowCustomColorPicker] = useState(false);
  const [customColorInput, setCustomColorInput] = useState("");
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);

  // Load habit data when editing
  useEffect(() => {
    if (editingHabitId) {
      const habit = habits.find(h => h.id === editingHabitId);
      if (habit) {
        const scheduleData = parseScheduleJson(habit.schedule_json);

        let schedule_type: HabitForm["schedule_type"] = "daily";
        if (scheduleData.days_of_month && scheduleData.days_of_month.length > 0) {
          schedule_type = "days_of_month";
        } else if (scheduleData.specific_days && scheduleData.specific_days.length > 0) {
          schedule_type = "specific_days";
        } else if (scheduleData.times_per_week !== undefined) {
          schedule_type = "times_per_week";
        }

        setForm({
          name: habit.name,
          description: habit.description || "",
          target_type: habit.target_type,
          target_value: habit.target_value.toString(),
          color: habit.color || "#22C55E",
          icon: habit.icon || "",
          schedule_type,
          habit_mode: scheduleData.habit_mode || "build",
          specific_days: scheduleData.specific_days || [],
          times_per_week: scheduleData.times_per_week?.toString() || "3",
          days_of_month: scheduleData.days_of_month || [],
        });

        const habitColor = habit.color || "#22C55E";
        const isCustomColor = !PRESET_COLORS.includes(habitColor);
        setShowCustomColorPicker(isCustomColor);
        setCustomColorInput(isCustomColor ? habitColor : "");
      }
    }
  }, [editingHabitId, habits]);

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
    const storedScheduleType = form.schedule_type === "daily" ? "daily" : "custom";

    if (isEditing && editingHabitId) {
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

    router.back();
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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
            <Text style={styles.saveButtonText}>{isEditing ? "Update" : "Save"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Color Picker Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={colorPickerModalVisible}
        onRequestClose={() => {
          setColorPickerModalVisible(false);
          setShowCustomColorPicker(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Color</Text>
              <TouchableOpacity
                style={[styles.modalClose, { backgroundColor: form.color }]}
                onPress={() => {
                  setColorPickerModalVisible(false);
                  setShowCustomColorPicker(false);
                }}
              >
                <Text style={styles.modalCloseText}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.colorModalPreview, { backgroundColor: form.color }]}>
                <Text style={styles.colorModalPreviewText}>{form.color}</Text>
              </View>

              <Text style={styles.sectionTitle}>Preset Colors</Text>
              <View style={styles.colorGrid}>
                {PRESET_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorGridButton,
                      { backgroundColor: color },
                      form.color === color && styles.colorGridButtonSelected,
                    ]}
                    onPress={() => {
                      setForm({ ...form, color });
                      setShowCustomColorPicker(false);
                      setCustomColorInput(color);
                    }}
                  />
                ))}
              </View>

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

              {showCustomColorPicker && (
                <View style={styles.customColorSection}>
                  <ColorPickerSimple
                    value={form.color}
                    onColorChange={(color) => {
                      setForm({ ...form, color });
                      setCustomColorInput(color);
                    }}
                  />
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule</Text>
              <TouchableOpacity
                style={[styles.modalClose, { backgroundColor: form.color }]}
                onPress={() => setScheduleModalVisible(false)}
              >
                <Text style={styles.modalCloseText}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F4F7",
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: "#111827",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  inputError: {
    borderColor: "#EF4444",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 4,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  pickerRow: {
    flexDirection: "row",
    gap: 10,
  },
  pickerOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  pickerOptionSmall: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  pickerOptionText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  pickerOptionTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
  modeHint: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 6,
    fontStyle: "italic",
  },
  colorPreviewButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  colorPreviewSwatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  colorPreviewInfo: {
    flex: 1,
    marginLeft: 14,
  },
  colorPreviewText: {
    fontSize: 15,
    color: "#374151",
    fontWeight: "500",
  },
  colorPreviewHex: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 2,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  colorPreviewArrow: {
    fontSize: 24,
    color: "#9CA3AF",
  },
  iconRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  iconText: {
    fontSize: 22,
  },
  schedulePreviewButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  schedulePreviewIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  schedulePreviewIconText: {
    fontSize: 22,
  },
  schedulePreviewInfo: {
    flex: 1,
    marginLeft: 14,
  },
  schedulePreviewTitle: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "500",
  },
  schedulePreviewSubtitle: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 2,
  },
  schedulePreviewArrow: {
    fontSize: 24,
    color: "#9CA3AF",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 30,
    marginBottom: 40,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  saveButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },
  modalClose: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalCloseText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
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
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  colorGridButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  colorGridButtonSelected: {
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
  // Schedule modal styles
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

import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Gesture, GestureDetector, GestureHandlerRootView, Swipeable } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useHabits } from "../context/HabitsContext";
import { Habit, parseScheduleJson } from "../types/habit";

const MIN_SWIPE_CHECK_PX = 60;
const FULL_SWIPE_PX = 240;
const FLICK_VELOCITY_THRESHOLD = 450;
const FLICK_MIN_RATIO = 0.25;

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type CalendarModalProps = {
  visible: boolean;
  onClose: () => void;
  selectedDate: string;
  todayDate: string;
  onSelectDate: (date: string) => void;
};

function CalendarModal({ visible, onClose, selectedDate, todayDate, onSelectDate }: CalendarModalProps) {
  const [viewingMonth, setViewingMonth] = useState(() => {
    const date = new Date(selectedDate + 'T00:00:00');
    return { year: date.getFullYear(), month: date.getMonth() };
  });
  const [pickerMode, setPickerMode] = useState<'day' | 'month'>('day');

  // Reset to day mode when modal opens
  useEffect(() => {
    if (visible) {
      setPickerMode('day');
      // Also sync viewingMonth to the selected date when opening
      const date = new Date(selectedDate + 'T00:00:00');
      setViewingMonth({ year: date.getFullYear(), month: date.getMonth() });
    }
  }, [visible, selectedDate]);

  const today = new Date(todayDate + 'T00:00:00');
  const selected = new Date(selectedDate + 'T00:00:00');

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  // Day mode navigation
  const goToPreviousMonth = () => {
    setViewingMonth(prev => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const goToNextMonth = () => {
    const nextMonth = viewingMonth.month === 11
      ? { year: viewingMonth.year + 1, month: 0 }
      : { year: viewingMonth.year, month: viewingMonth.month + 1 };

    if (nextMonth.year > today.getFullYear() ||
        (nextMonth.year === today.getFullYear() && nextMonth.month > today.getMonth())) {
      return;
    }
    setViewingMonth(nextMonth);
  };

  const canGoNextMonth = () => {
    const nextMonth = viewingMonth.month === 11
      ? { year: viewingMonth.year + 1, month: 0 }
      : { year: viewingMonth.year, month: viewingMonth.month + 1 };
    return !(nextMonth.year > today.getFullYear() ||
        (nextMonth.year === today.getFullYear() && nextMonth.month > today.getMonth()));
  };

  // Year mode navigation
  const goToPreviousYear = () => {
    setViewingMonth(prev => ({ ...prev, year: prev.year - 1 }));
  };

  const goToNextYear = () => {
    if (viewingMonth.year < today.getFullYear()) {
      setViewingMonth(prev => ({ ...prev, year: prev.year + 1 }));
    }
  };

  const canGoNextYear = () => {
    return viewingMonth.year < today.getFullYear();
  };

  const handleMonthSelect = (monthIndex: number) => {
    // Check if this month is in the future
    if (viewingMonth.year === today.getFullYear() && monthIndex > today.getMonth()) {
      return;
    }
    setViewingMonth(prev => ({ ...prev, month: monthIndex }));
    setPickerMode('day');
  };

  const isMonthDisabled = (monthIndex: number) => {
    return viewingMonth.year === today.getFullYear() && monthIndex > today.getMonth();
  };

  const isMonthCurrent = (monthIndex: number) => {
    return viewingMonth.year === today.getFullYear() && monthIndex === today.getMonth();
  };

  const handleDayPress = (day: number) => {
    const dateStr = `${viewingMonth.year}-${String(viewingMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dateObj = new Date(dateStr + 'T00:00:00');
    if (dateObj <= today) {
      onSelectDate(dateStr);
      onClose();
    }
  };

  const handleTodayPress = () => {
    onSelectDate(todayDate);
    onClose();
  };

  const daysInMonth = getDaysInMonth(viewingMonth.year, viewingMonth.month);
  const firstDay = getFirstDayOfMonth(viewingMonth.year, viewingMonth.month);

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    const week = calendarDays.slice(i, i + 7);
    while (week.length < 7) {
      week.push(null);
    }
    weeks.push(week);
  }

  // Month grid for month picker (3 columns x 4 rows)
  const monthRows: number[][] = [];
  for (let i = 0; i < 12; i += 3) {
    monthRows.push([i, i + 1, i + 2]);
  }

  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={calendarStyles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={calendarStyles.container}>
            {/* Navigation Header */}
            <View style={calendarStyles.monthNav}>
              <TouchableOpacity
                onPress={pickerMode === 'day' ? goToPreviousMonth : goToPreviousYear}
                style={calendarStyles.monthNavButton}
              >
                <Text style={calendarStyles.monthNavArrow}>‹</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setPickerMode(pickerMode === 'day' ? 'month' : 'day')}>
                <Text style={calendarStyles.monthTitle}>
                  {pickerMode === 'day'
                    ? `${MONTHS[viewingMonth.month]} ${viewingMonth.year}`
                    : viewingMonth.year}
                </Text>
                <Text style={calendarStyles.monthTitleHint}>
                  {pickerMode === 'day' ? 'Tap to pick month' : 'Tap to pick day'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={pickerMode === 'day' ? goToNextMonth : goToNextYear}
                style={[
                  calendarStyles.monthNavButton,
                  (pickerMode === 'day' ? !canGoNextMonth() : !canGoNextYear()) && calendarStyles.monthNavButtonDisabled
                ]}
                disabled={pickerMode === 'day' ? !canGoNextMonth() : !canGoNextYear()}
              >
                <Text style={[
                  calendarStyles.monthNavArrow,
                  (pickerMode === 'day' ? !canGoNextMonth() : !canGoNextYear()) && calendarStyles.monthNavArrowDisabled
                ]}>›</Text>
              </TouchableOpacity>
            </View>

            {pickerMode === 'day' ? (
              <>
                {/* Day Headers */}
                <View style={calendarStyles.weekRow}>
                  {DAYS_OF_WEEK.map(day => (
                    <View key={day} style={calendarStyles.dayCell}>
                      <Text style={calendarStyles.dayHeader}>{day}</Text>
                    </View>
                  ))}
                </View>

                {/* Calendar Grid */}
                {weeks.map((week, weekIndex) => (
                  <View key={weekIndex} style={calendarStyles.weekRow}>
                    {week.map((day, dayIndex) => {
                      if (day === null) {
                        return <View key={dayIndex} style={calendarStyles.dayCell} />;
                      }

                      const dateStr = `${viewingMonth.year}-${String(viewingMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const dateObj = new Date(dateStr + 'T00:00:00');
                      const isToday = dateStr === todayDate;
                      const isSelected = dateStr === selectedDate;
                      const isFuture = dateObj > today;

                      return (
                        <TouchableOpacity
                          key={dayIndex}
                          style={calendarStyles.dayCell}
                          onPress={() => handleDayPress(day)}
                          disabled={isFuture}
                        >
                          <View style={[
                            calendarStyles.dayNumber,
                            isToday && calendarStyles.todayCircle,
                            isSelected && !isToday && calendarStyles.selectedCircle,
                          ]}>
                            <Text style={[
                              calendarStyles.dayText,
                              isToday && calendarStyles.todayText,
                              isSelected && !isToday && calendarStyles.selectedText,
                              isFuture && calendarStyles.futureText,
                            ]}>
                              {day}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </>
            ) : (
              /* Month Picker Grid */
              <View style={calendarStyles.monthGrid}>
                {monthRows.map((row, rowIndex) => (
                  <View key={rowIndex} style={calendarStyles.monthRow}>
                    {row.map(monthIndex => {
                      const disabled = isMonthDisabled(monthIndex);
                      const isCurrent = isMonthCurrent(monthIndex);
                      const isSelectedMonth = viewingMonth.month === monthIndex;

                      return (
                        <TouchableOpacity
                          key={monthIndex}
                          style={[
                            calendarStyles.monthCell,
                            isCurrent && calendarStyles.currentMonthCell,
                            isSelectedMonth && !isCurrent && calendarStyles.selectedMonthCell,
                          ]}
                          onPress={() => handleMonthSelect(monthIndex)}
                          disabled={disabled}
                        >
                          <Text style={[
                            calendarStyles.monthCellText,
                            isCurrent && calendarStyles.currentMonthText,
                            isSelectedMonth && !isCurrent && calendarStyles.selectedMonthText,
                            disabled && calendarStyles.disabledMonthText,
                          ]}>
                            {MONTH_SHORT[monthIndex]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}

            {/* Today Button */}
            <TouchableOpacity style={calendarStyles.todayButton} onPress={handleTodayPress}>
              <Text style={calendarStyles.todayButtonText}>Go to Today</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const calendarStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    width: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthNavButtonDisabled: {
    backgroundColor: '#F9FAFB',
  },
  monthNavArrow: {
    fontSize: 24,
    color: '#374151',
    fontWeight: '300',
  },
  monthNavArrowDisabled: {
    color: '#D1D5DB',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'center',
  },
  monthTitleHint: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },
  monthGrid: {
    paddingVertical: 8,
  },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  monthCell: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  currentMonthCell: {
    backgroundColor: '#22C55E',
  },
  selectedMonthCell: {
    backgroundColor: '#E0F2FE',
    borderWidth: 2,
    borderColor: '#0EA5E9',
  },
  monthCellText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  currentMonthText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  selectedMonthText: {
    color: '#0369A1',
    fontWeight: '600',
  },
  disabledMonthText: {
    color: '#D1D5DB',
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  dayHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  dayNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 15,
    color: '#374151',
  },
  todayCircle: {
    backgroundColor: '#22C55E',
  },
  todayText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  selectedCircle: {
    backgroundColor: '#E0F2FE',
    borderWidth: 2,
    borderColor: '#0EA5E9',
  },
  selectedText: {
    color: '#0369A1',
    fontWeight: '600',
  },
  futureText: {
    color: '#D1D5DB',
  },
  todayButton: {
    marginTop: 16,
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  todayButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

type RightSwipeGestureWrapperProps = {
  habit: Habit;
  onSwipeMoveRef: React.MutableRefObject<(habitId: string, tx: number) => void>;
  onSwipeEndRef: React.MutableRefObject<(habitId: string, tx: number, velocityX: number) => void>;
  children: React.ReactNode;
};

function RightSwipeGestureWrapper({ habit, onSwipeMoveRef, onSwipeEndRef, children }: RightSwipeGestureWrapperProps) {
  const habitId = habit.id;
  const habitIdRef = useRef(habitId);
  habitIdRef.current = habitId;
  const panGesture = useMemo(() => {
    const reportMove = (tx: number) => onSwipeMoveRef.current(habitIdRef.current, tx);
    const reportEnd = (tx: number, vx: number) => onSwipeEndRef.current(habitIdRef.current, tx, vx);
    return Gesture.Pan()
      .activeOffsetX([15, Infinity])
      .onUpdate((e) => {
        "worklet";
        runOnJS(reportMove)(e.translationX);
      })
      .onEnd((e) => {
        "worklet";
        runOnJS(reportEnd)(e.translationX, e.velocityX);
      })
      .onFinalize(() => {
        "worklet";
        runOnJS(reportEnd)(0, 0);
      });
  }, [habitId, onSwipeMoveRef, onSwipeEndRef]);

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.swipeRowWrapper}>{children}</View>
    </GestureDetector>
  );
}

type HabitTileProps = {
  habit: Habit;
  completed: boolean;
  currentValue: number;
  isScheduledToday: boolean;
  onTap: () => void;
  onLongPress: () => void;
  swipeIncrement?: number;
  swipePreviewValue?: number | null;
};

function HabitTile({ habit, completed, currentValue, isScheduledToday, onTap, onLongPress, swipeIncrement = 0, swipePreviewValue = null }: HabitTileProps) {
  const isProgressType = habit.target_type !== "check";
  const scheduleData = parseScheduleJson(habit.schedule_json);
  const isQuitHabit = scheduleData.habit_mode === 'quit';

  const displayValue = swipePreviewValue != null ? swipePreviewValue : currentValue;
  const progressPercent = isProgressType
    ? Math.min((displayValue / habit.target_value) * 100, 100)
    : (completed ? 100 : 0);
  const basePercent = isProgressType && swipePreviewValue != null
    ? Math.min((currentValue / habit.target_value) * 100, 100)
    : progressPercent;
  const isSwiping = swipePreviewValue != null && swipePreviewValue > currentValue;

  const getUnitLabel = () => {
    if (habit.target_type === "minutes") return "min";
    if (habit.target_type === "hours") return "hr";
    if (habit.target_type === "count") return "";
    return "";
  };

  const progressLabel = habit.target_type === "check"
    ? (swipeIncrement > 0 ? "Done" : null)
    : swipeIncrement > 0
      ? `+${swipeIncrement} ${getUnitLabel()}`.trim()
      : null;

  const color = habit.color || "#22C55E";

  return (
    <TouchableOpacity
      style={[
        styles.habitItem,
        { borderLeftColor: color },
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
            backgroundColor: `${color}30`,
            width: `${progressPercent}%`,
          },
        ]}
      />
      {isSwiping && (
        <View
          style={[
            styles.progressFill,
            styles.progressFillSwipe,
            {
              left: `${basePercent}%`,
              width: `${progressPercent - basePercent}%`,
              backgroundColor: `${color}99`,
            },
          ]}
        />
      )}

      {completed && (
        <View style={[styles.completedFill, { backgroundColor: `${color}40` }]} />
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
      {progressLabel !== null && (
        <View style={[styles.swipeFeedback, { backgroundColor: habit.color ? `${habit.color}99` : "#22C55E99" }]}>
          <Text style={styles.swipeFeedbackText}>{progressLabel}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

export default function HabitsScreen() {
  const router = useRouter();
  const {
    habits,
    toggleHabit,
    completedCount,
    isHabitCompleted,
    isHabitScheduledForToday,
    isHabitScheduledForDate,
    archiveHabit,
    updateEntryValue,
    getEntryValue,
    loading,
    viewingDate,
    setViewingDate,
    isViewingToday,
    currentDate,
  } = useHabits();

  // Progress input modal state
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [progressValue, setProgressValue] = useState("");

  // Options modal state
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [optionsHabit, setOptionsHabit] = useState<Habit | null>(null);

  // Calendar modal state
  const [calendarVisible, setCalendarVisible] = useState(false);

  // Swipeable refs (right side = Reset only)
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});
  const currentlyOpenSwipeable = useRef<string | null>(null);

  // Right-swipe progress: distance → increment, shown live and applied on release
  const [swipeProgress, setSwipeProgress] = useState<{ habitId: string; translationX: number } | null>(null);

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

  const getSwipeProgress = (habit: Habit, translationX: number) => {
    if (habit.target_type === "check") {
      const done = translationX >= MIN_SWIPE_CHECK_PX;
      return { ratio: done ? 1 : 0, increment: done ? 1 : 0, previewValue: done ? habit.target_value : getEntryValue(habit.id) };
    }
    const current = getEntryValue(habit.id);
    const remaining = Math.max(0, habit.target_value - current);
    const ratio = Math.min(1, Math.max(0, translationX / FULL_SWIPE_PX));
    const previewValue = current + ratio * remaining;
    const increment = Math.round(ratio * remaining);
    return { ratio, increment, previewValue: Math.min(habit.target_value, previewValue) };
  };

  const computeSwipeIncrement = (habit: Habit, translationX: number): number => {
    return getSwipeProgress(habit, translationX).increment;
  };

  const applySwipeProgress = (habitId: string, translationX: number, velocityX: number) => {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;
    setSwipeProgress(null);
    if (habit.target_type === "check") {
      if (translationX >= MIN_SWIPE_CHECK_PX) toggleHabit(habitId);
      return;
    }
    const current = getEntryValue(habitId);
    const remaining = Math.max(0, habit.target_value - current);
    const { ratio, increment: baseIncrement } = getSwipeProgress(habit, translationX);
    const isFlick = velocityX >= FLICK_VELOCITY_THRESHOLD && ratio >= FLICK_MIN_RATIO;
    const increment = isFlick ? remaining : baseIncrement;
    if (increment > 0) {
      updateEntryValue(habitId, current + increment);
    }
  };

  const setSwipeProgressRef = useRef((habitId: string, tx: number) => setSwipeProgress({ habitId, translationX: tx }));
  setSwipeProgressRef.current = (habitId: string, tx: number) => setSwipeProgress({ habitId, translationX: tx });
  const applySwipeProgressRef = useRef(applySwipeProgress);
  applySwipeProgressRef.current = applySwipeProgress;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#22C55E" />
        <Text style={styles.loadingText}>Loading habits...</Text>
      </View>
    );
  }

  const goToPreviousDay = () => {
    setViewingDate(addDays(viewingDate, -1));
  };

  const goToNextDay = () => {
    const nextDay = addDays(viewingDate, 1);
    // Don't allow going to future dates
    if (nextDay <= currentDate) {
      setViewingDate(nextDay);
    }
  };

  const isScheduledForViewingDate = (habitId: string): boolean => {
    if (isViewingToday) {
      return isHabitScheduledForToday(habitId);
    }
    return isHabitScheduledForDate(habitId, viewingDate);
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Daily Habits</Text>
        <Text style={styles.subtitle}>
          {completedCount} of {habits.length} completed
        </Text>
      </View>

      {/* Date Navigator */}
      <View style={styles.dateNavigator}>
        <TouchableOpacity onPress={goToPreviousDay} style={styles.dateNavButton}>
          <Text style={styles.dateNavArrow}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setCalendarVisible(true)} style={styles.dateDisplay}>
          <Text style={styles.dateText}>
            {isViewingToday ? 'Today' : formatDateHeader(viewingDate)}
          </Text>
          <Text style={styles.tapToOpenCalendar}>Tap to pick date</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={goToNextDay}
          style={[styles.dateNavButton, isViewingToday && styles.dateNavButtonDisabled]}
          disabled={isViewingToday}
        >
          <Text style={[styles.dateNavArrow, isViewingToday && styles.dateNavArrowDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Calendar Modal */}
      <CalendarModal
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        selectedDate={viewingDate}
        todayDate={currentDate}
        onSelectDate={setViewingDate}
      />

      {!isViewingToday && (
        <View style={styles.pastDateBanner}>
          <Text style={styles.pastDateText}>Viewing {formatDateHeader(viewingDate)} (read-only)</Text>
        </View>
      )}

      <ScrollView style={styles.habitsList} contentContainerStyle={styles.habitsContent}>
        {habits.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No habits yet</Text>
            <Text style={styles.emptySubtext}>Tap the + button to create your first habit</Text>
          </View>
        ) : (
          habits.map((habit) => {
            const completed = isHabitCompleted(habit.id);
            const isScheduledForDay = isScheduledForViewingDate(habit.id);
            const isSwipingThis = swipeProgress?.habitId === habit.id && isViewingToday;
            const tx = isSwipingThis ? swipeProgress.translationX : 0;
            const { increment: swipeIncrement, previewValue: swipePreviewValue } = isSwipingThis
              ? getSwipeProgress(habit, tx)
              : { increment: 0, previewValue: null };

            // When viewing past dates, render without swipe gestures
            if (!isViewingToday) {
              return (
                <View key={habit.id}>
                  <HabitTile
                    habit={habit}
                    completed={completed}
                    currentValue={getEntryValue(habit.id)}
                    isScheduledToday={isScheduledForDay}
                    onTap={() => {}}
                    onLongPress={() => {}}
                    swipeIncrement={0}
                    swipePreviewValue={null}
                  />
                </View>
              );
            }

            return (
              <RightSwipeGestureWrapper
                key={habit.id}
                habit={habit}
                onSwipeMoveRef={setSwipeProgressRef}
                onSwipeEndRef={applySwipeProgressRef}
              >
                <Swipeable
                  ref={(ref) => { swipeableRefs.current[habit.id] = ref; }}
                  renderRightActions={() => renderRightActions(habit)}
                  onSwipeableWillOpen={() => handleSwipeableOpen(habit.id)}
                  friction={2}
                >
                  <HabitTile
                    habit={habit}
                    completed={completed}
                    currentValue={getEntryValue(habit.id)}
                    isScheduledToday={isScheduledForDay}
                    onTap={() => handleHabitPress(habit)}
                    onLongPress={() => handleOpenOptions(habit)}
                    swipeIncrement={swipeIncrement}
                    swipePreviewValue={isSwipingThis ? swipePreviewValue : null}
                  />
                </Swipeable>
              </RightSwipeGestureWrapper>
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
    backgroundColor: "#F1F5F9",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#64748B",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 4,
  },
  dateNavigator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dateNavButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  dateNavButtonDisabled: {
    backgroundColor: "#F9FAFB",
  },
  dateNavArrow: {
    fontSize: 28,
    color: "#374151",
    fontWeight: "300",
    marginTop: -2,
  },
  dateNavArrowDisabled: {
    color: "#D1D5DB",
  },
  dateDisplay: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  dateText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0F172A",
  },
  tapToOpenCalendar: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  pastDateBanner: {
    backgroundColor: "#FEF3C7",
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  pastDateText: {
    fontSize: 13,
    color: "#92400E",
    fontWeight: "500",
  },
  habitsList: {
    flex: 1,
  },
  habitsContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#64748B",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 8,
  },
  habitItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    overflow: "hidden",
    position: "relative",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  progressFillSwipe: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    zIndex: 1,
  },
  completedFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    borderRadius: 14,
  },
  resetAction: {
    backgroundColor: "#F59E0B",
    justifyContent: "center",
    alignItems: "center",
    width: 72,
    borderRadius: 14,
    marginBottom: 12,
    marginLeft: 6,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  resetActionText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 13,
  },
  swipeRowWrapper: {
    flex: 1,
    minHeight: 0,
  },
  swipeFeedback: {
    position: "absolute",
    right: 18,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  swipeFeedbackText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
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
    fontSize: 15,
    fontWeight: "bold",
  },
  habitInfo: {
    flex: 1,
    minWidth: 0,
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
    color: "#0F172A",
    flex: 1,
    fontWeight: "500",
  },
  habitTextCompleted: {
    color: "#94A3B8",
    textDecorationLine: "line-through",
  },
  habitDescription: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 2,
  },
  habitProgress: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  completedBanner: {
    backgroundColor: "#22C55E",
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginBottom: 80,
    borderRadius: 14,
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
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#22C55E",
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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

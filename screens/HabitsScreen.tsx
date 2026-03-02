import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { ThemeColors } from "../constants/Colors";
import { useHabits } from "../context/HabitsContext";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { getEntriesForDateRange } from "../services/database/entryService";
import { getDatabase } from "../services/database/db";
import { Habit, parseScheduleJson } from "../types/habit";

function getISOMonday(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MIN_SWIPE_CHECK_PX = 20;
const FULL_SWIPE_PX = 200;
const FLICK_VELOCITY_THRESHOLD = 300;
const FLICK_MIN_RATIO = 0.15;

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type CalendarModalProps = {
  visible: boolean;
  onClose: () => void;
  selectedDate: string;
  todayDate: string;
  onSelectDate: (date: string) => void;
  colors: ThemeColors;
};

function CalendarModal({ visible, onClose, selectedDate, todayDate, onSelectDate, colors }: CalendarModalProps) {
  const { t: tCal } = useLanguage();
  const calendarStyles = createCalendarStyles(colors);
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
                  {pickerMode === 'day' ? tCal('habits.tapToPickMonth') : tCal('habits.tapToPickDay')}
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
              <Text style={calendarStyles.todayButtonText}>{tCal('habits.goToToday')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

type RightSwipeGestureWrapperProps = {
  habit: Habit;
  onSwipeMoveRef: React.MutableRefObject<(habitId: string, tx: number) => void>;
  onSwipeEndRef: React.MutableRefObject<(habitId: string, tx: number, velocityX: number) => void>;
  onTap: () => void;
  onLongPress: () => void;
  children: React.ReactNode;
};

function RightSwipeGestureWrapper({ habit, onSwipeMoveRef, onSwipeEndRef, onTap, onLongPress, children }: RightSwipeGestureWrapperProps) {
  const habitId = habit.id;
  const habitIdRef = useRef(habitId);
  habitIdRef.current = habitId;
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;
  const onLongPressRef = useRef(onLongPress);
  onLongPressRef.current = onLongPress;

  const gesture = useMemo(() => {
    const reportMove = (tx: number) => onSwipeMoveRef.current(habitIdRef.current, tx);
    const reportEnd = (tx: number, vx: number) => onSwipeEndRef.current(habitIdRef.current, tx, vx);
    const handleTap = () => onTapRef.current();
    const handleLongPress = () => onLongPressRef.current();

    const pan = Gesture.Pan()
      .activeOffsetX([-Infinity, 5])
      .failOffsetY([-15, 15])
      .onUpdate((e) => {
        "worklet";
        if (e.translationX > 0) {
          runOnJS(reportMove)(e.translationX);
        }
      })
      .onEnd((e) => {
        "worklet";
        runOnJS(reportEnd)(e.translationX, e.velocityX);
      })
      .onFinalize(() => {
        "worklet";
        runOnJS(reportEnd)(0, 0);
      });

    const tap = Gesture.Tap()
      .maxDistance(10)
      .onEnd(() => {
        "worklet";
        runOnJS(handleTap)();
      });

    const longPress = Gesture.LongPress()
      .minDuration(500)
      .onStart(() => {
        "worklet";
        runOnJS(handleLongPress)();
      });

    return Gesture.Race(pan, longPress, tap);
  }, [habitId, onSwipeMoveRef, onSwipeEndRef]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width: '100%' }}>{children}</View>
    </GestureDetector>
  );
}

type HabitTileProps = {
  habit: Habit;
  completed: boolean;
  currentValue: number;
  isScheduledToday: boolean;
  isBeforeCreation?: boolean;
  onTap: () => void;
  onLongPress: () => void;
  swipeIncrement?: number;
  swipePreviewValue?: number | null;
  weeklyCount?: number;
  colors: ThemeColors;
};

function HabitTile({ habit, completed, currentValue, isScheduledToday, isBeforeCreation = false, onTap, onLongPress, swipeIncrement = 0, swipePreviewValue = null, weeklyCount, colors }: HabitTileProps) {
  const { t: tHabit } = useLanguage();
  const styles = createStyles(colors);
  const isProgressType = habit.target_type !== "check";
  const scheduleData = parseScheduleJson(habit.schedule_json);
  const isQuitHabit = scheduleData.habit_mode === 'quit';
  const isQuitFailed = isQuitHabit && (
    (isProgressType && currentValue > habit.target_value) ||
    (!isProgressType && !completed)
  );

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

  const color = habit.color || colors.success;

  return (
    <View
      style={[
        styles.habitItem,
        { borderLeftColor: isQuitFailed ? colors.textTertiary : color },
        (!isScheduledToday || isBeforeCreation) && styles.habitItemDimmed,
        isQuitFailed && styles.habitItemFailed,
      ]}
    >
      {!completed && (
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: isQuitFailed ? `${colors.textTertiary}30` : `${color}30`,
              width: `${progressPercent}%`,
            },
          ]}
        />
      )}
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
          { borderColor: isQuitFailed ? colors.textTertiary : (habit.color || colors.success) },
          isQuitFailed
            ? { backgroundColor: colors.textTertiary }
            : completed && { backgroundColor: habit.color || colors.success },
        ]}
      >
        {isQuitFailed
          ? <Text style={styles.checkmark}>✗</Text>
          : completed && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.habitInfo}>
        <View style={styles.habitHeader}>
          {habit.icon ? <Text style={styles.habitIcon}>{habit.icon}</Text> : null}
          <Text
            style={[
              styles.habitText,
              isQuitFailed && styles.habitTextFailed,
              completed && !isQuitFailed && styles.habitTextCompleted,
              (!isScheduledToday || isBeforeCreation) && styles.habitTextDimmed,
            ]}
          >
            {habit.name}
          </Text>
          {isQuitHabit && <View style={styles.quitBadge}><Text style={styles.quitBadgeText}>{tHabit('habits.quit')}</Text></View>}
        </View>
        {isBeforeCreation ? (
          <Text style={styles.notScheduledText}>{tHabit('habits.notCreatedYet')}</Text>
        ) : !isScheduledToday ? (
          <Text style={styles.notScheduledText}>{tHabit('habits.notScheduled')}</Text>
        ) : habit.target_type === "check" && habit.description ? (
          <Text style={styles.habitDescription} numberOfLines={1}>
            {habit.description}
          </Text>
        ) : null}
      </View>
      {scheduleData.times_per_week ? (
        <View style={styles.weeklyDots}>
          {Array.from({ length: scheduleData.times_per_week }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.weeklyDot,
                i < (weeklyCount ?? 0)
                  ? { backgroundColor: color }
                  : { backgroundColor: 'transparent', borderColor: color },
              ]}
            />
          ))}
        </View>
      ) : (
        isScheduledToday && habit.target_type !== "check" && (
          <Text style={[styles.habitProgress, isQuitFailed && styles.habitProgressFailed]}>
            {currentValue} / {habit.target_value} {getUnitLabel()}
            {isQuitFailed ? ` (${tHabit('habits.limitExceeded')})` : isQuitHabit ? ` (${tHabit('habits.limit')})` : ''}
          </Text>
        )
      )}
      {progressLabel !== null && (
        <View style={[styles.swipeFeedback, { backgroundColor: habit.color ? `${habit.color}99` : `${colors.success}99` }]}>
          <Text style={styles.swipeFeedbackText}>{progressLabel}</Text>
        </View>
      )}
    </View>
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
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(colors);
  const {
    habits,
    toggleHabit,
    completedCount,
    scheduledCount,
    isHabitCompleted,
    isHabitScheduledForToday,
    isHabitScheduledForDate,
    archiveHabit,
    reorderHabits,
    updateEntryValue,
    getEntryValue,
    entries,
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

  // Info tooltip state
  const [infoVisible, setInfoVisible] = useState(false);

  // Edit mode state
  const [editMode, setEditMode] = useState(false);

  // Calendar modal state
  const [calendarVisible, setCalendarVisible] = useState(false);

  // Celebration modal state
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [dontShowCelebration, setDontShowCelebration] = useState(false);
  const celebrationShownForDate = useRef<string>('');
  const celebrationHiddenPermanently = useRef(false);
  const celebrationSettingsLoaded = useRef(false);
  const celebrationScale = useRef(new Animated.Value(0.7)).current;
  const celebrationOpacity = useRef(new Animated.Value(0)).current;
  const [celebrationSettingsReady, setCelebrationSettingsReady] = useState(false);

  useEffect(() => {
    getDatabase().then(async db => {
      const [hideRow, shownRow] = await Promise.all([
        db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', ['hide_celebration']),
        db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', ['celebration_shown_date']),
      ]);
      if (hideRow?.value === '1') celebrationHiddenPermanently.current = true;
      if (shownRow?.value) celebrationShownForDate.current = shownRow.value;
      celebrationSettingsLoaded.current = true;
      setCelebrationSettingsReady(true);
    }).catch(() => {
      celebrationSettingsLoaded.current = true;
      setCelebrationSettingsReady(true);
    });
  }, []);

  useEffect(() => {
    if (!celebrationSettingsReady) return;
    if (isViewingToday && scheduledCount > 0 && completedCount === scheduledCount && celebrationShownForDate.current !== currentDate && !celebrationHiddenPermanently.current) {
      celebrationShownForDate.current = currentDate;
      getDatabase().then(db =>
        db.runAsync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['celebration_shown_date', currentDate])
      ).catch(() => {});
      setCelebrationVisible(true);
    }
  }, [completedCount, scheduledCount, isViewingToday, currentDate, celebrationSettingsReady]);

  useEffect(() => {
    if (celebrationVisible) {
      setDontShowCelebration(false);
      celebrationScale.setValue(0.7);
      celebrationOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(celebrationScale, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
        Animated.timing(celebrationOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [celebrationVisible]);

  // Weekly completions for times_per_week habits
  const [weeklyCompletions, setWeeklyCompletions] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const tpwHabits = habits.filter(h => {
      const s = parseScheduleJson(h.schedule_json);
      return (s.times_per_week ?? 0) > 0;
    });
    if (tpwHabits.length === 0) { setWeeklyCompletions(new Map()); return; }

    const monday = getISOMonday(viewingDate);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    getEntriesForDateRange(fmtDate(monday), fmtDate(sunday)).then(allEntries => {
      const counts = new Map<string, number>();
      tpwHabits.forEach(h => {
        const entryMap = new Map(allEntries.filter(e => e.habit_id === h.id).map(e => [e.date, e]));
        let count = 0;
        for (let i = 0; i < 7; i++) {
          const day = new Date(monday);
          day.setDate(monday.getDate() + i);
          const entry = entryMap.get(fmtDate(day));
          if (!entry) continue;
          if (h.target_type === 'check' ? entry.value >= 1 : entry.value >= h.target_value) count++;
        }
        counts.set(h.id, count);
      });
      setWeeklyCompletions(counts);
    });
  }, [viewingDate, habits, entries]);

  // Right-swipe progress: distance → increment, shown live and applied on release
  const [swipeProgress, setSwipeProgress] = useState<{ habitId: string; translationX: number } | null>(null);

  const isHabitBeforeCreation = (habit: Habit): boolean => {
    if (isViewingToday) return false;
    const viewingDateObj = new Date(viewingDate + 'T00:00:00');
    const createdDate = new Date(habit.created_at);
    createdDate.setHours(0, 0, 0, 0);
    return viewingDateObj < createdDate;
  };

  const handleHabitPress = (habit: Habit) => {
    if (isHabitBeforeCreation(habit)) return;
    if (isViewingToday && !isScheduledForViewingDate(habit.id)) return;
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
    setProgressValue("");
    setTimeout(() => setSelectedHabit(null), 300);
  };

  const handleProgressCancel = () => {
    setProgressModalVisible(false);
    setProgressValue("");
    setTimeout(() => setSelectedHabit(null), 300);
  };

  const handleProgressReset = async () => {
    if (!selectedHabit) return;
    await updateEntryValue(selectedHabit.id, 0);
    setProgressModalVisible(false);
    setProgressValue("");
    setTimeout(() => setSelectedHabit(null), 300);
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
      t('habits.deleteConfirmTitle'),
      t('habits.deleteConfirmMessage', { name: optionsHabit.name }),
      [
        { text: t('habits.cancel'), style: "cancel" },
        {
          text: t('habits.deleteButton'),
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

  const handleResetHabit = async () => {
    if (!optionsHabit) return;
    await updateEntryValue(optionsHabit.id, 0);
    handleCloseOptions();
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
    if (isHabitBeforeCreation(habit)) return;
    if (isViewingToday && !isScheduledForViewingDate(habitId)) return;
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
  setSwipeProgressRef.current = (habitId: string, tx: number) => {
    const habit = habits.find(h => h.id === habitId);
    if (habit && isHabitBeforeCreation(habit)) return;
    setSwipeProgress({ habitId, translationX: tx });
  };
  const applySwipeProgressRef = useRef(applySwipeProgress);
  applySwipeProgressRef.current = applySwipeProgress;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.success} />
        <Text style={styles.loadingText}>{t('habits.loadingHabits')}</Text>
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
        <View style={styles.headerRow}>
          <View style={styles.headerTitles}>
            <Text style={styles.title}>{t('habits.title')}</Text>
            <Text style={styles.subtitle}>
              {t('habits.completedOf', { completed: completedCount, total: scheduledCount })}
            </Text>
          </View>
          {habits.length > 1 && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setEditMode(!editMode)}
            >
              <Text style={styles.editButtonText}>{editMode ? t('habits.done') : t('habits.editOrder')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Date Navigator */}
      <View style={styles.dateNavigator}>
        <TouchableOpacity onPress={goToPreviousDay} style={styles.dateNavButton}>
          <Text style={styles.dateNavArrow}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setCalendarVisible(true)} style={styles.dateDisplay}>
          <Text style={styles.dateText}>
            {isViewingToday ? t('habits.todayLabel') : formatDateHeader(viewingDate)}
          </Text>
          <Text style={styles.tapToOpenCalendar}>{t('habits.tapToPickDate')}</Text>
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
        colors={colors}
      />

      {!isViewingToday && (
        <View style={styles.pastDateBanner}>
          <Text style={styles.pastDateText}>{t('habits.viewing', { date: formatDateHeader(viewingDate) })}</Text>
        </View>
      )}

      <ScrollView style={styles.habitsList} contentContainerStyle={styles.habitsContent} scrollEventThrottle={16} bounces={false} overScrollMode="never">
        {habits.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('habits.noHabits')}</Text>
            <Text style={styles.emptySubtext}>{t('habits.noHabitsHint')}</Text>
          </View>
        ) : (
          habits.map((habit, index) => {
            const completed = isHabitCompleted(habit.id);
            const isScheduledForDay = isViewingToday ? isScheduledForViewingDate(habit.id) : true;
            const beforeCreation = isHabitBeforeCreation(habit);
            const isSwipingThis = !editMode && swipeProgress?.habitId === habit.id;
            const tx = isSwipingThis ? swipeProgress.translationX : 0;
            const { increment: swipeIncrement, previewValue: swipePreviewValue } = isSwipingThis
              ? getSwipeProgress(habit, tx)
              : { increment: 0, previewValue: null };

            if (editMode) {
              return (
                <View key={habit.id} style={styles.editRow}>
                  <View style={styles.reorderButtons}>
                    <TouchableOpacity
                      style={[styles.reorderButton, index === 0 && styles.reorderButtonHidden]}
                      onPress={() => reorderHabits(index, index - 1)}
                      disabled={index === 0}
                    >
                      <Text style={styles.reorderButtonText}>▲</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.reorderButton, index === habits.length - 1 && styles.reorderButtonHidden]}
                      onPress={() => reorderHabits(index, index + 1)}
                      disabled={index === habits.length - 1}
                    >
                      <Text style={styles.reorderButtonText}>▼</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.editTileWrapper}>
                    <HabitTile
                      habit={habit}
                      completed={completed}
                      currentValue={getEntryValue(habit.id)}
                      isScheduledToday={isScheduledForDay}
                      isBeforeCreation={beforeCreation}
                      onTap={() => {}}
                      onLongPress={() => {}}
                      weeklyCount={weeklyCompletions.get(habit.id) ?? 0}
                      colors={colors}
                    />
                  </View>
                </View>
              );
            }

            return (
              <RightSwipeGestureWrapper
                key={habit.id}
                habit={habit}
                onSwipeMoveRef={setSwipeProgressRef}
                onSwipeEndRef={applySwipeProgressRef}
                onTap={() => handleHabitPress(habit)}
                onLongPress={() => handleOpenOptions(habit)}
              >
                <HabitTile
                  habit={habit}
                  completed={completed}
                  currentValue={getEntryValue(habit.id)}
                  isScheduledToday={isScheduledForDay}
                  isBeforeCreation={beforeCreation}
                  onTap={() => {}}
                  onLongPress={() => {}}
                  swipeIncrement={swipeIncrement}
                  swipePreviewValue={isSwipingThis ? swipePreviewValue : null}
                  weeklyCount={weeklyCompletions.get(habit.id) ?? 0}
                  colors={colors}
                />
              </RightSwipeGestureWrapper>
            );
          })
        )}
      </ScrollView>

      <Modal
        animationType="fade"
        transparent={true}
        visible={celebrationVisible}
        onRequestClose={() => setCelebrationVisible(false)}
      >
        <View style={styles.celebrationOverlay}>
          <Animated.View style={[styles.celebrationCard, { transform: [{ scale: celebrationScale }], opacity: celebrationOpacity }]}>
            <Text style={styles.celebrationEmoji}>🏆</Text>
            <Text style={styles.celebrationTitle}>{t('habits.celebrationTitle')}</Text>
            <Text style={styles.celebrationBody}>{t('habits.celebrationBody')}</Text>
            <View style={styles.celebrationStarsRow}>
              <Text style={styles.celebrationStar}>⭐</Text>
              <Text style={styles.celebrationStar}>⭐</Text>
              <Text style={styles.celebrationStar}>⭐</Text>
            </View>
            <TouchableOpacity style={styles.celebrationCheckRow} onPress={() => setDontShowCelebration(v => !v)} activeOpacity={0.7}>
              <View style={[styles.celebrationCheckbox, dontShowCelebration && styles.celebrationCheckboxChecked]}>
                {dontShowCelebration && <Text style={styles.celebrationCheckMark}>✓</Text>}
              </View>
              <Text style={styles.celebrationCheckLabel}>{t('habits.dontShowAgain')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.celebrationButton} onPress={async () => {
              if (dontShowCelebration) {
                celebrationHiddenPermanently.current = true;
                const db = await getDatabase();
                await db.runAsync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['hide_celebration', '1']);
              }
              setDontShowCelebration(false);
              setCelebrationVisible(false);
            }} activeOpacity={0.8}>
              <Text style={styles.celebrationButtonText}>{t('habits.celebrationDismiss')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <TouchableOpacity
        style={styles.infoButton}
        onPress={() => setInfoVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.infoButtonText}>i</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/habit-form')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Info Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={infoVisible}
        onRequestClose={() => setInfoVisible(false)}
      >
        <TouchableOpacity
          style={styles.infoModalOverlay}
          activeOpacity={1}
          onPress={() => setInfoVisible(false)}
        >
          <View style={styles.infoModalContent}>
            <Text style={styles.infoModalTitle}>{t('habits.tipsTitle')}</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>→</Text>
              <Text style={styles.infoText}>{t('habits.tipSwipeRight')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>↔</Text>
              <Text style={styles.infoText}>{t('habits.tipSwipeFurther')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>⋯</Text>
              <Text style={styles.infoText}>{t('habits.tipLongPress')}</Text>
            </View>
            <Text style={styles.infoModalTitle}>{t('habits.quitHabitsTitle')}</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>✓</Text>
              <Text style={styles.infoText}>{t('habits.tipQuitStart')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>✗</Text>
              <Text style={styles.infoText}>{t('habits.tipQuitTap')}</Text>
            </View>
            <TouchableOpacity
              style={styles.infoCloseButton}
              onPress={() => setInfoVisible(false)}
            >
              <Text style={styles.infoCloseText}>{t('habits.gotIt')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
              onPress={handleResetHabit}
            >
              <Text style={styles.optionItemText}>{t('habits.resetProgress')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleEditHabit}
            >
              <Text style={styles.optionItemText}>{t('habits.editHabit')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleDeleteHabit}
            >
              <Text style={styles.optionItemTextDanger}>{t('habits.deleteHabit')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionItemCancel}
              onPress={handleCloseOptions}
            >
              <Text style={styles.optionItemText}>{t('habits.cancel')}</Text>
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
        <TouchableOpacity
          style={styles.progressModalOverlay}
          activeOpacity={1}
          onPress={handleProgressCancel}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={styles.progressModalContent}>
            <Text style={styles.progressModalTitle}>
              {selectedHabit?.icon} {selectedHabit?.name}
            </Text>
            <Text style={styles.progressModalSubtitle}>
              {t('habits.target', { value: selectedHabit?.target_value, unit: selectedHabit?.target_type === "minutes" ? t('habits.minutes') : "" })}
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
                placeholderTextColor={colors.textTertiary}
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

            <View style={styles.quickButtonRow}>
              <TouchableOpacity
                style={styles.quickButton}
                onPress={() => {
                  const current = parseInt(progressValue) || 0;
                  setProgressValue(Math.max(0, current - 5).toString());
                }}
              >
                <Text style={styles.quickButtonText}>-5</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickButton}
                onPress={() => {
                  const current = parseInt(progressValue) || 0;
                  setProgressValue((current + 5).toString());
                }}
              >
                <Text style={styles.quickButtonText}>+5</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickButton}
                onPress={() => {
                  const current = parseInt(progressValue) || 0;
                  setProgressValue((current + 15).toString());
                }}
              >
                <Text style={styles.quickButtonText}>+15</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleProgressCancel}>
                <Text style={styles.cancelButtonText}>{t('habits.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleProgressSave}>
                <Text style={styles.saveButtonText}>{t('habits.save')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.resetButton} onPress={handleProgressReset}>
              <Text style={styles.resetButtonText}>Reset for today</Text>
            </TouchableOpacity>
          </View>
          </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </GestureHandlerRootView>
  );
}

function createCalendarStyles(colors: ThemeColors) {
  return {
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    container: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      width: 320,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    monthNav: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      marginBottom: 16,
    },
    monthNavButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.buttonBackground,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    monthNavButtonDisabled: {
      backgroundColor: colors.backgroundSecondary,
    },
    monthNavArrow: {
      fontSize: 24,
      color: colors.text,
      fontWeight: "300" as const,
    },
    monthNavArrowDisabled: {
      color: colors.handleBar,
    },
    monthTitle: {
      fontSize: 18,
      fontWeight: "600" as const,
      color: colors.text,
      textAlign: "center" as const,
    },
    monthTitleHint: {
      fontSize: 11,
      color: colors.textTertiary,
      textAlign: "center" as const,
      marginTop: 2,
    },
    monthGrid: {
      paddingVertical: 8,
    },
    monthRow: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      marginBottom: 8,
    },
    monthCell: {
      flex: 1,
      marginHorizontal: 4,
      paddingVertical: 14,
      borderRadius: 10,
      backgroundColor: colors.buttonBackground,
      alignItems: "center" as const,
    },
    currentMonthCell: {
      backgroundColor: colors.success,
    },
    selectedMonthCell: {
      backgroundColor: colors.accentLight,
      borderWidth: 2,
      borderColor: colors.accent,
    },
    monthCellText: {
      fontSize: 15,
      fontWeight: "500" as const,
      color: colors.text,
    },
    currentMonthText: {
      color: colors.textInverse,
      fontWeight: "600" as const,
    },
    selectedMonthText: {
      color: colors.accent,
      fontWeight: "600" as const,
    },
    disabledMonthText: {
      color: colors.handleBar,
    },
    weekRow: {
      flexDirection: "row" as const,
    },
    dayCell: {
      flex: 1,
      aspectRatio: 1,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      padding: 2,
    },
    dayHeader: {
      fontSize: 12,
      fontWeight: "600" as const,
      color: colors.textTertiary,
    },
    dayNumber: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    dayText: {
      fontSize: 15,
      color: colors.text,
    },
    todayCircle: {
      backgroundColor: colors.success,
    },
    todayText: {
      color: colors.textInverse,
      fontWeight: "600" as const,
    },
    selectedCircle: {
      backgroundColor: colors.accentLight,
      borderWidth: 2,
      borderColor: colors.accent,
    },
    selectedText: {
      color: colors.accent,
      fontWeight: "600" as const,
    },
    futureText: {
      color: colors.handleBar,
    },
    todayButton: {
      marginTop: 16,
      backgroundColor: colors.success,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: "center" as const,
    },
    todayButtonText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: "600" as const,
    },
  };
}

function createStyles(colors: ThemeColors) {
  return {
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: colors.textSecondary,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
    },
    headerRow: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      justifyContent: "space-between" as const,
    },
    headerTitles: {
      flex: 1,
    },
    editButton: {
      paddingVertical: 6,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: colors.buttonBackground,
      marginTop: 2,
    },
    editButtonText: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: colors.accent,
    },
    editRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginBottom: 12,
    },
    reorderButtons: {
      marginRight: 8,
      gap: 4,
    },
    reorderButton: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.buttonBackground,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    reorderButtonHidden: {
      opacity: 0,
    },
    reorderButtonText: {
      fontSize: 14,
      color: colors.text,
    },
    editTileWrapper: {
      flex: 1,
    },
    title: {
      fontSize: 26,
      fontWeight: "700" as const,
      color: colors.text,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
    dateNavigator: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: colors.card,
      marginHorizontal: 20,
      borderRadius: 12,
      marginBottom: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    dateNavButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.buttonBackground,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    dateNavButtonDisabled: {
      backgroundColor: colors.backgroundSecondary,
    },
    dateNavArrow: {
      fontSize: 28,
      color: colors.text,
      fontWeight: "300" as const,
      marginTop: -2,
    },
    dateNavArrowDisabled: {
      color: colors.handleBar,
    },
    dateDisplay: {
      flex: 1,
      alignItems: "center" as const,
      paddingHorizontal: 16,
    },
    dateText: {
      fontSize: 18,
      fontWeight: "600" as const,
      color: colors.text,
    },
    tapToOpenCalendar: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
    },
    pastDateBanner: {
      backgroundColor: colors.pastDateBanner,
      paddingVertical: 8,
      paddingHorizontal: 20,
      marginHorizontal: 20,
      marginBottom: 8,
      borderRadius: 8,
      alignItems: "center" as const,
    },
    pastDateText: {
      fontSize: 13,
      color: colors.pastDateText,
      fontWeight: "500" as const,
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
      alignItems: "center" as const,
      paddingTop: 64,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: "600" as const,
      color: colors.textSecondary,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textTertiary,
      marginTop: 8,
    },
    habitItem: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.card,
      paddingVertical: 16,
      paddingHorizontal: 18,
      borderRadius: 14,
      marginBottom: 12,
      borderLeftWidth: 4,
      overflow: "hidden" as const,
      position: "relative" as const,
      elevation: 1,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
    },
    progressFill: {
      position: "absolute" as const,
      left: 0,
      top: 0,
      bottom: 0,
      borderTopRightRadius: 14,
      borderBottomRightRadius: 14,
    },
    progressFillSwipe: {
      position: "absolute" as const,
      top: 0,
      bottom: 0,
      borderTopRightRadius: 10,
      borderBottomRightRadius: 10,
      zIndex: 1,
    },
    completedFill: {
      position: "absolute" as const,
      left: 0,
      top: 0,
      bottom: 0,
      right: 0,
    },
    swipeFeedback: {
      position: "absolute" as const,
      right: 18,
      top: 0,
      bottom: 0,
      justifyContent: "center" as const,
      paddingHorizontal: 14,
      borderRadius: 10,
    },
    swipeFeedbackText: {
      color: colors.textInverse,
      fontWeight: "700" as const,
      fontSize: 14,
    },
    checkbox: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginRight: 14,
    },
    checkmark: {
      color: colors.textInverse,
      fontSize: 15,
      fontWeight: "bold" as const,
    },
    habitInfo: {
      flex: 1,
      minWidth: 0,
    },
    habitHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
    },
    habitIcon: {
      fontSize: 18,
      marginRight: 8,
    },
    habitText: {
      fontSize: 16,
      color: colors.text,
      flex: 1,
      fontWeight: "500" as const,
    },
    habitTextCompleted: {
      color: colors.textTertiary,
      textDecorationLine: "line-through" as const,
    },
    habitDescription: {
      fontSize: 13,
      color: colors.textTertiary,
      marginTop: 2,
    },
    habitProgress: {
      fontSize: 13,
      color: colors.text,
      fontWeight: "500" as const,
      marginLeft: 8,
      flexShrink: 0,
      alignSelf: 'center',
    },
    celebrationOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      paddingHorizontal: 32,
    },
    celebrationCard: {
      backgroundColor: colors.card,
      borderRadius: 28,
      paddingVertical: 40,
      paddingHorizontal: 32,
      alignItems: 'center' as const,
      width: '100%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.35,
      shadowRadius: 20,
      elevation: 16,
    },
    celebrationEmoji: {
      fontSize: 72,
      marginBottom: 16,
    },
    celebrationTitle: {
      fontSize: 28,
      fontWeight: '800' as const,
      color: colors.text,
      textAlign: 'center' as const,
      marginBottom: 10,
    },
    celebrationBody: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center' as const,
      lineHeight: 22,
      marginBottom: 20,
    },
    celebrationStarsRow: {
      flexDirection: 'row' as const,
      marginBottom: 28,
    },
    celebrationStar: {
      fontSize: 26,
      marginHorizontal: 6,
    },
    celebrationCheckRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      marginBottom: 20,
    },
    celebrationCheckbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginRight: 10,
    },
    celebrationCheckboxChecked: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    celebrationCheckMark: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700' as const,
    },
    celebrationCheckLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    celebrationButton: {
      backgroundColor: colors.success,
      paddingVertical: 14,
      paddingHorizontal: 48,
      borderRadius: 14,
    },
    celebrationButtonText: {
      color: '#fff',
      fontSize: 17,
      fontWeight: '700' as const,
      letterSpacing: 0.3,
    },
    infoButton: {
      position: "absolute" as const,
      left: 20,
      bottom: 28,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    infoButtonText: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.textSecondary,
      fontStyle: "italic" as const,
    },
    infoModalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center" as const,
    },
    infoModalContent: {
      backgroundColor: colors.background,
      marginHorizontal: 30,
      borderRadius: 16,
      padding: 24,
    },
    infoModalTitle: {
      fontSize: 18,
      fontWeight: "700" as const,
      color: colors.text,
      marginBottom: 16,
    },
    infoRow: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      marginBottom: 14,
      gap: 12,
    },
    infoIcon: {
      fontSize: 16,
      color: colors.textSecondary,
      width: 20,
      textAlign: "center" as const,
      marginTop: 1,
    },
    infoText: {
      fontSize: 14,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 20,
    },
    infoCloseButton: {
      marginTop: 8,
      alignSelf: "center" as const,
      paddingVertical: 10,
      paddingHorizontal: 32,
      backgroundColor: colors.success,
      borderRadius: 10,
    },
    infoCloseText: {
      color: colors.textInverse,
      fontSize: 15,
      fontWeight: "600" as const,
    },
    fab: {
      position: "absolute" as const,
      right: 20,
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.success,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      elevation: 3,
      shadowColor: colors.success,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    fabText: {
      fontSize: 32,
      color: colors.textInverse,
      fontWeight: "300" as const,
      marginTop: -2,
    },
    optionsModalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "flex-end" as const,
    },
    optionsModalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 20,
      paddingBottom: 30,
    },
    optionsHeader: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    optionsTitle: {
      fontSize: 18,
      fontWeight: "600" as const,
      color: colors.text,
      textAlign: "center" as const,
    },
    optionItem: {
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    optionItemCancel: {
      paddingVertical: 16,
      paddingHorizontal: 20,
    },
    optionItemText: {
      fontSize: 16,
      color: colors.text,
      textAlign: "center" as const,
    },
    optionItemTextDanger: {
      fontSize: 16,
      color: colors.danger,
      textAlign: "center" as const,
      fontWeight: "500" as const,
    },
    habitItemDimmed: {
      opacity: 0.5,
    },
    habitItemFailed: {
      opacity: 0.55,
    },
    habitTextFailed: {
      color: colors.textTertiary,
    },
    habitProgressFailed: {
      color: colors.danger,
    },
    habitTextDimmed: {
      color: colors.textTertiary,
    },
    notScheduledText: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 4,
      fontStyle: "italic" as const,
    },
    quitBadge: {
      backgroundColor: colors.danger,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 8,
    },
    quitBadgeText: {
      fontSize: 10,
      color: colors.textInverse,
      fontWeight: "700" as const,
    },
    progressModalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    progressModalContent: {
      backgroundColor: colors.card,
      borderRadius: 20,
      paddingVertical: 24,
      paddingHorizontal: 48,
      width: "88%" as const,
      maxWidth: 360,
      alignItems: "center" as const,
    },
    progressModalTitle: {
      fontSize: 20,
      fontWeight: "bold" as const,
      color: colors.text,
      marginBottom: 4,
    },
    progressModalSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 24,
    },
    progressInputRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 16,
    },
    progressButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.buttonBackground,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    progressButtonText: {
      fontSize: 24,
      fontWeight: "600" as const,
      color: colors.text,
    },
    progressInput: {
      width: 100,
      fontSize: 32,
      fontWeight: "bold" as const,
      color: colors.text,
      textAlign: "center" as const,
      padding: 8,
      backgroundColor: colors.buttonBackground,
      borderRadius: 12,
    },
    progressUnitLabel: {
      fontSize: 14,
      color: colors.textTertiary,
      marginTop: 8,
      marginBottom: 16,
    },
    quickButtonRow: {
      flexDirection: "row" as const,
      gap: 8,
      marginTop: 12,
      marginBottom: 16,
    },
    quickButton: {
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.buttonBackground,
      alignItems: "center" as const,
    },
    quickButtonText: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: colors.text,
    },
    buttonRow: {
      flexDirection: "row" as const,
      gap: 12,
      width: "100%" as const,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      backgroundColor: colors.buttonBackground,
      alignItems: "center" as const,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.text,
    },
    saveButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      backgroundColor: colors.success,
      alignItems: "center" as const,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.textInverse,
    },
    resetButton: {
      width: "100%" as const,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: "center" as const,
      marginTop: 8,
    },
    resetButtonText: {
      fontSize: 14,
      fontWeight: "500" as const,
      color: colors.danger,
    },
    weeklyDots: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
      paddingHorizontal: 8,
    },
    weeklyDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      borderWidth: 1.5,
    },
  };
}

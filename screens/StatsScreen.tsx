import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useHabits } from "../context/HabitsContext";
import { getEntriesForHabitInRange } from "../services/database/entryService";
import {
  Habit,
  HabitEntry,
  isScheduledForDate,
  parseScheduleJson,
} from "../types/habit";

type TabKey = "overview" | "weekly" | "monthly" | "yearly";
type EntriesMap = Map<string, Map<string, HabitEntry>>;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEK_DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
// ─── Helpers ───

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function isCompletedForDate(
  habit: Habit,
  entry: HabitEntry | undefined
): boolean {
  const scheduleData = parseScheduleJson(habit.schedule_json);
  const isQuit = scheduleData.habit_mode === "quit";

  if (isQuit) {
    if (habit.target_type === "check") {
      return !entry || entry.value === 0;
    }
    return !entry || entry.value < habit.target_value;
  }

  if (!entry) return false;
  if (habit.target_type === "check") {
    return entry.value >= 1;
  }
  return entry.value >= habit.target_value;
}

function calcStreaks(
  habit: Habit,
  entriesByDate: Map<string, HabitEntry>,
  todayStr: string
): { current: number; best: number } {
  const scheduleData = parseScheduleJson(habit.schedule_json);
  const today = new Date(todayStr + "T00:00:00");

  let current = 0;
  let d = new Date(today);
  while (true) {
    const dateStr = formatDateStr(d);
    if (!isScheduledForDate(scheduleData, d)) {
      d.setDate(d.getDate() - 1);
      if (d.getTime() < habit.created_at) break;
      continue;
    }
    const entry = entriesByDate.get(dateStr);
    if (isCompletedForDate(habit, entry)) {
      current++;
      d.setDate(d.getDate() - 1);
      if (d.getTime() < habit.created_at) break;
    } else {
      break;
    }
  }

  let best = 0;
  let streak = 0;
  const createdDate = new Date(habit.created_at);
  createdDate.setHours(0, 0, 0, 0);
  d = new Date(createdDate);
  while (d <= today) {
    const dateStr = formatDateStr(d);
    if (!isScheduledForDate(scheduleData, d)) {
      d.setDate(d.getDate() + 1);
      continue;
    }
    const entry = entriesByDate.get(dateStr);
    if (isCompletedForDate(habit, entry)) {
      streak++;
      if (streak > best) best = streak;
    } else {
      streak = 0;
    }
    d.setDate(d.getDate() + 1);
  }

  return { current, best };
}

function calcCompletionRate(
  habit: Habit,
  entriesByDate: Map<string, HabitEntry>,
  startDate: Date,
  endDate: Date
): { completed: number; scheduled: number; rate: number } {
  const scheduleData = parseScheduleJson(habit.schedule_json);
  let completed = 0;
  let scheduled = 0;
  const d = new Date(startDate);
  while (d <= endDate) {
    if (isScheduledForDate(scheduleData, d)) {
      scheduled++;
      const dateStr = formatDateStr(d);
      const entry = entriesByDate.get(dateStr);
      if (isCompletedForDate(habit, entry)) completed++;
    }
    d.setDate(d.getDate() + 1);
  }
  const rate = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0;
  return { completed, scheduled, rate };
}

async function loadEntriesForRange(
  habits: Habit[],
  startDate: string,
  endDate: string
): Promise<EntriesMap> {
  const newMap: EntriesMap = new Map();
  await Promise.all(
    habits.map(async (habit) => {
      try {
        const entries = await getEntriesForHabitInRange(
          habit.id,
          startDate,
          endDate
        );
        const dateMap = new Map<string, HabitEntry>();
        entries.forEach((e) => dateMap.set(e.date, e));
        newMap.set(habit.id, dateMap);
      } catch (err) {
        console.error(`Failed to load entries for habit ${habit.id}:`, err);
        newMap.set(habit.id, new Map());
      }
    })
  );
  return newMap;
}

// ─── Week helpers ───

/** Get the Monday of the week containing the given date. */
function getMonday(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

/** Get the 7 dates of the week starting from Monday. */
function getWeekDates(monday: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

/** Format "Feb 3 – Feb 9, 2026" style label. */
function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const mStart = MONTH_SHORT[monday.getMonth()];
  const dStart = monday.getDate();
  const mEnd = MONTH_SHORT[sunday.getMonth()];
  const dEnd = sunday.getDate();
  const year = sunday.getFullYear();
  if (monday.getMonth() === sunday.getMonth()) {
    return `${mStart} ${dStart} \u2013 ${dEnd}, ${year}`;
  }
  return `${mStart} ${dStart} \u2013 ${mEnd} ${dEnd}, ${year}`;
}

// ─── Sub-components ───

function TabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}) {
  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "weekly", label: "Weekly" },
    { key: "monthly", label: "Monthly" },
    { key: "yearly", label: "Yearly" },
  ];
  return (
    <View style={styles.tabBar}>
      {tabs.map((t) => (
        <TouchableOpacity
          key={t.key}
          style={[styles.tab, activeTab === t.key && styles.tabActive]}
          onPress={() => onTabChange(t.key)}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === t.key && styles.tabTextActive,
            ]}
          >
            {t.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function NavRow({
  label,
  onPrev,
  onNext,
  nextDisabled,
  onLabelPress,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled: boolean;
  onLabelPress?: () => void;
}) {
  return (
    <View style={styles.navRow}>
      <TouchableOpacity onPress={onPrev} style={styles.navArrow}>
        <Text style={styles.navArrowText}>{"\u25C0"}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onLabelPress} disabled={!onLabelPress}>
        <Text style={styles.navLabel}>{label}</Text>
        {onLabelPress && (
          <Text style={styles.navLabelHint}>Tap to pick</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onNext}
        disabled={nextDisabled}
        style={styles.navArrow}
      >
        <Text
          style={[
            styles.navArrowText,
            nextDisabled && styles.navArrowDisabled,
          ]}
        >
          {"\u25B6"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Month Picker Modal ───

function MonthPickerModal({
  visible,
  onClose,
  selectedMonth,
  selectedYear,
  currentMonth,
  currentYear,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  selectedMonth: number;
  selectedYear: number;
  currentMonth: number;
  currentYear: number;
  onSelect: (month: number, year: number) => void;
}) {
  const [viewYear, setViewYear] = useState(selectedYear);

  useEffect(() => {
    if (visible) setViewYear(selectedYear);
  }, [visible, selectedYear]);

  const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthRows: number[][] = [];
  for (let i = 0; i < 12; i += 3) monthRows.push([i, i + 1, i + 2]);

  const canGoNext = viewYear < currentYear;
  const isDisabled = (m: number) => viewYear === currentYear && m > currentMonth;
  const isCurrent = (m: number) => viewYear === currentYear && m === currentMonth;
  const isSelected = (m: number) => viewYear === selectedYear && m === selectedMonth;

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={pickerStyles.container}>
            <View style={pickerStyles.nav}>
              <TouchableOpacity onPress={() => setViewYear((y) => y - 1)} style={pickerStyles.navButton}>
                <Text style={pickerStyles.navArrow}>{"\u2039"}</Text>
              </TouchableOpacity>
              <Text style={pickerStyles.navTitle}>{viewYear}</Text>
              <TouchableOpacity
                onPress={() => setViewYear((y) => y + 1)}
                style={[pickerStyles.navButton, !canGoNext && pickerStyles.navButtonDisabled]}
                disabled={!canGoNext}
              >
                <Text style={[pickerStyles.navArrow, !canGoNext && pickerStyles.navArrowDisabled]}>{"\u203A"}</Text>
              </TouchableOpacity>
            </View>
            <View style={pickerStyles.grid}>
              {monthRows.map((row, ri) => (
                <View key={ri} style={pickerStyles.gridRow}>
                  {row.map((m) => {
                    const disabled = isDisabled(m);
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[
                          pickerStyles.cell,
                          isCurrent(m) && pickerStyles.currentCell,
                          isSelected(m) && !isCurrent(m) && pickerStyles.selectedCell,
                        ]}
                        onPress={() => { if (!disabled) { onSelect(m, viewYear); onClose(); } }}
                        disabled={disabled}
                      >
                        <Text
                          style={[
                            pickerStyles.cellText,
                            isCurrent(m) && pickerStyles.currentCellText,
                            isSelected(m) && !isCurrent(m) && pickerStyles.selectedCellText,
                            disabled && pickerStyles.disabledCellText,
                          ]}
                        >
                          {MONTH_SHORT[m]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Year Picker Modal ───

function YearPickerModal({
  visible,
  onClose,
  selectedYear,
  currentYear,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  selectedYear: number;
  currentYear: number;
  onSelect: (year: number) => void;
}) {
  const [pageStart, setPageStart] = useState(() => selectedYear - ((selectedYear - currentYear) % 12 + 12) % 12);

  useEffect(() => {
    if (visible) {
      // Centre the selected year in the grid
      const offset = ((selectedYear - currentYear) % 12 + 12) % 12;
      setPageStart(selectedYear - offset);
    }
  }, [visible, selectedYear]);

  const years: number[] = [];
  for (let i = 0; i < 12; i++) years.push(pageStart + i);

  const yearRows: number[][] = [];
  for (let i = 0; i < 12; i += 3) yearRows.push(years.slice(i, i + 3));

  const canGoNext = pageStart + 12 <= currentYear;

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={pickerStyles.container}>
            <View style={pickerStyles.nav}>
              <TouchableOpacity onPress={() => setPageStart((s) => s - 12)} style={pickerStyles.navButton}>
                <Text style={pickerStyles.navArrow}>{"\u2039"}</Text>
              </TouchableOpacity>
              <Text style={pickerStyles.navTitle}>{pageStart} – {pageStart + 11}</Text>
              <TouchableOpacity
                onPress={() => setPageStart((s) => s + 12)}
                style={[pickerStyles.navButton, !canGoNext && pickerStyles.navButtonDisabled]}
                disabled={!canGoNext}
              >
                <Text style={[pickerStyles.navArrow, !canGoNext && pickerStyles.navArrowDisabled]}>{"\u203A"}</Text>
              </TouchableOpacity>
            </View>
            <View style={pickerStyles.grid}>
              {yearRows.map((row, ri) => (
                <View key={ri} style={pickerStyles.gridRow}>
                  {row.map((y) => {
                    const disabled = y > currentYear;
                    const isCurrent = y === currentYear;
                    const isSelected = y === selectedYear;
                    return (
                      <TouchableOpacity
                        key={y}
                        style={[
                          pickerStyles.cell,
                          isCurrent && pickerStyles.currentCell,
                          isSelected && !isCurrent && pickerStyles.selectedCell,
                        ]}
                        onPress={() => { if (!disabled) { onSelect(y); onClose(); } }}
                        disabled={disabled}
                      >
                        <Text
                          style={[
                            pickerStyles.cellText,
                            isCurrent && pickerStyles.currentCellText,
                            isSelected && !isCurrent && pickerStyles.selectedCellText,
                            disabled && pickerStyles.disabledCellText,
                          ]}
                        >
                          {y}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Week Picker Modal ───

function WeekPickerModal({
  visible,
  onClose,
  currentMonday,
  todayDate,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  currentMonday: Date;
  todayDate: Date;
  onSelect: (monday: Date) => void;
}) {
  const [viewYear, setViewYear] = useState(currentMonday.getFullYear());
  const [viewMonth, setViewMonth] = useState(currentMonday.getMonth());

  useEffect(() => {
    if (visible) {
      setViewYear(currentMonday.getFullYear());
      setViewMonth(currentMonday.getMonth());
    }
  }, [visible, currentMonday]);

  const canGoNext =
    viewYear < todayDate.getFullYear() ||
    (viewYear === todayDate.getFullYear() && viewMonth < todayDate.getMonth());

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const wpDayLabels = ["S", "M", "T", "W", "T", "F", "S"];
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  const lastRow = rows[rows.length - 1];
  while (lastRow.length < 7) lastRow.push(null);

  const todayStr = formatDateStr(todayDate);
  const currentMondayStr = formatDateStr(currentMonday);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={pickerStyles.container}>
            <View style={pickerStyles.nav}>
              <TouchableOpacity
                onPress={() => {
                  if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
                  else setViewMonth((m) => m - 1);
                }}
                style={pickerStyles.navButton}
              >
                <Text style={pickerStyles.navArrow}>{"\u2039"}</Text>
              </TouchableOpacity>
              <Text style={pickerStyles.navTitle}>
                {MONTH_SHORT[viewMonth]} {viewYear}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
                  else setViewMonth((m) => m + 1);
                }}
                style={[pickerStyles.navButton, !canGoNext && pickerStyles.navButtonDisabled]}
                disabled={!canGoNext}
              >
                <Text style={[pickerStyles.navArrow, !canGoNext && pickerStyles.navArrowDisabled]}>{"\u203A"}</Text>
              </TouchableOpacity>
            </View>
            <View style={weekPickerStyles.dayLabelsRow}>
              {wpDayLabels.map((label, i) => (
                <Text key={i} style={weekPickerStyles.dayLabel}>{label}</Text>
              ))}
            </View>
            {rows.map((row, ri) => (
              <View key={ri} style={weekPickerStyles.calRow}>
                {row.map((day, ci) => {
                  if (day === null) return <View key={`e-${ci}`} style={weekPickerStyles.calCell} />;
                  const cellDate = new Date(viewYear, viewMonth, day);
                  const dateStr = formatDateStr(cellDate);
                  const isFuture = cellDate > todayDate;
                  const isToday = dateStr === todayStr;
                  const cellMonday = getMonday(cellDate);
                  const isInCurrentWeek = formatDateStr(cellMonday) === currentMondayStr;
                  return (
                    <TouchableOpacity
                      key={`d-${day}`}
                      style={[
                        weekPickerStyles.calCell,
                        isInCurrentWeek && weekPickerStyles.selectedDayCell,
                        isToday && weekPickerStyles.todayDayCell,
                      ]}
                      disabled={isFuture}
                      onPress={() => { onSelect(getMonday(cellDate)); onClose(); }}
                    >
                      <Text style={[
                        weekPickerStyles.calDayText,
                        isToday && weekPickerStyles.todayDayText,
                        isFuture && weekPickerStyles.futureDayText,
                      ]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statBoxValue}>{value}</Text>
      <Text style={styles.statBoxLabel}>{label}</Text>
    </View>
  );
}

function HabitHeader({ habit }: { habit: Habit }) {
  return (
    <View style={styles.habitHeader}>
      <View style={styles.habitHeaderLeft}>
        <Text style={styles.habitIcon}>{habit.icon}</Text>
        <Text style={styles.habitName}>{habit.name}</Text>
        <View
          style={[styles.colorDot, { backgroundColor: habit.color }]}
        />
      </View>
    </View>
  );
}

function MonthlyGrid({
  habit,
  entriesByDate,
  todayStr,
  year,
  month,
}: {
  habit: Habit;
  entriesByDate: Map<string, HabitEntry>;
  todayStr: string;
  year: number;
  month: number;
}) {
  const today = new Date(todayStr + "T00:00:00");
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const { width: screenWidth } = useWindowDimensions();
  // card: marginHorizontal 16 + padding 16 each side = 64, cell margin 2 each side = 4 per cell, 7 cells = 28
  const cellSize = Math.floor((screenWidth - 64 - 28) / 7);

  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Build rows of 7
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  const lastRow = rows[rows.length - 1];
  while (lastRow.length < 7) lastRow.push(null);

  const scheduleData = parseScheduleJson(habit.schedule_json);

  return (
    <View>
      <View style={styles.monthCalRow}>
        {dayLabels.map((label, i) => (
          <Text key={i} style={[styles.monthDayLabel, { width: cellSize, marginHorizontal: 2 }]}>
            {label}
          </Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.monthCalRow}>
          {row.map((day, ci) => {
            if (day === null) {
              return (
                <View
                  key={`empty-${ri}-${ci}`}
                  style={{ width: cellSize, height: cellSize, margin: 2, borderRadius: 6 }}
                />
              );
            }

            const cellDate = new Date(year, month, day);
            const dateStr = formatDateStr(cellDate);
            const isToday = dateStr === todayStr;
            const isFuture = cellDate > today;
            const scheduled = isScheduledForDate(scheduleData, cellDate);
            const entry = entriesByDate.get(dateStr);
            const completed = scheduled && isCompletedForDate(habit, entry);

            let bgColor = "#D1D5DB";
            let opacity = 1;
            if (isFuture) {
              bgColor = "#D1D5DB";
              opacity = 0.25;
            } else if (completed) {
              bgColor = habit.color;
            } else if (!scheduled) {
              bgColor = "#F3F4F6";
            }

            return (
              <View
                key={`day-${day}`}
                style={[
                  {
                    width: cellSize,
                    height: cellSize,
                    margin: 2,
                    borderRadius: 6,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: bgColor,
                    opacity,
                  },
                  isToday && styles.todayCell,
                ]}
              >
                <Text style={[styles.monthCalDayText, isToday && styles.monthCalTodayText]}>
                  {day}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function YearlyGrid({
  habit,
  entriesByDate,
  todayStr,
  year,
}: {
  habit: Habit;
  entriesByDate: Map<string, HabitEntry>;
  todayStr: string;
  year: number;
}) {
  const today = new Date(todayStr + "T00:00:00");
  const startOfYear = new Date(year, 0, 1);
  const startDay = startOfYear.getDay();

  const scheduleData = parseScheduleJson(habit.schedule_json);

  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = [];
  for (let i = 0; i < startDay; i++) currentWeek.push(null);

  const d = new Date(startOfYear);
  while (d.getFullYear() === year) {
    currentWeek.push(new Date(d));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    d.setDate(d.getDate() + 1);
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return (
    <View>
      {[0, 1, 2, 3, 4, 5, 6].map((row) => (
        <View key={row} style={styles.yearRow}>
          {weeks.map((week, wi) => {
            const cell = week[row];
            if (!cell) {
              return <View key={wi} style={styles.yearCell} />;
            }

            const dateStr = formatDateStr(cell);
            const isToday = dateStr === todayStr;
            const isFuture = cell > today;
            const scheduled = isScheduledForDate(scheduleData, cell);
            const entry = entriesByDate.get(dateStr);
            const completed =
              scheduled && isCompletedForDate(habit, entry);

            let bgColor = "#D1D5DB";
            let opacity = 1;
            if (isFuture) {
              bgColor = "#D1D5DB";
              opacity = 0.25;
            } else if (completed) {
              bgColor = habit.color;
            } else if (!scheduled) {
              bgColor = "#F3F4F6";
            }

            return (
              <View
                key={wi}
                style={[
                  styles.yearCell,
                  { backgroundColor: bgColor, opacity },
                  isToday && styles.todayYearCell,
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Overview tab card (stat boxes only, no grids) ───

function OverviewHabitCard({
  habit,
  entriesByDate,
  todayStr,
}: {
  habit: Habit;
  entriesByDate: Map<string, HabitEntry>;
  todayStr: string;
}) {
  const scheduleData = parseScheduleJson(habit.schedule_json);
  const streaks = calcStreaks(habit, entriesByDate, todayStr);

  const today = new Date(todayStr + "T00:00:00");
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = getDaysInMonth(year, month);

  let monthCompleted = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(year, month, d);
    if (cellDate > today) break;
    const dateStr = formatDateStr(cellDate);
    if (isScheduledForDate(scheduleData, cellDate)) {
      const entry = entriesByDate.get(dateStr);
      if (isCompletedForDate(habit, entry)) monthCompleted++;
    }
  }

  let yearCompleted = 0;
  const startOfYear = new Date(year, 0, 1);
  const iter = new Date(startOfYear);
  while (iter <= today) {
    const dateStr = formatDateStr(iter);
    if (isScheduledForDate(scheduleData, iter)) {
      const entry = entriesByDate.get(dateStr);
      if (isCompletedForDate(habit, entry)) yearCompleted++;
    }
    iter.setDate(iter.getDate() + 1);
  }

  const modeLabel = scheduleData.habit_mode === "quit" ? "Quit" : "Build";

  return (
    <View style={styles.habitCard}>
      <View style={styles.habitHeader}>
        <View style={styles.habitHeaderLeft}>
          <Text style={styles.habitIcon}>{habit.icon}</Text>
          <Text style={styles.habitName}>{habit.name}</Text>
          <View
            style={[styles.colorDot, { backgroundColor: habit.color }]}
          />
        </View>
        <View
          style={[
            styles.modeBadge,
            {
              backgroundColor:
                scheduleData.habit_mode === "quit" ? "#FEE2E2" : "#DCFCE7",
            },
          ]}
        >
          <Text
            style={[
              styles.modeBadgeText,
              {
                color:
                  scheduleData.habit_mode === "quit" ? "#DC2626" : "#16A34A",
              },
            ]}
          >
            {modeLabel}
          </Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <StatBox label="Current Streak" value={String(streaks.current)} />
        <StatBox label="Best Streak" value={String(streaks.best)} />
        <StatBox label="This Month" value={`${monthCompleted}/${daysInMonth}`} />
        <StatBox label="This Year" value={String(yearCompleted)} />
      </View>
    </View>
  );
}

// ─── Main screen ───

export default function StatsScreen() {
  const { habits, completedCount } = useHabits();

  const todayDate = useMemo(() => new Date(), []);
  const todayStr = formatDateStr(todayDate);
  const currentYear = todayDate.getFullYear();
  const currentMonth = todayDate.getMonth();

  const activeHabits = useMemo(
    () => habits.filter((h) => !h.archived),
    [habits]
  );
  const habitIdsKey = activeHabits.map((h) => h.id).join(",");

  // Tab state
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  // Month/year selectors
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedMonthYear, setSelectedMonthYear] = useState(currentYear);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Weekly state
  const todayMonday = useMemo(() => getMonday(todayDate), [todayDate]);
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(todayDate));
  const [weekPickerVisible, setWeekPickerVisible] = useState(false);
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const weekLabel = useMemo(() => formatWeekLabel(weekStart), [weekStart]);
  const isCurrentWeek = formatDateStr(weekStart) === formatDateStr(todayMonday);

  // Picker modals
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [yearPickerVisible, setYearPickerVisible] = useState(false);

  // Entries maps
  const [overviewEntries, setOverviewEntries] = useState<EntriesMap>(new Map());
  const [weeklyEntries, setWeeklyEntries] = useState<EntriesMap>(new Map());
  const [monthlyEntries, setMonthlyEntries] = useState<EntriesMap>(new Map());
  const [yearlyEntries, setYearlyEntries] = useState<EntriesMap>(new Map());

  // Loading flags
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [yearlyLoading, setYearlyLoading] = useState(false);

  // Reload data when screen gains focus (e.g. after completing habits)
  const [focusCount, setFocusCount] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setFocusCount((c) => c + 1);
    }, [])
  );

  // ─── Load overview (current year Jan 1 → today) ───
  useEffect(() => {
    if (activeHabits.length === 0) {
      setOverviewEntries(new Map());
      setOverviewLoading(false);
      return;
    }
    setOverviewLoading(true);
    const startDate = `${currentYear}-01-01`;
    loadEntriesForRange(activeHabits, startDate, todayStr).then((m) => {
      setOverviewEntries(m);
      setOverviewLoading(false);
    });
  }, [habitIdsKey, todayStr, focusCount]);

  // ─── Load weekly entries when week changes ───
  useEffect(() => {
    if (activeHabits.length === 0) {
      setWeeklyEntries(new Map());
      return;
    }
    setWeeklyLoading(true);
    const startStr = formatDateStr(weekStart);
    const sunday = new Date(weekStart);
    sunday.setDate(weekStart.getDate() + 6);
    const endStr = formatDateStr(sunday);
    loadEntriesForRange(activeHabits, startStr, endStr).then((m) => {
      setWeeklyEntries(m);
      setWeeklyLoading(false);
    });
  }, [weekStart, habitIdsKey, focusCount]);

  // ─── Load monthly entries when month changes ───
  useEffect(() => {
    if (activeHabits.length === 0) {
      setMonthlyEntries(new Map());
      return;
    }
    // Optimisation: if viewing current year, reuse overview data
    if (selectedMonthYear === currentYear) {
      setMonthlyEntries(overviewEntries);
      return;
    }
    setMonthlyLoading(true);
    const dim = getDaysInMonth(selectedMonthYear, selectedMonth);
    const startDate = `${selectedMonthYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
    const endDate = `${selectedMonthYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(dim).padStart(2, "0")}`;
    loadEntriesForRange(activeHabits, startDate, endDate).then((m) => {
      setMonthlyEntries(m);
      setMonthlyLoading(false);
    });
  }, [selectedMonth, selectedMonthYear, habitIdsKey, overviewEntries, focusCount]);

  // ─── Load yearly entries when year changes ───
  useEffect(() => {
    if (activeHabits.length === 0) {
      setYearlyEntries(new Map());
      return;
    }
    // Optimisation: if viewing current year, reuse overview data
    if (selectedYear === currentYear) {
      setYearlyEntries(overviewEntries);
      return;
    }
    setYearlyLoading(true);
    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear}-12-31`;
    loadEntriesForRange(activeHabits, startDate, endDate).then((m) => {
      setYearlyEntries(m);
      setYearlyLoading(false);
    });
  }, [selectedYear, habitIdsKey, overviewEntries, focusCount]);

  // ─── Month navigation ───
  const goMonthPrev = useCallback(() => {
    setSelectedMonth((m) => {
      if (m === 0) {
        setSelectedMonthYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const goMonthNext = useCallback(() => {
    setSelectedMonth((m) => {
      if (m === 11) {
        setSelectedMonthYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const monthNextDisabled =
    selectedMonthYear === currentYear && selectedMonth === currentMonth;

  // ─── Week navigation ───
  const goWeekPrev = useCallback(() => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }, []);

  const goWeekNext = useCallback(() => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }, []);

  // ─── Year navigation ───
  const goYearPrev = useCallback(() => {
    setSelectedYear((y) => y - 1);
  }, []);

  const goYearNext = useCallback(() => {
    setSelectedYear((y) => y + 1);
  }, []);

  const yearNextDisabled = selectedYear === currentYear;

  // ─── Render ───

  const todayRate =
    activeHabits.length > 0
      ? Math.round((completedCount / activeHabits.length) * 100)
      : 0;

  // Overall completion across all habits for the current year
  const overallCompletion = useMemo(() => {
    let totalCompleted = 0;
    let totalScheduled = 0;
    for (const habit of activeHabits) {
      const entries = overviewEntries.get(habit.id) || new Map();
      const stats = calcCompletionRate(
        habit,
        entries,
        new Date(currentYear, 0, 1),
        todayDate
      );
      totalCompleted += stats.completed;
      totalScheduled += stats.scheduled;
    }
    return totalScheduled > 0
      ? Math.round((totalCompleted / totalScheduled) * 100)
      : 0;
  }, [activeHabits, overviewEntries]);

  const isLoading =
    (activeTab === "overview" && overviewLoading) ||
    (activeTab === "weekly" && weeklyLoading) ||
    (activeTab === "monthly" && monthlyLoading) ||
    (activeTab === "yearly" && yearlyLoading);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Stats</Text>
        <Text style={styles.subtitle}>Your progress</Text>
      </View>

      {/* Tab bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : activeHabits.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No habits yet. Add some to see your stats!
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.contentContainer}>
          {/* ─── OVERVIEW TAB ─── */}
          {activeTab === "overview" && (
            <>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>
                      {activeHabits.length}
                    </Text>
                    <Text style={styles.summaryLabel}>Habits</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>
                      {completedCount}/{activeHabits.length}
                    </Text>
                    <Text style={styles.summaryLabel}>Today ({todayRate}%)</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>
                      {overallCompletion}%
                    </Text>
                    <Text style={styles.summaryLabel}>Overall</Text>
                  </View>
                </View>
              </View>

              {activeHabits.map((habit) => (
                <OverviewHabitCard
                  key={habit.id}
                  habit={habit}
                  entriesByDate={
                    overviewEntries.get(habit.id) || new Map()
                  }
                  todayStr={todayStr}
                />
              ))}
            </>
          )}

          {/* ─── WEEKLY TAB ─── */}
          {activeTab === "weekly" && (
            <>
              <NavRow
                label={weekLabel}
                onPrev={goWeekPrev}
                onNext={goWeekNext}
                nextDisabled={isCurrentWeek}
                onLabelPress={() => setWeekPickerVisible(true)}
              />
              <WeekPickerModal
                visible={weekPickerVisible}
                onClose={() => setWeekPickerVisible(false)}
                currentMonday={weekStart}
                todayDate={todayDate}
                onSelect={(monday) => setWeekStart(monday)}
              />

              {/* Day labels row (same layout as habit rows so labels align with squares) */}
              <View style={styles.weekLabelRow}>
                <View style={styles.weekHabitInfo} />
                <View style={styles.weekSquaresRow}>
                  {WEEK_DAY_LABELS.map((label, i) => (
                    <View key={i} style={styles.weekSquare}>
                      <Text style={styles.weekDayHeaderLabel}>{label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Habit rows */}
              {activeHabits.map((habit) => {
                const entriesByDate = weeklyEntries.get(habit.id) || new Map();
                const scheduleData = parseScheduleJson(habit.schedule_json);
                return (
                  <View key={habit.id} style={styles.weekHabitRow}>
                    <View style={styles.weekHabitInfo}>
                      <Text style={styles.weekHabitIcon}>{habit.icon}</Text>
                      <Text style={styles.weekHabitName} numberOfLines={1}>{habit.name}</Text>
                      <View style={[styles.colorDot, { backgroundColor: habit.color }]} />
                    </View>
                    <View style={styles.weekSquaresRow}>
                      {weekDates.map((d, i) => {
                        const dateStr = formatDateStr(d);
                        const isToday = dateStr === todayStr;
                        const isFuture = d > todayDate;
                        const scheduled = isScheduledForDate(scheduleData, d);
                        const entry = entriesByDate.get(dateStr);
                        const completed = scheduled && !isFuture && isCompletedForDate(habit, entry);

                        let bgColor: string;
                        if (isFuture || !scheduled) {
                          bgColor = "#F3F4F6";
                        } else if (completed) {
                          bgColor = habit.color;
                        } else {
                          bgColor = "#D1D5DB";
                        }

                        return (
                          <View
                            key={i}
                            style={[
                              styles.weekSquare,
                              { backgroundColor: bgColor },
                              isToday && styles.weekTodaySquare,
                            ]}
                          />
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {/* ─── MONTHLY TAB ─── */}
          {activeTab === "monthly" && (
            <>
              <NavRow
                label={`${MONTH_NAMES[selectedMonth]} ${selectedMonthYear}`}
                onPrev={goMonthPrev}
                onNext={goMonthNext}
                nextDisabled={monthNextDisabled}
                onLabelPress={() => setMonthPickerVisible(true)}
              />
              <MonthPickerModal
                visible={monthPickerVisible}
                onClose={() => setMonthPickerVisible(false)}
                selectedMonth={selectedMonth}
                selectedYear={selectedMonthYear}
                currentMonth={currentMonth}
                currentYear={currentYear}
                onSelect={(m, y) => {
                  setSelectedMonth(m);
                  setSelectedMonthYear(y);
                }}
              />
              {activeHabits.map((habit) => {
                const entries = monthlyEntries.get(habit.id) || new Map();
                const dim = getDaysInMonth(selectedMonthYear, selectedMonth);
                const rangeEnd =
                  selectedMonthYear === currentYear && selectedMonth === currentMonth
                    ? todayDate
                    : new Date(selectedMonthYear, selectedMonth, dim);
                const stats = calcCompletionRate(
                  habit,
                  entries,
                  new Date(selectedMonthYear, selectedMonth, 1),
                  rangeEnd
                );
                return (
                  <View key={habit.id} style={styles.habitCard}>
                    <HabitHeader habit={habit} />
                    <Text style={styles.completionText}>
                      {stats.completed}/{stats.scheduled} completed ({stats.rate}%)
                    </Text>
                    <MonthlyGrid
                      habit={habit}
                      entriesByDate={entries}
                      todayStr={todayStr}
                      year={selectedMonthYear}
                      month={selectedMonth}
                    />
                  </View>
                );
              })}
            </>
          )}

          {/* ─── YEARLY TAB ─── */}
          {activeTab === "yearly" && (
            <>
              <NavRow
                label={String(selectedYear)}
                onPrev={goYearPrev}
                onNext={goYearNext}
                nextDisabled={yearNextDisabled}
                onLabelPress={() => setYearPickerVisible(true)}
              />
              <YearPickerModal
                visible={yearPickerVisible}
                onClose={() => setYearPickerVisible(false)}
                selectedYear={selectedYear}
                currentYear={currentYear}
                onSelect={(y) => setSelectedYear(y)}
              />
              {activeHabits.map((habit) => {
                const entries = yearlyEntries.get(habit.id) || new Map();
                const rangeEnd =
                  selectedYear === currentYear
                    ? todayDate
                    : new Date(selectedYear, 11, 31);
                const stats = calcCompletionRate(
                  habit,
                  entries,
                  new Date(selectedYear, 0, 1),
                  rangeEnd
                );
                return (
                  <View key={habit.id} style={styles.habitCard}>
                    <HabitHeader habit={habit} />
                    <Text style={styles.completionText}>
                      {stats.completed}/{stats.scheduled} completed ({stats.rate}%)
                    </Text>
                    <YearlyGrid
                      habit={habit}
                      entriesByDate={entries}
                      todayStr={todayStr}
                      year={selectedYear}
                    />
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F4F7",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainer: {
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
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

  // Tab bar
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#E5E7EB",
    borderRadius: 10,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: "#FFFFFF",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  tabTextActive: {
    color: "#111827",
  },

  // Nav row (month/year selector)
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 8,
  },
  navArrow: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  navArrowText: {
    fontSize: 18,
    color: "#3B82F6",
  },
  navArrowDisabled: {
    color: "#D1D5DB",
  },
  navLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    minWidth: 200,
    textAlign: "center",
  },
  navLabelHint: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 1,
  },

  // Summary card
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  summaryItem: {
    alignItems: "center",
    flex: 1,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#3B82F6",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#E5E7EB",
  },

  // Habit card
  habitCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  completionText: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 8,
  },
  habitHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  habitHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  habitIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  habitName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginRight: 8,
    flexShrink: 1,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },

  // Stats row
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    paddingVertical: 8,
    marginHorizontal: 2,
  },
  statBoxValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
  },
  statBoxLabel: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 2,
  },

  // Monthly grid (calendar layout)
  monthCalRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  monthDayLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 4,
  },
  monthCalDayText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#374151",
  },
  monthCalTodayText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  todayCell: {
    borderWidth: 2,
    borderColor: "#111827",
  },

  // Yearly grid
  yearRow: {
    flexDirection: "row",
  },
  yearCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 1,
    marginRight: 1,
    marginBottom: 1,
    backgroundColor: "#F3F4F6",
  },
  todayYearCell: {
    borderWidth: 1,
    borderColor: "#111827",
  },

  // Weekly grid
  weekLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 12,
  },
  weekDayHeaderLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    textAlign: "center",
  },
  weekHabitRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  weekHabitInfo: {
    width: 120,
    flexDirection: "row",
    alignItems: "center",
  },
  weekHabitIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  weekHabitName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    flexShrink: 1,
    marginRight: 4,
  },
  weekSquaresRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  weekSquare: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  weekTodaySquare: {
    borderWidth: 2,
    borderColor: "#111827",
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
  },
});

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    width: 320,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  navButtonDisabled: {
    backgroundColor: "#F9FAFB",
  },
  navArrow: {
    fontSize: 24,
    color: "#374151",
    fontWeight: "300",
  },
  navArrowDisabled: {
    color: "#D1D5DB",
  },
  navTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0F172A",
    textAlign: "center",
  },
  grid: {
    paddingVertical: 8,
  },
  gridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cell: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  currentCell: {
    backgroundColor: "#3B82F6",
  },
  selectedCell: {
    backgroundColor: "#E0F2FE",
    borderWidth: 2,
    borderColor: "#0EA5E9",
  },
  cellText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#374151",
  },
  currentCellText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  selectedCellText: {
    color: "#0369A1",
    fontWeight: "600",
  },
  disabledCellText: {
    color: "#D1D5DB",
  },
});

const weekPickerStyles = StyleSheet.create({
  dayLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 4,
  },
  dayLabel: {
    width: 36,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  calRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 4,
  },
  calCell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedDayCell: {
    backgroundColor: "#E0F2FE",
  },
  todayDayCell: {
    backgroundColor: "#3B82F6",
  },
  calDayText: {
    fontSize: 14,
    color: "#374151",
  },
  todayDayText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  futureDayText: {
    color: "#D1D5DB",
  },
});

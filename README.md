# Inner City

A gamified habit tracker where completing your daily habits earns you coins to build and grow your own isometric city.

## What It Is

Inner City turns habit tracking into a city-building game. Every habit you complete awards coins. Spend those coins to place buildings on your city grid — houses, apartments, offices, factories, and solar panels. Your city grows as you stay consistent.

All data is stored locally on your device. No accounts, no internet required, no data collection.

## Features

### Habit Tracking

- **Two habit types**: Check habits (done/not done) and progress habits (numeric targets like minutes or reps)
- **Two modes**:
  - **Build** — earn coins when you complete a habit
  - **Quit** — earn coins for each day you _don't_ do something
- **Flexible scheduling**: Daily, weekly (specific days), or custom (specific days of the month)
- **Swipe gestures**: Swipe right to increment progress, flick to complete
- **Date navigation**: Browse back through your history with a calendar picker
- **Color-coded habits**: Assign a custom color to each habit

### City Building

- **Isometric grid** rendered with tile-based sprites
- **5 building types**: Houses (6 color variants, up to 4 tiers), Apartments, Offices, Factories, Solar Panels
- **Gesture controls**:
  - Tap empty tile to place a building
  - Tap existing building to upgrade it
  - Pinch to zoom (0.5x–2x)
  - Drag to pan with momentum
  - Double tap to reset view
- **Auto-build** mode for quick expansion
- **Dynamic grid**: Expands automatically as you fill plots
- Buildings cost 3 coins each

### Statistics

- **Overview**: Streaks, completion rates, and per-habit breakdowns
- **Weekly view**: Color-coded 7-day completion grid
- **Monthly view**: Full calendar with daily completion status
- **Yearly view**: Heatmap of your entire year at a glance

### Other

- **Dark and light themes**
- **10 languages**: English, Spanish, French, Chinese, Hindi, Arabic, Portuguese, Russian, Japanese, Korean
- **Sound effects** (toggleable)
- **Local notifications** for habit reminders
- **Data export/import**: Back up and restore your city and habits as JSON

## Tech Stack

| Category      | Library                              |
| ------------- | ------------------------------------ |
| Framework     | Expo (React Native) with Expo Router |
| Language      | TypeScript                           |
| Database      | expo-sqlite (local SQLite)           |
| Animations    | React Native Reanimated              |
| Gestures      | React Native Gesture Handler         |
| Navigation    | React Navigation (Drawer)            |
| Audio         | expo-av                              |
| Notifications | expo-notifications                   |
| Localization  | expo-localization + i18n-js          |

## Project Structure

```
inner-city/
├── app/                  # Expo Router entry points
│   └── drawer/           # Drawer navigation screens
├── screens/              # Screen components
│   ├── CityScreen.tsx
│   ├── HabitsScreen.tsx
│   ├── StatsScreen.tsx
│   ├── SettingsScreen.tsx
│   └── HabitFormScreen.tsx
├── context/              # React context providers
│   ├── BuildingContext.tsx
│   ├── HabitsContext.tsx
│   ├── ThemeContext.tsx
│   ├── LanguageContext.tsx
│   └── SoundContext.tsx
├── services/
│   └── database/         # SQLite service layer
├── components/           # Reusable UI components
├── constants/
│   └── Colors.ts         # Light/dark color palettes
├── i18n/
│   └── locales/          # Translation files (10 languages)
├── types/                # TypeScript type definitions
└── assets/
    └── Sprites/          # Isometric tile and building graphics
```

## Running Locally

```bash
npm install
npm start
```

Then press `a` for Android, `i` for iOS, or `w` for web in the Expo CLI.

Requires Node.js and the Expo CLI. For device builds, you'll need Android Studio or Xcode.

## Privacy

Inner City does not collect analytics, use ads, or require a login. All habit and city data lives in a local SQLite database on your device and never leaves it.

## Platform Support

- Android
- iOS (phone only, tablets not supported)

// Color Palette
export const palette = {
  background: '#F2F4F7',
  cards: '#FFFFFF',
  emptyTiles: '#CBD5E1',
  cityBlue: '#3B82F6',
  successGreen: '#22C55E',
  rareHighlight: '#F59E0B',
  text: '#111827',
  textSecondary: '#64748B',
};

const tintColorLight = palette.cityBlue;
const tintColorDark = '#fff';

export default {
  light: {
    text: palette.text,
    background: palette.background,
    tint: tintColorLight,
    tabIconDefault: palette.textSecondary,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#fff',
    background: '#000',
    tint: tintColorDark,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorDark,
  },
};

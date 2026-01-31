import { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  PanResponder,
  Text,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type ColorPickerSimpleProps = {
  value: string;
  onColorChange: (color: string) => void;
};

// Convert HSL to Hex
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

// Convert Hex to HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 100, l: 50 };

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Convert HSV to Hex (better for color pickers)
function hsvToHex(h: number, s: number, v: number): string {
  s /= 100;
  v /= 100;

  const i = Math.floor(h / 60) % 6;
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  let r = 0, g = 0, b = 0;
  switch (i) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }

  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// Convert Hex to HSV
function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 100, v: 100 };

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;

  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }

  return { h: Math.round(h), s: Math.round(s), v: Math.round(v) };
}

export default function ColorPickerSimple({ value, onColorChange }: ColorPickerSimpleProps) {
  const initialHsv = hexToHsv(value);
  const [hue, setHue] = useState(initialHsv.h);
  const [saturation, setSaturation] = useState(initialHsv.s);
  const [brightness, setBrightness] = useState(initialHsv.v);

  const panelLayout = useRef({ width: 0, height: 0 });
  const hueLayout = useRef({ width: 0 });

  const updateColor = (h: number, s: number, v: number) => {
    const newColor = hsvToHex(h, s, v);
    onColorChange(newColor);
  };

  const handlePanelTouch = (x: number, y: number) => {
    const { width, height } = panelLayout.current;
    if (width === 0 || height === 0) return;

    const newSat = Math.max(0, Math.min(100, (x / width) * 100));
    const newBright = Math.max(0, Math.min(100, 100 - (y / height) * 100));

    setSaturation(newSat);
    setBrightness(newBright);
    updateColor(hue, newSat, newBright);
  };

  const handleHueTouch = (x: number) => {
    const { width } = hueLayout.current;
    if (width === 0) return;

    const newHue = Math.max(0, Math.min(360, (x / width) * 360));
    setHue(newHue);
    updateColor(newHue, saturation, brightness);
  };

  // Panel responder
  const panelResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        handlePanelTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
      },
      onPanResponderMove: (evt) => {
        handlePanelTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
      },
    })
  ).current;

  // Hue slider responder
  const hueResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        handleHueTouch(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt) => {
        handleHueTouch(evt.nativeEvent.locationX);
      },
    })
  ).current;

  const currentColor = hsvToHex(hue, saturation, brightness);
  const pureHueColor = hsvToHex(hue, 100, 100);

  // Calculate thumb positions (as percentages)
  const thumbX = saturation;
  const thumbY = 100 - brightness;
  const hueThumbX = (hue / 360) * 100;

  return (
    <View style={styles.container}>
      {/* Color preview */}
      <View style={[styles.preview, { backgroundColor: currentColor }]}>
        <Text style={styles.previewText}>{currentColor}</Text>
      </View>

      {/* Saturation/Brightness panel */}
      <View
        style={styles.panel}
        onLayout={(e) => {
          panelLayout.current = {
            width: e.nativeEvent.layout.width,
            height: e.nativeEvent.layout.height,
          };
        }}
        {...panelResponder.panHandlers}
      >
        {/* Base hue color */}
        <View style={[styles.panelBase, { backgroundColor: pureHueColor }]} />
        {/* White to transparent gradient (left to right) */}
        <LinearGradient
          colors={["#FFFFFF", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.panelGradient}
        />
        {/* Transparent to black gradient (top to bottom) */}
        <LinearGradient
          colors={["transparent", "#000000"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.panelGradient}
        />
        {/* Thumb indicator */}
        <View
          style={[
            styles.panelThumb,
            {
              left: `${thumbX}%`,
              top: `${thumbY}%`,
              backgroundColor: currentColor,
            },
          ]}
        />
      </View>

      {/* Hue slider */}
      <View
        style={styles.hueSlider}
        onLayout={(e) => {
          hueLayout.current = { width: e.nativeEvent.layout.width };
        }}
        {...hueResponder.panHandlers}
      >
        <LinearGradient
          colors={[
            "#FF0000", // 0°
            "#FFFF00", // 60°
            "#00FF00", // 120°
            "#00FFFF", // 180°
            "#0000FF", // 240°
            "#FF00FF", // 300°
            "#FF0000", // 360°
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.hueGradient}
        />
        <View
          style={[
            styles.hueThumb,
            {
              left: `${hueThumbX}%`,
              backgroundColor: pureHueColor,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  preview: {
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  previewText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  panel: {
    height: 150,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },
  panelBase: {
    ...StyleSheet.absoluteFillObject,
  },
  panelGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  panelThumb: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: "#fff",
    marginLeft: -12,
    marginTop: -12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  hueSlider: {
    height: 28,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  hueGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
  },
  hueThumb: {
    position: "absolute",
    top: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: "#fff",
    marginLeft: -12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
});

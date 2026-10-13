import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

// ─── PALETA OFICIAL (sin cambios) ─────────────────────────────────────────
export const C = {
  tangerine: "#F0BC21", butter: "#F2D88F", blush: "#E36888", sea: "#6698CC",
  matcha: "#B4B534", white: "#FFFFFF", bg: "#FFF9EE", dark: "#2A2016",
  muted: "#7A6A58", border: "#EDE3D0",
};

// ─── CARD ───────────────────────────────────────────────────────────────
// En web usabas onMouseEnter/onMouseLeave para el efecto hover.
// En móvil no hay mouse, así que usamos onPressIn/onPressOut para dar
// feedback táctil equivalente cuando el usuario toca la tarjeta.
type CardProps = {
  children: React.ReactNode;
  style?: object;
  onPress?: () => void;
};

export const Card = ({ children, style = {}, onPress }: CardProps) => {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => onPress && setPressed(true)}
      onPressOut={() => onPress && setPressed(false)}
      style={[
        styles.card,
        pressed && styles.cardPressed,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
};

// ─── PILL ───────────────────────────────────────────────────────────────
type PillProps = { color: string; children: React.ReactNode; outline?: boolean };

export const Pill = ({ color, children, outline }: PillProps) => (
  <View style={[
    styles.pill,
    { backgroundColor: outline ? "transparent" : color + "22",
      borderColor: outline ? color : "transparent",
      borderWidth: outline ? 1.5 : 0 },
  ]}>
    <Text style={[styles.pillText, { color }]}>{children}</Text>
  </View>
);

// ─── BTN ────────────────────────────────────────────────────────────────
type BtnProps = {
  children: React.ReactNode;
  color?: string;
  outline?: boolean;
  small?: boolean;
  full?: boolean;
  disabled?: boolean;
  style?: object;
  onPress?: () => void;
};

export const Btn = ({ children, color = C.blush, outline, small, full, disabled, style = {}, onPress }: BtnProps) => {
  const [pressed, setPressed] = useState(false);
  const bg = disabled ? C.border : (outline ? "transparent" : color);
  const textColor = disabled ? C.muted : (outline ? color : "#fff");
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.btn,
        { backgroundColor: bg, borderColor: disabled ? C.border : color,
          paddingVertical: small ? 7 : 11, paddingHorizontal: small ? 18 : 26,
          width: full ? "100%" : undefined, opacity: pressed && !disabled ? 0.85 : (disabled ? 0.7 : 1) },
        style,
      ]}
    >
      <Text style={{ color: textColor, fontWeight: "900", fontSize: small ? 12 : 14, textAlign: "center" }}>
        {children}
      </Text>
    </Pressable>
  );
};

// ─── BAR ────────────────────────────────────────────────────────────────
type BarProps = { val: number; color: string; label?: string; thin?: boolean };

export const Bar = ({ val, color, label, thin }: BarProps) => {
  const clamped = Math.max(0, Math.min(100, val));
  return (
    <View style={{ marginBottom: thin ? 5 : 10 }}>
      {label && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
          <Text style={{ fontSize: 12, color: C.muted }}>{label}</Text>
          <Text style={{ fontSize: 12, fontWeight: "800", color }}>{val}%</Text>
        </View>
      )}
      <View style={{ height: thin ? 6 : 10, backgroundColor: C.butter + "88", borderRadius: 99, overflow: "hidden" }}>
        <View style={{ height: "100%", width: `${clamped}%`, backgroundColor: color, borderRadius: 99 }} />
      </View>
    </View>
  );
};

// ─── SEC ────────────────────────────────────────────────────────────────
export const Sec = ({ children }: { children: React.ReactNode }) => (
  <Text style={styles.sec}>{children}</Text>
);

// ─── ALERT BOX ──────────────────────────────────────────────────────────
type AlertType = "warn" | "danger" | "info" | "ok";

export const AlertBox = ({ type, children }: { type: AlertType; children: React.ReactNode }) => {
  const map = { warn: C.tangerine, danger: C.blush, info: C.sea, ok: C.matcha };
  const cl = map[type] || C.sea;
  const icons = { warn: "⚠️", danger: "🚨", info: "ℹ️", ok: "✅" };
  return (
    <View style={[styles.alertBox, { backgroundColor: cl + "13", borderLeftColor: cl }]}>
      <Text style={{ fontSize: 14 }}>{icons[type]}</Text>
      <Text style={{ fontSize: 12, color: C.dark, lineHeight: 18, flex: 1 }}>{children}</Text>
    </View>
  );
};

// ─── MIRO (mascota) ─────────────────────────────────────────────────────
type MiroMood = "happy" | "excited" | "calm" | "thinking" | "cheer" | "worried";

export const Miro = ({ mood = "happy", size = 72 }: { mood?: MiroMood; size?: number }) => {
  const m: Record<MiroMood, { e: string; c: string; msg: string }> = {
    happy:    { e: "🦊", c: C.tangerine, msg: "¡Hola! Soy Miro 🎉" },
    excited:  { e: "🌟", c: C.blush,     msg: "¡Tú puedes! ✨" },
    calm:     { e: "🐨", c: C.sea,       msg: "Respira... 🌿" },
    thinking: { e: "🦉", c: C.matcha,    msg: "Pensemos juntos 🧠" },
    cheer:    { e: "🎊", c: C.blush,     msg: "¡Increíble logro! 🏆" },
    worried:  { e: "🦔", c: C.tangerine, msg: "Vamos con calma 💛" },
  };
  const d = m[mood] || m.happy;
  return (
    <View style={{ alignItems: "center", gap: 5 }}>
      <View style={{
        width: size, height: size, borderRadius: size / 2, backgroundColor: d.c + "22",
        borderWidth: 3, borderColor: d.c, alignItems: "center", justifyContent: "center",
      }}>
        <Text style={{ fontSize: size * 0.52 }}>{d.e}</Text>
      </View>
      <View style={{ backgroundColor: d.c, borderRadius: 99, paddingVertical: 4, paddingHorizontal: 12, maxWidth: 150 }}>
        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", textAlign: "center" }}>{d.msg}</Text>
      </View>
    </View>
  );
};

// ─── ESTILOS COMPARTIDOS ────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: C.border,
    // Sombra: en web era boxShadow, en RN son propiedades separadas por plataforma
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2, // sombra en Android
  },
  cardPressed: {
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 4,
  },
  pill: {
    borderRadius: 99,
    paddingVertical: 3,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  pillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  btn: {
    borderRadius: 99,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  sec: {
    fontSize: 11,
    fontWeight: "900",
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 11,
  },
  alertBox: {
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    gap: 9,
    alignItems: "flex-start",
    marginBottom: 7,
  },
});
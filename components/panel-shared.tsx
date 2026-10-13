import { ActivityIndicator, View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, Card, Btn, AlertBox } from "./base";

// Piezas comunes de los paneles de padre y especialista.

type HeaderProps = {
  colors: [string, string];
  title: string;
  subtitle: string;
  onLogout: () => void;
  children?: React.ReactNode;
};

export const PanelHeader = ({ colors, title, subtitle, onLogout, children }: HeaderProps) => (
  <LinearGradient colors={colors} style={styles.header}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSub}>{subtitle}</Text>
      </View>
      <Pressable onPress={onLogout} style={styles.logout}>
        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>Cerrar sesión</Text>
      </Pressable>
    </View>
    {children}
  </LinearGradient>
);

export const Loading = ({ label = "Cargando datos..." }: { label?: string }) => (
  <View style={{ alignItems: "center", paddingVertical: 28, gap: 8 }}>
    <ActivityIndicator color={C.tangerine} />
    <Text style={{ fontSize: 12, color: C.muted }}>{label}</Text>
  </View>
);

export const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <View>
    <AlertBox type="danger">{message}</AlertBox>
    <Btn small outline color={C.sea} onPress={onRetry} style={{ alignSelf: "flex-start", marginTop: 4 }}>Reintentar</Btn>
  </View>
);

export const EmptyState = ({ icon, text }: { icon: string; text: string }) => (
  <Card style={{ alignItems: "center", paddingVertical: 22 }}>
    <Text style={{ fontSize: 30, marginBottom: 6 }}>{icon}</Text>
    <Text style={{ fontSize: 12, color: C.muted, textAlign: "center", lineHeight: 18 }}>{text}</Text>
  </Card>
);

type ConfirmProps = {
  text: string;
  confirmLabel: string;
  color?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// Confirmación en línea (Alert.alert no muestra botones en la versión web).
export const ConfirmBox = ({ text, confirmLabel, color = C.sea, busy, onConfirm, onCancel }: ConfirmProps) => (
  <View style={[styles.confirm, { borderColor: color + "66", backgroundColor: color + "12" }]}>
    <Text style={{ fontSize: 12, color: C.dark, lineHeight: 18, marginBottom: 9 }}>{text}</Text>
    <View style={{ flexDirection: "row", gap: 8 }}>
      <Btn small color={color} disabled={busy} onPress={onConfirm}>{busy ? "Un momento..." : confirmLabel}</Btn>
      <Btn small outline color={C.muted} disabled={busy} onPress={onCancel}>Cancelar</Btn>
    </View>
  </View>
);

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 22, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTitle: { color: "#fff", fontWeight: "900", fontSize: 18 },
  headerSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 },
  logout: { borderRadius: 99, borderWidth: 1, borderColor: "rgba(255,255,255,0.7)", paddingVertical: 5, paddingHorizontal: 11 },
  confirm: { marginTop: 10, borderWidth: 1.5, borderRadius: 14, padding: 11 },
});

import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, Card, Btn, AlertBox, Miro, Sec } from "./base";
import { petStage, PET_STAGES, SHOP } from "./login-and-data";

export const GamificationScreen = ({ student, setStudent, onNav }: any) => {
  const stage = petStage(student.streak);
  const nextStage = PET_STAGES.find((p) => p.min > student.streak);
  const xpToNext = student.level * 150;

  const badges = [
    { ic: "🌟", n: "Primera actividad", e: student.history.length >= 1, c: C.tangerine },
    { ic: "🔥", n: "Racha de 5 días", e: student.streak >= 5, c: C.blush },
    { ic: "📚", n: "Lector dedicado", e: student.history.filter((h: any) => h.subject === "Lenguaje").length >= 2, c: C.sea },
    { ic: "🧮", n: "Maestro de sumas", e: student.performance["Matemáticas"] >= 80, c: C.matcha },
    { ic: "🎯", n: "Racha de 14 días", e: student.streak >= 14, c: C.sea },
    { ic: "🏆", n: "Explorador libre", e: student.history.some((h: any) => h.subject === "free"), c: C.blush },
  ];

  const buy = (item: any) => {
    if (student.points < item.cost || student.owned.includes(item.id)) return;
    setStudent((s: any) => ({ ...s, points: s.points - item.cost, owned: [...s.owned, item.id] }));
  };
  const equip = (id: string) =>
    setStudent((s: any) => ({
      ...s,
      equipped: s.equipped.includes(id) ? s.equipped.filter((x: string) => x !== id) : [...s.equipped, id],
    }));

  const weekDays = ["L", "M", "X", "J", "V", "S", "D"];
  const activeDays = student.streak % 7 || 7;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
      <LinearGradient colors={[C.tangerine, C.blush]} style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 12 }}>
          <Pressable onPress={() => onNav("home-student")}>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 18 }}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>🏆 Mis logros y recompensas</Text>
        </View>
        <View style={styles.levelBox}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={styles.levelLabel}>Nivel actual</Text>
              <Text style={styles.levelValue}>Nivel {student.level} 🌟</Text>
              <Text style={styles.levelSub}>{student.points} / {xpToNext} pts para el siguiente nivel</Text>
            </View>
            <Miro mood="excited" size={64} />
          </View>
          <View style={styles.levelTrack}>
            <View style={[styles.levelFill, { width: `${Math.min(100, (student.points / xpToNext) * 100)}%` }]} />
          </View>
        </View>
      </LinearGradient>

      <View style={{ padding: 14 }}>
        <Card style={{ marginBottom: 14, backgroundColor: C.butter + "55", borderColor: C.tangerine + "55" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={styles.streakIcon}><Text style={{ fontSize: 28 }}>🔥</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.streakTitle}>¡{student.streak} días seguidos!</Text>
              <Text style={styles.streakSub}>Completa una actividad hoy para que {stage.label} siga evolucionando</Text>
              <View style={{ flexDirection: "row", gap: 4, marginTop: 6 }}>
                {weekDays.map((d, i) => (
                  <View key={d} style={[styles.dayBox, { backgroundColor: i < activeDays ? C.tangerine : C.border }]}>
                    <Text style={{ fontSize: 9, color: i < activeDays ? "#fff" : C.muted, fontWeight: "800" }}>{d}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </Card>

        <Card style={{ marginBottom: 14, backgroundColor: C.sea + "10" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.petTitle}>{stage.label} {stage.e}</Text>
              <Text style={styles.petSub}>{nextStage ? `Faltan ${nextStage.min - student.streak} días de racha para evolucionar` : "¡Alcanzaste la evolución máxima!"}</Text>
            </View>
            <View style={{ flexDirection: "row" }}>
              <Text style={{ fontSize: 40 }}>{stage.e}</Text>
              {student.equipped.map((id: string) => (
                <Text key={id} style={{ fontSize: 40, marginLeft: 4 }}>{SHOP.find((i) => i.id === id)?.ic}</Text>
              ))}
            </View>
          </View>
        </Card>

        <Sec>Mis insignias</Sec>
        <View style={styles.badgeGrid}>
          {badges.map((b, i) => (
            <Card key={i} style={{ width: "31%", alignItems: "center", padding: 13, opacity: b.e ? 1 : 0.45, backgroundColor: b.e ? b.c + "12" : C.bg, borderColor: b.e ? b.c + "44" : C.border }}>
              <Text style={{ fontSize: 28, marginBottom: 4 }}>{b.ic}</Text>
              <Text style={{ fontSize: 10, fontWeight: "800", color: b.e ? b.c : C.muted, textAlign: "center", lineHeight: 13 }}>{b.n}</Text>
              {!b.e && <Text style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>🔒 Por ganar</Text>}
            </Card>
          ))}
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14, marginBottom: 10 }}>
          <Sec>Tienda de {stage.label}</Sec>
          <View style={styles.pointsBadge}>
            <Text style={{ fontSize: 12, fontWeight: "900", color: C.dark }}>⭐ {student.points} pts</Text>
          </View>
        </View>
        <View style={styles.shopGrid}>
          {SHOP.map((it, i) => {
            const owned = student.owned.includes(it.id);
            const equipped = student.equipped.includes(it.id);
            return (
              <Card key={i} style={{ width: "47%", padding: 12 }}>
                <Text style={{ fontSize: 32, textAlign: "center", marginBottom: 5 }}>{it.ic}</Text>
                <Text style={{ fontSize: 12, fontWeight: "800", textAlign: "center", marginBottom: 7 }}>{it.n}</Text>
                {!owned ? (
                  <Btn full small disabled={student.points < it.cost} color={C.tangerine} onPress={() => buy(it)}>⭐ {it.cost} pts</Btn>
                ) : (
                  <Btn full small color={equipped ? C.matcha : C.muted} outline={!equipped} onPress={() => equip(it.id)}>{equipped ? "Puesto ✓" : "Equipar"}</Btn>
                )}
              </Card>
            );
          })}
        </View>

        <View style={{ marginTop: 14 }}>
          <AlertBox type="ok">Sin comparaciones ni rankings entre compañeros — este progreso es solo tuyo. </AlertBox>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 22, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTitle: { color: "#fff", fontWeight: "900", fontSize: 16 },
  levelBox: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 16, padding: 15 },
  levelLabel: { color: "rgba(255,255,255,0.85)", fontSize: 11 },
  levelValue: { color: "#fff", fontWeight: "900", fontSize: 24 },
  levelSub: { color: "rgba(255,255,255,0.8)", fontSize: 11 },
  levelTrack: { marginTop: 9, height: 10, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 99, overflow: "hidden" },
  levelFill: { height: "100%", backgroundColor: "#fff", borderRadius: 99 },
  streakIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: C.tangerine + "22", alignItems: "center", justifyContent: "center" },
  streakTitle: { fontWeight: "900", fontSize: 15, color: C.tangerine },
  streakSub: { fontSize: 12, color: C.muted },
  dayBox: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  petTitle: { fontWeight: "900", fontSize: 13, color: C.dark, marginBottom: 3 },
  petSub: { fontSize: 12, color: C.muted },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: "3%", rowGap: 9 },
  pointsBadge: { backgroundColor: C.butter, borderRadius: 99, paddingVertical: 4, paddingHorizontal: 12 },
  shopGrid: { flexDirection: "row", flexWrap: "wrap", gap: "6%", rowGap: 9 },
});
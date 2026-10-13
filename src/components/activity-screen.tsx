import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, Card, Btn, Pill, Miro } from "./base";
import { SUBJECT_META } from "./login-and-data";

export const ActivityScreen = ({ student, setStudent, bank, addNotif, onNav, payload }: any) => {
  const subjects = Object.keys(bank);
  const initialSubject = payload?.subject && payload.subject !== "free" ? payload.subject : subjects[0];
  const [subject, setSubject] = useState(initialSubject);
  const [qIndex, setQIndex] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [hint, setHint] = useState(false);
  const [done, setDone] = useState(false);
  const [wrongStreak, setWrongStreak] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const [bigText, setBigText] = useState(false);
  const TOTAL = 5;

  const diffFor = (student.subjectStreak[subject] || 0) >= 2 ? "Difícil" : "Fácil";
  const pool = bank[subject].filter((e: any) => e.diff === diffFor);
  const ex = pool[qIndex % pool.length] || bank[subject][0];

  const checkAnswer = () => {
    if (sel === null) return;
    const ok = sel === ex.answer;
    setDone(true);
    setStudent((s: any) => {
      const perf = { ...s.performance, [subject]: Math.max(0, Math.min(100, s.performance[subject] + (ok ? 4 : -2))) };
      const subjectStreak = { ...s.subjectStreak, [subject]: ok ? (s.subjectStreak[subject] || 0) + 1 : 0 };
      return { ...s, performance: perf, subjectStreak, points: s.points + (ok ? 10 : 3) };
    });
    if (ok) { setSessionCorrect((c) => c + 1); setWrongStreak(0); }
    else { setWrongStreak((w) => w + 1); }
  };

  const next = () => {
    if (qIndex + 1 >= TOTAL) {
      setFinished(true);
      const timeSpent = `${TOTAL * 2} min`;
      setStudent((s: any) => {
        const already = s.dailyDoneOn === "hoy";
        return {
          ...s,
          streak: already ? s.streak : s.streak + 1,
          dailyDoneOn: "hoy",
          history: [...s.history, { icon: (SUBJECT_META as any)[subject]?.icon || "📘", name: `${subject} · sesión`, time: timeSpent, date: "Hoy", ok: sessionCorrect >= TOTAL / 2, subject }],
        };
      });
      addNotif(`${student.name} completó una actividad de ${subject} (${sessionCorrect}/${TOTAL} correctas)`, sessionCorrect >= TOTAL / 2 ? "ok" : "info");
    } else {
      setQIndex((i) => i + 1); setSel(null); setDone(false); setHint(false);
    }
  };

  if (wrongStreak >= 2 && !finished) {
    return (
      <View style={{ flex: 1, padding: 20 }}>
        <Card style={{ alignItems: "center", backgroundColor: C.butter + "33", borderColor: C.tangerine + "55" }}>
          <Miro mood="worried" size={64} />
          <Text style={styles.pauseTitle}>Note que esto se puso difícil </Text>
          <Text style={styles.pauseSub}>¿Quieres tomar un respiro antes de seguir? Está bien pausar un momento.</Text>
          <View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}>
            <Btn
              color={C.sea}
              small
              onPress={() => {
                setStudent((s: any) => ({ ...s, emotion: "Frustrado", emotionLog: [...s.emotionLog, { day: `Día ${s.emotionLog.length + 1}`, label: "Frustrado (detectado)" }] }));
                addNotif(`Posible frustración detectada en ${student.name} durante ${subject}`, "warn");
                onNav("emotions", { autoOpen: "breathing" });
              }}
            >Sí, respiremos </Btn>
            <Btn color={C.matcha} small onPress={() => setWrongStreak(0)}>Seguir intentando </Btn>
          </View>
        </Card>
      </View>
    );
  }

  if (finished) {
    return (
      <View style={{ flex: 1, padding: 20 }}>
        <Card style={{ alignItems: "center" }}>
          <Miro mood={sessionCorrect >= TOTAL / 2 ? "cheer" : "calm"} size={70} />
          <Text style={styles.finishedTitle}>¡Actividad completada! </Text>
          <Text style={styles.finishedSub}>Respondiste correctamente {sessionCorrect} de {TOTAL} preguntas de {subject}</Text>
          <Btn full color={C.tangerine} onPress={() => onNav("reward")}>Ir a mi recompensa diaria 🎁</Btn>
          <View style={{ marginTop: 8, width: "100%" }}>
            <Btn full outline color={C.sea} onPress={() => onNav("home-student")}>Volver al inicio</Btn>
          </View>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
      <LinearGradient colors={[(SUBJECT_META as any)[subject]?.color || C.sea, "#4a7fb5"]} style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 11 }}>
          <Pressable onPress={() => onNav("home-student")}>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 18 }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 11 }}>{(SUBJECT_META as any)[subject]?.icon} {subject} · Nivel {diffFor}</Text>
            <Text style={styles.headerQ}>{ex.q}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {subjects.map((s) => (
            <Pressable
              key={s}
              onPress={() => { setSubject(s); setQIndex(0); setSel(null); setDone(false); }}
              style={[styles.subjectTab, { backgroundColor: s === subject ? "#fff" : "rgba(255,255,255,0.25)" }]}
            >
              <Text style={{ fontSize: 10, fontWeight: "800", color: s === subject ? (SUBJECT_META as any)[s].color : "#fff" }}>{s}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>{qIndex + 1} / {TOTAL}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((qIndex + 1) / TOTAL) * 100}%` }]} />
          </View>
        </View>
      </LinearGradient>

      <View style={{ padding: 14 }}>
        <Card style={{ marginBottom: 13 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
            <Pill color={C.sea}>Texto de apoyo</Pill>
            <Pressable onPress={() => setBigText((b) => !b)} style={styles.bigTextBtn}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: C.dark }}>Aa {bigText ? "−" : "+"}</Text>
            </Pressable>
          </View>
          <View style={styles.supportBox}>
            <Text style={{ fontSize: bigText ? 17 : 14, lineHeight: bigText ? 26 : 22, color: C.dark }}>{ex.text}</Text>
          </View>
        </Card>

        <Card style={{ marginBottom: 13 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 13 }}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: C.dark, flex: 1 }}>❓ {ex.q}</Text>
            <Pressable onPress={() => setHint(!hint)} style={styles.hintBtn}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: C.dark }}>💡 Pista</Text>
            </Pressable>
          </View>
          {hint && (
            <View style={styles.hintBox}>
              <Miro mood="thinking" size={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: C.tangerine }}>Miro dice:</Text>
                <Text style={{ fontSize: 12, color: C.dark, marginTop: 2, lineHeight: 18 }}>Lee con calma el texto de arriba, ahí está la respuesta 🌟</Text>
              </View>
            </View>
          )}
          <View style={{ gap: 7 }}>
            {ex.opts.map((o: string, i: number) => {
              let bg = C.bg, bd = C.border, ic: string | null = null;
              if (done && sel === i) { bg = i === ex.answer ? C.matcha + "18" : C.blush + "18"; bd = i === ex.answer ? C.matcha : C.blush; ic = i === ex.answer ? "✅" : "❌"; }
              else if (done && i === ex.answer) { bg = C.matcha + "10"; bd = C.matcha + "88"; }
              const selectedNotDone = sel === i && !done;
              return (
                <Pressable
                  key={i}
                  onPress={() => { if (!done) setSel(i); }}
                  style={[styles.option, { borderColor: selectedNotDone ? C.sea : bd, backgroundColor: selectedNotDone ? C.sea + "14" : bg }]}
                >
                  <View style={[styles.optionCircle, { backgroundColor: selectedNotDone ? C.sea : "#E2E8F0" }]}>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: selectedNotDone ? "#fff" : C.muted }}>{ic || String.fromCharCode(65 + i)}</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: C.dark, flex: 1 }}>{o}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {done && (
          <Card style={{ backgroundColor: (sel === ex.answer ? C.matcha : C.tangerine) + "14", borderColor: (sel === ex.answer ? C.matcha : C.tangerine) + "44", marginBottom: 13 }}>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <Miro mood={sel === ex.answer ? "cheer" : "calm"} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "900", color: sel === ex.answer ? C.matcha : C.tangerine, marginBottom: 4 }}>
                  {sel === ex.answer ? "¡Excelente! 🎉" : "¡Casi! Tú puedes 💪"}
                </Text>
                <Text style={{ fontSize: 12, color: C.dark, lineHeight: 18 }}>
                  {sel === ex.answer ? "¡Correcto! Sigues aprendiendo muy bien." : `La respuesta era "${ex.opts[ex.answer]}". ${ex.text}`}
                </Text>
              </View>
            </View>
            <View style={{ marginTop: 11 }}>
              <Btn full color={sel === ex.answer ? C.matcha : C.tangerine} onPress={next}>
                {qIndex + 1 >= TOTAL ? "Ver resultado final →" : "Siguiente pregunta →"}
              </Btn>
            </View>
          </Card>
        )}
        {!done && <Btn full color={sel !== null ? C.sea : C.muted} disabled={sel === null} onPress={checkAnswer}>Verificar respuesta ✓</Btn>}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingTop: 15, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerQ: { color: "#fff", fontWeight: "900", fontSize: 15 },
  subjectTab: { fontSize: 10, fontWeight: "800", paddingVertical: 3, paddingHorizontal: 9, borderRadius: 99 },
  progressTrack: { flex: 1, height: 8, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 99, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#fff", borderRadius: 99 },
  bigTextBtn: { backgroundColor: C.butter + "55", borderRadius: 99, paddingVertical: 4, paddingHorizontal: 10 },
  supportBox: { backgroundColor: C.butter + "55", borderRadius: 12, padding: 13, borderLeftWidth: 4, borderLeftColor: C.tangerine },
  hintBtn: { backgroundColor: C.butter, borderRadius: 99, paddingVertical: 5, paddingHorizontal: 11, marginLeft: 8 },
  hintBox: { backgroundColor: C.butter + "55", borderWidth: 1.5, borderColor: C.tangerine + "88", borderRadius: 11, padding: 12, marginBottom: 11, flexDirection: "row", gap: 9, alignItems: "flex-start" },
  option: { paddingVertical: 11, paddingHorizontal: 13, borderRadius: 12, borderWidth: 2, flexDirection: "row", alignItems: "center", gap: 10 },
  optionCircle: { width: 27, height: 27, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  pauseTitle: { fontSize: 14, fontWeight: "900", color: C.dark, marginTop: 12, marginBottom: 6 },
  pauseSub: { fontSize: 12, color: C.muted, marginBottom: 14, textAlign: "center" },
  finishedTitle: { fontSize: 16, fontWeight: "900", color: C.dark, marginTop: 12, marginBottom: 4 },
  finishedSub: { fontSize: 13, color: C.muted, marginBottom: 14, textAlign: "center" },
});
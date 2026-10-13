import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, Card, Pill, Btn, Bar, Sec, Miro } from "./base";
import { SUBJECT_META, petStage } from "./login-and-data";



const AssistantMsg = ({ mood, text }: { mood: any; text: string }) => (
  <Card style={{ marginBottom: 13, backgroundColor: C.butter + "33", borderColor: C.tangerine + "44" }}>
    <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
      <Miro mood={mood} size={46} />
      <Text style={{ fontSize: 12, color: C.dark, lineHeight: 18, flex: 1 }}>{text}</Text>
    </View>
  </Card>
);

export const HomeStudent = ({ student, setStudent, addNotif, onNav }: any) => {
  const negative = ["Triste", "Frustrado", "Ansioso", "Cansado"].includes(student.emotion);
  const stage = petStage(student.streak);

  const selectEmotion = (label: string) => {
    setStudent((s: any) => ({
      ...s,
      emotion: label,
      emotionLog: [...s.emotionLog, { day: `Día ${s.emotionLog.length + 1}`, label }],
    }));
    if (label === "Frustrado" || label === "Ansioso") {
      addNotif(`${student.name} reportó sentirse ${label.toLowerCase()}`, "warn");
    }
  };

  const worstSubject = Object.entries(student.performance).sort((a: any, b: any) => a[1] - b[1])[0][0] as string;

  const recs = negative
    ? [
        { icon: "🫁", title: "Respiración guiada", sub: "Regulación emocional", color: C.sea, xp: 10, time: "2 min", diff: "Calma", act: () => onNav("emotions", { autoOpen: "breathing" }) },
        { icon: "📖", title: "Cuento: El dragón valiente", sub: "Regulación emocional", color: C.blush, xp: 10, time: "3 min", diff: "Calma", act: () => onNav("emotions", { autoOpen: "story" }) },
        { icon: (SUBJECT_META as any)[worstSubject].icon, title: `Practicar ${worstSubject} (con calma)`, sub: "Motor adaptativo", color: C.matcha, xp: 15, time: "4 min", diff: "Fácil", act: () => onNav("activity", { subject: worstSubject }) },
      ]
    : Object.entries(student.performance).sort((a: any, b: any) => a[1] - b[1]).map(([subj, val]: any) => ({
        icon: (SUBJECT_META as any)[subj].icon,
        title: subj,
        sub: `Progreso ${val}%`,
        color: (SUBJECT_META as any)[subj].color,
        xp: 20,
        time: "4 min",
        diff: (student.subjectStreak[subj] || 0) >= 2 ? "Difícil" : "Fácil",
        act: () => onNav("activity", { subject: subj }),
      }));

  const assistantText = student.assignment
    ? `Tu profesora te asignó: ${student.assignment}. ¡Vamos a intentarlo!`
    : negative
    ? "Vi que te sientes así. Antes de seguir aprendiendo, probemos calmarnos un poco 💛"
    : student.emotion
    ? "¡Qué bueno que me contaste cómo te sientes! Sigamos aprendiendo juntos 🌟"
    : "Cuéntame cómo te sientes hoy para elegir las mejores actividades para ti.";

  const emotionOptions: [string, string, string][] = [
    ["😄", "Feliz", C.matcha], ["😐", "Normal", C.sea], ["😔", "Triste", C.blush],
    ["😤", "Frustrado", C.tangerine], ["😴", "Cansado", C.muted],
  ];

  const quickAccess = [
    { icon: "🏆", label: "Mis logros", color: C.tangerine, to: "gamification" },
    { icon: "💛", label: "Emociones", color: C.blush, to: "emotions" },
    { icon: "📊", label: `Nivel: ${stage.label}`, color: C.sea, to: "gamification" },
  ];

  return (
    
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
      

        
      <LinearGradient colors={[C.tangerine, C.blush]} style={styles.header}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View>
            <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>¡Hola! </Text>
            <Text style={styles.headerName}>{student.name} {student.avatarEmoji}</Text>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {[[`⭐ ${student.points} pts`, C.butter], [`🔥 ${student.streak} días`, C.sea], [`Nivel ${student.level}`, C.matcha]].map(([l, c]) => (
                <View key={l} style={[styles.headerBadge, { backgroundColor: c + "44", borderColor: c + "88" }]}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{l}</Text>
                </View>
              ))}
            </View>
          </View>
          <Miro mood={negative ? "calm" : student.emotion ? "happy" : "thinking"} size={66} />
        </View>
      </LinearGradient>

      <View style={{ paddingHorizontal: 14, marginTop: -28 }}>
        <Card style={{ marginBottom: 14 }}>
          <Text style={styles.cardTitle}>¿Cómo te sientes hoy? 💭</Text>
          <View style={{ flexDirection: "row", gap: 5, justifyContent: "space-between" }}>
            {emotionOptions.map(([em, lb, co]) => (
              <Pressable
                key={lb}
                onPress={() => selectEmotion(lb)}
                style={[
                  styles.emotionTile,
                  { backgroundColor: student.emotion === lb ? co + "22" : C.bg, borderColor: student.emotion === lb ? co : C.border },
                ]}
              >
                <Text style={{ fontSize: 22 }}>{em}</Text>
                <Text style={{ fontSize: 9, color: student.emotion === lb ? co : C.muted, fontWeight: "700" }}>{lb}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {student.emotion && <AssistantMsg mood={negative ? "worried" : "happy"} text={assistantText} />}

        <Card style={{ marginBottom: 14 }}>
          <Sec>Mi progreso esta semana</Sec>
          {Object.entries(student.performance).map(([subj, val]: any) => (
            <Bar key={subj} val={val} color={(SUBJECT_META as any)[subj].color} label={subj} />
          ))}
          <View style={styles.totalBadge}>
            <Text>🎯</Text>
            <Text style={{ fontSize: 12, color: C.matcha, fontWeight: "800" }}>{student.history.length} actividades completadas en total</Text>
          </View>
        </Card>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Sec>{negative ? "Recomendado para calmarte" : "Recomendadas para ti"}</Sec>
          <Pill color={C.blush}> Por Miro</Pill>
        </View>
        <View style={{ gap: 9, marginBottom: 14 }}>
          {recs.map((a: any, i: number) => (
            <Card key={i} onPress={a.act} style={{ paddingVertical: 11, paddingHorizontal: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                <View style={[styles.recIcon, { backgroundColor: a.color + "22" }]}>
                  <Text style={{ fontSize: 24 }}>{a.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "800", fontSize: 13, color: C.dark }}>{a.title}</Text>
                  <Text style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{a.sub} · {a.time}</Text>
                  <Pill color={a.color}>{a.diff}</Pill>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: a.color }}>+{a.xp} XP</Text>
                  <View style={[styles.playBtn, { backgroundColor: a.color + "22" }]}>
                    <Text style={{ fontSize: 14 }}>▶</Text>
                  </View>
                </View>
              </View>
            </Card>
          ))}
        </View>

        <Card onPress={() => onNav("activity", { subject: "free" })} style={{ backgroundColor: C.sea + "10", borderColor: C.sea + "33", marginBottom: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ fontSize: 36 }}>🗺️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "900", fontSize: 14, color: C.dark }}>Exploración libre</Text>
              <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Elige tú mismo cualquier materia para practicar</Text>
            </View>
            <Btn color={C.sea} small onPress={() => onNav("activity", { subject: "free" })}>Explorar</Btn>
          </View>
        </Card>

        <Sec>Accesos rápidos</Sec>
        <View style={{ flexDirection: "row", gap: 9 }}>
          {quickAccess.map((q) => (
            <Card key={q.label} onPress={() => onNav(q.to, null)} style={{ flex: 1, padding: 11, alignItems: "center", backgroundColor: q.color + "14", borderColor: q.color + "33" }}>
              <Text style={{ fontSize: 26, marginBottom: 3 }}>{q.icon}</Text>
              <Text style={{ fontSize: 10, fontWeight: "800", color: C.dark, textAlign: "center" }}>{q.label}</Text>
            </Card>
          ))}
        </View>
      </View>
    </ScrollView>
    
  );
};

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 50, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  headerName: { fontSize: 22, fontWeight: "900", color: "#fff", marginBottom: 8 },
  headerBadge: { borderRadius: 99, paddingVertical: 3, paddingHorizontal: 10, borderWidth: 1 },
  cardTitle: { fontSize: 13, fontWeight: "900", color: C.dark, marginBottom: 9 },
  emotionTile: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 7, paddingHorizontal: 3, borderRadius: 12, borderWidth: 1.5 },
  totalBadge: { marginTop: 8, backgroundColor: C.matcha + "18", borderRadius: 10, paddingVertical: 7, paddingHorizontal: 11, flexDirection: "row", gap: 7, alignItems: "center" },
  recIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  playBtn: { marginTop: 4, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Slider from "@react-native-community/slider";
import * as Speech from "expo-speech";
import { C, Card, Btn } from "./base";
import { STORY } from "./login-and-data";

// ─── MINIJUEGO: RESPIRACIÓN ─────────────────────────────────────────────
const BreathingWidget = () => {
  const [phase, setPhase] = useState("Inhala");
  const [running, setRunning] = useState(false);
  const timerRef = useRef<any>(null);

  const start = () => {
    setRunning(true);
    const phases = ["Inhala", "Sostén", "Exhala"];
    let i = 0;
    setPhase(phases[0]);
    timerRef.current = setInterval(() => { i = (i + 1) % phases.length; setPhase(phases[i]); }, 3000);
  };
  const stop = () => { setRunning(false); clearInterval(timerRef.current); setPhase("Inhala"); };
  useEffect(() => () => clearInterval(timerRef.current), []);

  const size = phase === "Exhala" ? 90 : 170;

  return (
    <Card style={{ alignItems: "center" }}>
      <Text style={styles.widgetTitle}>🫁 Respiración guiada</Text>
      <View style={[styles.breathCircle, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={{ fontWeight: "900", color: C.sea, fontSize: 13 }}>{running ? phase : "🌬️"}</Text>
      </View>
      <View style={{ marginTop: 14 }}>
        {!running ? <Btn color={C.sea} onPress={start}>Comenzar</Btn> : <Btn color={C.muted} onPress={stop}>Detener</Btn>}
      </View>
    </Card>
  );
};

// ─── MINIJUEGO: CUENTO ───────────────────────────────────────────────────
const StoryWidget = () => {
  const [speaking, setSpeaking] = useState(false);
  const read = () => {
    Speech.stop();
    setSpeaking(true);
    Speech.speak(STORY.text, { language: "es-ES", rate: 0.92, onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false) });
  };
  const stop = () => { Speech.stop(); setSpeaking(false); };
  return (
    <Card>
      <Text style={[styles.widgetTitle, { color: C.blush }]}>📖 {STORY.title}</Text>
      <Text style={{ fontSize: 12, color: C.dark, lineHeight: 20, marginBottom: 10 }}>{STORY.text}</Text>
      <Btn color={C.blush} small onPress={speaking ? stop : read}>{speaking ? "⏸ Detener lectura" : "🔊 Leer en voz alta"}</Btn>
    </Card>
  );
};

// ─── MINIJUEGO: DIBUJO ────────────────────────────────────────────────────
const DrawWidget = () => {
  const [strokes, setStrokes] = useState<{ x: number; y: number; c: string }[]>([]);
  const colors = [C.blush, C.sea, C.tangerine, C.matcha, C.dark];
  const [color, setColor] = useState(colors[0]);

  return (
    <Card>
      <Text style={[styles.widgetTitle, { color: C.tangerine }]}>🎨 Dibuja cómo te sientes</Text>
      <Pressable
        onPress={(e) => {
          const { locationX, locationY } = e.nativeEvent;
          setStrokes((s) => [...s, { x: locationX, y: locationY, c: color }]);
        }}
        style={styles.canvas}
      >
        {strokes.map((s, i) => (
          <View key={i} style={[styles.dot, { left: s.x - 6, top: s.y - 6, backgroundColor: s.c }]} />
        ))}
        {strokes.length === 0 && <Text style={styles.canvasHint}>Toca aquí para dibujar puntos de color</Text>}
      </Pressable>
      <View style={{ flexDirection: "row", gap: 6, marginTop: 9, alignItems: "center" }}>
        {colors.map((c) => (
          <Pressable key={c} onPress={() => setColor(c)} style={[styles.colorDot, { backgroundColor: c, borderColor: color === c ? C.dark : "transparent" }]} />
        ))}
        <View style={{ marginLeft: "auto" }}>
          <Btn small outline color={C.muted} onPress={() => setStrokes([])}>Borrar</Btn>
        </View>
      </View>
    </Card>
  );
};

// ─── PANTALLA PRINCIPAL DE EMOCIONES ─────────────────────────────────────
export const EmotionsScreen = ({ student, setStudent, addNotif, onNav, payload }: any) => {
  const [sel, setSel] = useState<number | null>(null);
  const [intensity, setIntensity] = useState(3);
  const [note, setNote] = useState("");
  const [openWidget, setOpenWidget] = useState<string | null>(payload?.autoOpen || null);
  const [saved, setSaved] = useState(false);

  const emotions: [string, string, string][] = [
    ["😄", "Muy feliz", C.matcha], ["🙂", "Bien", C.sea], ["😐", "Normal", C.muted],
    ["😔", "Triste", C.blush], ["😤", "Frustrado", C.tangerine], ["😰", "Ansioso", C.blush],
    ["😴", "Cansado", C.sea], ["🤩", "Emocionado", C.tangerine],
  ];
  const positivo = sel !== null && [0, 1, 7].includes(sel);
  const recs = positivo
    ? [
        { ic: "🎮", t: "Actividad desafío", c: C.matcha, tm: "5 min", open: null },
        { ic: "🏆", t: "Reto del día", c: C.tangerine, tm: "4 min", open: null },
        { ic: "📚", t: "Lectura especial", c: C.sea, tm: "6 min", open: "story" },
      ]
    : [
        { ic: "🫁", t: "Respiración guiada", c: C.sea, tm: "2 min", open: "breathing" },
        { ic: "📖", t: "Cuento calmante", c: C.blush, tm: "3 min", open: "story" },
        { ic: "🎨", t: "Dibujar mis emociones", c: C.tangerine, tm: "3 min", open: "draw" },
      ];

  const save = () => {
    if (sel === null) return;
    const label = emotions[sel][1];
    setStudent((s: any) => ({
      ...s,
      emotion: label,
      emotionLog: [...s.emotionLog, { day: `Día ${s.emotionLog.length + 1}`, label, intensity, note }],
    }));
    if (label === "Frustrado" || label === "Ansioso") {
      addNotif(`${student.name} registró ${label.toLowerCase()} (intensidad ${intensity}/5)`, "warn");
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
      <LinearGradient colors={[C.blush, "#c0466a"]} style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <Pressable onPress={() => onNav("home-student")}>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 18 }}>←</Text>
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>💛 ¿Cómo te sientes hoy?</Text>
            <Text style={styles.headerSub}>Este es tu espacio seguro 🌈</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={{ padding: 14 }}>
        {!openWidget ? (
          <>
            <View style={styles.emotionGrid}>
              {emotions.map(([em, lb, co], i) => (
                <Pressable
                  key={i}
                  onPress={() => setSel(sel === i ? null : i)}
                  style={[styles.emotionTile, { backgroundColor: sel === i ? co + "22" : C.bg, borderColor: sel === i ? co : C.border }]}
                >
                  <Text style={{ fontSize: 28, marginBottom: 3 }}>{em}</Text>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: sel === i ? co : C.muted, textAlign: "center" }}>{lb}</Text>
                </Pressable>
              ))}
            </View>

            {sel !== null ? (
              <>
                <Card style={{ marginBottom: 12 }}>
                  <Text style={styles.sliderLabel}>¿Qué tan intenso es?</Text>
                  <Slider
                    minimumValue={1}
                    maximumValue={5}
                    step={1}
                    value={intensity}
                    onValueChange={setIntensity}
                    minimumTrackTintColor={emotions[sel][2]}
                    maximumTrackTintColor={C.border}
                    thumbTintColor={emotions[sel][2]}
                  />
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={styles.sliderEnd}>Un poco</Text>
                    <Text style={styles.sliderEnd}>Muchísimo</Text>
                  </View>
                </Card>

                <Card style={{ marginBottom: 12 }}>
                  <Text style={styles.sliderLabel}>Cuéntame más (opcional) 💬</Text>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Escribe cómo te sientes hoy..."
                    placeholderTextColor={C.muted}
                    multiline
                    style={styles.noteInput}
                  />
                </Card>

                <Text style={styles.sectionLabel}>Actividades recomendadas para ti ahora</Text>
                <View style={{ gap: 8, marginBottom: 13 }}>
                  {recs.map((r, i) => (
                    <Card key={i} style={{ paddingVertical: 10, paddingHorizontal: 13 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                        <View style={[styles.recIcon, { backgroundColor: r.c + "22" }]}>
                          <Text style={{ fontSize: 22 }}>{r.ic}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: "800", fontSize: 13, color: C.dark }}>{r.t}</Text>
                          <Text style={{ fontSize: 11, color: C.muted }}>{r.tm}</Text>
                        </View>
                        <Btn color={r.c} small onPress={() => (r.open ? setOpenWidget(r.open) : onNav("activity", { subject: "free" }))}>Iniciar</Btn>
                      </View>
                    </Card>
                  ))}
                </View>

                <Btn full color={C.blush} onPress={save}>💾 Guardar cómo me siento hoy</Btn>
                {saved && <Text style={styles.savedMsg}>¡Guardado! Gracias por contarme 💛</Text>}
              </>
            ) : (
              <Card style={{ alignItems: "center", padding: 22, backgroundColor: C.butter + "44", borderColor: C.tangerine + "33" }}>
                <Text style={{ fontSize: 38, marginBottom: 7 }}>👆</Text>
                <Text style={{ fontSize: 13, color: C.muted, textAlign: "center" }}>Toca la emoción que mejor describe cómo te sientes</Text>
              </Card>
            )}
          </>
        ) : (
          <>
            <Pressable onPress={() => setOpenWidget(null)}>
              <Text style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>← Volver</Text>
            </Pressable>
            {openWidget === "breathing" && <BreathingWidget />}
            {openWidget === "story" && <StoryWidget />}
            {openWidget === "draw" && <DrawWidget />}
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingTop: 15, paddingBottom: 22, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  headerTitle: { color: "#fff", fontWeight: "900", fontSize: 16 },
  headerSub: { color: "rgba(255,255,255,0.8)", fontSize: 11 },
  emotionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 14 },
  emotionTile: { width: "22%", borderWidth: 2.5, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 4, alignItems: "center" },
  sliderLabel: { fontSize: 13, fontWeight: "800", marginBottom: 9 },
  sliderEnd: { fontSize: 11, color: C.muted, marginTop: 3 },
  noteInput: { minHeight: 58, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, padding: 9, fontSize: 13, color: C.dark, backgroundColor: C.bg, marginTop: 4, textAlignVertical: "top" },
  sectionLabel: { fontSize: 11, fontWeight: "900", color: C.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 11 },
  recIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  savedMsg: { marginTop: 8, textAlign: "center", fontSize: 12, fontWeight: "800", color: C.matcha },
  widgetTitle: { fontSize: 13, fontWeight: "900", color: C.sea, marginBottom: 10 },
  breathCircle: { alignItems: "center", justifyContent: "center", backgroundColor: C.sea + "33", borderWidth: 3, borderColor: C.sea },
  canvas: { backgroundColor: C.bg, borderWidth: 2, borderColor: C.border, borderStyle: "dashed", borderRadius: 14, height: 140, position: "relative", overflow: "hidden" },
  canvasHint: { position: "absolute", top: "45%", width: "100%", textAlign: "center", fontSize: 11, color: C.muted },
  dot: { position: "absolute", width: 12, height: 12, borderRadius: 6 },
  colorDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
});
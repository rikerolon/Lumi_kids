import { useState, useRef } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from "react-native";
import { C } from "./base";

// Ajusta esta ruta si mueves el archivo de carpeta — es relativa
// desde src/components hacia la raíz del proyecto (lumi/assets/...).
//const LOGO = require("../../assets/images/tabicons/logo.png");

type ChatMsg = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT =
  "Eres Miro, la mascota zorro asistente de Nubi Learn, una plataforma educativa para niños de kínder y primaria. " +
  "Responde siempre en español, en oraciones cortas, con tono cálido, positivo y sencillo, adecuado para niños. " +
  "Usa emojis con moderación. Si te preguntan sobre matemáticas, lenguaje o vocabulario, explica paso a paso y con paciencia.";

export const ChatbotWidget = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "¡Hola! Soy Miro 🦊 ¿En qué te puedo ayudar hoy?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const updated: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...updated.map((m) => ({ role: m.role, content: m.content })),
          ],
          max_tokens: 300,
        }),
      });
      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content || "No pude responder ahora, ¿probamos de nuevo? 💛";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Hubo un problema de conexión, intenta de nuevo 🌈" }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.fab}>
        {open ? <Text style={{ fontSize: 26, color: "#fff" }}>✕</Text> : <Text style={{ fontSize: 26 }}>🦊</Text>}
      </Pressable>

      {open && (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            {open ? <Text style={{ fontSize: 26, color: "#fff" }}>✕</Text> : <Text style={{ fontSize: 26 }}>🦊</Text>}
            <Text style={styles.panelHeaderText}>Miro · Tu asistente</Text>
          </View>

          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((m, i) => (
              <View
                key={i}
                style={[
                  styles.bubble,
                  m.role === "user"
                    ? { alignSelf: "flex-end", backgroundColor: C.sea + "22" }
                    : { alignSelf: "flex-start", backgroundColor: C.butter + "55" },
                ]}
              >
                <Text style={{ fontSize: 12, color: C.dark }}>{m.content}</Text>
              </View>
            ))}
            {loading && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <ActivityIndicator size="small" color={C.blush} />
                <Text style={{ fontSize: 11, color: C.muted }}>Miro está pensando...</Text>
              </View>
            )}
          </ScrollView>

          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.inputRow}>
              <TextInput
                value={input}
                onChangeText={setInput}
                onSubmitEditing={send}
                placeholder="Escribe tu pregunta..."
                placeholderTextColor={C.muted}
                style={styles.input}
              />
              <Pressable onPress={send} disabled={loading} style={styles.sendBtn}>
                <Text style={{ color: "#fff", fontSize: 14 }}>➤</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: "absolute", bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.blush, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8,
    zIndex: 1000,
  },
  panel: {
    position: "absolute", bottom: 86, right: 20, width: 320, maxWidth: "90%", height: 420,
    backgroundColor: C.white, borderRadius: 20, overflow: "hidden",
    borderWidth: 1.5, borderColor: C.border, zIndex: 1000,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10,
  },
  panelHeader: { backgroundColor: C.tangerine, paddingVertical: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  panelHeaderText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  fabLogo: { width: 32, height: 32 },
  headerLogo: { width: 20, height: 20 },
  bubble: { borderRadius: 12, paddingVertical: 7, paddingHorizontal: 11, maxWidth: "85%" },
  inputRow: { flexDirection: "row", gap: 6, padding: 10, borderTopWidth: 1.5, borderTopColor: C.border },
  input: { flex: 1, paddingVertical: 8, paddingHorizontal: 11, borderRadius: 99, borderWidth: 1.5, borderColor: C.border, fontSize: 12, color: C.dark },
  sendBtn: { backgroundColor: C.blush, borderRadius: 17, width: 34, height: 34, alignItems: "center", justifyContent: "center" },
});
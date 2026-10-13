import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Image } from "react-native";
import { supabase } from "../lib/supabaseClient";
import { C, Card, Btn, Pill } from "./base";
import { Account, NubiError, bootstrapAccount, signOut } from "../lib/nubi-api";

// ─── DATOS COMPARTIDOS ────────────────────────────────────────────────────
export const SUBJECT_META = {
  "Lenguaje":    { icon: "📖", color: C.blush },
  "Matemáticas": { icon: "🔢", color: C.sea },
  "Vocabulario": { icon: "🧩", color: C.matcha },
};

export const INITIAL_BANK = {
  "Lenguaje": [
    { id: "len1", diff: "Fácil",   q: "¿Qué necesitan las plantas para crecer?", opts: ["El sol solo", "El agua y la luz", "Solo la lluvia", "Solo la tierra"], answer: 1, text: "Las plantas necesitan agua y luz solar para crecer y vivir. Sin estos elementos no pueden hacer la fotosíntesis y se marchitan. ☀️🌱" },
    { id: "len2", diff: "Fácil",   q: "¿Cuál palabra rima con 'gato'?", opts: ["Perro", "Pato", "Sol", "Luna"], answer: 1, text: "Las palabras que riman terminan con un sonido parecido, como gato y pato." },
    { id: "len3", diff: "Difícil", q: "¿Cuál es el sujeto en 'El perro corre rápido'?", opts: ["El perro", "Corre", "Rápido", "Ninguno"], answer: 0, text: "El sujeto es quien realiza la acción de la oración." },
  ],
  "Matemáticas": [
    { id: "mat1", diff: "Fácil",   q: "¿Cuánto es 3 + 4?", opts: ["5", "6", "7", "8"], answer: 2, text: "Suma paso a paso: 3 + 4 = 7." },
    { id: "mat2", diff: "Fácil",   q: "¿Cuánto es 12 - 5?", opts: ["6", "7", "8", "9"], answer: 1, text: "Resta paso a paso: 12 - 5 = 7." },
    { id: "mat3", diff: "Difícil", q: "¿Cuánto es 6 x 7?", opts: ["36", "42", "48", "40"], answer: 1, text: "La tabla del 6: 6 x 7 = 42." },
  ],
  "Vocabulario": [
    { id: "voc1", diff: "Fácil",   q: "Elige el sinónimo de 'feliz'", opts: ["Triste", "Contento", "Enojado", "Cansado"], answer: 1, text: "Un sinónimo es una palabra que significa lo mismo." },
    { id: "voc2", diff: "Fácil",   q: "¿Cuál es el antónimo de 'grande'?", opts: ["Enorme", "Gigante", "Pequeño", "Alto"], answer: 2, text: "Un antónimo es una palabra de significado opuesto." },
    { id: "voc3", diff: "Difícil", q: "¿Qué significa 'perseverar'?", opts: ["Rendirse", "Continuar con esfuerzo", "Descansar", "Olvidar"], answer: 1, text: "Perseverar significa seguir intentando a pesar de las dificultades." },
  ],
};

export const STORY = {
  title: "El dragón que tenía miedo de volar",
  text: "Había una vez un pequeño dragón llamado Fito que tenía miedo de volar muy alto. Un día una mariposa le dijo: no tienes que volar rápido, solo respira despacio y confía en tus alas. Fito respiró profundo, contó hasta cuatro, y descubrió que el miedo se hace más pequeño cuando lo miramos con calma.",
};

export const SHOP = [
  { id: "hat", ic: "🎩", n: "Sombrero mágico", cost: 50 },
  { id: "rainbow", ic: "🌈", n: "Fondo arcoíris", cost: 80 },
  { id: "cape", ic: "⚡", n: "Capa de héroe", cost: 120 },
  { id: "horn", ic: "🦄", n: "Cuerno unicornio", cost: 200 },
];

export const PET_STAGES = [
  { min: 0, label: "Cachorro", e: "🦊" }, { min: 3, label: "Explorador", e: "🦊✨" },
  { min: 7, label: "Aventurero", e: "🦸" }, { min: 14, label: "Héroe", e: "🦸‍♂️" },
  { min: 30, label: "Leyenda", e: "🐉" },
];
export const petStage = (streak: number) => {
  let s = PET_STAGES[0];
  for (const p of PET_STAGES) if (streak >= p.min) s = p;
  return s;
};

export const ROSTER = [
  { id: 1, n: "Lucas P.",   em: "🐶", c: C.sea,    perf: { Lenguaje: 40, Matemáticas: 45, Vocabulario: 38 }, emotions: ["Frustrado", "Triste", "Frustrado"], time: "5 min" },
  { id: 2, n: "María G.",   em: "🐱", c: C.blush,  perf: { Lenguaje: 70, Matemáticas: 60, Vocabulario: 65 }, emotions: ["Normal", "Bien", "Muy feliz"],       time: "18 min" },
  { id: 3, n: "Carlos R.",  em: "🐸", c: C.matcha, perf: { Lenguaje: 90, Matemáticas: 85, Vocabulario: 88 }, emotions: ["Muy feliz", "Muy feliz", "Bien"],     time: "31 min" },
  { id: 4, n: "Valeria S.", em: "🦋", c: C.blush,  perf: { Lenguaje: 35, Matemáticas: 38, Vocabulario: 33 }, emotions: ["Frustrado", "Ansioso", "Frustrado"], time: "3 min" },
  { id: 5, n: "Andrés M.",  em: "🐰", c: C.matcha, perf: { Lenguaje: 55, Matemáticas: 50, Vocabulario: 52 }, emotions: ["Normal", "Cansado", "Normal"],        time: "9 min" },
];

export const T = {
  es: { home: "Inicio", activities: "Actividades", emotions: "Emociones", achievements: "Logros" },
  en: { home: "Home",   activities: "Activities",  emotions: "Emotions",  achievements: "Rewards" },
};

// ─── LOGIN SCREEN ───────────────────────────────────────────────────────
// Nota: el botón de voz ("Di tu nombre en voz alta") se quitó por ahora.
// Web Speech API no existe en móvil — cuando quieras esa función, se agrega
// con una librería como expo-speech-recognition (requiere permisos nativos).

type Profile = "student" | "teacher" | "parent" | "specialist";

const ROLE_LABEL: Record<string, string> = { parent: "padre / madre", specialist: "especialista", teacher: "docente" };

export const LoginScreen = ({ onLogin }: { onLogin: (role: Profile, data: any) => void }) => {
  const [sel, setSel] = useState<Profile | null>(null);
  const [step, setStep] = useState<"who" | "form">("who");
  const [avatarIdx, setAvatarIdx] = useState(2);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const avatars = ["🐱", "🐶", "🦊", "🐰", "🐸", "🦋"];
  const profiles: { id: Profile; emoji: string; label: string; color: string; desc: string }[] = [
    { id: "student",    emoji: "👧", label: "Soy Estudiante", color: C.blush,     desc: "Entra a jugar y aprender" },
    { id: "teacher",    emoji: "👩‍🏫", label: "Soy Docente",    color: C.sea,       desc: "Gestiona tu clase" },
    { id: "parent",     emoji: "👨‍👩‍👧", label: "Padre / Madre", color: C.matcha,    desc: "Sigue el progreso" },
    { id: "specialist", emoji: "🧠", label: "Especialista",   color: C.tangerine, desc: "Apoyo psicopedagógico" },
  ];
  const selP = profiles.find((p) => p.id === sel);
  const canSubmit = sel === "student" ? username.trim().length > 0 : (email.trim().length > 0 && password.trim().length > 0);

  const handleSubmit = async () => {
    if (sel === "student") {
      onLogin(sel, { username: username || "Sofía", avatarIdx });
      return;
    }
    setAuthError("");
    setAuthLoading(true);
    const { data, error } =
      authMode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { role: sel } } });
    if (error) {
      setAuthLoading(false);
      setAuthError(authMode === "signin" ? "Correo o contraseña incorrectos" : (error.message || "No se pudo crear la cuenta"));
      return;
    }
    if (authMode === "signup" && !data.session) {
      setAuthLoading(false);
      setAuthError("Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.");
      setAuthMode("signin");
      return;
    }

    // El rol lo decide el servidor, no el perfil elegido en esta pantalla.
    let account: Account;
    try {
      account = await bootstrapAccount();
    } catch (e) {
      await signOut();
      setAuthLoading(false);
      setAuthError((e as NubiError).message);
      return;
    }
    if (account.role === "pending" || account.role !== sel) {
      await signOut();
      setAuthLoading(false);
      setAuthError(
        account.role !== "pending"
          ? `Tu cuenta está registrada como ${ROLE_LABEL[account.role]}. Elige ese perfil para entrar.`
          : sel === "specialist" || sel === "teacher"
          ? `Tu correo todavía no está autorizado como ${ROLE_LABEL[sel]}. Pide a la institución que lo habilite.`
          : "Tu cuenta todavía no tiene un perfil habilitado. Contacta a la institución."
      );
      return;
    }
    setAuthLoading(false);
    onLogin(account.role, { username: data.user?.email || email, avatarIdx, account });
  };

  return (
    <View style={styles.wrap}>
      <View style={{ width: "100%", maxWidth: 460 }}>
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          <View style={styles.logoCircle}>
            <Image source={require('../../assets/images/tabIcons/logo.png')} style={{ width: 130, height: 100 }} /> </View>
          <Text style={styles.title}>Nubi Learn</Text>
          <Text style={styles.subtitle}>Cedes Don Bosco · Kínder y Primaria</Text>
          <View style={{ marginTop: 8, flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
            {[" Inclusivo", " Interactivo", " Adaptativo", " Seguro"].map((t) => (
              <Pill key={t} color={C.sea}>{t}</Pill>
            ))}
          </View>
        </View>

        {step === "who" ? (
          <Card>
            <Text style={styles.cardTitle}>¿Quién eres hoy? </Text>
            <View style={styles.grid2}>
              {profiles.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => setSel(p.id)}
                  style={[
                    styles.profileTile,
                    { borderColor: sel === p.id ? p.color : C.border, backgroundColor: sel === p.id ? p.color + "18" : C.bg },
                  ]}
                >
                  <Text style={{ fontSize: 28, marginBottom: 5 }}>{p.emoji}</Text>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: sel === p.id ? p.color : C.dark, textAlign: "center" }}>{p.label}</Text>
                  <Text style={{ fontSize: 10, color: C.muted, marginTop: 2, textAlign: "center" }}>{p.desc}</Text>
                </Pressable>
              ))}
            </View>
            <Btn full color={selP?.color || C.muted} disabled={!sel} onPress={() => setStep("form")}>Continuar →</Btn>
          </Card>
        ) : (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Pressable onPress={() => setStep("who")}>
                <Text style={{ fontSize: 18, color: C.muted }}>←</Text>
              </Pressable>
              <Text style={{ fontSize: 15, fontWeight: "900" }}>{selP?.emoji} {selP?.label}</Text>
            </View>

            {sel === "student" ? (
              <>
                <Text style={styles.centerLabel}>Elige tu avatar</Text>
                <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 14 }}>
                  {avatars.map((em, i) => (
                    <Pressable
                      key={i}
                      onPress={() => setAvatarIdx(i)}
                      style={[
                        styles.avatarCircle,
                        { backgroundColor: [C.blush, C.sea, C.tangerine, C.butter, C.matcha, C.blush][i] + "33",
                          borderColor: avatarIdx === i ? C.tangerine : "transparent" },
                      ]}
                    >
                      <Text style={{ fontSize: 24 }}>{em}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.label}>Nombre de usuario</Text>
                <TextInput value={username} onChangeText={setUsername} placeholder="sofi2015" style={styles.input} placeholderTextColor={C.muted} />
              </>
            ) : (
              <>
                <Text style={styles.label}>Correo institucional</Text>
                <TextInput value={email} onChangeText={setEmail} placeholder="nombre@est.cedesdonbosco.ed.cr" keyboardType="email-address" autoCapitalize="none" style={styles.input} placeholderTextColor={C.muted} />
                <Text style={styles.label}>Contraseña</Text>
                <TextInput value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry style={styles.input} placeholderTextColor={C.muted} />
                <View style={{ flexDirection: "row", gap: 4, alignItems: "center", marginBottom: 14 }}>
                  <Text style={{ fontSize: 11, color: C.muted }}>🔒 Datos cifrados · Cumple normativa de privacidad infantil</Text>
                </View>
                {!!authError && <Text style={{ fontSize: 11, color: C.blush, marginBottom: 10, fontWeight: "700" }}>{authError}</Text>}
              </>
            )}

            <Btn full color={selP?.color || C.blush} disabled={!canSubmit || authLoading} onPress={handleSubmit}>
              {authLoading ? "Un momento..." : sel === "student" ? "¡Entrar a jugar! 🚀" : (authMode === "signin" ? "Iniciar sesión →" : "Crear cuenta →")}
            </Btn>

            {sel !== "student" && (
              <Pressable onPress={() => { setAuthMode((m) => (m === "signin" ? "signup" : "signin")); setAuthError(""); }}>
                <Text style={styles.switchText}>{authMode === "signin" ? "¿No tenés cuenta? Crear una" : "¿Ya tenés cuenta? Iniciar sesión"}</Text>
              </Pressable>
            )}
          </Card>
        )}

        <Text style={styles.footer}>🌐 Español · English   |   🔒 HTTPS · Datos protegidos</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  logoCircle: { width: 76, height: 76, borderRadius: 24, backgroundColor: C.blush, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  title: { fontSize: 30, fontWeight: "900", color: C.dark, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: C.muted, marginTop: 3 },
  cardTitle: { textAlign: "center", fontSize: 15, fontWeight: "900", color: C.dark, marginBottom: 16 },
  grid2: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  profileTile: { width: "47%", borderWidth: 2.5, borderRadius: 16, padding: 14, alignItems: "center" },
  centerLabel: { textAlign: "center", fontSize: 12, color: C.muted, marginBottom: 10 },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 3 },
  label: { fontSize: 12, fontWeight: "700", color: C.muted },
  input: { marginTop: 5, marginBottom: 10, paddingVertical: 9, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, fontSize: 13, backgroundColor: C.bg, color: C.dark },
  switchText: { textAlign: "center", marginTop: 10, fontSize: 11, color: C.muted },
  footer: { textAlign: "center", marginTop: 14, fontSize: 10, color: C.muted },
});
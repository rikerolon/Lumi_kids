import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { LoginScreen, INITIAL_BANK } from "../components/login-and-data";
import { HomeStudent } from "../components/home-student";
import { ActivityScreen } from "../components/activity-screen";
import { ChatbotWidget } from "../components/chatbot-widget";
import { EmotionsScreen } from "../components/emotions-screen";
import { GamificationScreen } from "../components/gamificacion-screen";
import { HomeParent } from "../components/home-parent";
import { HomeSpecialist } from "../components/home-specialist";
import { Account, clearStoredSession, signOut } from "../lib/nubi-api";

export default function Index() {
  const [cur, setCur] = useState("login");
  const [payload, setPayload] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [bank, setBank] = useState<any>(INITIAL_BANK);
  const [account, setAccount] = useState<Account | null>(null);

  const [student, setStudent] = useState<any>({
    name: "Sofía", avatarEmoji: "🦊", points: 60, level: 1, streak: 2, emotion: null,
    emotionLog: [], performance: { Lenguaje: 65, Matemáticas: 58, Vocabulario: 72 },
    subjectStreak: {}, history: [], owned: [], equipped: [], assignment: null, dailyDoneOn: null,
  });

  // La app siempre abre en el login: no debe quedar en el dispositivo la
  // sesión de quien lo usó antes (tabletas compartidas).
  useEffect(() => { clearStoredSession(); }, []);

  const nav = (id: string, pl?: any) => { setPayload(pl || null); setCur(id); };
  const addNotif = (text: string, type = "info") => setNotifications((n) => [...n, { text, type, ts: Date.now() }]);

  const avatars = ["🐱", "🐶", "🦊", "🐰", "🐸", "🦋"];
  const handleLogin = (r: string, data: any) => {
    setRole(r);
    if (r === "student") {
      setStudent((s: any) => ({ ...s, name: data.username, avatarEmoji: avatars[data.avatarIdx] }));
    }
    setAccount(data.account ?? null);
    const home: Record<string, string> = { student: "home-student", parent: "home-parent", specialist: "home-specialist" };
    nav(home[r] ?? "placeholder");
  };

  const handleLogout = async () => {
    await signOut();
    setAccount(null);
    setRole(null);
    nav("login");
  };

  const render = () => {
    switch (cur) {
      case "login":
        return <LoginScreen onLogin={handleLogin} />;
      case "home-student":
        return <HomeStudent student={student} setStudent={setStudent} addNotif={addNotif} onNav={nav} />;
      case "activity":
        return <ActivityScreen student={student} setStudent={setStudent} bank={bank} addNotif={addNotif} onNav={nav} payload={payload} />;
      case "emotions":
        return <EmotionsScreen student={student} setStudent={setStudent} addNotif={addNotif} onNav={nav} payload={payload} />;
      case "gamification":
        return <GamificationScreen student={student} setStudent={setStudent} onNav={nav} />;
      case "home-parent":
        return account && <HomeParent account={account} onLogout={handleLogout} />;
      case "home-specialist":
        return account && <HomeSpecialist account={account} onLogout={handleLogout} />;
      default:
        return (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", marginBottom: 8 }}>🚧 Pantalla "{cur}" en construcción</Text>
            <Text style={{ fontSize: 13, color: "#7A6A58", textAlign: "center" }}>Todavía no hemos convertido esta parte.</Text>
          </View>
        );
    }
  };

  return <View style={{ flex: 1, backgroundColor: "#FFF9EE" }}>
      {render()}
      {role && <ChatbotWidget />}
    </View>;
}
import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet } from "react-native";
import { C, Card, Btn, Pill, Sec, AlertBox } from "./base";
import { PanelHeader, Loading, ErrorState, EmptyState } from "./panel-shared";
import { Account, ParentChild, NubiError, listMyChildren, createChild, formatDate, ageFrom } from "../lib/nubi-api";

// "DD/MM/AAAA" → "AAAA-MM-DD"; null si está vacío, undefined si no es una fecha real.
const parseBirthDate = (text: string): string | null | undefined => {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return undefined;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return undefined;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

export const HomeParent = ({ account, onLogout }: { account: Account; onLogout: () => void }) => {
  const [children, setChildren] = useState<ParentChild[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [relationship, setRelationship] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      setChildren(await listMyChildren());
    } catch (e) {
      setLoadError((e as NubiError).message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    const birthDate = parseBirthDate(birth);
    if (birthDate === undefined) {
      setFormError("Escribe la fecha como DD/MM/AAAA, por ejemplo 04/03/2018.");
      return;
    }
    setFormError("");
    setNotice("");
    setSaving(true);
    try {
      const created = await createChild(name, birthDate, relationship.trim() || null);
      setName(""); setBirth(""); setRelationship("");
      setNotice(`${created.full_name} quedó registrado y pendiente de asignación a un especialista.`);
      await load();
    } catch (e) {
      setFormError((e as NubiError).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 90 }} keyboardShouldPersistTaps="handled">
      <PanelHeader colors={[C.matcha, C.sea]} title="👨‍👩‍👧 Mi familia" subtitle={account.full_name} onLogout={onLogout} />

      <View style={{ paddingHorizontal: 14, marginTop: 16 }}>
        <Sec>Mis hijos</Sec>
        {!!notice && <AlertBox type="ok">{notice}</AlertBox>}

        {loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : children === null ? (
          <Loading />
        ) : children.length === 0 ? (
          <EmptyState icon="🧒" text="Todavía no registraste a ningún niño. Usa el formulario de abajo para crear su perfil." />
        ) : (
          <View style={{ gap: 9 }}>
            {children.map((ch) => {
              const age = ageFrom(ch.birth_date);
              return (
                <Card key={ch.child_user_id}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.childName}>{ch.full_name}</Text>
                      <Text style={styles.meta}>
                        {ch.birth_date ? `Nació el ${formatDate(ch.birth_date)}${age !== null ? ` · ${age} años` : ""}` : "Sin fecha de nacimiento"}
                        {ch.relationship_type ? ` · ${ch.relationship_type}` : ""}
                      </Text>
                    </View>
                    {ch.status === "assigned"
                      ? <Pill color={C.matcha}>Con especialista</Pill>
                      : <Pill color={C.tangerine}>Pendiente</Pill>}
                  </View>
                  <Text style={[styles.meta, { marginTop: 7 }]}>
                    {ch.status === "assigned"
                      ? `🧠 Especialista: ${ch.specialist_name} · desde ${formatDate(ch.assigned_at)}`
                      : "🕓 Aún no tiene especialista asignado. Un especialista lo tomará desde su panel."}
                  </Text>
                </Card>
              );
            })}
          </View>
        )}

        <View style={{ height: 18 }} />
        <Sec>Registrar un hijo</Sec>
        <Card>
          <Text style={styles.label}>Nombre completo</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Lucía Mora Rojas" style={styles.input} placeholderTextColor={C.muted} maxLength={100} />
          <Text style={styles.label}>Fecha de nacimiento (opcional)</Text>
          <TextInput value={birth} onChangeText={setBirth} placeholder="DD/MM/AAAA" style={styles.input} placeholderTextColor={C.muted} maxLength={10} />
          <Text style={styles.label}>Parentesco (opcional)</Text>
          <TextInput value={relationship} onChangeText={setRelationship} placeholder="Madre, padre, tutor..." style={styles.input} placeholderTextColor={C.muted} maxLength={50} />
          {!!formError && <Text style={styles.error}>{formError}</Text>}
          <Btn full color={C.matcha} disabled={saving || name.trim().length < 2} onPress={submit}>
            {saving ? "Guardando..." : "Crear perfil"}
          </Btn>
        </Card>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  childName: { fontSize: 14, fontWeight: "900", color: C.dark },
  meta: { fontSize: 11, color: C.muted, lineHeight: 16 },
  label: { fontSize: 12, fontWeight: "700", color: C.muted },
  input: { marginTop: 5, marginBottom: 10, paddingVertical: 9, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, fontSize: 13, backgroundColor: C.bg, color: C.dark },
  error: { fontSize: 11, color: C.blush, marginBottom: 10, fontWeight: "700" },
});

import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet } from "react-native";
import { C, Card, Btn, Pill, Sec, AlertBox } from "./base";
import { PanelHeader, Loading, ErrorState, EmptyState, ConfirmBox } from "./panel-shared";
import {
  Account, AssignedChild, DirectoryChild, Specialist, NubiError,
  listAssignedChildren, searchChildren, listSpecialists, assignChild, releaseChild, transferChild,
  formatDate, ageFrom,
} from "../lib/nubi-api";

type Tab = "mine" | "assign";
type Notice = { type: "ok" | "danger"; text: string } | null;

const Field = ({ label, value }: { label: string; value: string | null }) => (
  <View style={{ flexDirection: "row", gap: 6, marginBottom: 3 }}>
    <Text style={{ fontSize: 11, color: C.muted, width: 118 }}>{label}</Text>
    <Text style={{ fontSize: 11, color: C.dark, flex: 1 }}>{value || "—"}</Text>
  </View>
);

export const HomeSpecialist = ({ account, onLogout }: { account: Account; onLogout: () => void }) => {
  const [tab, setTab] = useState<Tab>("mine");
  const [notice, setNotice] = useState<Notice>(null);

  // Mis niños
  const [assigned, setAssigned] = useState<AssignedChild[] | null>(null);
  const [assignedError, setAssignedError] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [action, setAction] = useState<{ childId: number; kind: "release" | "transfer"; target?: Specialist } | null>(null);
  const [specialists, setSpecialists] = useState<Specialist[] | null>(null);

  // Asignaciones
  const [query, setQuery] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [results, setResults] = useState<DirectoryChild[] | null>(null);
  const [searchError, setSearchError] = useState("");
  const [confirmAssignId, setConfirmAssignId] = useState<number | null>(null);

  const [busy, setBusy] = useState(false);
  const searchSeq = useRef(0);

  const loadAssigned = useCallback(async () => {
    setAssignedError("");
    try {
      setAssigned(await listAssignedChildren());
    } catch (e) {
      setAssignedError((e as NubiError).message);
    }
  }, []);

  const runSearch = useCallback(async (q: string, only: boolean) => {
    const seq = ++searchSeq.current;
    setSearchError("");
    try {
      const data = await searchChildren(q, only);
      if (seq === searchSeq.current) setResults(data);
    } catch (e) {
      if (seq === searchSeq.current) setSearchError((e as NubiError).message);
    }
  }, []);

  useEffect(() => { loadAssigned(); }, [loadAssigned]);

  useEffect(() => {
    if (tab !== "assign") return;
    const t = setTimeout(() => runSearch(query, onlyAvailable), 300);
    return () => clearTimeout(t);
  }, [tab, query, onlyAvailable, runSearch]);

  const refreshAll = () => Promise.all([loadAssigned(), runSearch(query, onlyAvailable)]);

  const run = async (op: () => Promise<unknown>, okText: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await op();
      setNotice({ type: "ok", text: okText });
    } catch (e) {
      setNotice({ type: "danger", text: (e as NubiError).message });
    } finally {
      // Se recarga también tras un error: la lista puede haber quedado desactualizada.
      setConfirmAssignId(null);
      setAction(null);
      await refreshAll();
      setBusy(false);
    }
  };

  const startTransfer = async (childId: number) => {
    setAction({ childId, kind: "transfer" });
    if (specialists) return;
    try {
      setSpecialists(await listSpecialists());
    } catch (e) {
      setAction(null);
      setNotice({ type: "danger", text: (e as NubiError).message });
    }
  };

  const renderMine = () => {
    if (assignedError) return <ErrorState message={assignedError} onRetry={loadAssigned} />;
    if (assigned === null) return <Loading />;
    if (assigned.length === 0) {
      return <EmptyState icon="🗂️" text="Todavía no tienes niños asignados. Ve a «Asignaciones» para buscar y asignarte los que te correspondan." />;
    }
    return (
      <View style={{ gap: 9 }}>
        {assigned.map((ch) => {
          const open = openId === ch.child_user_id;
          const age = ageFrom(ch.birth_date);
          const act = action?.childId === ch.child_user_id ? action : null;
          return (
            <Card key={ch.child_user_id}>
              <Pressable
                onPress={() => { setOpenId(open ? null : ch.child_user_id); setAction(null); }}
                style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.childName}>{ch.full_name}</Text>
                  <Text style={styles.meta}>
                    {age !== null ? `${age} años · ` : ""}Asignado el {formatDate(ch.assigned_at)}
                  </Text>
                </View>
                <Text style={{ fontSize: 14, color: C.muted }}>{open ? "▲" : "▼"}</Text>
              </Pressable>

              {open && (
                <View style={{ marginTop: 11 }}>
                  <Field label="Fecha de nacimiento" value={ch.birth_date ? formatDate(ch.birth_date) : null} />
                  <Field label="Centro educativo" value={ch.school_name} />
                  <Field label="Grupo" value={ch.classroom_name} />
                  <Field label="Teléfono del tutor" value={ch.guardian_phone} />
                  <Field label="Alergias" value={ch.allergies} />
                  <Field label="Contacto de emergencia" value={ch.emergency_contact} />
                  {ch.guardians.map((g) => (
                    <Field
                      key={g.email}
                      label={g.relationship_type || "Tutor"}
                      value={`${g.full_name} · ${g.email}${g.phone ? ` · ${g.phone}` : ""}`}
                    />
                  ))}

                  {!act && (
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 9 }}>
                      <Btn small outline color={C.sea} onPress={() => startTransfer(ch.child_user_id)}>Transferir</Btn>
                      <Btn small outline color={C.blush} onPress={() => setAction({ childId: ch.child_user_id, kind: "release" })}>Liberar</Btn>
                    </View>
                  )}

                  {act?.kind === "release" && (
                    <ConfirmBox
                      color={C.blush}
                      text={`¿Liberar a ${ch.full_name}? Quedará pendiente de asignación y dejarás de ver su perfil.`}
                      confirmLabel="Sí, liberar"
                      busy={busy}
                      onCancel={() => setAction(null)}
                      onConfirm={() => run(() => releaseChild(ch.child_user_id), `${ch.full_name} quedó pendiente de asignación.`)}
                    />
                  )}

                  {act?.kind === "transfer" && !act.target && (
                    <View style={styles.picker}>
                      <Text style={[styles.meta, { marginBottom: 7 }]}>¿A qué especialista quieres transferirlo?</Text>
                      {specialists === null ? (
                        <Loading label="Cargando especialistas..." />
                      ) : specialists.length === 0 ? (
                        <Text style={styles.meta}>No hay otros especialistas registrados en tu institución.</Text>
                      ) : (
                        specialists.map((s) => (
                          <Pressable key={s.user_id} onPress={() => setAction({ ...act, target: s })} style={styles.pickerRow}>
                            <Text style={{ fontSize: 12, fontWeight: "800", color: C.dark }}>🧠 {s.full_name}</Text>
                            {!!s.specialty && <Text style={styles.meta}>{s.specialty}</Text>}
                          </Pressable>
                        ))
                      )}
                      <Btn small outline color={C.muted} onPress={() => setAction(null)} style={{ alignSelf: "flex-start", marginTop: 6 }}>Cancelar</Btn>
                    </View>
                  )}

                  {act?.kind === "transfer" && act.target && (
                    <ConfirmBox
                      text={`¿Transferir a ${ch.full_name} a ${act.target.full_name}? Dejarás de ver su perfil y el cambio quedará en el historial.`}
                      confirmLabel="Sí, transferir"
                      busy={busy}
                      onCancel={() => setAction(null)}
                      onConfirm={() => run(
                        () => transferChild(ch.child_user_id, act.target!.user_id),
                        `${ch.full_name} fue transferido a ${act.target!.full_name}.`,
                      )}
                    />
                  )}
                </View>
              )}
            </Card>
          );
        })}
      </View>
    );
  };

  const renderAssign = () => (
    <View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar por nombre o código del niño"
        style={styles.input}
        placeholderTextColor={C.muted}
        autoCapitalize="none"
      />
      <View style={{ flexDirection: "row", gap: 7, marginBottom: 12 }}>
        {([[true, "Disponibles"], [false, "Todos"]] as const).map(([val, label]) => (
          <Pressable key={label} onPress={() => setOnlyAvailable(val)}>
            <Pill color={C.sea} outline={onlyAvailable !== val}>{label}</Pill>
          </Pressable>
        ))}
      </View>

      {searchError ? (
        <ErrorState message={searchError} onRetry={() => runSearch(query, onlyAvailable)} />
      ) : results === null ? (
        <Loading />
      ) : results.length === 0 ? (
        <EmptyState
          icon="🔎"
          text={query.trim()
            ? `No hay resultados para «${query.trim()}».`
            : onlyAvailable ? "No hay niños pendientes de asignación en este momento." : "Todavía no hay niños registrados."}
        />
      ) : (
        <View style={{ gap: 9 }}>
          {results.map((ch) => (
            <Card key={ch.child_user_id}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.childName}>{ch.full_name}</Text>
                  <Text style={styles.meta}>
                    Código {ch.child_user_id}{ch.guardian_name ? ` · Tutor: ${ch.guardian_name}` : ""}
                  </Text>
                  {ch.status === "other" && <Text style={styles.meta}>🧠 Especialista: {ch.specialist_name}</Text>}
                </View>
                {ch.status === "available" && confirmAssignId !== ch.child_user_id && (
                  <Btn small color={C.tangerine} onPress={() => setConfirmAssignId(ch.child_user_id)}>Asignar</Btn>
                )}
                {ch.status === "mine" && <Pill color={C.matcha}>Asignado a ti</Pill>}
                {ch.status === "other" && <Pill color={C.muted}>Asignado</Pill>}
              </View>
              {confirmAssignId === ch.child_user_id && (
                <ConfirmBox
                  color={C.tangerine}
                  text={`¿Asignar a ${ch.full_name} a tu cuenta? Podrás ver su perfil y darle seguimiento.`}
                  confirmLabel="Sí, asignar"
                  busy={busy}
                  onCancel={() => setConfirmAssignId(null)}
                  onConfirm={() => run(() => assignChild(ch.child_user_id), `${ch.full_name} ahora está asignado a tu cuenta.`)}
                />
              )}
            </Card>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 90 }} keyboardShouldPersistTaps="handled">
      <PanelHeader colors={[C.tangerine, C.sea]} title="🧠 Panel del especialista" subtitle={account.full_name} onLogout={onLogout}>
        <View style={styles.tabs}>
          {([["mine", `Mis niños${assigned ? ` (${assigned.length})` : ""}`], ["assign", "Asignaciones"]] as const).map(([id, label]) => (
            <Pressable key={id} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.tabActive]}>
              <Text style={{ fontSize: 12, fontWeight: "900", color: tab === id ? C.dark : "#fff" }}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </PanelHeader>

      <View style={{ paddingHorizontal: 14, marginTop: 16 }}>
        {notice && <AlertBox type={notice.type}>{notice.text}</AlertBox>}
        <Sec>{tab === "mine" ? "Niños asignados a tu cuenta" : "Gestionar asignaciones"}</Sec>
        {tab === "mine" ? renderMine() : renderAssign()}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  childName: { fontSize: 14, fontWeight: "900", color: C.dark },
  meta: { fontSize: 11, color: C.muted, lineHeight: 16 },
  input: { marginBottom: 10, paddingVertical: 9, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, fontSize: 13, backgroundColor: C.white, color: C.dark },
  tabs: { flexDirection: "row", gap: 6, marginTop: 14, backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 99, padding: 4 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 99 },
  tabActive: { backgroundColor: "#fff" },
  picker: { marginTop: 10, borderWidth: 1.5, borderColor: C.border, borderRadius: 14, padding: 11, backgroundColor: C.bg },
  pickerRow: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white, marginBottom: 6 },
});

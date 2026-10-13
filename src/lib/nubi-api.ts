import { supabase } from "./supabaseClient";

// Acceso a datos de padres y especialistas. Todo pasa por funciones de la base
// de datos (nubi_*) que identifican al usuario por su sesión: el cliente nunca
// envía su propio id ni su rol.

export type AccountRole = "parent" | "specialist" | "teacher" | "pending";

export type Account = {
  user_id: number;
  tenant_id: number;
  full_name: string;
  email: string;
  role: AccountRole;
};

export type ParentChild = {
  child_user_id: number;
  full_name: string;
  birth_date: string | null;
  relationship_type: string | null;
  status: "pending" | "assigned";
  specialist_name: string | null;
  assigned_at: string | null;
};

export type Guardian = {
  full_name: string;
  email: string;
  phone: string | null;
  relationship_type: string | null;
  is_primary_guardian: boolean;
};

export type AssignedChild = {
  child_user_id: number;
  full_name: string;
  birth_date: string | null;
  school_name: string | null;
  classroom_name: string | null;
  guardian_phone: string | null;
  allergies: string | null;
  emergency_contact: string | null;
  assigned_at: string;
  guardians: Guardian[];
};

export type DirectoryChild = {
  child_user_id: number;
  full_name: string;
  guardian_name: string | null;
  status: "available" | "mine" | "other";
  specialist_name: string | null;
};

export type Specialist = { user_id: number; full_name: string; specialty: string | null };

const MESSAGES: Record<string, string> = {
  not_authenticated: "Tu sesión expiró. Vuelve a iniciar sesión.",
  not_authorized: "Tu cuenta no tiene permiso para realizar esta acción.",
  account_not_ready: "Tu cuenta todavía no está lista. Vuelve a iniciar sesión.",
  account_disabled: "Tu cuenta está desactivada. Contacta a la institución.",
  email_not_confirmed: "Confirma tu correo antes de continuar.",
  tenant_not_configured: "La institución todavía no está configurada en el sistema.",
  invalid_name: "Escribe el nombre completo del niño (entre 2 y 100 caracteres).",
  invalid_birth_date: "La fecha de nacimiento no es válida.",
  child_duplicate: "Ya registraste un niño con ese nombre y fecha de nacimiento.",
  child_not_found: "No se encontró ese niño.",
  child_already_assigned: "Ese niño ya fue asignado a otro especialista.",
  not_your_child: "Ese niño no está asignado a tu cuenta.",
  invalid_target: "El especialista de destino no es válido.",
};

export class NubiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function toNubiError(error: { message?: string; code?: string }): NubiError {
  const raw = error.message ?? "";
  const known = Object.keys(MESSAGES).find((k) => raw.includes(k));
  if (known) return new NubiError(known, MESSAGES[known]);
  // PGRST202 / 42883: la función no existe → falta aplicar la migración.
  if (error.code === "PGRST202" || error.code === "42883") {
    return new NubiError("not_configured", "El servidor todavía no está configurado para esta función.");
  }
  if (error.code === "42501") return new NubiError("not_authorized", MESSAGES.not_authorized);
  if (/network|fetch/i.test(raw)) {
    return new NubiError("network", "No hay conexión. Revisa tu internet e inténtalo de nuevo.");
  }
  return new NubiError("unknown", "Ocurrió un error inesperado. Inténtalo de nuevo.");
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  let res;
  try {
    res = await supabase.rpc(fn, args);
  } catch (e: any) {
    throw toNubiError({ message: e?.message ?? "network" });
  }
  if (res.error) throw toNubiError(res.error);
  return res.data as T;
}

/** Crea o enlaza la cuenta del usuario autenticado y devuelve su rol real. */
export const bootstrapAccount = () => call<Account>("nubi_bootstrap_me");

export const signOut = () => supabase.auth.signOut();

// ─── Padre ──────────────────────────────────────────────────────────────
export const listMyChildren = () => call<ParentChild[]>("nubi_my_children");

export const createChild = (fullName: string, birthDate: string | null, relationship: string | null) =>
  call<{ child_user_id: number; full_name: string }>("nubi_create_child", {
    p_full_name: fullName,
    p_birth_date: birthDate,
    p_relationship: relationship,
  });

// ─── Especialista ───────────────────────────────────────────────────────
export const listAssignedChildren = () => call<AssignedChild[]>("nubi_my_assigned_children");

export const searchChildren = (query: string, onlyAvailable: boolean) =>
  call<DirectoryChild[]>("nubi_search_children", { p_query: query, p_only_available: onlyAvailable });

export const listSpecialists = () => call<Specialist[]>("nubi_list_specialists");

export const assignChild = (childUserId: number) =>
  call<{ assignment_id: number; already_assigned: boolean }>("nubi_assign_child", { p_child_user_id: childUserId });

export const releaseChild = (childUserId: number) =>
  call<{ closed_assignment_id: number }>("nubi_release_child", { p_child_user_id: childUserId });

export const transferChild = (childUserId: number, toSpecialistUserId: number) =>
  call<{ assignment_id: number }>("nubi_transfer_child", {
    p_child_user_id: childUserId,
    p_to_specialist_user_id: toSpecialistUserId,
  });

// ─── Utilidades de presentación ─────────────────────────────────────────
export const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

export const ageFrom = (birthDate: string | null) => {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age;
};

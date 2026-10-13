// Entorno de PRUEBA: Postgres embebido (PGlite) en memoria.
// Reconstruye las tablas reales a partir de supabase/schema_dump.json, simula
// lo mínimo de Supabase (roles anon/authenticated, auth.users, auth.uid()) y
// aplica la migración. No se conecta nunca a la base de datos real.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const TABLES = [
  "tenants", "users", "roles", "user_roles", "schools", "classrooms",
  "child_profiles", "parent_children", "professional_profiles",
];

function loadDump() {
  let dump = JSON.parse(readFileSync(join(root, "schema_dump.json"), "utf8").replace(/^﻿/, ""));
  if (Array.isArray(dump)) dump = dump[0];
  if (dump.schema_dump) dump = typeof dump.schema_dump === "string" ? JSON.parse(dump.schema_dump) : dump.schema_dump;
  return dump;
}

function baseSchemaSql() {
  const dump = loadDump();
  const out = [];
  for (const t of TABLES) {
    const cols = dump.columns.filter((c) => c.t === t).map((c) => {
      const identity = c.c === "id" && c.default === null && c.null === "NO";
      return `"${c.c}" ${c.type}` +
        (identity ? " generated always as identity" : "") +
        (c.null === "NO" && !identity ? " not null" : "") +
        (c.default !== null ? ` default ${c.default}` : "");
    });
    out.push(`create table public.${t} (${cols.join(", ")});`);
    if (dump.rls.find((r) => r.t === t)?.enabled) out.push(`alter table public.${t} enable row level security;`);
  }
  const constraints = dump.constraints.filter((c) => TABLES.includes(c.t));
  const isFk = (c) => c.def.startsWith("FOREIGN KEY");
  for (const c of [...constraints.filter((c) => !isFk(c)), ...constraints.filter(isFk)]) {
    out.push(`alter table public.${c.t} add constraint "${c.name}" ${c.def};`);
  }
  return out.join("\n");
}

const SUPABASE_SHIM = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    email_confirmed_at timestamptz,
    raw_user_meta_data jsonb
  );
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  -- Igual que Supabase: todo objeto nuevo en public nace con permisos para
  -- anon y authenticated; la protección debe venir de RLS y de los revoke.
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`;

export function migrationSql() {
  const dir = join(root, "migrations");
  return readdirSync(dir).sort().map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
}

export async function freshDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_SHIM);
  await db.exec(baseSchemaSql());
  await db.exec("grant all on all tables in schema public to anon, authenticated;");
  await db.exec(migrationSql());
  return db;
}

/** Ejecuta SQL como un usuario de la app (rol authenticated + JWT) o como anon. */
export async function as(db, authUid, sql, params = []) {
  await db.exec(`set role ${authUid ? "authenticated" : "anon"};`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [authUid ?? ""]);
  try {
    return (await db.query(sql, params)).rows;
  } finally {
    await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
  }
}

export async function rpc(db, authUid, fn, args = []) {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await as(db, authUid, `select public.${fn}(${placeholders}) as r`, args);
  return rows[0].r;
}

/** Simula un registro en Supabase Auth. El rol va en metadatos, como hace la app. */
export async function signUp(db, email, role, { confirmed = true } = {}) {
  const { rows } = await db.query(
    "insert into auth.users (email, email_confirmed_at, raw_user_meta_data) values ($1, $2, $3) returning id",
    [email, confirmed ? new Date().toISOString() : null, JSON.stringify({ role })],
  );
  return rows[0].id;
}

/** Lo que haría el administrador en el SQL Editor para autorizar a un especialista. */
export async function inviteSpecialist(db, email, tenantId = 1) {
  await db.query("insert into public.specialist_invitations (email, tenant_id) values ($1, $2)", [email, tenantId]);
}

export async function newParent(db, email) {
  const uid = await signUp(db, email, "parent");
  const me = await rpc(db, uid, "nubi_bootstrap_me");
  return { uid, ...me };
}

export async function newSpecialist(db, email, tenantId = 1) {
  await inviteSpecialist(db, email, tenantId);
  const uid = await signUp(db, email, "specialist");
  const me = await rpc(db, uid, "nubi_bootstrap_me");
  return { uid, ...me };
}

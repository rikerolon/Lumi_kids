import assert from "node:assert/strict";
import { test } from "node:test";
import { as, freshDb, inviteSpecialist, migrationSql, newParent, newSpecialist, rpc, signUp } from "./helpers.mjs";

const child = async (db, parent, name, birth = null) =>
  (await rpc(db, parent.uid, "nubi_create_child", [name, birth, "madre"])).child_user_id;

const names = (list) => list.map((c) => c.full_name);

test("la migración se puede aplicar dos veces sin errores ni duplicados", async () => {
  const db = await freshDb();
  await db.exec(migrationSql());
  const { rows } = await db.query("select name from public.roles order by name");
  assert.deepEqual(rows.map((r) => r.name), ["parent", "specialist", "student", "teacher"]);
  assert.equal((await db.query("select count(*)::int n from public.tenants")).rows[0].n, 1);
});

test("un padre que inicia sesión obtiene su cuenta enlazada y el rol parent", async () => {
  const db = await freshDb();
  const p = await newParent(db, "Mama@Example.com");
  assert.equal(p.role, "parent");
  assert.equal(p.email, "mama@example.com");

  const again = await rpc(db, p.uid, "nubi_bootstrap_me");
  assert.equal(again.user_id, p.user_id, "volver a entrar no crea otra fila");
  assert.equal((await db.query("select count(*)::int n from public.users")).rows[0].n, 1);
});

test("sin correo confirmado no se crea la cuenta", async () => {
  const db = await freshDb();
  const uid = await signUp(db, "x@example.com", "parent", { confirmed: false });
  await assert.rejects(rpc(db, uid, "nubi_bootstrap_me"), /email_not_confirmed/);
});

test("elegir 'specialist' en el cliente no concede el rol", async () => {
  const db = await freshDb();
  const uid = await signUp(db, "intruso@example.com", "specialist");
  const me = await rpc(db, uid, "nubi_bootstrap_me");
  assert.equal(me.role, "pending");

  for (const fn of ["nubi_my_assigned_children", "nubi_search_children", "nubi_list_specialists"]) {
    await assert.rejects(rpc(db, uid, fn), /not_authorized/);
  }
  await assert.rejects(rpc(db, uid, "nubi_assign_child", [1]), /not_authorized/);
});

test("cambiar los metadatos después del registro no cambia el rol", async () => {
  const db = await freshDb();
  const p = await newParent(db, "papa@example.com");
  await db.query(`update auth.users set raw_user_meta_data = '{"role":"specialist"}' where id = $1`, [p.uid]);
  assert.equal((await rpc(db, p.uid, "nubi_bootstrap_me")).role, "parent");
  await assert.rejects(rpc(db, p.uid, "nubi_search_children"), /not_authorized/);
});

test("un correo invitado obtiene el rol specialist, aunque la cuenta ya existiera", async () => {
  const db = await freshDb();
  const a = await newSpecialist(db, "ana@example.com");
  assert.equal(a.role, "specialist");

  const uid = await signUp(db, "beto@example.com", "specialist");
  assert.equal((await rpc(db, uid, "nubi_bootstrap_me")).role, "pending");
  await inviteSpecialist(db, "beto@example.com");
  assert.equal((await rpc(db, uid, "nubi_bootstrap_me")).role, "specialist");
});

test("el cliente no puede escribir directamente en las tablas ni concederse roles", async () => {
  const db = await freshDb();
  const p = await newParent(db, "papa@example.com");
  const a = await newSpecialist(db, "ana@example.com");
  const kid = await child(db, p, "Lucía Mora");
  const specialistRole = (await db.query("select id from public.roles where name = 'specialist'")).rows[0].id;

  await assert.rejects(
    as(db, p.uid, "insert into public.user_roles (user_id, role_id) values ($1, $2)", [p.user_id, specialistRole]),
    /row-level security|permission denied/,
  );
  await assert.rejects(
    as(db, p.uid, "insert into public.specialist_invitations (email, tenant_id) values ('papa@example.com', 1)"),
    /row-level security|permission denied/,
  );
  await assert.rejects(
    as(db, a.uid, "insert into public.child_specialist_assignments (tenant_id, child_user_id, specialist_user_id) values (1, $1, $2)", [kid, a.user_id]),
    /row-level security|permission denied/,
  );
  await assert.rejects(as(db, p.uid, "select public.nubi_require_role('parent')"), /permission denied/);

  // RLS sin políticas: las lecturas y escrituras directas no ven ninguna fila.
  assert.equal((await as(db, p.uid, "select * from public.users")).length, 0);
  assert.equal((await as(db, p.uid, "select * from public.child_profiles")).length, 0);
  await as(db, p.uid, "update public.users set full_name = 'hack'");
  assert.equal((await db.query("select count(*)::int n from public.users where full_name = 'hack'")).rows[0].n, 0);
});

test("sin sesión (anon) no se puede ejecutar ninguna función", async () => {
  const db = await freshDb();
  for (const call of [
    "nubi_bootstrap_me()", "nubi_my_children()", "nubi_my_assigned_children()", "nubi_search_children()",
    "nubi_list_specialists()", "nubi_assign_child(1)", "nubi_release_child(1)", "nubi_transfer_child(1, 2)",
    "nubi_create_child('Niño')", "nubi_current_user_id()",
  ]) {
    await assert.rejects(as(db, null, `select public.${call}`), /permission denied/, call);
  }
});

test("un padre crea un niño: queda enlazado por parent_children y pendiente de asignación", async () => {
  const db = await freshDb();
  const p = await newParent(db, "mama@example.com");
  const other = await newParent(db, "otro@example.com");
  const kid = await child(db, p, "  Lucía   Mora ", "2018-03-04");

  const link = (await db.query("select * from public.parent_children where child_user_id = $1", [kid])).rows;
  assert.equal(link.length, 1);
  assert.equal(link[0].parent_user_id, p.user_id);
  assert.equal(link[0].tenant_id, p.tenant_id);
  assert.equal((await db.query("select count(*)::int n from public.child_profiles where user_id = $1", [kid])).rows[0].n, 1);
  assert.equal(
    (await db.query("select r.name from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = $1", [kid])).rows[0].name,
    "student",
  );

  const mine = await rpc(db, p.uid, "nubi_my_children");
  assert.equal(mine.length, 1);
  assert.equal(mine[0].full_name, "Lucía Mora");
  assert.equal(mine[0].status, "pending");
  assert.equal(mine[0].specialist_name, null);

  assert.deepEqual(await rpc(db, other.uid, "nubi_my_children"), [], "otro padre no ve hijos ajenos");
});

test("no se crean perfiles de niño duplicados ni con datos inválidos", async () => {
  const db = await freshDb();
  const p = await newParent(db, "mama@example.com");
  await child(db, p, "Lucía Mora", "2018-03-04");
  await assert.rejects(child(db, p, "lucía mora", "2018-03-04"), /child_duplicate/);
  await assert.rejects(child(db, p, " ", null), /invalid_name/);
  await assert.rejects(child(db, p, "Futuro", "2999-01-01"), /invalid_birth_date/);
  assert.equal((await rpc(db, p.uid, "nubi_my_children")).length, 1);

  const a = await newSpecialist(db, "ana@example.com");
  await assert.rejects(rpc(db, a.uid, "nubi_create_child", ["Niño", null, null]), /not_authorized/);
});

test("un especialista asigna un niño disponible y la asignación persiste", async () => {
  const db = await freshDb();
  const p = await newParent(db, "mama@example.com");
  const a = await newSpecialist(db, "ana@example.com");
  const kid = await child(db, p, "Lucía Mora", "2018-03-04");

  const before = await rpc(db, a.uid, "nubi_search_children", ["luc", true]);
  assert.equal(before.length, 1);
  assert.equal(before[0].status, "available");
  assert.deepEqual(await rpc(db, a.uid, "nubi_my_assigned_children"), []);

  const res = await rpc(db, a.uid, "nubi_assign_child", [kid]);
  assert.equal(res.already_assigned, false);

  // "Cerrar sesión y volver a entrar": nueva llamada de arranque y nueva consulta.
  assert.equal((await rpc(db, a.uid, "nubi_bootstrap_me")).role, "specialist");
  const assigned = await rpc(db, a.uid, "nubi_my_assigned_children");
  assert.deepEqual(names(assigned), ["Lucía Mora"]);
  assert.equal(assigned[0].guardians[0].email, "mama@example.com");

  assert.deepEqual(await rpc(db, a.uid, "nubi_search_children", ["", true]), [], "ya no figura como disponible");
  const mine = await rpc(db, p.uid, "nubi_my_children");
  assert.equal(mine[0].status, "assigned");
  assert.equal(mine[0].specialist_name, a.full_name);
});

test("no hay asignaciones activas duplicadas", async () => {
  const db = await freshDb();
  const p = await newParent(db, "mama@example.com");
  const a = await newSpecialist(db, "ana@example.com");
  const b = await newSpecialist(db, "beto@example.com");
  const kid = await child(db, p, "Lucía Mora");

  await rpc(db, a.uid, "nubi_assign_child", [kid]);
  assert.equal((await rpc(db, a.uid, "nubi_assign_child", [kid])).already_assigned, true, "repetir es inocuo");
  await assert.rejects(rpc(db, b.uid, "nubi_assign_child", [kid]), /child_already_assigned/);

  const rows = (await db.query("select * from public.child_specialist_assignments where child_user_id = $1", [kid])).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].specialist_user_id, a.user_id);

  // Garantía final ante solicitudes simultáneas: el índice único parcial.
  await assert.rejects(
    db.query("insert into public.child_specialist_assignments (tenant_id, child_user_id, specialist_user_id) values (1, $1, $2)", [kid, b.user_id]),
    /child_specialist_assignments_one_active/,
  );
  await assert.rejects(rpc(db, a.uid, "nubi_assign_child", [999999]), /child_not_found/);
  await assert.rejects(rpc(db, a.uid, "nubi_assign_child", [p.user_id]), /child_not_found/, "un adulto no es asignable");
});

test("dos especialistas tienen niños distintos y ninguno ve los datos privados del otro", async () => {
  const db = await freshDb();
  const p = await newParent(db, "mama@example.com");
  const a = await newSpecialist(db, "ana@example.com");
  const b = await newSpecialist(db, "beto@example.com");
  const k1 = await child(db, p, "Uno");
  const k2 = await child(db, p, "Dos");
  const k3 = await child(db, p, "Tres");
  await db.query("update public.child_profiles set allergies = 'maní', emergency_contact = 'tía 8888' where user_id = $1", [k1]);

  await rpc(db, a.uid, "nubi_assign_child", [k1]);
  await rpc(db, a.uid, "nubi_assign_child", [k2]);
  await rpc(db, b.uid, "nubi_assign_child", [k3]);

  assert.deepEqual(names(await rpc(db, a.uid, "nubi_my_assigned_children")), ["Dos", "Uno"]);
  assert.deepEqual(names(await rpc(db, b.uid, "nubi_my_assigned_children")), ["Tres"]);

  // B ve en el directorio que "Uno" es de otra especialista, sin datos privados.
  const seen = (await rpc(db, b.uid, "nubi_search_children", ["Uno"]))[0];
  assert.equal(seen.status, "other");
  assert.equal(seen.specialist_name, a.full_name);
  assert.deepEqual(Object.keys(seen).sort(), ["child_user_id", "full_name", "guardian_name", "specialist_name", "status"]);
  assert.ok(!JSON.stringify(await rpc(db, b.uid, "nubi_search_children")).includes("maní"));

  // Lectura directa de la tabla: RLS deja ver solo las filas propias.
  const direct = await as(db, b.uid, "select child_user_id from public.child_specialist_assignments");
  assert.deepEqual(direct.map((r) => r.child_user_id), [k3]);
  assert.deepEqual(await as(db, p.uid, "select * from public.child_specialist_assignments"), []);

  // B no puede liberar ni transferir un niño de A.
  await assert.rejects(rpc(db, b.uid, "nubi_release_child", [k1]), /not_your_child/);
  await assert.rejects(rpc(db, b.uid, "nubi_transfer_child", [k1, b.user_id]), /invalid_target/);
  await assert.rejects(rpc(db, b.uid, "nubi_transfer_child", [k1, a.user_id]), /not_your_child/);
  assert.deepEqual(names(await rpc(db, a.uid, "nubi_my_assigned_children")), ["Dos", "Uno"]);
});

test("liberar deja al niño pendiente y conserva el historial", async () => {
  const db = await freshDb();
  const p = await newParent(db, "mama@example.com");
  const a = await newSpecialist(db, "ana@example.com");
  const b = await newSpecialist(db, "beto@example.com");
  const kid = await child(db, p, "Lucía Mora");

  await rpc(db, a.uid, "nubi_assign_child", [kid]);
  await rpc(db, a.uid, "nubi_release_child", [kid]);

  assert.equal((await rpc(db, p.uid, "nubi_my_children"))[0].status, "pending", "el niño no desaparece");
  assert.equal((await rpc(db, b.uid, "nubi_search_children", ["", true])).length, 1);
  await rpc(db, b.uid, "nubi_assign_child", [kid]);

  const hist = (await db.query(
    "select specialist_user_id, is_active, end_reason, ended_at from public.child_specialist_assignments where child_user_id = $1 order by id", [kid],
  )).rows;
  assert.equal(hist.length, 2);
  assert.deepEqual([hist[0].specialist_user_id, hist[0].is_active, hist[0].end_reason], [a.user_id, false, "released"]);
  assert.ok(hist[0].ended_at);
  assert.deepEqual([hist[1].specialist_user_id, hist[1].is_active, hist[1].end_reason], [b.user_id, true, null]);
});

test("una transferencia autorizada cierra la asignación anterior y crea la nueva", async () => {
  const db = await freshDb();
  const p = await newParent(db, "mama@example.com");
  const a = await newSpecialist(db, "ana@example.com");
  const b = await newSpecialist(db, "beto@example.com");
  const kid = await child(db, p, "Lucía Mora");
  await rpc(db, a.uid, "nubi_assign_child", [kid]);

  assert.deepEqual((await rpc(db, a.uid, "nubi_list_specialists")).map((s) => s.user_id), [b.user_id]);
  await assert.rejects(rpc(db, a.uid, "nubi_transfer_child", [kid, p.user_id]), /invalid_target/, "destino no especialista");
  await assert.rejects(rpc(db, a.uid, "nubi_transfer_child", [kid, a.user_id]), /invalid_target/, "destino = uno mismo");

  await rpc(db, a.uid, "nubi_transfer_child", [kid, b.user_id]);

  assert.deepEqual(await rpc(db, a.uid, "nubi_my_assigned_children"), []);
  assert.deepEqual(names(await rpc(db, b.uid, "nubi_my_assigned_children")), ["Lucía Mora"]);

  const hist = (await db.query(
    "select specialist_user_id, assigned_by_user_id, is_active, end_reason from public.child_specialist_assignments where child_user_id = $1 order by id", [kid],
  )).rows;
  assert.deepEqual(hist, [
    { specialist_user_id: a.user_id, assigned_by_user_id: a.user_id, is_active: false, end_reason: "transferred" },
    { specialist_user_id: b.user_id, assigned_by_user_id: a.user_id, is_active: true, end_reason: null },
  ]);
  await assert.rejects(rpc(db, a.uid, "nubi_transfer_child", [kid, b.user_id]), /not_your_child/, "ya no es suyo");
});

test("los tenants están aislados entre sí", async () => {
  const db = await freshDb();
  await db.exec("insert into public.tenants (name, subdomain) values ('Otro colegio', 'otro');");
  const p = await newParent(db, "mama@example.com");
  const a = await newSpecialist(db, "ana@example.com", 1);
  const z = await newSpecialist(db, "zoe@otro.example.com", 2);
  const kid = await child(db, p, "Lucía Mora");
  assert.equal(z.tenant_id, 2);

  assert.deepEqual(await rpc(db, z.uid, "nubi_search_children"), []);
  await assert.rejects(rpc(db, z.uid, "nubi_assign_child", [kid]), /child_not_found/);
  assert.deepEqual(await rpc(db, z.uid, "nubi_list_specialists"), []);

  await rpc(db, a.uid, "nubi_assign_child", [kid]);
  await assert.rejects(rpc(db, a.uid, "nubi_transfer_child", [kid, z.user_id]), /invalid_target/);
});

test("una fila de users ya existente se enlaza por correo confirmado y conserva sus roles", async () => {
  const db = await freshDb();
  await db.exec(`
    insert into public.users (tenant_id, email, password_hash, full_name) values (1, 'Previa@Example.com', 'x', 'Dra. Previa');
    insert into public.user_roles (user_id, role_id) select u.id, r.id from public.users u, public.roles r where r.name = 'specialist';
  `);
  const uid = await signUp(db, "previa@example.com", "parent");
  const me = await rpc(db, uid, "nubi_bootstrap_me");
  assert.equal(me.full_name, "Dra. Previa");
  assert.equal(me.role, "specialist");
  assert.equal((await db.query("select count(*)::int n from public.users")).rows[0].n, 1);
});

test("una cuenta desactivada pierde el acceso", async () => {
  const db = await freshDb();
  const a = await newSpecialist(db, "ana@example.com");
  await db.query("update public.users set is_active = false where id = $1", [a.user_id]);
  await assert.rejects(rpc(db, a.uid, "nubi_bootstrap_me"), /account_disabled/);
  await assert.rejects(rpc(db, a.uid, "nubi_search_children"), /account_not_ready/);
});

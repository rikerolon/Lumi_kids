-- ════════════════════════════════════════════════════════════════════════
-- Nubi Learn · Asignación de niños a especialistas
--
-- Migración ADITIVA: no elimina ni modifica datos, columnas o restricciones
-- existentes. Se puede ejecutar más de una vez sin efectos adicionales.
--
-- Qué hace:
--   1. Enlaza public.users con auth.users (columna nueva users.auth_user_id).
--   2. Carga el catálogo de roles si falta y un tenant por defecto si no hay.
--   3. Crea staff_invitations (quién puede ser especialista o docente).
--   4. Crea child_specialist_assignments (asignación niño ↔ especialista).
--   5. Crea las funciones nubi_* que son la ÚNICA vía de escritura.
--
-- Las tablas existentes siguen con RLS activado y sin políticas: el cliente
-- no puede leerlas ni escribirlas directamente, solo mediante las funciones.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- Si otra sesión mantiene bloqueada una tabla, falla en 5 s en vez de
-- dejar a la aplicación esperando; basta con volver a ejecutar.
set local lock_timeout = '5s';

-- ─── 0. Comprobación previa ─────────────────────────────────────────────
-- Las funciones insertan sin indicar "id": si alguna tabla no lo genera
-- sola, se aborta aquí antes de tocar nada.
do $$
declare
  v_missing text;
begin
  select string_agg(t, ', ') into v_missing
  from unnest(array['tenants', 'users', 'roles', 'child_profiles', 'parent_children']) as t
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = t and c.column_name = 'id'
      and (c.is_identity = 'YES' or c.column_default is not null)
  );
  if v_missing is not null then
    raise exception 'Nubi: la columna id no se genera automáticamente en: %', v_missing;
  end if;
end $$;

-- ─── 1. Vínculo con Supabase Auth ───────────────────────────────────────
alter table public.users
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

create unique index if not exists users_auth_user_id_key
  on public.users (auth_user_id) where auth_user_id is not null;

-- ─── 2. Catálogo de roles y tenant por defecto ──────────────────────────
insert into public.roles (name, description) values
  ('parent',     'Padre, madre o tutor'),
  ('specialist', 'Especialista de apoyo psicopedagógico'),
  ('teacher',    'Docente'),
  ('student',    'Niño / estudiante')
on conflict (name) do nothing;

insert into public.tenants (name, subdomain)
select 'Cedes Don Bosco', 'cedesdonbosco'
where not exists (select 1 from public.tenants);

-- ─── 3. Quién puede ser especialista o docente ──────────────────────────
-- Solo se administra desde el SQL Editor / service role. El rol se concede
-- al iniciar sesión con un correo confirmado que esté en esta lista; nunca
-- por lo que el cliente diga de sí mismo.
create table if not exists public.staff_invitations (
  email      varchar(255) primary key check (email = lower(btrim(email))),
  tenant_id  bigint not null references public.tenants (id) on delete cascade,
  role       varchar(50) not null default 'specialist' check (role in ('specialist', 'teacher')),
  created_at timestamp without time zone not null default now()
);

alter table public.staff_invitations enable row level security;
revoke all on table public.staff_invitations from anon, authenticated;

-- ─── 4. Asignaciones niño ↔ especialista ────────────────────────────────
-- specialist_user_id usa ON DELETE RESTRICT: borrar la cuenta de un
-- especialista no puede llevarse el historial. Las cuentas se desactivan
-- (users.is_active = false), no se borran.
create table if not exists public.child_specialist_assignments (
  id                  bigint generated always as identity primary key,
  tenant_id           bigint not null references public.tenants (id) on delete cascade,
  child_user_id       bigint not null references public.users (id) on delete cascade,
  specialist_user_id  bigint not null references public.users (id) on delete restrict,
  assigned_by_user_id bigint references public.users (id) on delete set null,
  is_active           boolean not null default true,
  assigned_at         timestamp without time zone not null default now(),
  ended_at            timestamp without time zone,
  end_reason          varchar(30) check (end_reason in ('released', 'transferred', 'specialist_inactive')),
  constraint child_specialist_assignments_distinct_users check (child_user_id <> specialist_user_id),
  constraint child_specialist_assignments_active_xor_ended check (is_active = (ended_at is null))
);

-- Un único especialista activo por niño. Es también la garantía final
-- frente a dos solicitudes simultáneas.
create unique index if not exists child_specialist_assignments_one_active
  on public.child_specialist_assignments (child_user_id) where is_active;

create index if not exists child_specialist_assignments_specialist_active
  on public.child_specialist_assignments (specialist_user_id) where is_active;

create index if not exists child_specialist_assignments_child_history
  on public.child_specialist_assignments (child_user_id, assigned_at);

alter table public.child_specialist_assignments enable row level security;
revoke all on table public.child_specialist_assignments from anon, authenticated;
grant select on table public.child_specialist_assignments to authenticated;

-- ─── 5. Funciones de identidad ──────────────────────────────────────────
create or replace function public.nubi_current_user_id()
returns bigint
language sql stable security definer set search_path = ''
as $$
  select u.id from public.users u
  where u.auth_user_id = (select auth.uid()) and u.is_active
$$;

-- Uso interno: devuelve la fila del usuario autenticado si su cuenta y su
-- tenant están activos y tiene el rol pedido.
create or replace function public.nubi_require_role(p_role text)
returns public.users
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me public.users%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select u.* into v_me
  from public.users u
  join public.tenants t on t.id = u.tenant_id and t.is_active
  where u.auth_user_id = auth.uid() and u.is_active;
  if not found then
    raise exception 'account_not_ready' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = v_me.id and r.name = p_role
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return v_me;
end $$;

-- Uso interno: ¿es este usuario un especialista vigente de ese tenant?
create or replace function public.nubi_is_active_specialist(p_user_id bigint, p_tenant_id bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    join public.user_roles ur on ur.user_id = u.id
    join public.roles r on r.id = ur.role_id and r.name = 'specialist'
    where u.id = p_user_id and u.tenant_id = p_tenant_id and u.is_active
  )
$$;

-- Política de lectura directa: cada especialista ve solo sus propias filas.
-- No hay políticas de escritura: insert/update/delete solo vía funciones.
drop policy if exists child_specialist_assignments_select_own on public.child_specialist_assignments;
create policy child_specialist_assignments_select_own
  on public.child_specialist_assignments
  for select to authenticated
  using (specialist_user_id = (select public.nubi_current_user_id()));

-- La propia tabla rechaza asignaciones activas incoherentes, también las
-- hechas a mano desde el SQL Editor: el niño debe ser un niño de ese tenant
-- y el especialista un especialista vigente del mismo tenant.
create or replace function public.nubi_validate_assignment()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.is_active then
    if not exists (
      select 1 from public.users c
      join public.child_profiles cp on cp.user_id = c.id
      where c.id = new.child_user_id and c.tenant_id = new.tenant_id
    ) then
      raise exception 'child_not_found';
    end if;
    if not public.nubi_is_active_specialist(new.specialist_user_id, new.tenant_id) then
      raise exception 'invalid_target';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists child_specialist_assignments_validate on public.child_specialist_assignments;
create trigger child_specialist_assignments_validate
  before insert or update of tenant_id, child_user_id, specialist_user_id, is_active
  on public.child_specialist_assignments
  for each row execute function public.nubi_validate_assignment();

-- ─── 6. Alta / enlace de la cuenta al iniciar sesión ────────────────────
-- Crea (o enlaza por correo confirmado) la fila de public.users del usuario
-- de Supabase Auth y devuelve su rol REAL. Del rol pedido en el registro solo
-- se respeta 'parent'; 'specialist' y 'teacher' exigen invitación.
create or replace function public.nubi_bootstrap_me()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_email     text;
  v_confirmed timestamptz;
  v_meta      jsonb;
  v_inv       public.staff_invitations%rowtype;
  v_me        public.users%rowtype;
  v_matches   integer;
  v_tenant    bigint;
  v_role      text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select lower(btrim(a.email)), a.email_confirmed_at, coalesce(a.raw_user_meta_data, '{}'::jsonb)
    into v_email, v_confirmed, v_meta
  from auth.users a where a.id = v_uid;

  if v_email is null or v_confirmed is null then
    raise exception 'email_not_confirmed' using errcode = '42501';
  end if;

  select * into v_inv from public.staff_invitations i where i.email = v_email;

  select * into v_me from public.users u where u.auth_user_id = v_uid;
  if not found then
    -- Serializa el alta por correo para no crear la cuenta dos veces.
    perform pg_advisory_xact_lock(hashtext('nubi_bootstrap:' || v_email));
    select * into v_me from public.users u where u.auth_user_id = v_uid;
  end if;

  if v_me.id is null then
    -- ¿Existe ya una fila con ese correo sin enlazar? Se reutiliza solo si
    -- es inequívoca. Las filas de niños nunca se enlazan a una cuenta.
    select count(*) into v_matches
    from public.users u
    where lower(u.email) = v_email and u.auth_user_id is null
      and not exists (select 1 from public.child_profiles cp where cp.user_id = u.id);

    if v_matches > 1 then
      raise exception 'account_conflict';
    elsif v_matches = 1 then
      update public.users u set auth_user_id = v_uid, updated_at = now()
      where lower(u.email) = v_email and u.auth_user_id is null
        and not exists (select 1 from public.child_profiles cp where cp.user_id = u.id)
      returning u.* into v_me;
    else
      v_tenant := coalesce(
        v_inv.tenant_id,
        (select t.id from public.tenants t where t.is_active order by t.id limit 1)
      );
      if v_tenant is null then
        raise exception 'tenant_not_configured';
      end if;

      insert into public.users (tenant_id, email, password_hash, full_name, auth_user_id)
      values (
        v_tenant, v_email, '!supabase-auth',
        left(coalesce(nullif(btrim(v_meta ->> 'full_name'), ''), split_part(v_email, '@', 1)), 100),
        v_uid
      )
      returning * into v_me;
    end if;

    -- Rol pedido en el registro: solo 'parent', y solo si la cuenta (nueva o
    -- recién enlazada) todavía no tiene ningún rol.
    if v_meta ->> 'role' = 'parent'
       and not exists (select 1 from public.user_roles ur where ur.user_id = v_me.id) then
      insert into public.user_roles (user_id, role_id, is_primary)
      select v_me.id, r.id, true from public.roles r where r.name = 'parent'
      on conflict do nothing;
    end if;
  end if;

  if not v_me.is_active
     or not exists (select 1 from public.tenants t where t.id = v_me.tenant_id and t.is_active) then
    raise exception 'account_disabled' using errcode = '42501';
  end if;

  if v_inv.email is not null and v_inv.tenant_id = v_me.tenant_id then
    insert into public.user_roles (user_id, role_id, is_primary)
    select v_me.id, r.id, false from public.roles r where r.name = v_inv.role
    on conflict do nothing;

    if v_inv.role = 'specialist' then
      insert into public.professional_profiles (user_id, tenant_id)
      values (v_me.id, v_me.tenant_id)
      on conflict do nothing;
    end if;
  end if;

  update public.users set last_login_at = now() where id = v_me.id;

  select r.name::text into v_role
  from public.user_roles ur join public.roles r on r.id = ur.role_id
  where ur.user_id = v_me.id and r.name in ('specialist', 'teacher', 'parent')
  order by array_position(array['specialist', 'teacher', 'parent'], r.name::text)
  limit 1;

  return jsonb_build_object(
    'user_id', v_me.id,
    'tenant_id', v_me.tenant_id,
    'full_name', v_me.full_name,
    'email', v_me.email,
    'role', coalesce(v_role, 'pending')
  );
end $$;

-- ─── 7. Padre: crear y consultar hijos ──────────────────────────────────
-- El niño es un usuario (así lo exige el esquema: child_profiles.user_id y
-- parent_children.child_user_id apuntan a users). No inicia sesión, por eso
-- lleva un correo interno no enrutable y un hash de contraseña inválido.
create or replace function public.nubi_create_child(
  p_full_name    text,
  p_birth_date   date default null,
  p_relationship text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me      public.users%rowtype;
  v_name    text := nullif(btrim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g')), '');
  v_student integer;
  v_child   bigint;
begin
  v_me := public.nubi_require_role('parent');

  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'invalid_name';
  end if;
  if p_birth_date is not null
     and (p_birth_date > current_date or p_birth_date < current_date - interval '25 years') then
    raise exception 'invalid_birth_date';
  end if;

  select r.id into v_student from public.roles r where r.name = 'student';
  if v_student is null then
    raise exception 'roles_not_configured';
  end if;

  -- Serializa por padre para que los controles siguientes sean fiables.
  perform pg_advisory_xact_lock(hashtext('nubi_create_child:' || v_me.id));

  if (select count(*) from public.parent_children pc where pc.parent_user_id = v_me.id) >= 10 then
    raise exception 'child_limit_reached';
  end if;

  if exists (
    select 1
    from public.parent_children pc
    join public.users c on c.id = pc.child_user_id
    left join public.child_profiles cp on cp.user_id = c.id
    where pc.parent_user_id = v_me.id
      and lower(c.full_name) = lower(v_name)
      and cp.birth_date is not distinct from p_birth_date
  ) then
    raise exception 'child_duplicate';
  end if;

  insert into public.users (tenant_id, email, password_hash, full_name)
  values (
    v_me.tenant_id,
    'child-' || replace(gen_random_uuid()::text, '-', '') || '@nubi.invalid',
    '!no-login',
    v_name
  )
  returning id into v_child;

  insert into public.user_roles (user_id, role_id, is_primary) values (v_child, v_student, true);

  insert into public.child_profiles (user_id, tenant_id, birth_date)
  values (v_child, v_me.tenant_id, p_birth_date);

  insert into public.parent_children (tenant_id, parent_user_id, child_user_id, relationship_type, is_primary_guardian)
  values (v_me.tenant_id, v_me.id, v_child, left(nullif(btrim(p_relationship), ''), 50), true);

  return jsonb_build_object('child_user_id', v_child, 'full_name', v_name);
end $$;

create or replace function public.nubi_my_children()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me public.users%rowtype;
begin
  v_me := public.nubi_require_role('parent');

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'child_user_id', c.id,
      'full_name', c.full_name,
      'birth_date', cp.birth_date,
      'relationship_type', pc.relationship_type,
      'status', case when a.id is null then 'pending' else 'assigned' end,
      'specialist_name', s.full_name,
      'assigned_at', a.assigned_at
    ) order by c.full_name, c.id), '[]'::jsonb)
    from public.parent_children pc
    join public.users c on c.id = pc.child_user_id and c.is_active
    left join public.child_profiles cp on cp.user_id = c.id
    left join public.child_specialist_assignments a
      on a.child_user_id = c.id and a.is_active
     and public.nubi_is_active_specialist(a.specialist_user_id, a.tenant_id)
    left join public.users s on s.id = a.specialist_user_id
    where pc.parent_user_id = v_me.id
  );
end $$;

-- ─── 8. Especialista: consulta ──────────────────────────────────────────
-- Perfil completo, solo de los niños asignados al especialista autenticado.
create or replace function public.nubi_my_assigned_children()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me public.users%rowtype;
begin
  v_me := public.nubi_require_role('specialist');

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'child_user_id', c.id,
      'full_name', c.full_name,
      'birth_date', cp.birth_date,
      'school_name', sc.name,
      'classroom_name', cl.name,
      'guardian_phone', cp.guardian_phone,
      'allergies', cp.allergies,
      'emergency_contact', cp.emergency_contact,
      'assigned_at', a.assigned_at,
      'guardians', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'full_name', p.full_name,
          'email', p.email,
          'phone', p.phone,
          'relationship_type', pc.relationship_type,
          'is_primary_guardian', pc.is_primary_guardian
        ) order by pc.is_primary_guardian desc, p.full_name), '[]'::jsonb)
        from public.parent_children pc
        join public.users p on p.id = pc.parent_user_id
        where pc.child_user_id = c.id
      )
    ) order by c.full_name, c.id), '[]'::jsonb)
    from public.child_specialist_assignments a
    join public.users c on c.id = a.child_user_id and c.is_active
    left join public.child_profiles cp on cp.user_id = c.id
    left join public.schools sc on sc.id = cp.school_id
    left join public.classrooms cl on cl.id = cp.classroom_id
    where a.specialist_user_id = v_me.id and a.is_active
  );
end $$;

-- Directorio para asignar: SOLO datos mínimos (nombre, tutor y estado) de
-- los niños del mismo tenant. Nunca devuelve datos privados del perfil.
-- Un niño cuyo especialista ya no está vigente figura como disponible.
create or replace function public.nubi_search_children(
  p_query          text default '',
  p_only_available boolean default false
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me public.users%rowtype;
  v_q  text := lower(btrim(coalesce(p_query, '')));
begin
  v_me := public.nubi_require_role('specialist');

  return (
    select coalesce(jsonb_agg(to_jsonb(x) - 'sort_key' order by x.sort_key, x.full_name, x.child_user_id), '[]'::jsonb)
    from (
      select
        c.id as child_user_id,
        c.full_name,
        (
          select p.full_name from public.parent_children pc
          join public.users p on p.id = pc.parent_user_id
          where pc.child_user_id = c.id
          order by pc.is_primary_guardian desc, pc.id
          limit 1
        ) as guardian_name,
        case
          when a.id is null then 'available'
          when a.specialist_user_id = v_me.id then 'mine'
          else 'other'
        end as status,
        s.full_name as specialist_name,
        case when a.id is null then 0 when a.specialist_user_id = v_me.id then 1 else 2 end as sort_key
      from public.child_profiles cp
      join public.users c on c.id = cp.user_id and c.is_active
      left join public.child_specialist_assignments a
        on a.child_user_id = c.id and a.is_active
       and public.nubi_is_active_specialist(a.specialist_user_id, a.tenant_id)
      left join public.users s on s.id = a.specialist_user_id
      where c.tenant_id = v_me.tenant_id
        and (not p_only_available or a.id is null)
        and (v_q = '' or position(v_q in lower(c.full_name)) > 0 or c.id::text = v_q)
      order by sort_key, c.full_name, c.id
      limit 50
    ) x
  );
end $$;

create or replace function public.nubi_list_specialists()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me public.users%rowtype;
begin
  v_me := public.nubi_require_role('specialist');

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', u.id,
      'full_name', u.full_name,
      'specialty', pp.specialty
    ) order by u.full_name, u.id), '[]'::jsonb)
    from public.users u
    left join public.professional_profiles pp on pp.user_id = u.id
    where u.id <> v_me.id and public.nubi_is_active_specialist(u.id, v_me.tenant_id)
  );
end $$;

-- ─── 9. Especialista: asignar, liberar y transferir ─────────────────────
-- El especialista SIEMPRE es el usuario autenticado; el cliente no envía
-- ningún identificador de especialista para asignarse un niño.
create or replace function public.nubi_assign_child(p_child_user_id bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me  public.users%rowtype;
  v_cur public.child_specialist_assignments%rowtype;
  v_id  bigint;
begin
  v_me := public.nubi_require_role('specialist');

  -- Bloquea la fila del niño: dos asignaciones simultáneas se ejecutan en serie.
  perform 1
  from public.users c
  where c.id = p_child_user_id and c.tenant_id = v_me.tenant_id and c.is_active
    and exists (select 1 from public.child_profiles cp where cp.user_id = c.id)
  for update of c;
  if not found then
    raise exception 'child_not_found';
  end if;

  select * into v_cur from public.child_specialist_assignments a
  where a.child_user_id = p_child_user_id and a.is_active;
  if found then
    if v_cur.specialist_user_id = v_me.id then
      return jsonb_build_object('assignment_id', v_cur.id, 'already_assigned', true);
    end if;
    if public.nubi_is_active_specialist(v_cur.specialist_user_id, v_cur.tenant_id) then
      raise exception 'child_already_assigned';
    end if;
    -- El especialista anterior fue desactivado o perdió el rol: su asignación
    -- se cierra (queda en el historial) y el niño puede ser atendido por otro.
    update public.child_specialist_assignments
    set is_active = false, ended_at = now(), end_reason = 'specialist_inactive'
    where id = v_cur.id;
  end if;

  begin
    insert into public.child_specialist_assignments (tenant_id, child_user_id, specialist_user_id, assigned_by_user_id)
    values (v_me.tenant_id, p_child_user_id, v_me.id, v_me.id)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'child_already_assigned';
  end;

  return jsonb_build_object('assignment_id', v_id, 'already_assigned', false);
end $$;

-- Regla de transferencia: solo el especialista que tiene AHORA al niño puede
-- liberarlo (queda pendiente) o transferirlo a otro especialista del mismo
-- tenant. Nadie puede quitarle un niño a otro profesional vigente.
create or replace function public.nubi_release_child(p_child_user_id bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me public.users%rowtype;
  v_id bigint;
begin
  v_me := public.nubi_require_role('specialist');

  update public.child_specialist_assignments a
  set is_active = false, ended_at = now(), end_reason = 'released'
  where a.child_user_id = p_child_user_id and a.specialist_user_id = v_me.id and a.is_active
  returning a.id into v_id;
  if not found then
    raise exception 'not_your_child' using errcode = '42501';
  end if;

  return jsonb_build_object('closed_assignment_id', v_id);
end $$;

create or replace function public.nubi_transfer_child(p_child_user_id bigint, p_to_specialist_user_id bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me     public.users%rowtype;
  v_old_id bigint;
  v_new_id bigint;
begin
  v_me := public.nubi_require_role('specialist');

  if p_to_specialist_user_id is null or p_to_specialist_user_id = v_me.id
     or not public.nubi_is_active_specialist(p_to_specialist_user_id, v_me.tenant_id) then
    raise exception 'invalid_target';
  end if;

  perform 1 from public.users c
  where c.id = p_child_user_id and c.tenant_id = v_me.tenant_id
  for update of c;

  update public.child_specialist_assignments a
  set is_active = false, ended_at = now(), end_reason = 'transferred'
  where a.child_user_id = p_child_user_id and a.specialist_user_id = v_me.id and a.is_active
  returning a.id into v_old_id;
  if not found then
    raise exception 'not_your_child' using errcode = '42501';
  end if;

  insert into public.child_specialist_assignments (tenant_id, child_user_id, specialist_user_id, assigned_by_user_id)
  values (v_me.tenant_id, p_child_user_id, p_to_specialist_user_id, v_me.id)
  returning id into v_new_id;

  return jsonb_build_object('closed_assignment_id', v_old_id, 'assignment_id', v_new_id);
end $$;

-- ─── 10. Permisos de ejecución ──────────────────────────────────────────
revoke all on function
  public.nubi_current_user_id(),
  public.nubi_require_role(text),
  public.nubi_is_active_specialist(bigint, bigint),
  public.nubi_validate_assignment(),
  public.nubi_bootstrap_me(),
  public.nubi_create_child(text, date, text),
  public.nubi_my_children(),
  public.nubi_my_assigned_children(),
  public.nubi_search_children(text, boolean),
  public.nubi_list_specialists(),
  public.nubi_assign_child(bigint),
  public.nubi_release_child(bigint),
  public.nubi_transfer_child(bigint, bigint)
from public, anon, authenticated;

-- nubi_require_role, nubi_is_active_specialist y nubi_validate_assignment
-- quedan sin permiso a propósito: son de uso interno.
grant execute on function
  public.nubi_current_user_id(),
  public.nubi_bootstrap_me(),
  public.nubi_create_child(text, date, text),
  public.nubi_my_children(),
  public.nubi_my_assigned_children(),
  public.nubi_search_children(text, boolean),
  public.nubi_list_specialists(),
  public.nubi_assign_child(bigint),
  public.nubi_release_child(bigint),
  public.nubi_transfer_child(bigint, bigint)
to authenticated;

commit;

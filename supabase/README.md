# Base de datos de Nubi Learn

| Ruta | Qué es |
|---|---|
| `schema_dump.json` | Volcado del esquema real (columnas, restricciones, RLS). Lo usan las pruebas. |
| `migrations/20261011220000_child_specialist_assignments.sql` | Migración de asignación de niños a especialistas. |
| `tests/` | Pruebas de la migración sobre un Postgres embebido en memoria. |
| `functions/miro-chat/` | Función preparada para sacar la clave de OpenAI del cliente (sin desplegar). |

## Aplicar la migración

La base de datos es de **producción**. La migración es aditiva (no borra ni altera datos
existentes), corre dentro de una transacción y se puede repetir sin efectos.

1. Haz una copia de seguridad (Supabase → Database → Backups).
2. Abre Supabase → SQL Editor, pega el contenido completo del archivo de `migrations/` y ejecútalo.
3. Comprueba el resultado:

```sql
select name from public.roles order by name;            -- parent, specialist, student, teacher
select id, name from public.tenants;                    -- al menos uno
select count(*) from public.child_specialist_assignments; -- 0
```

Si ya existía un tenant, la migración no crea otro: las cuentas nuevas se dan de alta en el
tenant activo con menor `id`.

## Autorizar a un especialista

Nadie obtiene el rol de especialista por elegirlo en la app. Se concede cuando un correo
**confirmado** que está en `specialist_invitations` inicia sesión:

```sql
insert into public.specialist_invitations (email, tenant_id)
values ('especialista@ejemplo.com', (select id from public.tenants order by id limit 1));
```

El correo va en minúsculas. Funciona tanto si la persona ya creó su cuenta como si la crea
después; el rol se aplica en su siguiente inicio de sesión.

Para retirar el acceso:

```sql
delete from public.specialist_invitations where email = 'especialista@ejemplo.com';
delete from public.user_roles
where user_id = (select id from public.users where email = 'especialista@ejemplo.com')
  and role_id = (select id from public.roles where name = 'specialist');
```

Sus asignaciones activas no se tocan; transfiérelas antes o ciérralas con:

```sql
update public.child_specialist_assignments
set is_active = false, ended_at = now(), end_reason = 'released'
where is_active and specialist_user_id = (select id from public.users where email = 'especialista@ejemplo.com');
```

## Reglas de asignación

- Un niño tiene como máximo un especialista activo (índice único parcial sobre `child_user_id`).
- Sin fila activa, el niño está **pendiente**; nunca desaparece.
- Solo el especialista que tiene ahora al niño puede **liberarlo** o **transferirlo** a otro
  especialista del mismo tenant. Nadie puede quitarle un niño a otro profesional.
- Liberar y transferir cierran la fila (`is_active = false`, `ended_at`, `end_reason`) y la
  conservan como historial; la transferencia crea además la fila nueva en la misma transacción.

Historial de un niño:

```sql
select a.id, s.full_name as especialista, a.assigned_at, a.ended_at, a.end_reason, a.is_active
from public.child_specialist_assignments a
join public.users s on s.id = a.specialist_user_id
where a.child_user_id = 123
order by a.id;
```

## Pruebas

```bash
npm test
```

Reconstruyen las tablas reales desde `schema_dump.json`, simulan los roles de Supabase
(`anon`, `authenticated`, `auth.uid()`), aplican la migración y ejercitan permisos y flujo.
No se conectan a ningún servidor.

## Deshacer la migración

Solo si hace falta, y perdiendo las asignaciones registradas:

```sql
begin;
drop function if exists public.nubi_transfer_child(bigint, bigint), public.nubi_release_child(bigint),
  public.nubi_assign_child(bigint), public.nubi_list_specialists(), public.nubi_search_children(text, boolean),
  public.nubi_my_assigned_children(), public.nubi_my_children(), public.nubi_create_child(text, date, text),
  public.nubi_bootstrap_me(), public.nubi_require_role(text);
drop table if exists public.child_specialist_assignments, public.specialist_invitations;
drop function if exists public.nubi_current_user_id();
alter table public.users drop column if exists auth_user_id;
commit;
```

Los roles sembrados y el tenant por defecto se dejan: pueden tener ya usuarios asociados.

## Tarea de seguridad: clave de OpenAI

`EXPO_PUBLIC_OPENAI_API_KEY` se incluye en el bundle de la app (todo `EXPO_PUBLIC_*` es
público). Cualquiera puede extraerla y consumir la cuenta de OpenAI.

1. **Rotar** la clave actual en OpenAI: ya debe considerarse expuesta.
2. Guardar la nueva como secreto del servidor: `supabase secrets set OPENAI_API_KEY=...`
3. Desplegar `functions/miro-chat` (`supabase functions deploy miro-chat`).
4. En `src/components/chatbot-widget.tsx` y `chat-bubble.tsx`, cambiar el `fetch` a OpenAI por
   `supabase.functions.invoke("miro-chat", { body: { messages } })` y leer `data.reply`.
5. Borrar `EXPO_PUBLIC_OPENAI_API_KEY` de `.env`.
6. Antes de publicar: decidir cómo limitar el uso. Los estudiantes hoy no inician sesión, así
   que la función no puede exigir un usuario autenticado; hace falta un límite por IP o que
   el niño tenga sesión.

La función está escrita pero no se ha desplegado ni probado.

// Supabase Edge Function (Deno) · PREPARADA, SIN DESPLEGAR NI PROBAR.
//
// Sustituye la llamada directa a OpenAI que hoy hace el cliente con
// EXPO_PUBLIC_OPENAI_API_KEY. La clave pasa a ser un secreto del servidor:
//   supabase secrets set OPENAI_API_KEY=...
//   supabase functions deploy miro-chat
// Pasos completos en supabase/README.md ("Tarea de seguridad: clave de OpenAI").

const SYSTEM_PROMPT =
  "Eres Miro, la mascota zorro asistente de Nubi Learn, una plataforma educativa para niños de kínder y primaria. " +
  "Responde siempre en español, en oraciones cortas, con tono cálido, positivo y sencillo, adecuado para niños. " +
  "Usa emojis con moderación. Si te preguntan sobre matemáticas, lenguaje o vocabulario, explica paso a paso y con paciencia.";

const MAX_MESSAGES = 20;
const MAX_CHARS = 1000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ error: "not_configured" }, 500);

  let messages: { role: string; content: string }[];
  try {
    messages = (await req.json()).messages;
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  // El cliente solo aporta turnos user/assistant; el prompt de sistema vive aquí.
  if (
    !Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES ||
    messages.some((m) => !["user", "assistant"].includes(m?.role) || typeof m?.content !== "string" || m.content.length > MAX_CHARS)
  ) {
    return json({ error: "invalid_messages" }, 400);
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages.map(({ role, content }) => ({ role, content }))],
      max_tokens: 300,
    }),
  });
  if (!res.ok) return json({ error: "upstream_error" }, 502);

  const data = await res.json();
  return json({ reply: data?.choices?.[0]?.message?.content ?? null });
});

// Edge Function "noticias": reads financial-news RSS feeds and stores new headlines in public.noticias.
// Called every 5 minutes by pg_cron. Reads stay public through the table's RLS policy.
import { createClient } from "npm:@supabase/supabase-js@2";
import { FEEDS, toRows, fedBody } from "./parse.js";

const UA = "Mozilla/5.0 (compatible; PregaoDoDia/1.0; +https://pedropferraz.github.io/pregao/)";

async function fetchText(url: string, ms = 8000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/xml, text/html;q=0.8" }, signal: ctrl.signal, redirect: "follow" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}

Deno.serve(async () => {
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const now = new Date();
  const ok: string[] = [], failed: string[] = [];

  const results = await Promise.allSettled(FEEDS.map(async (f: any) => ({ f, xml: await fetchText(f.url) })));
  // deno-lint-ignore no-explicit-any
  let rows: any[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") { ok.push(FEEDS[i].name); rows.push(...toRows(r.value.f, r.value.xml, now)); }
    else failed.push(FEEDS[i].name);
  });

  // dedupe within this batch (first source wins: direct feeds come before Google aggregation)
  const seen = new Set<string>();
  rows = rows.filter(r => (seen.has(r.id) ? false : (seen.add(r.id), true)));

  // only insert what is new
  const existing = new Set<string>();
  for (let i = 0; i < rows.length; i += 200) {
    const { data } = await supa.from("noticias").select("id").in("id", rows.slice(i, i + 200).map(r => r.id));
    (data || []).forEach((d: any) => existing.add(d.id));
  }
  const fresh = rows.filter(r => !existing.has(r.id));

  // Federal Reserve press releases: pull the full statement for new ones (public domain)
  let fedFetched = 0;
  for (const r of fresh) {
    if (!r._fed || fedFetched >= 3) continue;
    try { const body = fedBody(await fetchText(r.url, 8000)); if (body) { r.body = body; r.full_text = true; r.summary = r.summary || body[0].slice(0, 260); } } catch { /* keep headline only */ }
    fedFetched++;
  }
  const payload = fresh.map(({ _fed, ...r }) => r);

  let inserted = 0;
  if (payload.length) {
    const { error, count } = await supa.from("noticias").upsert(payload, { onConflict: "id", ignoreDuplicates: true, count: "exact" });
    if (error) failed.push("db: " + error.message); else inserted = count ?? payload.length;
  }

  // keep the table small: 5 days of history
  await supa.from("noticias").delete().lt("published_at", new Date(now.getTime() - 5 * 86400 * 1000).toISOString());
  await supa.from("noticias_status").upsert({ id: 1, last_run: now.toISOString(), inserted, feeds_ok: ok.length, feeds_failed: failed });

  return new Response(JSON.stringify({ inserted, candidates: rows.length, feeds_ok: ok.length, feeds_failed: failed }), {
    headers: { "Content-Type": "application/json" },
  });
});

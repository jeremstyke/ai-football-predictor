// AI Football Predictor - mini app API extension (team and competition sheets) - by @jeremstyke
// 7 nov 2026 (Jeremy): "quand on clique sur une équipe on a des détails et quand on clique sur un championnat on a les classements et d'autres trucs".
// Served by the afp-blog Railway function (loader), code stored in afp_assets key 'api_ts' (edit with SQL, no redeploy).
// Auth: Telegram WebApp initData (HMAC with the bot token). API-Football answers are cached in afp_tdata (6 h, fixture ids 30 days).
import { createHmac, createHash, randomBytes } from "node:crypto";
const SB_URL = Bun.env.SUPABASE_URL!, SB_KEY = Bun.env.SUPABASE_SERVICE_KEY!, APIF = Bun.env.APIF_KEY || "", TOKEN = Bun.env.TELEGRAM_BOT_TOKEN || "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "x-init-data,x-web,content-type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };
const out = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
async function sb(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  const t = await r.text(); if (!r.ok) { console.log("sb error", path, r.status, t.slice(0, 200)); return null; } return t ? JSON.parse(t) : true;
}
function checkInit(initData: string) {
  try {
    const p = new URLSearchParams(initData); const hash = p.get("hash"); if (!hash) return false; p.delete("hash");
    const dcs = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join("\n");
    const secret = createHmac("sha256", "WebAppData").update(TOKEN).digest();
    return createHmac("sha256", secret).update(dcs).digest("hex") === hash;
  } catch { return false; }
}
async function af(path: string) {
  try { const r = await fetch(`https://v3.football.api-sports.io/${path}`, { headers: { "x-apisports-key": APIF } }); const j: any = await r.json(); return j?.response ?? null; } catch (e) { console.log("af error", path, String(e)); return null; }
}
async function cached(key: string, ttl: number, fn: () => Promise<any>) {
  const row = (await sb(`afp_tdata?key=eq.${encodeURIComponent(key)}&select=data,updated_at`))?.[0];
  if (row && Date.now() - Date.parse(row.updated_at) < ttl) return row.data;
  const d = await fn();
  if (d) { await sb("afp_tdata?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key, data: d, updated_at: new Date().toISOString() }) }); return d; }
  return row?.data ?? null;
}
async function fx(n: number) {
  const p = (await sb(`afp_predictions?n=eq.${n}&select=af_id,league,home,away`))?.[0]; if (!p?.af_id) return null;
  const f = await cached(`fx:${p.af_id}`, 30 * 86400000, async () => {
    const x = (await af(`fixtures?id=${p.af_id}`))?.[0]; if (!x) return null;
    return { lg: x.league.id, ss: x.league.season, lname: x.league.name, llogo: x.league.logo, country: x.league.country, hid: x.teams.home.id, aid: x.teams.away.id, hn: x.teams.home.name, an: x.teams.away.name, hlogo: x.teams.home.logo, alogo: x.teams.away.logo };
  });
  return f ? { ...f, code: p.league, home: p.home, away: p.away } : null;
}
const fxRow = (f: any, tid?: number) => ({ d: f.fixture.date, st: f.fixture.status?.short, comp: f.league?.name, h: f.teams.home.name, a: f.teams.away.name, hl: f.teams.home.logo, al: f.teams.away.logo, hg: f.goals.home, ag: f.goals.away, r: tid == null || f.goals.home == null ? null : (() => { const me = f.teams.home.id === tid ? f.goals.home : f.goals.away, op = f.teams.home.id === tid ? f.goals.away : f.goals.home; return me > op ? "W" : me === op ? "D" : "L"; })() });
function table(st: any) {
  const groups: any[] = st?.[0]?.league?.standings || [];
  return groups.map((g: any[]) => g.map((r: any) => ({ rk: r.rank, id: r.team.id, t: r.team.name, l: r.team.logo, pts: r.points, gd: r.goalsDiff, p: r.all?.played, w: r.all?.win, dr: r.all?.draw, lo: r.all?.lose, gf: r.all?.goals?.for, ga: r.all?.goals?.against, f: r.form || "", g: r.group, desc: r.description || "" })));
}
async function ours(filter: string) {
  const rows = (await sb(`afp_predictions?selected=eq.true&status=in.(won,lost)&${filter}&select=home,away,pick,status,hg,ag,kickoff&order=kickoff.desc&limit=200`)) || [];
  return { n: rows.length, won: rows.filter((r: any) => r.status === "won").length, last: rows.slice(0, 5) };
}
async function team(n: number, side: string) {
  const f = await fx(n); if (!f) return { ok: false };
  const tid = side === "a" ? f.aid : f.hid, name = side === "a" ? f.away : f.home;
  const d = await cached(`team:${tid}:${f.lg}:${f.ss}`, 6 * 3600000, async () => {
    const [s, last, next, st] = await Promise.all([af(`teams/statistics?league=${f.lg}&season=${f.ss}&team=${tid}`), af(`fixtures?team=${tid}&last=6`), af(`fixtures?team=${tid}&next=4`), af(`standings?league=${f.lg}&season=${f.ss}`)]);
    if (!s) return null;
    const tb = table(st).flat(), me = tb.find((r: any) => r.id === tid);
    const g = (o: any) => ({ h: o?.home ?? null, a: o?.away ?? null, t: o?.total ?? null });
    return {
      id: tid, name: s.team?.name, logo: s.team?.logo, league: s.league?.name, llogo: s.league?.logo, season: f.ss,
      rank: me ? { rk: me.rk, of: tb.filter((r: any) => r.g === me.g).length, pts: me.pts, gd: me.gd, desc: me.desc } : null,
      form: (s.form || "").slice(-10),
      played: g(s.fixtures?.played), wins: g(s.fixtures?.wins), draws: g(s.fixtures?.draws), loses: g(s.fixtures?.loses),
      gf: g(s.goals?.for?.total), ga: g(s.goals?.against?.total), gfa: g(s.goals?.for?.average), gaa: g(s.goals?.against?.average),
      cs: g(s.clean_sheet), fts: g(s.failed_to_score), streak: s.biggest?.streak || null, bigwin: s.biggest?.wins || null,
      formation: (s.lineups || []).sort((a: any, b: any) => b.played - a.played)[0]?.formation || null,
      last: (last || []).map((x: any) => fxRow(x, tid)), next: (next || []).map((x: any) => fxRow(x)),
    };
  });
  if (!d) return { ok: false };
  const o = await ours(`or=(home.eq.${encodeURIComponent(name)},away.eq.${encodeURIComponent(name)})`);
  // 8 nov 2026: the team's scorers and assist makers from the competition sheet (players open from everywhere)
  let sc: any[] = [], as: any[] = [];
  try { const L: any = await league(n); if (L?.ok) { sc = (L.scorers || []).filter((x: any) => x.tid === tid); as = (L.assists || []).filter((x: any) => x.tid === tid); } } catch {}
  return { ok: true, ...d, ours: o, our_name: name, sc, as };
}
// ---------- player sheet (8 nov 2026, Jeremy: "des fiches joueurs"): season stats + our probability that he scores in his team's next match.
// P(score) = 1 - exp(-xG of his team in the next match (our model) x his share of the team's league goals x minutes per game / 90)
async function player(n: number, pid: number) {
  const f = await fx(n); if (!f || !pid) return { ok: false };
  const d = await cached(`player:${pid}:${f.ss}`, 6 * 3600000, async () => {
    const r = (await af(`players?id=${pid}&season=${f.ss}`))?.[0]; if (!r) return null;
    const p = r.player || {};
    return { id: p.id, name: p.name, first: p.firstname, last: p.lastname, age: p.age, nat: p.nationality, photo: p.photo, height: p.height,
      stats: (r.statistics || []).filter((s: any) => s.games?.appearences).map((s: any) => ({ lgid: s.league?.id, lg: s.league?.name, llogo: s.league?.logo, team: s.team?.name, tid: s.team?.id, tlogo: s.team?.logo,
        app: s.games.appearences, min: s.games.minutes || 0, pos: s.games.position, rating: s.games.rating ? Number(s.games.rating).toFixed(2) : null,
        g: s.goals?.total || 0, a: s.goals?.assists || 0, shots: s.shots?.total ?? null, sot: s.shots?.on ?? null, pen: s.penalty?.scored ?? null, y: s.cards?.yellow ?? 0, rc: s.cards?.red ?? 0 })) };
  });
  if (!d) return { ok: false };
  const main = d.stats.find((s: any) => s.lgid === f.lg) || d.stats.slice().sort((a: any, b: any) => b.min - a.min)[0] || null;
  let next: any = null;
  if (main?.tid) {
    const t = main.tid;
    const m = (await sb(`afp_predictions?kickoff=gt.${new Date().toISOString()}&or=(home_logo.like.*/teams/${t}.png,away_logo.like.*/teams/${t}.png)&order=kickoff.asc&limit=1&select=n,home,away,kickoff,league,xg_h,xg_a,home_logo,away_logo,ph,pd,pa`))?.[0];
    if (m) {
      const home = String(m.home_logo || "").includes(`/teams/${t}.png`);
      next = { n: m.n, home: m.home, away: m.away, ko: m.kickoff, atHome: home, ph: m.ph, pd: m.pd, pa: m.pa };
      const lg = main.lgid === f.lg ? (await cached(`league2:${f.lg}:${f.ss}`, 6 * 3600000, async () => null)) : null;
      const row = (lg?.table || []).flat().find((x: any) => x.id === t);
      const xg = Number(home ? m.xg_h : m.xg_a);
      if (row?.gf && xg > 0 && main.app > 0) {
        const share = main.g / row.gf, mpg = Math.min(1, main.min / main.app / 90);
        next.prob = Math.round((1 - Math.exp(-xg * share * mpg)) * 1000) / 1000;
        next.share = Math.round(share * 100) / 100; next.xg = xg;
      }
    }
  }
  for (const s of d.stats || []) s.n = await lgN(s.lgid);
  return { ok: true, ...d, main, next };
}
// player sheet from a goal in a match (8 nov 2026, Jeremy: tap a scorer in a match): find the player id in the fixture events, then player()
// 8 nov 2026 (Jeremy): competitions open from a player sheet; full match events (goals, cards, substitutions) with player ids
const LID: Record<number, string> = { 39: "E0", 61: "F1", 140: "SP1", 135: "I1", 78: "D1", 94: "P1", 88: "N1", 179: "SC0", 144: "B1", 203: "T1", 197: "G1", 283: "ROU", 103: "NOR", 71: "BRA", 128: "ARG", 2: "CL", 3: "EL", 848: "ECL", 210: "HR", 286: "RS", 333: "UA", 307: "SA", 318: "CY", 172: "BG", 45: "FAC", 48: "EFL", 81: "DFB", 143: "CDR", 181: "SCC", 185: "SLC", 96: "TDP" };
async function lgN(lgid: number) { const c = LID[lgid]; if (!c) return null; return (await sb(`afp_predictions?league=eq.${c}&af_id=not.is.null&order=kickoff.desc&limit=1&select=n`))?.[0]?.n ?? null; }
async function events(n: number) {
  const p = (await sb(`afp_predictions?n=eq.${n}&select=af_id,kickoff`))?.[0]; if (!p?.af_id) return { ok: false };
  const f = await fx(n);
  const old = Date.parse(p.kickoff) < Date.now() - 3 * 3600000;
  const ev: any[] = (await cached(`fxev:${p.af_id}`, old ? 86400000 : 60000, async () => af(`fixtures/events?fixture=${p.af_id}`))) || [];
  return { ok: true, ev: ev.filter((e: any) => e.comments !== "Penalty Shootout").map((e: any) => ({ min: e.time?.elapsed ?? null, extra: e.time?.extra ?? null, side: f && e.team?.id === f.hid ? "h" : "a", type: e.type, detail: e.detail, pid: e.player?.id || null, player: e.player?.name || "", aid: e.assist?.id || null, assist: e.assist?.name || "" })) };
}
async function pfind(n: number, name: string) {
  const p = (await sb(`afp_predictions?n=eq.${n}&select=af_id`))?.[0]; if (!p?.af_id || !name) return { ok: false };
  const ev: any[] = (await cached(`fxev:${p.af_id}`, 10 * 60000, async () => af(`fixtures/events?fixture=${p.af_id}`))) || [];
  const low = name.toLowerCase(), last = low.split(" ").pop() || low;
  const e = ev.find((x: any) => String(x.player?.name || "").toLowerCase() === low) || ev.find((x: any) => String(x.player?.name || "").toLowerCase().includes(last));
  if (!e?.player?.id) return { ok: false };
  return player(n, e.player.id);
}
async function league(n: number) {
  const f = await fx(n); if (!f) return { ok: false };
  const d = await cached(`league2:${f.lg}:${f.ss}`, 6 * 3600000, async () => {
    const [st, sc, as, nx] = await Promise.all([af(`standings?league=${f.lg}&season=${f.ss}`), af(`players/topscorers?league=${f.lg}&season=${f.ss}`), af(`players/topassists?league=${f.lg}&season=${f.ss}`), af(`fixtures?league=${f.lg}&season=${f.ss}&next=8`)]);
    const pl = (x: any) => ({ id: x.player?.id, tid: x.statistics?.[0]?.team?.id, n: x.player?.name, ph: x.player?.photo, t: x.statistics?.[0]?.team?.name, tl: x.statistics?.[0]?.team?.logo, g: x.statistics?.[0]?.goals?.total ?? 0, as: x.statistics?.[0]?.goals?.assists ?? 0, ap: x.statistics?.[0]?.games?.appearences ?? null });
    return { id: f.lg, name: f.lname, logo: f.llogo, country: f.country, season: f.ss, table: table(st), scorers: (sc || []).slice(0, 10).map(pl), assists: (as || []).slice(0, 5).map(pl), next: (nx || []).map((x: any) => fxRow(x)) };
  });
  if (!d) return { ok: false };
  const o = await ours(`league=eq.${encodeURIComponent(f.code)}`);
  return { ok: true, ...d, ours: o, hl: [f.hid, f.aid] };
}
// 8 nov 2026 (Jeremy): own cookieless site analytics ("un truc où tu peux faire toi", "beaucoup de données", "un truc à part")
// POST /api/hit (sendBeacon from every page of aifootpredictor.com), GET /api/site-stats?k=..., GET /api/dash?k=... (private dashboard)
const DASH_KEY = "aifp-7c41e9d2b85a", HIT_SALT = "aifp-site-3f8a2c";
const HIT_BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch|go-http|java\/|okhttp|facebookexternalhit|embedly|whatsapp|telegram|discord|bsky|cardyb|semrush|ahrefs|mj12|dataforseo|bytespider|petal|gpt|claude|anthropic|perplexity|yandex|baidu|bingpreview|google-|adsbot|mediapartners/i;
function hitSection(path: string) {
  const p = path.replace(/^\/fr(?=\/|$)/, "") || "/";
  if (p === "/") return "home";
  if (/^\/blog\/?$/.test(p)) return "blog";
  if (p.startsWith("/blog/")) return "article";
  if (/^\/(table|classement)\//.test(p)) return "tables";
  if (/^\/(team|equipe)\//.test(p)) return "teams";
  if (/^\/(player|joueur)\//.test(p)) return "players";
  if (/^\/widget\//.test(p)) return "widgets";
  if (/^\/(method|methode)\//.test(p)) return "method";
  if (/^\/api\//.test(p)) return "api";
  return "other";
}
function hitRef(r: string) {
  let h = ""; try { h = new URL(r).hostname.replace(/^www\./, "").toLowerCase(); } catch {}
  if (!h) return { h: "", k: "direct" };
  const k = /aifootpredictor\.com$|jeremstyke\.github\.io$/.test(h) ? "internal"
    : /(^|\.)google\./.test(h) ? "google" : /bing\.com$/.test(h) ? "bing"
    : /duckduckgo|yahoo|yandex|ecosia|qwant|baidu|brave\.com|startpage|naver/.test(h) ? "search"
    : /bsky\.app$|bsky\.social$|bluesky/.test(h) ? "bluesky" : /(^|\.)t\.me$|telegram/.test(h) ? "telegram"
    : /(^|\.)(x|twitter)\.com$|^t\.co$/.test(h) ? "x" : /facebook|instagram|threads\.net|fb\.com/.test(h) ? "meta"
    : /reddit/.test(h) ? "reddit" : /chatgpt|openai|perplexity|claude\.ai|gemini|copilot|mistral|deepseek|you\.com/.test(h) ? "ai"
    : /github/.test(h) ? "github" : /youtube|tiktok|linkedin|discord|whatsapp/.test(h) ? "social" : "site";
  return { h, k };
}
function hitUa(ua: string) {
  const dev = /iPad|Tablet/i.test(ua) ? "tablet" : /Mobi|Android|iPhone/i.test(ua) ? "mobile" : "desktop";
  const os = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /CrOS/.test(ua) ? "ChromeOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "other";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung" : /FBAN|FBAV|Instagram/.test(ua) ? "Facebook/Insta" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /CriOS|Chrome/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "other";
  return { dev, os, br };
}
const hitInt = (v: any, a: number, b: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : null; };
async function hit(req: Request) {
  const ok = new Response(null, { status: 204, headers: CORS });
  try {
    if (req.method !== "POST") return ok;
    const ua = req.headers.get("user-agent") || "", org = req.headers.get("origin") || req.headers.get("referer") || "";
    if (!ua || HIT_BOT.test(ua) || !/aifootpredictor\.com|jeremstyke\.github\.io/.test(org)) return ok;
    const b: any = JSON.parse((await req.text()).slice(0, 4000) || "{}");
    const pid = String(b.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 16);
    if (b.k === "end") {
      if (pid) await sb(`afp_site_hits?pid=eq.${pid}&kind=eq.pv`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ms: hitInt(b.ms, 0, 7200000), scroll: hitInt(b.sc, 0, 100) }) });
      return ok;
    }
    if (b.k !== "pv" && b.k !== "out") return ok;
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
    const vid = createHash("sha256").update(`${ip}|${ua}|${day}|${HIT_SALT}`).digest("hex").slice(0, 16);
    const path = String(b.p || "/").split("?")[0].slice(0, 200), u = hitUa(ua);
    const row: any = { kind: b.k, pid: pid || null, vid, path, section: hitSection(path), lang: /^\/fr(\/|$)/.test(path) ? "fr" : "en", dev: u.dev, os: u.os, br: u.br };
    if (b.k === "out") row.target = String(b.to || "").slice(0, 120);
    else {
      const r = hitRef(String(b.r || ""));
      Object.assign(row, { title: String(b.t || "").slice(0, 160), ref_host: r.h, ref_kind: r.k, src: String(b.src || "").replace(/[^\w.-]/g, "").slice(0, 40),
        blang: String(b.l || "").slice(0, 16), tz: String(b.tz || "").slice(0, 40), sw: hitInt(b.w, 0, 10000) });
    }
    await sb("afp_site_hits", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) });
  } catch (e) { console.log("hit error", String(e)); }
  return ok;
}
let DASH_HTML = "", dashAt = 0;
async function siteRoutes(req: Request, u: URL) {
  if (u.pathname === "/api/hit") return hit(req);
  if (u.searchParams.get("k") !== DASH_KEY) return new Response("forbidden", { status: 403 });
  if (u.pathname === "/api/site-stats") {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/afp_site_stats`, { method: "POST", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" }, body: "{}" });
    return new Response(await r.text(), { status: r.status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  }
  if (!DASH_HTML || Date.now() - dashAt > 60000) { DASH_HTML = (await sb("afp_assets?key=eq.sitedash_html&select=body"))?.[0]?.body || "no dashboard"; dashAt = Date.now(); }
  return new Response(DASH_HTML, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
// 8 nov 2026 (Jeremy): Google accounts on aifootpredictor.com, to keep created widgets, favourite club and teams,
// followed matches and leagues, and the language, on every device. Session token in the site's local storage (no cookie).
// POST /api/acct/google {credential} -> {token, user, data} ; GET /api/acct/me ; POST /api/acct/data {items:{k:v}} ; POST /api/acct/logout ; POST /api/acct/delete
const ACCT_KEYS = new Set(["afp_fav", "afp_fol", "afp_cfol", "afp_lang", "afp_club", "afp_widgets"]);
const ACCT_CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type,x-session", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Max-Age": "86400" };
const acctOut = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...ACCT_CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
let GCID = "", gcidAt = 0;
async function gcid() { if (!GCID || Date.now() - gcidAt > 600000) { GCID = (await sb("afp_config?key=eq.google_client_id&select=value"))?.[0]?.value || ""; gcidAt = Date.now(); } return GCID; }
async function acctData(uid: string) {
  const rows = (await sb(`afp_account_data?uid=eq.${uid}&select=k,v`)) || [];
  const o: any = {}; for (const r of rows) o[r.k] = r.v; return o;
}
async function acctUser(req: Request) {
  const t = (req.headers.get("x-session") || "").replace(/[^a-f0-9]/g, "").slice(0, 64);
  if (t.length < 40) return null;
  const s = (await sb(`afp_sessions?token=eq.${t}&select=uid,last_seen`))?.[0];
  if (!s) return null;
  if (Date.now() - Date.parse(s.last_seen) > 3600e3) await sb(`afp_sessions?token=eq.${t}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ last_seen: new Date().toISOString() }) });
  return { uid: s.uid as string, token: t };
}
async function acctRoutes(req: Request, u: URL) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: ACCT_CORS });
  try {
    if (u.pathname === "/api/acct/google" && req.method === "POST") {
      const b: any = await req.json().catch(() => ({}));
      const cred = String(b.credential || "").slice(0, 4000), cid = await gcid();
      if (!cred || !cid) return acctOut({ ok: false, error: "config" }, 400);
      const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(cred)}`);
      const g: any = await r.json().catch(() => null);
      if (!r.ok || !g || g.aud !== cid || !["accounts.google.com", "https://accounts.google.com"].includes(g.iss) || Number(g.exp) * 1000 < Date.now() || !g.sub) return acctOut({ ok: false, error: "google" }, 401);
      const prof = { email: g.email || null, name: g.given_name || g.name || null, picture: g.picture || null, last_login: new Date().toISOString() };
      let a = (await sb(`afp_accounts?google_sub=eq.${encodeURIComponent(g.sub)}&select=uid`))?.[0], isNew = false;
      if (a) await sb(`afp_accounts?uid=eq.${a.uid}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(prof) });
      else {
        a = (await sb("afp_accounts", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ google_sub: g.sub, lang: b.lang === "fr" ? "fr" : "en", ...prof }) }))?.[0];
        isNew = true;
        if (a && TOKEN) await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: 7057960224, text: `🆕 AI Football Predictor - nouveau compte sur le site (Google)\n${prof.name || ""}\nLangue : ${b.lang === "fr" ? "fr" : "en"}` }) }).catch(() => null);
      }
      if (!a?.uid) return acctOut({ ok: false, error: "server" }, 500);
      const token = randomBytes(32).toString("hex");
      await sb("afp_sessions", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ token, uid: a.uid, ua: (req.headers.get("user-agent") || "").slice(0, 200) }) });
      return acctOut({ ok: true, token, isNew, user: { name: prof.name, email: prof.email, picture: prof.picture }, data: await acctData(a.uid) });
    }
    const me = await acctUser(req);
    if (!me) return acctOut({ ok: false, error: "auth" }, 401);
    if (u.pathname.startsWith("/api/acct/apikey")) return v1KeyRoutes(req, u, me.uid);
    if (u.pathname === "/api/acct/me") {
      const a = (await sb(`afp_accounts?uid=eq.${me.uid}&select=name,email,picture,lang,tg_id`))?.[0] || {};
      // 8 nov 2026 (Jeremy): player id for "Défie le modèle" (Telegram id once linked) and Premium of the linked Telegram account
      const gid = await sb("rpc/afp_acct_gid", { method: "POST", body: JSON.stringify({ p_uid: me.uid }) });
      let prem = null;
      if (a.tg_id) { const t = (await sb(`afp_users?tg_id=eq.${a.tg_id}&select=premium_until`))?.[0]; if (t?.premium_until && Date.parse(t.premium_until) > Date.now()) prem = t.premium_until; }
      return acctOut({ ok: true, user: { name: a.name, email: a.email, picture: a.picture, lang: a.lang }, tg: !!a.tg_id, gid: typeof gid === "number" ? gid : null, prem, data: await acctData(me.uid) });
    }
    if (u.pathname === "/api/acct/linkcode" && req.method === "POST") {
      // 8 nov 2026 (Jeremy): "fusionner son compte avec celui de Telegram": a code the Mini App confirms (rpc afp_acct_link)
      const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", b = randomBytes(6); let code = ""; for (const x of b) code += A[x % A.length];
      await sb("afp_link_codes", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ code, uid: me.uid }) });
      return acctOut({ ok: true, code, url: `https://t.me/ai_football_predictorbot/app?startapp=link_${code}` });
    }
    if (u.pathname === "/api/acct/data" && req.method === "POST") {
      const b: any = await req.json().catch(() => ({}));
      const rows = Object.entries(b.items || {}).filter(([k, v]) => ACCT_KEYS.has(k) && JSON.stringify(v ?? null).length <= 30000).map(([k, v]) => ({ uid: me.uid, k, v: v ?? null, updated_at: new Date().toISOString() }));
      if (rows.length) await sb("afp_account_data?on_conflict=uid,k", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
      return acctOut({ ok: true, saved: rows.map(r => r.k) });
    }
    if (u.pathname === "/api/acct/logout" && req.method === "POST") {
      await sb(`afp_sessions?token=eq.${me.token}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      return acctOut({ ok: true });
    }
    if (u.pathname === "/api/acct/delete" && req.method === "POST") {
      // the person's right to erase: the account, its sessions and its saved settings (cascade)
      await sb(`afp_accounts?uid=eq.${me.uid}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      return acctOut({ ok: true, deleted: true });
    }
  } catch (e) { console.log("acct error", u.pathname, String(e)); return acctOut({ ok: false, error: "server" }, 500); }
  return acctOut({ ok: false, error: "not found" }, 404);
}
// ---- Free public API v1 ----
// 9 nov 2026 (Jeremy): "une seule offre gratuite", 1000 requests/day, key for signed-in members only, "si pas de lien vers nous l'api bloque".
// Only our own calculations (probabilities, likely score, expected goals, reliability). No odds, no logos, no raw provider data.
const V1_SITE = "https://aifootpredictor.com/";
const V1_CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "x-api-key,content-type", "Access-Control-Allow-Methods": "GET,OPTIONS", "Access-Control-Expose-Headers": "X-RateLimit-Limit,X-RateLimit-Remaining" };
const V1_ATTR = { text: "Probabilities by AI Football Predictor", url: V1_SITE + "?utm_source=api", html: '<a href="https://aifootpredictor.com/?utm_source=api" target="_blank" rel="noopener">Probabilities by AI Football Predictor</a>', required: true, rule: "Show this link, visible and clickable, on every page that displays data from this API." };
const v1Out = (d: any, s = 200, h: Record<string, string> = {}) => new Response(JSON.stringify(d, null, 1), { status: s, headers: { ...V1_CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...h } });
function v1Url(raw: string) {
  try {
    const u = new URL(String(raw || "").trim().slice(0, 500));
    if (!["http:", "https:"].includes(u.protocol)) return null;
    const h = u.hostname.toLowerCase();
    if (!h.includes(".") || /^[\d.]+$/.test(h) || h.includes(":") || /(^|\.)(localhost|internal|local|railway\.internal)$/.test(h) || h.endsWith("aifootpredictor.com")) return null;
    return { url: u.toString(), domain: h.replace(/^www\./, "") };
  } catch { return null; }
}
async function v1LinkCheck(url: string) {
  try {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 12000);
    const r = await fetch(url, { signal: ac.signal, redirect: "follow", headers: { "User-Agent": "AIFP-LinkCheck/1.0 (+https://aifootpredictor.com/api/)", Accept: "text/html,*/*" } });
    clearTimeout(t);
    if (!r.ok) return { ok: false, why: `http_${r.status}` };
    const html = (await r.text()).slice(0, 3_000_000);
    const ok = /(href|src)\s*=\s*["']?https?:\/\/(www\.)?aifootpredictor\.com/i.test(html);
    return { ok, why: ok ? "found" : "not_found" };
  } catch (e) { return { ok: false, why: "unreachable" }; }
}
function v1KeyView(k: any) {
  if (!k) return null;
  const grace = !k.link_ok ? Math.max(0, Math.ceil((Date.parse(k.created_at) + 3 * 864e5 - Date.now()) / 864e5)) : 0;
  return { key: k.key, site_url: k.site_url, domain: k.domain, link_ok: !!k.link_ok, checked_at: k.checked_at, grace_days: grace, blocked: !k.link_ok && grace === 0, active: k.active };
}
async function v1KeyRoutes(req: Request, u: URL, uid: string) {
  const sel = "key,site_url,domain,link_ok,checked_at,created_at,active,fails";
  let k = (await sb(`afp_api_keys?uid=eq.${uid}&select=${sel}`))?.[0];
  if (u.pathname === "/api/acct/apikey" && req.method === "GET") {
    const use = k ? (await sb(`afp_api_usage?key=eq.${k.key}&day=eq.${new Date().toISOString().slice(0, 10)}&select=calls`))?.[0]?.calls || 0 : 0;
    const lim: any = await sb("rpc/afp_api_limit_for", { method: "POST", body: JSON.stringify({ p_uid: uid }) });
    return acctOut({ ok: true, key: v1KeyView(k), today: use, limit: Number(lim) || 5000 });
  }
  if (req.method !== "POST") return acctOut({ ok: false, error: "method" }, 405);
  if (u.pathname === "/api/acct/apikey") {
    const b: any = await req.json().catch(() => ({}));
    const s = v1Url(b.site_url);
    if (!s) return acctOut({ ok: false, error: "site_url" }, 400);
    const chk = await v1LinkCheck(s.url), now = new Date().toISOString();
    const patch: any = { site_url: s.url, domain: s.domain, checked_at: now, link_ok: chk.ok, fails: chk.ok ? 0 : 1 };
    if (chk.ok) patch.link_at = now;
    if (k) {
      await sb(`afp_api_keys?uid=eq.${uid}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
    } else {
      const a = (await sb(`afp_accounts?uid=eq.${uid}&select=email,name`))?.[0] || {};
      const key = "aifp_" + randomBytes(16).toString("hex");
      await sb("afp_api_keys", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ key, uid, email: a.email || null, plan: "free", active: true, note: "member", ...patch }) });
      if (TOKEN) fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: 7057960224, text: `🔑 AI Football Predictor - nouvelle clé API gratuite\n${a.name || ""}\nSite : ${s.url}\nLien vers nous : ${chk.ok ? "trouvé ✅" : "pas encore ❌"}` }) }).catch(() => null);
    }
    k = (await sb(`afp_api_keys?uid=eq.${uid}&select=${sel}`))?.[0];
    return acctOut({ ok: true, key: v1KeyView(k), check: chk.why });
  }
  if (u.pathname === "/api/acct/apikey/check") {
    if (!k) return acctOut({ ok: false, error: "no_key" }, 404);
    if (k.checked_at && Date.now() - Date.parse(k.checked_at) < 30e3) return acctOut({ ok: true, key: v1KeyView(k), check: "wait" });
    const chk = await v1LinkCheck(k.site_url), now = new Date().toISOString();
    const patch: any = { checked_at: now };
    if (chk.ok) Object.assign(patch, { link_ok: true, fails: 0, link_at: now }); else Object.assign(patch, { link_ok: false, fails: (k.fails || 0) + 1 });
    await sb(`afp_api_keys?uid=eq.${uid}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
    k = (await sb(`afp_api_keys?uid=eq.${uid}&select=${sel}`))?.[0];
    return acctOut({ ok: true, key: v1KeyView(k), check: chk.why });
  }
  return acctOut({ ok: false, error: "not found" }, 404);
}
// Daily check (cron): a link that disappears 3 checks in a row blocks the key.
async function v1Cron() {
  const old = new Date(Date.now() - 20 * 3600e3).toISOString();
  const rows = (await sb(`afp_api_keys?uid=not.is.null&active=eq.true&site_url=not.is.null&or=(checked_at.is.null,checked_at.lt.${old})&select=key,site_url,fails,link_ok&limit=60`)) || [];
  let ok = 0, ko = 0;
  for (const k of rows) {
    const chk = await v1LinkCheck(k.site_url), now = new Date().toISOString();
    const patch: any = { checked_at: now };
    if (chk.ok) { Object.assign(patch, { link_ok: true, fails: 0, link_at: now }); ok++; }
    else { const f = (k.fails || 0) + 1; Object.assign(patch, { fails: f }); if (f >= 3) patch.link_ok = false; ko++; }
    await sb(`afp_api_keys?key=eq.${k.key}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
  }
  return { checked: rows.length, ok, ko };
}
// 9 nov 2026 (Jeremy, "oui"): more per match, all derived from our expected goals (same Poisson calculation as the app's match page)
function v1Pois(k: number, m: number) { let q = Math.exp(-m); for (let i = 1; i <= k; i++) q *= m / i; return q; }
function v1Extra(m: any) {
  const r = (x: number) => Math.round(x * 1000) / 1000;
  const dc = { home_or_draw: r(Number(m.ph) + Number(m.pd)), away_or_draw: r(Number(m.pa) + Number(m.pd)), home_or_away: r(Number(m.ph) + Number(m.pa)) };
  if (m.xg_h == null || m.xg_a == null) return { double_chance: dc, both_teams_score: null, clean_sheet: null, top_scores: null };
  const xh = Number(m.xg_h), xa = Number(m.xg_a), g: any[] = [];
  for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) g.push({ score: `${i}-${j}`, probability: v1Pois(i, xh) * v1Pois(j, xa) });
  g.sort((a, b) => b.probability - a.probability);
  return { double_chance: dc, both_teams_score: r((1 - Math.exp(-xh)) * (1 - Math.exp(-xa))), clean_sheet: { home: r(Math.exp(-xa)), away: r(Math.exp(-xh)) }, top_scores: g.slice(0, 5).map(x => ({ score: x.score, probability: r(x.probability) })) };
}
const V1_TBL: Record<string, string> = { F1: "Ligue 1", E0: "Premier League", SP1: "LaLiga", I1: "Serie A", D1: "Bundesliga", P1: "Liga Portugal", N1: "Eredivisie", T1: "Süper Lig" };
const V1_SEL = "id,n,league,kickoff,home,away,ph,pd,pa,o25,score,score_p,xg_h,xg_a,pick,pick_prob,status,hg,ag";
function v1Match(m: any, dom: string) {
  const r2 = (x: any) => (x == null ? null : Math.round(Number(x) * 1000) / 1000);
  const oc: any = { H: "home", D: "draw", A: "away" };
  const fin = m.status === "won" || m.status === "lost";
  return {
    id: m.id, competition: m.league, kickoff: m.kickoff, home: m.home, away: m.away,
    probabilities: { home: r2(m.ph), draw: r2(m.pd), away: r2(m.pa) },
    most_likely: { outcome: oc[m.pick] || null, probability: r2(m.pick_prob) },
    over_2_5_goals: r2(m.o25),
    likely_score: m.score ? { score: m.score, probability: r2(m.score_p) } : null,
    expected_goals: m.xg_h != null ? { home: m.xg_h, away: m.xg_a } : null,
    ...v1Extra(m),
    status: fin ? "finished" : m.status === "pending" ? "upcoming" : m.status,
    result: fin ? { home: m.hg, away: m.ag, most_likely_happened: m.status === "won" } : null,
    url: `${V1_SITE}?tab=m${m.n}&utm_source=api&utm_medium=${encodeURIComponent(dom || "unknown")}`,
  };
}
async function v1(req: Request, u: URL) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: V1_CORS });
  const p = u.pathname.replace(/\/+$/, "");
  if (p === "/api/v1/_cron") { if (u.searchParams.get("k") !== "9b22101c96f9f88c28fd0721") return v1Out({ error: "auth" }, 401); return v1Out(await v1Cron()); }
  if (p === "/api/v1" || p === "/api/v1/") return v1Out({ name: "AI Football Predictor free API", docs: V1_SITE + "api/", endpoints: ["/api/v1/matches", "/api/v1/articles", "/api/v1/tables", "/api/v1/competitions", "/api/v1/reliability"], openapi: V1_SITE + "openapi.json", attribution: V1_ATTR });
  const key = (req.headers.get("x-api-key") || u.searchParams.get("key") || "").trim().slice(0, 80);
  if (!key) return v1Out({ error: "missing_key", message: "Send your key in the X-API-Key header. Free key for members at https://aifootpredictor.com/api/", attribution: V1_ATTR }, 401);
  const au: any = await sb("rpc/afp_api_v1_auth", { method: "POST", body: JSON.stringify({ p_key: key, p_origin: req.headers.get("origin") || null }) });
  if (!au?.ok) return v1Out({ error: au?.error || "server", message: au?.message || "Server error", attribution: V1_ATTR }, au?.status || 500);
  const rl = { "X-RateLimit-Limit": String(au.limit), "X-RateLimit-Remaining": String(au.left) };
  const dom = (await sb(`afp_api_keys?key=eq.${encodeURIComponent(key)}&select=domain`))?.[0]?.domain || "";
  const meta: any = { calls_left_today: au.left };
  if (au.grace) meta.notice = "No link to aifootpredictor.com found on your site yet. Add it within 3 days of creating your key, or the key stops working.";
  try {
    if (p === "/api/v1/matches") {
      const d = /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get("date") || "") ? u.searchParams.get("date")! : new Date().toISOString().slice(0, 10);
      const next = new Date(Date.parse(d + "T00:00:00Z") + 864e5).toISOString().slice(0, 10);
      const c = (u.searchParams.get("competition") || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 12);
      const st = u.searchParams.get("status") || "all";
      let q = `afp_predictions?select=${V1_SEL}&kickoff=gte.${d}T00:00:00Z&kickoff=lt.${next}T00:00:00Z&order=kickoff.asc&limit=400`;
      if (c) q += `&league=eq.${c}`;
      if (st === "upcoming") q += "&status=eq.pending"; else if (st === "finished") q += "&status=in.(won,lost)";
      const rows = ((await sb(q)) || []).map((m: any) => v1Match(m, dom));
      return v1Out({ attribution: V1_ATTR, meta: { ...meta, date: d, count: rows.length }, data: rows }, 200, rl);
    }
    if (p === "/api/v1/competitions") {
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const rows = (await sb(`afp_predictions?select=league&kickoff=gte.${since}&limit=5000`)) || [];
      const cnt: Record<string, number> = {}; for (const r of rows) cnt[r.league] = (cnt[r.league] || 0) + 1;
      const data = Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([code, n]) => ({ code, matches_last_30_days: n }));
      return v1Out({ attribution: V1_ATTR, meta: { ...meta, count: data.length }, data }, 200, rl);
    }
    if (p === "/api/v1/articles") {
      // 9 nov 2026 (Jeremy, "oui"): pre-match articles in the free API as an excerpt (title, lede, first paragraph) + mandatory "read the full analysis" link, so Google keeps our page as the original
      const lg = u.searchParams.get("lang") === "fr" ? "fr" : "en";
      const d = /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get("date") || "") ? u.searchParams.get("date")! : "";
      const lim = Math.min(50, Math.max(1, Number(u.searchParams.get("limit")) || 20));
      let q = `afp_blog?kind=eq.match&lang=eq.${lg}&select=slug,title,published_at,data&order=published_at.desc&limit=${lim}`;
      if (d) { const nx = new Date(Date.parse(d + "T00:00:00Z") + 864e5).toISOString().slice(0, 10); q += `&data->>ko=gte.${d}T00:00:00&data->>ko=lt.${nx}T00:00:00`; }
      const rt = lg === "fr" ? "Lire l'analyse complète sur AI Football Predictor" : "Read the full analysis on AI Football Predictor";
      const data = ((await sb(q)) || []).map((r: any) => {
        const A = r.data?.a || {}, b = A[`body_${lg}`] || [];
        const url = `${V1_SITE}${lg === "fr" ? "fr/" : ""}blog/${r.slug}/?utm_source=api&utm_medium=${encodeURIComponent(dom || "unknown")}`;
        return { title: A[`title_${lg}`] || r.title, lede: A[`lede_${lg}`] || null, excerpt: b[0] || null, kickoff: r.data?.ko || null, published_at: r.published_at, url, read_more: { text: rt, url, html: `<a href="${url}" target="_blank" rel="noopener">${rt}</a>`, required: true } };
      });
      return v1Out({ attribution: V1_ATTR, meta: { ...meta, lang: lg, count: data.length, rule: "Show the excerpt only, with the read_more link visible under it. Do not republish the full article." }, data }, 200, rl);
    }
    if (p === "/api/v1/tables") {
      // 9 nov 2026 (Jeremy, "oui"): predicted end-of-season tables from our nightly simulations (no logos, no provider ids)
      const c = (u.searchParams.get("competition") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!V1_TBL[c]) return v1Out({ attribution: V1_ATTR, meta: { ...meta, message: "Add ?competition=CODE" }, data: Object.entries(V1_TBL).map(([code, name]) => ({ code, name })) }, 200, rl);
      const d: any = await sb("rpc/afp_widget_table", { method: "POST", body: JSON.stringify({ lg: c }) });
      if (!d?.teams?.length) return v1Out({ error: "not_available", attribution: V1_ATTR }, 404, rl);
      const r = (x: any) => (x == null ? null : Math.round(Number(x) * 1000) / 1000);
      const teams = d.teams.slice().sort((a: any, b: any) => b.xpts - a.xpts || a.pos - b.pos).map((t: any, i: number) => ({ rank: i + 1, team: t.name, played: t.pl, points: t.pts, expected_points: t.xpts, expected_position: r(t.pos), title: r(t.title), [`top_${d.top}`]: r(t.top), relegation: r(t.rel), attack_rating: r(t.att), defence_rating: r(t.def) }));
      return v1Out({ attribution: V1_ATTR, meta: { ...meta, competition: c, name: d.name, season: d.season, simulations: d.sims, updated_at: d.at, top_places: d.top, relegation_places: d.rel, url: `${V1_SITE}?utm_source=api` }, data: teams }, 200, rl);
    }
    if (p === "/api/v1/reliability") {
      const s: any = await sb("rpc/afp_scores", { method: "POST", body: "{}" });
      return v1Out({ attribution: V1_ATTR, meta: { ...meta, explain: V1_SITE + "method/" }, data: { all: s?.all ?? null, compared_with_market: s?.cmp ?? null, random_guess: s?.guess ?? null } }, 200, rl);
    }
  } catch (e) { console.log("v1 error", p, String(e)); return v1Out({ error: "server", attribution: V1_ATTR }, 500); }
  return v1Out({ error: "not_found", docs: V1_SITE + "api/", attribution: V1_ATTR }, 404);
}
export async function handle(req: Request) {
  if (new URL(req.url).pathname.startsWith("/api/v1")) return v1(req, new URL(req.url));
  if (new URL(req.url).pathname.startsWith("/api/acct/")) return acctRoutes(req, new URL(req.url));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const u = new URL(req.url);
  if (u.pathname === "/api/hit" || u.pathname === "/api/site-stats" || u.pathname === "/api/dash") return siteRoutes(req, u);
  // 7 nov 2026 (Jeremy): "le site doit être comme la mini app": the web version (outside Telegram) reads the same public sheets (x-web: 1)
  if (!checkInit(req.headers.get("x-init-data") || "") && req.headers.get("x-web") !== "1") return out({ error: "auth" }, 401);
  try {
    const n = Number(u.searchParams.get("n"));
    if (u.pathname === "/api/team") return out(await team(n, u.searchParams.get("s") || "h"));
    if (u.pathname === "/api/league") return out(await league(n));
    if (u.pathname === "/api/player") return out(await player(n, Number(u.searchParams.get("id"))));
    if (u.pathname === "/api/events") return out(await events(n));
    if (u.pathname === "/api/pfind") return out(await pfind(n, String(u.searchParams.get("name") || "").slice(0, 80)));
    // 8 nov 2026 (Jeremy): follow a whole competition (Telegram users; the web app uses the rpc afp_webpush_comp). afp_comp_expand() adds its matches to afp_live_subs.
    if (u.pathname === "/api/csub" || u.pathname === "/api/csubs") {
      let uid = 0; try { uid = Number(JSON.parse(new URLSearchParams(req.headers.get("x-init-data") || "").get("user") || "{}").id) || 0; } catch {}
      if (!uid || !checkInit(req.headers.get("x-init-data") || "")) return out({ error: "auth" }, 401);
      if (u.pathname === "/api/csub" && req.method === "POST") {
        const b: any = await req.json().catch(() => ({})), c = String(b.c || "").slice(0, 12);
        if (!c) return out({ ok: false });
        await sb("afp_comp_subs?on_conflict=tg_id,league", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ tg_id: uid, league: c, active: !!b.on, updated_at: new Date().toISOString() }) });
        await sb("rpc/afp_comp_expand", { method: "POST", body: "{}" });
        return out({ ok: true, c, on: !!b.on });
      }
      const rows = (await sb(`afp_comp_subs?tg_id=eq.${uid}&active=eq.true&select=league`)) || [];
      return out({ ok: true, c: rows.map((r: any) => r.league) });
    }
  } catch (e) { console.log("api error", u.pathname, String(e)); return out({ error: "server" }, 500); }
  return out({ error: "not found" }, 404);
}

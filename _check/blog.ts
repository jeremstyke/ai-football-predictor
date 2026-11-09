// AI Football Predictor - SEO blog generator - by @jeremstyke
// Loaded at each run by the afp-blog Railway function (loader) from afp_assets key 'blog_ts': edit here with SQL, no redeploy.
// 7 nov 2026 (Jeremy): "plein d'articles de blog SEO, au fur et à mesure".
// 7 nov 2026 (01h00, Jeremy): "il faut pas trop donner le pronostic": a pick is only shown on the site once its match is settled;
//   before that the page shows a lock and sends to the Telegram app, where all the detail is.
// Every run (Supabase pg_cron 07:40 and 22:40 UTC, GET /run?k=...&m=am|pm|all):
//   1. daily article "football predictions of the day" (EN + FR) built ONLY from our data (1X2 picks, goals picks, xG,
//      probabilities, odds); re-rendered in the evening with the results, so each day gets one permanent page;
//   2. in the morning run only: one evergreen guide (EN + FR) from the afp_blog_topics queue, written by the AI (m=all re-renders stored guides);
//   3. blog index pages (EN, FR) and ai-football-predictor/sitemap.xml are rebuilt.
// Pages are pushed to the GitHub Pages repo jeremstyke.github.io through the Supabase function tmp_gh_put2.
const SB_URL = Bun.env.SUPABASE_URL!, SB_KEY = Bun.env.SUPABASE_SERVICE_KEY!, AKEY = Bun.env.ANTHROPIC_API_KEY || "";
const MODEL = Bun.env.BLOG_MODEL || "claude-sonnet-5-5";
const SITE = "https://aifootpredictor.com/";
const BOT = "https://t.me/ai_football_predictorbot?start=src_blog", CH = "https://t.me/aifootballpredictorchannel";
const COMP: Record<string, string> = { E0: "Premier League", F1: "Ligue 1", SP1: "LaLiga", I1: "Serie A", D1: "Bundesliga", P1: "Liga Portugal", N1: "Eredivisie", SC0: "Scottish Premiership", B1: "Belgian Pro League", T1: "Süper Lig", G1: "Greek Super League", ROU: "Romanian Liga 1", NOR: "Eliteserien", BRA: "Brasileirão", ARG: "Liga Profesional", CL: "Champions League", EL: "Europa League", ECL: "Conference League", HR: "HNL", RS: "Serbian SuperLiga", UA: "Ukrainian Premier League", SA: "Saudi Pro League", CY: "Cypriot First Division", BG: "Bulgarian First League", FAC: "FA Cup", EFL: "EFL Cup", DFB: "DFB-Pokal", CDR: "Copa del Rey", SCC: "Scottish Cup", SLC: "Scottish League Cup", TDP: "Taça de Portugal" };

async function sb(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers || {}) } });
  const t = await r.text(); if (!r.ok) { console.log("sb error", path, r.status, t.slice(0, 300)); return null; } return t ? JSON.parse(t) : true;
}
async function put(path: string, content: string, msg: string) {
  const r = await sb("rpc/tmp_gh_put2", { method: "POST", body: JSON.stringify({ p_repo: path.startsWith("ai-football-predictor/") ? "ai-football-predictor" : "jeremstyke.github.io", p: path.startsWith("ai-football-predictor/") ? path.slice(22) : path, /* 8 nov 2026: site moved to aifootpredictor.com */ c: content, msg }) });
  console.log("put", path, JSON.stringify(r)); return r;
}
async function ai(system: string, user: string, max = 6000) {
  if (!AKEY) return null;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: AbortSignal.timeout(120000), headers: { "x-api-key": AKEY, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: MODEL, max_tokens: max, system, messages: [{ role: "user", content: user }] }) });
    const j: any = await r.json();
    const txt = (j?.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    const m = txt.match(/\{[\s\S]*\}/); if (!m) { console.log("ai no json", JSON.stringify(j).slice(0, 300)); return null; }
    return JSON.parse(m[0]);
  } catch (e) { console.log("ai error", String(e)); return null; }
}
const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const nodash = (s: string) => s.replace(/[—–]/g, "-");
const pct = (x: any) => Math.round(Number(x) * 100) + " %";
const parisDay = (t = Date.now()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
const longDate = (d: string, lang: string) => new Date(d + "T12:00:00Z").toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
const hm = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);

const unesc = (s: any) => String(s ?? "").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

// 7 nov 2026 (01h17, Jeremy): "le blog est moche, reprend le thème de l'app et du site" + "rend les articles plus attrayants":
// same CSS (read live from the site page), header and footer as the site (mini app tokens), plus article blocks: breadcrumb,
// hero with live tag and key figures, prediction slip (ticket with perforated edges) for the picks, table of contents,
// reading time, mid-article call-out, FAQ accordions, "à lire aussi" cards and the final block of the site.
let SITE_CSS = "";
// 8 nov 2026 (Jeremy, "sur le site ça va pas, c'est moche"): compact header on phones (logo, name, Blog, EN and the button on one line)
const MOB_CSS = "html{background:#06090e}.scan{top:0;bottom:0;height:auto;overflow:hidden;animation:none;background:none}.scan::before{content:'';position:absolute;left:0;right:0;top:-30%;height:30%;background:linear-gradient(180deg,transparent,rgba(62,224,168,.05),transparent);animation:scan 7s linear infinite}@media(max-width:600px){.w{padding:0 14px}.nav{height:56px;gap:8px}.mark{width:32px;height:32px;font-size:10px}.brand{gap:8px;min-width:0}.brand b{font-size:14px;white-space:nowrap}.brand small{display:none}.nav nav{gap:10px;flex:none}.nav nav a{font-size:13px}.nav nav a.btn.sm{padding:7px 10px;font-size:12.5px;white-space:nowrap}.lng{padding:4px 6px}}@media(max-width:420px){.nav nav a[href$='blog/']{display:none}.brand b{font-size:13px}}";
async function loadCss() { try { const h = await (await fetch("https://raw.githubusercontent.com/jeremstyke/jeremstyke.github.io/730d1c6d53b07612a115201aa2424098e6fdc674/ai-football-predictor/fr/index.html")).text(); /* 7 nov 2026: the site home is now the web app (iframe), the blog keeps the theme CSS of the former home page */ const m = h.match(/<style>([\s\S]*?)<\/style>/); if (m) SITE_CSS = m[1]; } catch (e) { console.log("css error", String(e)); } }
const BLOG_CSS = `.ahero{padding:42px 0 8px}.ahero h1{font-size:clamp(30px,4.8vw,50px);margin:16px 0 14px}
.crumb{font:12px var(--mono);color:var(--dim)}.crumb a{color:var(--mut);text-decoration:none}.crumb a:hover{color:var(--acc)}
.lede{font-size:18.5px;color:#c5d0de;max-width:720px}
.chipsm{display:flex;flex-wrap:wrap;gap:6px;margin-top:18px}.chipsm span{font:600 11.5px var(--mono);color:var(--mut);border:1px solid var(--line2);background:var(--panel);padding:5px 9px}.chipsm span b{color:var(--txt)}
.art>*{max-width:760px}
.prose{font-size:17px;line-height:1.78;color:#cfd8e4}.prose>*:first-child{margin-top:0}
.prose h2{font-size:clamp(23px,3vw,31px);margin:44px 0 12px;padding-top:20px;border-top:1px dashed var(--line2);scroll-margin-top:80px}
.prose h3{font-size:19px;margin:26px 0 8px;color:var(--txt)}
.prose p{margin:0 0 16px}.prose ul,.prose ol{margin:0 0 18px 22px}.prose li{margin:7px 0}.prose li::marker{color:var(--acc)}
.prose strong{color:#fff}.prose table{margin:12px 0 22px;border:1px solid var(--line);background:var(--panel)}.prose td,.prose th{padding:10px 12px}
.toc{border:1px solid var(--line);background:var(--panel);padding:16px 20px;margin:26px 0 30px}
.toc .sec{margin-bottom:8px}.toc ol{margin:0 0 0 20px;font-size:15px}.toc li{margin:5px 0}.toc li::marker{font:600 12px var(--mono);color:var(--acc)}.toc a{color:var(--txt);text-decoration:none}.toc a:hover{color:var(--acc)}
.call{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;border:1px solid rgba(62,224,168,.45);background:rgba(62,224,168,.05);padding:18px;margin:30px 0}
.call .mark{width:44px;height:44px}.call b{display:block;font-size:16px}.call span{color:var(--mut);font-size:14px}
.tkwrap{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:8px}
.tkl.d4{grid-template-columns:52px 1fr auto}.pk{font:700 13px var(--mono);color:var(--txt);text-align:right}.pk small{display:block;font:11px var(--mono);color:var(--mut);text-align:right;margin-top:3px}
.res{font:700 11px var(--mono);padding:2px 6px;border:1px solid;margin-left:4px}.res.ok{color:var(--acc);border-color:rgba(62,224,168,.4)}.res.ko{color:var(--bad);border-color:rgba(255,95,115,.4)}
.empty{padding:14px 0;color:var(--mut);font-size:14px}
.cards{display:grid;grid-template-columns:repeat(2,1fr);border:1px solid var(--line);background:var(--panel)}
.card{display:flex;flex-direction:column;padding:22px 20px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);text-decoration:none;color:var(--txt);transition:background .15s}
.card:nth-child(2n){border-right:0}.card:hover{background:#101924}.card:hover h3{color:var(--acc)}
.card .ic{align-self:flex-start;font:700 11px var(--mono);color:var(--acc2);border:1px solid rgba(76,195,255,.35);padding:3px 7px}.card .ic.d{color:var(--warn);border-color:rgba(245,184,74,.35)}
.card h3{font-size:18px;line-height:1.3;margin:12px 0 6px;transition:color .15s}.card p{font-size:14px;color:var(--mut);flex:1}.card .go{font:600 12px var(--mono);color:var(--acc);margin-top:14px}
.feat1{display:grid;grid-template-columns:1.1fr .9fr;gap:30px;align-items:center;border:1px solid var(--line);background:var(--panel);padding:26px}
.feat1 h3{font-size:clamp(22px,3vw,30px);line-height:1.15;margin:12px 0 8px}.feat1 p{color:var(--mut)}
.arch a{display:grid;grid-template-columns:120px 1fr auto;gap:14px;align-items:center;padding:13px 4px;border-top:1px dashed var(--line);text-decoration:none;color:var(--txt);font-size:15px}.arch a:hover{color:var(--acc)}.arch .t{font:12px var(--mono);color:var(--mut)}.arch .go{font:600 12px var(--mono);color:var(--acc)}
@media(max-width:900px){.tkwrap,.feat1{grid-template-columns:1fr}.cards{grid-template-columns:1fr}.card{border-right:0}.call{grid-template-columns:1fr}.call .mark{display:none}.arch a{grid-template-columns:1fr auto}.arch .t{display:none}}`;

const L10 = (fr: boolean) => fr ? {
  home: "Accueil", blog: "Blog", bot: "📊 Probabilités", alt: "EN", altName: "English", daily: "Probabilités du jour", guide: "Guide", read: "Lire", min: "min de lecture",
  foot: "Estimations statistiques à titre d'information, pas un conseil de pari. Aucune garantie de résultat. Interdit aux moins de 18 ans. Jouer comporte des risques : 09 74 75 13 13.",
  by: "Fait par", fin: "Les probabilités de chaque match, gratuites", finP: "Les plus probables du jour, le direct, les fiches équipes et la preuve de fiabilité, gratuitement sur le site.",
  open: "Voir les probabilités", ch: "Chaîne des résultats", also: "À lire aussi", toc: "sommaire", faq: "Questions fréquentes",
} : {
  home: "Home", blog: "Blog", bot: "📊 Probabilities", alt: "FR", altName: "Français", daily: "Daily probabilities", guide: "Guide", read: "Read", min: "min read",
  foot: "Statistical estimates for information only, not betting advice. No guarantee of results. 18+.",
  by: "Made by", fin: "The probability of every match, free", finP: "Today's most likely matches, live, team sheets and proof of reliability, free on the site.",
  open: "See the probabilities", ch: "Results channel", also: "Read next", toc: "contents", faq: "FAQ",
};

// 9 nov 2026 (Jeremy, "une petite bannière Sorare visible ... dès dans le contenu, sans défilement"): small Sorare partner banner right under the H1 of most site pages
const SOR_URL = "https://sorare.pxf.io/c/3023254/3202039/12209";
function sorBan(fr: boolean) { return `<div class="aifp-sorb"><a href="${SOR_URL}?subId1=site" target="_blank" rel="sponsored noopener" style="display:flex;align-items:center;gap:10px;margin:12px 0 2px;padding:10px 12px;border:1px solid #243246;border-radius:12px;background:linear-gradient(90deg,rgba(246,196,69,.10),rgba(79,141,255,.08));color:#e6edf6;text-decoration:none"><span style="font-size:22px" aria-hidden="true">🃏</span><span style="flex:1;min-width:0"><b style="display:block;font-size:14px">${fr ? "Fantasy foot sur Sorare" : "Fantasy football on Sorare"}</b><small style="color:#7d8ba1;font-size:12px">${fr ? "Tes analyses valent des points. Gratuit pour commencer." : "Turn your analysis into points. Free to start."}</small></span><span style="color:#3ee0a8;font-size:13px;font-weight:700;white-space:nowrap">${fr ? "Découvrir" : "Discover"}</span></a><div style="text-align:right;color:#4b5869;font-size:10.5px;margin-bottom:8px">${fr ? "Lien partenaire · 18+" : "Partner link · 18+"}</div></div>`; }
function withSor(body: string, fr: boolean, url: string) { if (/\/(api|privacy|confidentialite|terms|conditions)\/$/.test(url)) return body; const i = body.indexOf("</h1>"); return i < 0 ? body : body.slice(0, i + 5) + sorBan(fr) + body.slice(i + 5); }
function page(o: { lang: string; url: string; alt?: string; title: string; desc: string; body: string; ld?: any[]; type?: string; img?: string }) {
  const fr = o.lang === "fr", t = L10(fr), home = SITE + (fr ? "fr/" : "");
  return `<!DOCTYPE html><html lang="${o.lang}"><head><meta charset="utf-8"><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8638687738606649" crossorigin="anonymous"></script><script defer src="/a.js"></script><script defer src="/account.js"></script><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)}</title><meta name="description" content="${esc(o.desc)}"><meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${o.url}"><link rel="alternate" type="application/rss+xml" title="${fr ? "AI Football Predictor - avant-matchs" : "AI Football Predictor - match previews"}" href="${home}feed.xml">${o.alt ? `<link rel="alternate" hreflang="${o.lang}" href="${o.url}"><link rel="alternate" hreflang="${fr ? "en" : "fr"}" href="${o.alt}">` : ""}
<meta property="og:type" content="${o.type || "article"}"><meta property="og:title" content="${esc(o.title)}"><meta property="og:description" content="${esc(o.desc)}"><meta property="og:url" content="${o.url}"><meta property="og:site_name" content="AI Football Predictor"><meta property="og:locale" content="${fr ? "fr_FR" : "en_GB"}">${o.img ? `<meta property="og:image" content="${o.img}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${o.img}">` : `<meta name="twitter:card" content="summary">`}
<meta name="theme-color" content="#06090e"><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E⚽%3C/text%3E%3C/svg%3E">
${(o.ld || []).map(x => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join("")}<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600;700;800&display=swap" rel="stylesheet"><style>${SITE_CSS}${BLOG_CSS}${MOB_CSS}</style></head>
<body><div class="scan"></div>
<header><div class="w nav"><a class="brand" href="${home}"><span class="mark">AIFP</span><span><b>AI Football Predictor</b><small>${fr ? "probabilités vérifiées" : "verified probabilities"}</small></span></a>
<nav><a class="hide" href="${home}">${t.home}</a><a href="${home}blog/">${t.blog}</a><a class="hide" href="${home}${fr ? "methode/" : "method/"}">${fr ? "Méthode" : "Method"}</a>${o.alt ? `<a class="lng" href="${o.alt}" hreflang="${fr ? "en" : "fr"}">${t.alt}</a>` : ""}<a class="btn sm" href="${SITE}${fr ? "fr/" : ""}">${t.bot}</a></nav></div></header>
<main>${withSor(o.body, fr, o.url)}
<section><div class="w"><div class="final"><h2>${t.fin}</h2><p class="lead" style="margin:0 auto">${t.finP}</p><div class="ctas"><a class="btn" href="${SITE}${fr ? "fr/" : ""}">${t.open}</a></div></div></div></section>
</main><footer><div class="w"><span>${t.foot}</span><span><a href="${home}blog/">Blog</a> · <a href="https://t.me/aifootballpredictorchannel" rel="me">📢 Telegram</a> · <a href="https://bsky.app/profile/did:plc:nxkke6m5abp74xikyikzyuoz" rel="me">🦋 Bluesky</a> · <a href="${home}${fr ? "confidentialite/" : "privacy/"}">${fr ? "Confidentialité" : "Privacy"}</a> · <a href="${home}${fr ? "conditions/" : "terms/"}">${fr ? "Conditions" : "Terms"}</a>${o.alt ? ` · <a href="${o.alt}" hreflang="${fr ? "en" : "fr"}">${t.altName}</a>` : ""}</span></div></footer></body></html>`;
}
const crumb = (fr: boolean, last: string) => { const h = SITE + (fr ? "fr/" : ""), t = L10(fr); return `<nav class="crumb" aria-label="breadcrumb"><a href="${h}">${t.home}</a> / <a href="${h}blog/">${t.blog}</a> / ${esc(last)}</nav>`; };
const crumbLd = (fr: boolean, name: string, url: string) => { const h = SITE + (fr ? "fr/" : ""); return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: fr ? "Accueil" : "Home", item: h }, { "@type": "ListItem", position: 2, name: "Blog", item: h + "blog/" }, { "@type": "ListItem", position: 3, name, item: url }] }; };
const blogUrl = (x: any) => `${SITE}${x.lang === "fr" ? "fr/" : ""}blog/${x.slug}/`;
async function related(lang: string, not: string, n = 4) {
  const r = (await sb(`afp_blog?lang=eq.${lang}&slug=neq.${not}&select=slug,lang,kind,title,descr,published_at&order=published_at.desc&limit=12`)) || [];
  const g = r.filter((x: any) => x.kind === "guide"), d = r.filter((x: any) => x.kind === "daily");
  const out: any[] = []; while (out.length < n && (g.length || d.length)) { if (g.length) out.push(g.shift()); if (d.length && out.length < n) out.push(d.shift()); }
  return out;
}
function cards(list: any[], fr: boolean) {
  const t = L10(fr);
  return `<div class="cards">${list.map((x: any) => `<a class="card" href="${blogUrl(x)}"><span class="ic${x.kind === "daily" ? " d" : ""}">${x.kind === "daily" ? (fr ? "JOUR" : "DAILY") : x.kind === "match" ? (fr ? "AVANT-MATCH" : "PREVIEW") : "GUIDE"}</span><h3>${esc(x.title)}</h3><p>${esc(x.descr || "")}</p><span class="go">${t.read}</span></a>`).join("")}</div>`;
}
const alsoBlock = async (lang: string, slug: string) => { const fr = lang === "fr", r = await related(lang, slug); return r.length ? `<section style="padding-top:20px"><div class="w"><div class="sec">${L10(fr).also}</div>${cards(r, fr)}</div></section>` : ""; };

// ---------- daily probabilities article (7 nov 2026, Jeremy: no more "pronos", probabilities only, same data as the app) ----------
async function daily(day: string) {
  const from = new Date(Date.parse(day + "T00:00:00+01:00") - 3600000).toISOString(), to = new Date(Date.parse(day + "T23:59:59+01:00") + 3600000).toISOString();
  const rows = ((await sb(`afp_predictions?kickoff=gte.${from}&kickoff=lte.${to}&order=kickoff.asc&limit=1000&select=n,league,home,away,kickoff,pick,pick_prob,ph,pd,pa,xg_h,xg_a,o25,score,selected,published,status,hg,ag`)) || []).filter((p: any) => parisDay(Date.parse(p.kickoff)) === day);
  if (!rows.length) { console.log("daily: no matches", day); return null; }
  const top = rows.filter((p: any) => p.selected);
  const comps = [...new Set(rows.map((p: any) => COMP[p.league] || p.league))];
  const big = rows.filter((p: any) => ["E0", "F1", "SP1", "I1", "D1", "CL", "EL", "ECL"].includes(p.league)).slice(0, 16);
  const done = top.filter((p: any) => p.status === "won" || p.status === "lost"), won = done.filter((p: any) => p.status === "won").length;
  const ann = done.length ? done.reduce((s: number, p: any) => s + Number(p.pick_prob), 0) / done.length : null;
  const facts = {
    date: day, matches_analysed: rows.length, competitions: comps.slice(0, 12),
    most_likely_matches_65_plus: top.map((p: any) => ({ match: `${p.home} vs ${p.away}`, comp: COMP[p.league] || p.league, most_likely: p.pick === "H" ? `${p.home} win` : p.pick === "A" ? `${p.away} win` : "draw", probability: pct(p.pick_prob), result: p.status === "won" ? "happened" : p.status === "lost" ? "did not happen" : "not played yet", score: p.hg != null ? `${p.hg}-${p.ag}` : null })),
    finished_most_likely: done.length ? `${won}/${done.length} happened, ${pct(ann)} announced on average` : null,
  };
  // 8 nov 2026 (Jeremy): "un article récap chaque jour par l'IA": once the day is over, the daily page becomes the AI's recap of that day (same URL)
  const recap = day < parisDay() && done.length > 0;
  (facts as any).recap = recap;
  const txt = await ai("If facts.recap is true, this is the AI's daily recap of a finished day: call the predictor 'the AI' / 'our AI' (French: 'l'IA' or 'notre IA', feminine), for example 'The AI saw Lens beating Nantes' / 'L'IA avait vu juste sur Lens', and say plainly where it was wrong. You write the short introduction of a daily football probabilities article for SEO. We publish win probabilities, not predictions or tips: say 'most likely', 'happened', 'did not happen', never 'prediction', 'pick', 'tip', 'won' or 'lost'. Use ONLY the JSON facts. Never invent news, players, injuries, streaks or quotes. No betting language (no 'bet', 'stake', 'odds', 'lock', 'sure'). Never use em dashes. Lively but factual: the first paragraph is a hook of 1 or 2 sentences. Reply with JSON only: {\"en\":\"2 short paragraphs\",\"fr\":\"2 short paragraphs, natural French\"}. If results are known, mention them honestly, including the ones that did not happen.", JSON.stringify(facts), 3000);
  for (const lang of ["en", "fr"]) {
    const fr = lang === "fr", d = longDate(day, lang), t = L10(fr);
    const slug = fr ? `pronostics-foot-${day}` : `football-predictions-${day}`;
    const url = `${SITE}${fr ? "fr/" : ""}blog/${slug}/`, alt = `${SITE}${fr ? "" : "fr/"}blog/${fr ? `football-predictions-${day}` : `pronostics-foot-${day}`}/`;
    const title = recap ? (fr ? `Récap de l'IA du ${d} : ${won} sur ${done.length} matchs les plus probables arrivés` : `AI recap for ${d}: ${won} of ${done.length} most likely matches happened`) : fr ? `Probabilités foot du ${d} : les matchs les plus probables` : `Football probabilities for ${d}: the most likely matches`;
    const desc = recap ? (fr ? `Le récap de l'IA du ${d} : ${won} des ${done.length} matchs les plus probables sont arrivés. Résultats, scores et probabilités annoncées avant le coup d'envoi.` : `The AI's recap for ${d}: ${won} of the ${done.length} most likely matches happened. Results, scores and the probabilities announced before kickoff.`) : fr ? `${rows.length} matchs analysés le ${d} : probabilités de victoire, nul et défaite, ${top.length} match(s) à 65 % et plus, buts attendus et résultats vérifiés.` : `${rows.length} matches analysed on ${d}: win, draw and loss probabilities, ${top.length} match(es) at 65%+, expected goals and checked results.`;
    const lab = (p: any) => p.pick === "D" ? (fr ? "Match nul" : "Draw") : fr ? `Victoire ${p.pick === "H" ? p.home : p.away}` : `${p.pick === "H" ? p.home : p.away} win`;
    const resB = (st: string) => st === "won" ? `<span class="res ok">✓ ${fr ? "ARRIVÉ" : "HAPPENED"}</span>` : st === "lost" ? `<span class="res ko">✗ ${fr ? "PAS ARRIVÉ" : "DID NOT HAPPEN"}</span>` : "";
    const sc = (p: any) => p.hg != null ? ` · ${p.hg}-${p.ag}` : "";
    const intro = txt?.[lang] ? String(nodash(txt[lang])).split(/\n+/).filter(Boolean) : [];
    const upd = new Date().toLocaleString(fr ? "fr-FR" : "en-GB", { timeZone: "Europe/Paris", dateStyle: "medium", timeStyle: "short" });
    const APP = `${SITE}${fr ? "fr/" : ""}`;
    let b = `<section class="ahero"><div class="w">${crumb(fr, d)}<div style="margin-top:18px"><span class="tag"><span class="dot"></span>${t.daily} · ${esc(d)}</span></div><h1>${esc(title)}</h1>${intro[0] ? `<p class="lede">${esc(intro[0])}</p>` : ""}
<div class="chipsm"><span>${fr ? "mis à jour" : "updated"} <b>${esc(upd)}</b></span><span><b>${comps.length}</b> ${fr ? "compétitions" : "competitions"}</span></div></div></section>`;
    b += `<section style="padding:26px 0 10px"><div class="w"><div class="kv"><div><b>${rows.length}</b><small>${fr ? "matchs analysés" : "matches analysed"}</small></div><div><b>${top.length}</b><small>${fr ? "matchs à 65 % et plus" : "matches at 65%+"}</small></div><div><b>${done.length ? `${won}/${done.length}` : "-"}</b><small>${fr ? "les plus probables arrivés" : "most likely that happened"}${ann != null ? ` · ${fr ? "annoncé" : "announced"} ${pct(ann)}` : ""}</small>${done.length ? `<span class="bar" style="display:block"><i style="width:${Math.round(won / done.length * 100)}%"></i></span>` : ""}</div></div></div></section>`;
    const row = (p: any) => `<div class="tkl d4"><span class="t">${hm(p.kickoff)}</span><span>${esc(p.home)} - ${esc(p.away)}<br><small class="mut">${esc(COMP[p.league] || p.league)}${sc(p)}</small></span><span class="pk">${esc(lab(p))} ${resB(p.status)}<small>${pct(p.pick_prob)}${p.xg_h != null ? ` · ${fr ? "buts attendus" : "exp. goals"} ${p.xg_h}-${p.xg_a}` : ""}</small></span></div>`;
    b += `<section style="padding-top:30px"><div class="w"><div class="sec">${fr ? "les plus probables" : "most likely"}</div><h2>${fr ? "Les matchs les plus probables du jour" : "The day's most likely matches"}</h2><p class="lead">${fr ? "Un match est mis en avant quand une équipe a au moins 65 % de chances de gagner. Ce sont des probabilités, pas des certitudes : à 70 %, ça ne se produit pas 3 fois sur 10." : "A match is highlighted when a team has at least a 65% chance to win. These are probabilities, not certainties: at 70%, it fails 3 times out of 10."}</p>
<div class="tk"><div class="tkh"><div><b>${fr ? "LES PLUS PROBABLES" : "MOST LIKELY"}</b><small>${top.length} ${fr ? "matchs à 65 %+" : "matches at 65%+"}${done.length ? ` · ${won}/${done.length} ${fr ? "arrivés" : "happened"}` : ""}</small></div><span class="mono">#AIFP-${day.replace(/-/g, "")}</span></div>${top.length ? top.map(row).join("") : `<div class="empty">${fr ? "Aucune équipe n'atteint 65 % ce jour-là. Toutes les probabilités sont dans l'appli." : "No team reaches 65% that day. Every probability is in the app."}</div>`}<div class="tkf"><span>${fr ? "Fiches équipes, direct et fiabilité dans l'appli" : "Team sheets, live and reliability in the app"}</span><a class="btn sm" href="${APP}">${fr ? "Ouvrir" : "Open"}</a></div></div></div></section>`;
    if (intro.length > 1) b += `<section style="padding-top:10px"><div class="w art prose">${intro.slice(1).map((x: string) => `<p>${esc(x)}</p>`).join("")}</div></section>`;
    if (big.length) b += `<section style="padding-top:14px"><div class="w"><div class="sec">${fr ? "grands championnats" : "top leagues"}</div><h2>${fr ? "Les grands championnats en probabilités" : "Top leagues in probabilities"}</h2><p class="lead">${fr ? "Chances de victoire à domicile (1), de nul (N) et de victoire à l'extérieur (2), et chance de voir plus de 2,5 buts." : "Chance of a home win (1), a draw (X) and an away win (2), and chance of more than 2.5 goals."}</p><div class="tw"><table><tr><th>Match</th><th>1</th><th>${fr ? "N" : "X"}</th><th>2</th><th>${fr ? "+2,5 buts" : "Over 2.5"}</th></tr>${big.map((p: any) => `<tr><td>${esc(p.home)} - ${esc(p.away)}<br><small class="mut">${esc(COMP[p.league])} · ${hm(p.kickoff)}${sc(p)}</small></td><td class="mono">${pct(p.ph)}</td><td class="mono">${pct(p.pd)}</td><td class="mono">${pct(p.pa)}</td><td class="mono">${p.o25 != null ? pct(p.o25) : "-"}</td></tr>`).join("")}</table></div></div></section>`;
    b += `<section style="padding-top:14px"><div class="w"><div class="sec">${fr ? "couverture" : "coverage"}</div><h2>${fr ? "Compétitions analysées" : "Competitions analysed"}</h2><div class="chips">${comps.map(c => `<span>${esc(c)}</span>`).join("")}</div>
<p class="lead" style="margin-top:22px">${fr ? "Méthode : les probabilités suivent le marché quand il existe, et notre modèle (attaque, défense, matchs récents, buts attendus) sinon. Chaque probabilité est verrouillée 3 h avant le coup d'envoi puis comparée au vrai résultat." : "Method: probabilities follow the market when it exists, and our model (attack, defence, recent matches, expected goals) otherwise. Every probability is locked 3 hours before kick-off, then checked against the real result."} <a href="${SITE}${fr ? "fr/methode/" : "method/"}">${fr ? "La méthode en détail" : "Method in detail"}</a> · <a href="${SITE}${fr ? "fr/" : ""}widget/">${fr ? "Widget gratuit pour ton site" : "Free widget for your site"}</a></p></div></section>`;
    b += await alsoBlock(lang, slug);
    const ld = [{ "@context": "https://schema.org", "@type": "Article", headline: title, description: desc, datePublished: day + "T07:00:00+01:00", dateModified: new Date().toISOString(), inLanguage: lang, author: { "@type": "Organization", name: "AI Football Predictor" }, mainEntityOfPage: url }, crumbLd(fr, d, url)];
    await put(`ai-football-predictor/${fr ? "fr/" : ""}blog/${slug}/index.html`, page({ lang, url, alt, title, desc, body: b, ld }), `blog: daily ${lang} ${day}`);
    await sb("afp_blog?on_conflict=slug,lang", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ slug, lang, kind: "daily", title, descr: desc, published_at: day + "T07:00:00+01:00", updated_at: new Date().toISOString() }) });
  }
  return true;
}

// ---------- weekly recap (9 nov 2026, Jeremy: "un article de résultats" -> "bilan de la semaine le lundi, en automatique") ----------
// Monday morning (mode am) or mode weekly: one article per language for last week (Monday to Sunday, Paris). Honest numbers only:
// how often the most likely outcome happened, 65%+ matches, announced vs happened by probability band, our model alone vs the market,
// the surest that happened, the biggest misses, and the "Beat the model" game (no player names: they are private).
const weekStart = (day: string) => { const d = new Date(day + "T12:00:00Z"); return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10); };
const addDays = (day: string, n: number) => new Date(Date.parse(day + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);
async function weekly(w: string) {
  const end = addDays(w, 7);
  const from = new Date(Date.parse(w + "T00:00:00+01:00") - 3600000).toISOString(), to = new Date(Date.parse(end + "T00:00:00+01:00") + 3600000).toISOString();
  const rows = ((await sb(`afp_predictions?kickoff=gte.${from}&kickoff=lt.${to}&status=in.(won,lost)&order=kickoff.asc&limit=4000&select=n,league,home,away,kickoff,pick,pick_prob,mkt_h,mkt_d,mkt_a,mdl_h,mdl_d,mdl_a,selected,status,hg,ag`)) || [])
    .filter((p: any) => { const d = parisDay(Date.parse(p.kickoff)); return d >= w && d < end && p.hg != null; });
  if (rows.length < 20) { console.log("weekly: not enough matches", w, rows.length); return null; }
  const d1 = parisDay(Date.parse(rows[0].kickoff)), d2 = parisDay(Date.parse(rows[rows.length - 1].kickoff));
  const won = rows.filter((p: any) => p.status === "won").length, rate = won / rows.length;
  const ann = rows.reduce((s: number, p: any) => s + Number(p.pick_prob), 0) / rows.length;
  const top = rows.filter((p: any) => p.selected), topWon = top.filter((p: any) => p.status === "won").length;
  const annTop = top.length ? top.reduce((s: number, p: any) => s + Number(p.pick_prob), 0) / top.length : null;
  const res = (p: any) => p.hg > p.ag ? "H" : p.hg === p.ag ? "D" : "A";
  const fav = (h: any, d: any, a: any) => { h = Number(h); d = Number(d); a = Number(a); return h >= d && h >= a ? "H" : a >= d ? "A" : "D"; };
  const mk = rows.filter((p: any) => p.mkt_h != null && p.mdl_h != null);
  const mktOk = mk.filter((p: any) => fav(p.mkt_h, p.mkt_d, p.mkt_a) === res(p)).length, mdlOk = mk.filter((p: any) => fav(p.mdl_h, p.mdl_d, p.mdl_a) === res(p)).length;
  const beatMkt = mk.filter((p: any) => fav(p.mdl_h, p.mdl_d, p.mdl_a) !== fav(p.mkt_h, p.mkt_d, p.mkt_a) && fav(p.mdl_h, p.mdl_d, p.mdl_a) === res(p)).slice(0, 4);
  const bands = [[0.4, 0.5], [0.5, 0.6], [0.6, 0.7], [0.7, 1.01]].map(([a, b]) => { const r = rows.filter((p: any) => Number(p.pick_prob) >= a && Number(p.pick_prob) < b); return { a, b, n: r.length, ok: r.filter((p: any) => p.status === "won").length, ann: r.length ? r.reduce((s: number, p: any) => s + Number(p.pick_prob), 0) / r.length : 0 }; }).filter(x => x.n >= 5);
  const sure = rows.filter((p: any) => p.status === "won").sort((a: any, b: any) => b.pick_prob - a.pick_prob).slice(0, 4);
  const miss = rows.filter((p: any) => p.status === "lost").sort((a: any, b: any) => b.pick_prob - a.pick_prob).slice(0, 4);
  const byComp: Record<string, { n: number; ok: number }> = {};
  for (const p of rows) { const c = COMP[p.league] || p.league; (byComp[c] ||= { n: 0, ok: 0 }); byComp[c].n++; if (p.status === "won") byComp[c].ok++; }
  const comps = Object.entries(byComp).filter(([, v]) => v.n >= 6).sort((a, b) => b[1].ok / b[1].n - a[1].ok / a[1].n);
  let game: any[] = [];
  try { game = (await sb("rpc/afp_game_week_rows", { method: "POST", body: JSON.stringify({ p_w: w }) })) || []; } catch { game = []; }
  const gp = game.filter((g: any) => Number(g.tg_id) !== -1), gai = game.find((g: any) => Number(g.tg_id) === -1);
  const gBest = gp.length ? gp.slice().sort((a: any, b: any) => Number(a.rk) - Number(b.rk))[0] : null, gBeat = gai ? gp.filter((g: any) => Number(g.pts) > Number(gai.pts)).length : 0;
  const lab = (p: any, fr: boolean) => p.pick === "D" ? (fr ? "Match nul" : "Draw") : fr ? `Victoire ${p.pick === "H" ? p.home : p.away}` : `${p.pick === "H" ? p.home : p.away} win`;
  const facts = {
    from: d1, to: d2, launch_day: "2026-11-06", matches_checked: rows.length,
    most_likely_happened: `${won}/${rows.length} (${pct(rate)}), announced ${pct(ann)} on average`,
    matches_65_plus: top.length ? `${topWon}/${top.length} happened, announced ${pct(annTop)} on average` : null,
    bands: bands.map(b => ({ band: `${Math.round(b.a * 100)}-${Math.min(100, Math.round(b.b * 100))}%`, announced: pct(b.ann), happened: pct(b.ok / b.n), matches: b.n })),
    model_alone_vs_market: mk.length >= 10 ? { matches: mk.length, model_favourite_happened: mdlOk, market_favourite_happened: mktOk } : null,
    surest_that_happened: sure.map((p: any) => ({ match: `${p.home} vs ${p.away}`, most_likely: lab(p, false), probability: pct(p.pick_prob), score: `${p.hg}-${p.ag}` })),
    biggest_misses: miss.map((p: any) => ({ match: `${p.home} vs ${p.away}`, most_likely: lab(p, false), probability: pct(p.pick_prob), score: `${p.hg}-${p.ag}` })),
    best_competitions: comps.slice(0, 3).map(([c, v]) => `${c} ${v.ok}/${v.n}`), worst_competitions: comps.slice(-2).map(([c, v]) => `${c} ${v.ok}/${v.n}`),
    beat_the_model_game: gp.length ? { players: gp.length, best_player_score: gBest ? `${gBest.pts}/${gBest.played}` : null, model_score: gai ? `${gai.pts}/${gai.played}` : null, players_who_beat_the_model: gBeat } : null,
  };
  const txt = await ai("You write the introduction of a weekly football recap for SEO, about our AI's win probabilities over the past week. Call the predictor 'the AI' / 'our AI' (French: 'l'IA' / 'notre IA', feminine). We publish win probabilities, not predictions or tips: say 'most likely', 'happened', 'did not happen', never 'prediction', 'pick', 'tip', 'won' or 'lost'. Use ONLY the JSON facts. Never invent news, players, injuries, streaks or quotes. No betting language (no 'bet', 'stake', 'odds', 'lock', 'sure thing'). Never use em dashes. Be honest: say plainly where the AI was wrong, and whether 'announced' and 'happened' match (that is what matters for probabilities). If 'from' equals launch_day, say this is the first week since the launch on 6 November. Never name players of the game. Reply with JSON only: {\"en\":\"3 short paragraphs\",\"fr\":\"3 short paragraphs, natural French\"}. First paragraph: a 1 or 2 sentence hook with the main number.", JSON.stringify(facts), 3000);
  const fmt = (d: string, fr: boolean) => new Date(d + "T12:00:00Z").toLocaleDateString(fr ? "fr-FR" : "en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
  for (const lang of ["en", "fr"]) {
    const fr = lang === "fr", t = L10(fr), r1 = fmt(d1, fr), r2 = fmt(d2, fr) + " " + d2.slice(0, 4);
    const slug = fr ? `bilan-semaine-foot-${w}` : `football-weekly-recap-${w}`;
    const url = `${SITE}${fr ? "fr/" : ""}blog/${slug}/`, alt = `${SITE}${fr ? "" : "fr/"}blog/${fr ? `football-weekly-recap-${w}` : `bilan-semaine-foot-${w}`}/`;
    const title = fr ? `Bilan de la semaine (${r1} au ${r2}) : ${pct(rate)} des issues les plus probables sont arrivées` : `Weekly recap (${r1} to ${r2}): ${pct(rate)} of the most likely outcomes happened`;
    const desc = fr ? `Le bilan honnête de l'IA du ${r1} au ${r2} : ${won} issues les plus probables arrivées sur ${rows.length} matchs, ${top.length ? `${topWon}/${top.length} à 65 % et plus, ` : ""}annoncé contre arrivé, modèle contre marché, meilleurs coups et ratés.` : `The AI's honest recap from ${r1} to ${r2}: ${won} most likely outcomes happened out of ${rows.length} matches, ${top.length ? `${topWon}/${top.length} at 65%+, ` : ""}announced vs happened, model vs market, best calls and misses.`;
    const intro = txt?.[lang] ? String(nodash(txt[lang])).split(/\n+/).filter(Boolean) : [];
    const resB = (st: string) => st === "won" ? `<span class="res ok">✓ ${fr ? "ARRIVÉ" : "HAPPENED"}</span>` : `<span class="res ko">✗ ${fr ? "PAS ARRIVÉ" : "DID NOT HAPPEN"}</span>`;
    const row = (p: any) => `<div class="tkl d4"><span class="t">${esc(parisDay(Date.parse(p.kickoff)).slice(5).split("-").reverse().join("/"))}</span><span>${esc(p.home)} - ${esc(p.away)}<br><small class="mut">${esc(COMP[p.league] || p.league)} · ${p.hg}-${p.ag}</small></span><span class="pk">${esc(lab(p, fr))} ${resB(p.status)}<small>${pct(p.pick_prob)}</small></span></div>`;
    const box = (head: string, sub: string, list: any[]) => list.length ? `<div class="tk" style="margin-bottom:16px"><div class="tkh"><div><b>${head}</b><small>${sub}</small></div><span class="mono">#AIFP-W${w.replace(/-/g, "")}</span></div>${list.map(row).join("")}</div>` : "";
    const APP = `${SITE}${fr ? "fr/" : ""}`;
    let b = `<section class="ahero"><div class="w">${crumb(fr, fr ? "Bilan de la semaine" : "Weekly recap")}<div style="margin-top:18px"><span class="tag"><span class="dot"></span>${fr ? "Bilan de la semaine" : "Weekly recap"} · ${esc(r1)} - ${esc(r2)}</span></div><h1>${esc(title)}</h1>${intro[0] ? `<p class="lede">${esc(intro[0])}</p>` : ""}
<div class="chipsm"><span><b>${rows.length}</b> ${fr ? "matchs vérifiés" : "matches checked"}</span><span><b>${Object.keys(byComp).length}</b> ${fr ? "compétitions" : "competitions"}</span></div></div></section>`;
    b += `<section style="padding:26px 0 10px"><div class="w"><div class="kv"><div><b>${pct(rate)}</b><small>${fr ? "issues les plus probables arrivées" : "most likely outcomes that happened"} · ${fr ? "annoncé" : "announced"} ${pct(ann)}</small><span class="bar" style="display:block"><i style="width:${Math.round(rate * 100)}%"></i></span></div><div><b>${top.length ? `${topWon}/${top.length}` : "-"}</b><small>${fr ? "matchs à 65 % et plus arrivés" : "65%+ matches that happened"}${annTop != null ? ` · ${fr ? "annoncé" : "announced"} ${pct(annTop)}` : ""}</small></div><div><b>${mk.length >= 10 ? `${mdlOk} - ${mktOk}` : "-"}</b><small>${fr ? "notre modèle seul contre le marché (favori arrivé)" : "our model alone vs the market (favourite happened)"}${mk.length >= 10 ? ` · ${mk.length} ${fr ? "matchs" : "matches"}` : ""}</small></div></div></div></section>`;
    if (intro.length > 1) b += `<section style="padding-top:10px"><div class="w art prose">${intro.slice(1).map((x: string) => `<p>${esc(x)}</p>`).join("")}</div></section>`;
    if (bands.length) b += `<section style="padding-top:14px"><div class="w"><div class="sec">${fr ? "fiabilité" : "reliability"}</div><h2>${fr ? "Annoncé contre arrivé" : "Announced vs happened"}</h2><p class="lead">${fr ? "Une probabilité est juste quand elle se vérifie dans les mêmes proportions : sur les issues annoncées autour de 70 %, environ 7 sur 10 doivent arriver. Une semaine reste un petit échantillon." : "A probability is right when it comes true in the same proportion: of the outcomes announced around 70%, about 7 in 10 should happen. One week is still a small sample."}</p><div class="tw"><table><tr><th>${fr ? "Probabilité annoncée" : "Announced probability"}</th><th>${fr ? "Matchs" : "Matches"}</th><th>${fr ? "Annoncé" : "Announced"}</th><th>${fr ? "Arrivé" : "Happened"}</th></tr>${bands.map(x => `<tr><td>${Math.round(x.a * 100)} - ${Math.min(100, Math.round(x.b * 100))} %</td><td class="mono">${x.n}</td><td class="mono">${pct(x.ann)}</td><td class="mono"><b>${pct(x.ok / x.n)}</b></td></tr>`).join("")}</table></div></div></section>`;
    b += `<section style="padding-top:24px"><div class="w"><div class="sec">${fr ? "les matchs" : "the matches"}</div><h2>${fr ? "Les plus sûrs et les plus gros ratés" : "The surest calls and the biggest misses"}</h2>`
      + box(fr ? "LES PLUS SÛRS, ARRIVÉS" : "SUREST, HAPPENED", fr ? "les plus fortes probabilités qui se sont vérifiées" : "the highest probabilities that came true", sure)
      + box(fr ? "LES PLUS GROS RATÉS" : "BIGGEST MISSES", fr ? "les plus fortes probabilités qui ne sont pas arrivées" : "the highest probabilities that did not happen", miss)
      + (beatMkt.length ? box(fr ? "LE MODÈLE CONTRE LE MARCHÉ" : "MODEL VS MARKET", fr ? "notre modèle seul avait un autre favori que le marché, et il avait raison" : "our model alone had another favourite than the market, and it was right", beatMkt.map((p: any) => ({ ...p, pick: fav(p.mdl_h, p.mdl_d, p.mdl_a), pick_prob: Math.max(Number(p.mdl_h), Number(p.mdl_d), Number(p.mdl_a)), status: "won" }))) : "")
      + `</div></section>`;
    if (comps.length >= 3) b += `<section style="padding-top:14px"><div class="w"><div class="sec">${fr ? "par compétition" : "by competition"}</div><h2>${fr ? "Où l'IA a été la plus juste" : "Where the AI was most accurate"}</h2><div class="tw"><table><tr><th>${fr ? "Compétition" : "Competition"}</th><th>${fr ? "Issue la plus probable arrivée" : "Most likely outcome happened"}</th></tr>${comps.map(([c, v]) => `<tr><td>${esc(c)}</td><td class="mono">${v.ok}/${v.n} · ${pct(v.ok / v.n)}</td></tr>`).join("")}</table></div></div></section>`;
    if (gp.length) b += `<section style="padding-top:14px"><div class="w"><div class="sec">${fr ? "le jeu" : "the game"}</div><h2>${fr ? "Défie le modèle : la semaine des joueurs" : "Beat the model: the players' week"}</h2><p class="lead">${fr ? `${gp.length} joueur${gp.length > 1 ? "s" : ""} cette semaine. ${gBest ? `Le meilleur a fait ${gBest.pts}/${gBest.played}` : ""}${gai ? `, le modèle ${gai.pts}/${gai.played}` : ""}. ${gBeat ? `${gBeat} joueur${gBeat > 1 ? "s ont" : " a"} battu le modèle.` : "Personne n'a battu le modèle."} Le classement repart de zéro chaque lundi.` : `${gp.length} player${gp.length > 1 ? "s" : ""} this week. ${gBest ? `The best scored ${gBest.pts}/${gBest.played}` : ""}${gai ? `, the model ${gai.pts}/${gai.played}` : ""}. ${gBeat ? `${gBeat} player${gBeat > 1 ? "s" : ""} beat the model.` : "Nobody beat the model."} The leaderboard resets every Monday.`}</p><div class="ctas"><a class="btn" href="https://t.me/ai_football_predictorbot?start=src_weekly">${fr ? "Jouer sur Telegram" : "Play on Telegram"}</a><a class="btn out" href="${APP}?tab=game&src=weekly">${fr ? "Jouer sur le site" : "Play on the website"}</a></div></div></section>`;
    b += `<section style="padding-top:14px"><div class="w"><p class="lead">${fr ? "Méthode : chaque probabilité est verrouillée avant le coup d'envoi puis comparée au vrai résultat, ratés compris. Les probabilités publiées suivent le marché quand il existe ; « notre modèle seul » est le calcul sans le marché." : "Method: every probability is locked before kickoff, then checked against the real result, misses included. Published probabilities follow the market when it exists; \"our model alone\" is the calculation without the market."} <a href="${SITE}${fr ? "fr/methode/" : "method/"}">${fr ? "La méthode en détail" : "Method in detail"}</a> · <a href="${APP}?app=1&tab=r">${fr ? "Tous les résultats" : "All results"}</a></p></div></section>`;
    b += await alsoBlock(lang, slug);
    const ld = [{ "@context": "https://schema.org", "@type": "Article", headline: title, description: desc, datePublished: addDays(w, 7) + "T08:00:00+01:00", dateModified: new Date().toISOString(), inLanguage: lang, author: { "@type": "Organization", name: "AI Football Predictor" }, mainEntityOfPage: url }, crumbLd(fr, fr ? "Bilan de la semaine" : "Weekly recap", url)];
    await put(`ai-football-predictor/${fr ? "fr/" : ""}blog/${slug}/index.html`, page({ lang, url, alt, title, desc, body: b, ld }), `blog: weekly ${lang} ${w}`);
    await sb("afp_blog?on_conflict=slug,lang", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ slug, lang, kind: "weekly", title, descr: desc, published_at: addDays(w, 7) + "T08:00:00+01:00", updated_at: new Date().toISOString() }) });
  }
  console.log("weekly done", w, rows.length);
  return true;
}

// ---------- evergreen guide ----------
function guideBody(lang: string, x: any, published: string) {
  const fr = lang === "fr", t = L10(fr);
  let i = 0; const toc: string[] = [];
  let html = String(x.html).replace(/<h2>(.*?)<\/h2>/g, (_m: string, h: string) => { const id = "s" + (++i); toc.push(`<li><a href="#${id}">${h}</a></li>`); return `<h2 id="${id}">${h}</h2>`; });
  const call = `<div class="call"><span class="mark">AIFP</span><div><b>${fr ? "Ces chiffres, pour chaque match du jour" : "These numbers, for every match today"}</b><span>${fr ? "Probabilités, buts attendus et fiabilité vérifiée, gratuitement, sur le site." : "Probabilities, expected goals and checked reliability, free, on the site."}</span></div><a class="btn sm" href="${SITE}${fr ? "fr/" : ""}">${fr ? "Voir les probabilités" : "See the probabilities"}</a></div>`;
  let n = 0; html = html.replace(/<h2 id="s3">/, (m: string) => { n++; return call + m; }); if (!n) html += call;
  const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length, mins = Math.max(3, Math.round(words / 220));
  const faq = (x.faq || []).slice(0, 4);
  const date = new Date(published).toLocaleDateString(fr ? "fr-FR" : "en-GB", { dateStyle: "long", timeZone: "Europe/Paris" });
  return `<section class="ahero"><div class="w">${crumb(fr, x.title)}<div style="margin-top:18px"><span class="tag"><span class="dot"></span>${t.guide}</span></div><h1>${esc(x.title)}</h1><p class="lede">${esc(x.desc)}</p>
<div class="chipsm"><span><b>${mins}</b> ${t.min}</span><span>${esc(date)}</span><span>${fr ? "par" : "by"} <b>AI Football Predictor</b></span></div></div></section>
<section style="padding-top:10px"><div class="w art">${toc.length > 2 ? `<nav class="toc"><div class="sec">${t.toc}</div><ol>${toc.join("")}</ol></nav>` : ""}<div class="prose">${html}</div>
${faq.length ? `<div class="sec" style="margin-top:46px">faq</div><h2>${t.faq}</h2>${faq.map((f: any) => `<details><summary>${esc(nodash(f.q))}</summary><p>${esc(nodash(f.a))}</p></details>`).join("")}` : ""}</div></section>`;
}
async function renderGuide(lang: string, slug: string, alt: string, x: any, published: string) {
  const fr = lang === "fr", url = `${SITE}${fr ? "fr/" : ""}blog/${slug}/`;
  const faq = (x.faq || []).slice(0, 4);
  const ld: any[] = [{ "@context": "https://schema.org", "@type": "Article", headline: x.title, description: x.desc, datePublished: published, dateModified: new Date().toISOString(), inLanguage: lang, author: { "@type": "Organization", name: "AI Football Predictor" }, mainEntityOfPage: url }, crumbLd(fr, x.title, url)];
  if (faq.length) ld.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f: any) => ({ "@type": "Question", name: nodash(f.q), acceptedAnswer: { "@type": "Answer", text: nodash(f.a) } })) });
  const body = guideBody(lang, x, published) + await alsoBlock(lang, slug);
  await put(`ai-football-predictor/${fr ? "fr/" : ""}blog/${slug}/index.html`, page({ lang, url, alt, title: x.title, desc: x.desc, body, ld }), `blog: guide ${lang} ${slug}`);
}
async function guide() {
  const t = (await sb("afp_blog_topics?done_at=is.null&order=id.asc&limit=1"))?.[0]; if (!t) return null;
  const o = await ai("You write evergreen SEO guide articles for a football statistics website (AI Football Predictor). Educational, accurate, neutral, engaging: open with a concrete situation a fan recognises, use short paragraphs, at least 5 <h2> sections, bullet lists, one worked example in a <table>, and bold the key ideas. No invented statistics: when you give numbers, keep them general and well known (for example typical league averages stated as approximate) or worked examples clearly labelled as examples. No betting promotion, no 'sure wins', no staking advice; when betting is mentioned, recall that statistics are not guarantees and that gambling is for adults and carries risks. Never use em dashes. Use simple HTML only: <h2>, <h3>, <p>, <ul><li>, <strong>, <table>. Mention once, naturally, that AI Football Predictor publishes these numbers (probabilities, xG) for every match. Reply with JSON only: {\"en\":{\"title\":\"...\",\"desc\":\"max 155 chars\",\"html\":\"1000-1400 words\",\"faq\":[{\"q\":\"\",\"a\":\"\"}x3]},\"fr\":{same in natural French, adapted not literally translated}}.", `Topic EN: ${t.en}\nTopic FR: ${t.fr}`, 16000);
  if (!o?.en?.html || !o?.fr?.html) return null;
  const sEn = slugify(t.en), sFr = slugify(t.fr), now = new Date().toISOString();
  const X: any = {};
  for (const lang of ["en", "fr"]) {
    const fr = lang === "fr", src = o[lang], slug = fr ? sFr : sEn;
    const x = { title: nodash(String(src.title)), desc: nodash(String(src.desc)).slice(0, 160), html: nodash(String(src.html)).replace(/<(script|style|iframe)[\s\S]*?<\/\1>/gi, ""), faq: (src.faq || []).map((f: any) => ({ q: nodash(String(f.q)), a: nodash(String(f.a)) })), alt: fr ? sEn : sFr };
    X[lang] = x;
    await sb("afp_blog?on_conflict=slug,lang", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ slug, lang, kind: "guide", title: x.title, descr: x.desc, data: x, published_at: now, updated_at: now }) });
  }
  for (const lang of ["en", "fr"]) { const fr = lang === "fr"; await renderGuide(lang, fr ? sFr : sEn, `${SITE}${fr ? "" : "fr/"}blog/${fr ? sEn : sFr}/`, X[lang], now); }
  await sb(`afp_blog_topics?id=eq.${t.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ done_at: now }) });
  return true;
}
// re-render every stored guide with the current template (m=all)
async function rerenderGuides() {
  const all = (await sb("afp_blog?kind=eq.guide&data=not.is.null&select=slug,lang,title,descr,data,published_at&order=published_at.asc")) || [];
  for (const g of all) {
    const alt = g.data.alt ? `${SITE}${g.lang === "fr" ? "" : "fr/"}blog/${g.data.alt}/` : undefined;
    const x = { title: g.title, desc: g.descr, html: g.data.html, faq: (g.data.faq || []).map((f: any) => ({ q: unesc(f.q), a: unesc(f.a) })) };
    await renderGuide(g.lang, g.slug, alt as any, x, g.published_at);
  }
}

// ---------- index pages + sitemap ----------
async function indexes() {
  // 8 nov 2026: manual runs (guides, announce...) skipped teams/players, so the sitemap lost ~460 team and player pages: always rebuild the lists (no page write)
  if (!PLAYER_URLS.length) { try { await players(false); } catch (e) { console.log("indexes players list error", String(e)); } }
  if (!TEAM_URLS.length) { try { await teams(false); } catch (e) { console.log("indexes teams list error", String(e)); } }
  const all = (await sb("afp_blog?select=slug,lang,kind,title,descr,published_at,updated_at&order=published_at.desc&limit=2000")) || [];
  for (const lang of ["en", "fr"]) {
    const fr = lang === "fr", t = L10(fr), L = all.filter((x: any) => x.lang === lang);
    const url = `${SITE}${fr ? "fr/" : ""}blog/`, alt = `${SITE}${fr ? "" : "fr/"}blog/`;
    const title = fr ? "Blog AI Football Predictor : probabilités foot du jour et guides statistiques" : "AI Football Predictor blog: daily football probabilities and statistics guides";
    const desc = fr ? "Chaque jour les probabilités de chaque match de foot avec les résultats vérifiés, et des guides pour comprendre les buts attendus et les probabilités." : "Every day the probability of every football match with checked results, plus guides to understand expected goals and probabilities.";
    const G = L.filter((x: any) => x.kind === "guide"), D = L.filter((x: any) => x.kind === "daily"), top = D[0];
    let body = `<section class="ahero"><div class="w"><span class="tag"><span class="dot"></span>${fr ? "Nouveaux articles chaque jour" : "New articles every day"}</span><h1>${fr ? "Le blog des probabilités foot" : "The football probabilities blog"}</h1><p class="lede">${esc(desc)}</p>
<div class="chipsm"><span><b>${D.length}</b> ${fr ? "pages du jour" : "daily pages"}</span><span><b>${G.length}</b> guides</span></div></div></section>`;
    if (top) body += `<section style="padding-top:24px"><div class="w"><div class="sec">${fr ? "à la une" : "featured"}</div><div class="feat1"><div><span class="tag"><span class="dot"></span>${t.daily}</span><h3>${esc(top.title)}</h3><p>${esc(top.descr || "")}</p><div class="ctas"><a class="btn" href="${blogUrl(top)}">${t.read}</a><a class="btn out" href="${SITE}${fr ? "fr/" : ""}">${fr ? "Ouvrir l'appli" : "Open the app"}</a></div></div>
<div class="tk"><div class="tkh"><div><b>${fr ? "LES PLUS PROBABLES" : "MOST LIKELY"}</b><small>${esc(longDate(String(top.slug).slice(-10), lang))}</small></div><span class="mono">#AIFP-${String(top.slug).slice(-10).replace(/-/g, "")}</span></div>${[1, 2, 3].map(() => `<div class="tkl"><span class="t">--:--</span><span><span class="blur">Home FC - Away FC</span></span><span class="lock">🔒 ${fr ? "dans l'app" : "in the app"}</span></div>`).join("")}<div class="tkf"><span>${fr ? "Probabilités, fiches équipes et direct dans l'appli" : "Probabilities, team sheets and live in the app"}</span><a class="btn sm" href="${SITE}${fr ? "fr/" : ""}">${fr ? "Ouvrir" : "Open"}</a></div></div></div></div></section>`;
    const M = L.filter((x: any) => x.kind === "match").slice(0, 12); /* 8 nov 2026: match previews */
    if (M.length) body += `<section style="padding-top:20px"><div class="w"><div class="sec">${fr ? "avant-matchs" : "match previews"}</div><h2>${fr ? "Les gros matchs vus par le modèle" : "The big matches seen by the model"}</h2>${cards(M, fr)}</div></section>`;
    { const W = L.filter((x: any) => x.kind === "weekly").slice(0, 8); if (W.length) body += `<section style="padding-top:20px"><div class="w"><div class="sec">${fr ? "bilans" : "recaps"}</div><h2>${fr ? "Les bilans de la semaine" : "Weekly recaps"}</h2>${cards(W, fr)}</div></section>`; }
    if (G.length) body += `<section style="padding-top:20px"><div class="w"><div class="sec">guides</div><h2>${fr ? "Comprendre les chiffres du foot" : "Understand football numbers"}</h2>${cards(G, fr)}</div></section>`;
    if (D.length) body += `<section style="padding-top:20px"><div class="w"><div class="sec">${fr ? "archives" : "archive"}</div><h2>${fr ? "Probabilités jour par jour" : "Probabilities day by day"}</h2><div class="arch">${D.map((x: any) => `<a href="${blogUrl(x)}"><span class="t">${String(x.slug).slice(-10)}</span><span>${esc(x.title)}</span><span class="go">${t.read}</span></a>`).join("")}</div></div></section>`;
    const ld = [{ "@context": "https://schema.org", "@type": "Blog", name: title, url, inLanguage: lang, blogPost: L.slice(0, 20).map((x: any) => ({ "@type": "BlogPosting", headline: x.title, url: blogUrl(x), datePublished: x.published_at })) }];
    await put(`ai-football-predictor/${fr ? "fr/" : ""}blog/index.html`, page({ lang, url, alt, title, desc, body, ld, type: "website" }), `blog: index ${lang}`);
  }
  const u = (loc: string, lm: string, f = "weekly", p = "0.7") => `<url><loc>${loc}</loc><lastmod>${lm.slice(0, 10)}</lastmod><changefreq>${f}</changefreq><priority>${p}</priority></url>`;
  const now = new Date().toISOString();
  const sm = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[u(SITE, now, "daily", "1.0"), u(SITE + "fr/", now, "daily", "1.0"), u(SITE + "blog/", now, "daily", "0.9"), u(SITE + "fr/blog/", now, "daily", "0.9"), u(SITE + "method/", now, "weekly", "0.8"), u(SITE + "fr/methode/", now, "weekly", "0.8"), u(SITE + "widget/", now, "weekly", "0.8"), u(SITE + "fr/widget/", now, "weekly", "0.8"), u(SITE + "widget/live/", now, "weekly", "0.8"), u(SITE + "fr/widget/live/", now, "weekly", "0.8"), u(SITE + "table/", now, "daily", "0.8"), u(SITE + "fr/classement/", now, "daily", "0.8"), ...TBL.flatMap(x => [u(tblUrl(false, x[1]), now, "daily", "0.8"), u(tblUrl(true, x[1]), now, "daily", "0.8")]), ...TEAM_URLS.flatMap(x => [u(x[0], now, "daily", "0.7"), u(x[1], now, "daily", "0.7")]), u(SITE + "widget/clubs/", now, "weekly", "0.7"), u(SITE + "fr/widget/clubs/", now, "weekly", "0.7"), ...PLAYER_URLS.flatMap(x => [u(x[0], now, "daily", "0.6"), u(x[1], now, "daily", "0.6")]), ...WP.flatMap((w: any) => [u(wpUrl(false, w), now, "daily", "0.8"), u(wpUrl(true, w), now, "daily", "0.8")]), u(SITE + "api/", now, "weekly", "0.9"), u(SITE + "fr/api/", now, "weekly", "0.9"), ...all.map((x: any) => u(blogUrl(x), x.updated_at || now, x.kind === "daily" ? "daily" : "monthly", x.kind === "daily" ? "0.6" : "0.8"))].join("\n")}\n</urlset>\n`;
  await put("ai-football-predictor/sitemap.xml", sm, "blog: sitemap");
  // 8 nov 2026 (Jeremy): "des widgets prêts pour chaque club" + "référence bien les pages" + "les fichiers pour les IA":
  // a hub page that lists every club widget (links to team/<slug>/#widget), and llms.txt (the site map written for AI assistants).
  if (TEAM_LINKS.length) {
    for (const lang of ["en", "fr"]) {
      const fr = lang === "fr", url = SITE + (fr ? "fr/" : "") + "widget/clubs/", alt = SITE + (fr ? "" : "fr/") + "widget/clubs/";
      const title = fr ? "Widgets foot gratuits par club : le prochain match et ses probabilités" : "Free football club widgets: the next match and its probabilities";
      const desc = fr ? `Un widget gratuit pour chacun des ${TEAM_LINKS.length} clubs des grands championnats : prochain match, probabilités de victoire, nul et défaite, derniers résultats. Deux lignes de code, mis à jour tout seul.` : `A free widget for each of the ${TEAM_LINKS.length} clubs of the big leagues: next match, win, draw and loss probabilities, latest results. Two lines of code, updates itself.`;
      const groups: Record<string, any[]> = {};
      for (const t of TEAM_LINKS) (groups[t.lg] ||= []).push(t);
      const list = Object.entries(groups).map(([lg, ts]) => `<h2>${esc(lg)}</h2><p style="line-height:2">${ts.slice().sort((a: any, b: any) => a.name.localeCompare(b.name)).map((t: any) => `<a href="${fr ? t.fr : t.en}#widget" style="white-space:nowrap">${fr ? "Widget " : ""}${esc(t.name)}${fr ? "" : " widget"}</a>`).join(" · ")}</p>`).join("\n");
      const body = `${TCSS}<section style="padding-top:28px"><div class="w"><nav class="crumb" aria-label="breadcrumb"><a href="${SITE}${fr ? "fr/" : ""}">${fr ? "Accueil" : "Home"}</a> / <a href="${SITE}${fr ? "fr/" : ""}widget/">Widget</a> / ${fr ? "Clubs" : "Clubs"}</nav>
<h1>${esc(title)}</h1><div class="tbox"><p style="margin:0">${esc(desc)} ${fr ? "Choisis ton club : sa page donne le code à copier et un aperçu en direct." : "Pick your club: its page gives the code to copy and a live preview."}</p></div>
${list}
</div></section>`;
      const ld = [{ "@context": "https://schema.org", "@type": "CollectionPage", name: title, url, inLanguage: lang, description: desc }];
      await put(`ai-football-predictor/${fr ? "fr/" : ""}widget/clubs/index.html`, page({ lang, url, alt, title, desc, body, ld, type: "website" }), `blog: club widgets ${lang}`);
    }
  }
  const L = (t: string, u: string, d = "") => `- [${t}](${u})${d ? `: ${d}` : ""}`;
  const llms = [
    "# AI Football Predictor",
    "",
    "> Free win, draw and loss probabilities for every football match in 25+ competitions, locked before kickoff and checked against the real result (misses included). Website (English and French) and Telegram Mini App. Statistical estimates for information, not betting advice.",
    "",
    "Key facts: probabilities come from a Poisson model on goals and expected goals (xG), recalculated every day; every match since launch (6 November 2026) is tracked in a public reliability record; season outcomes (title, top, relegation) come from 20,000 simulations of the remaining matches.",
    "",
    "## Main pages",
    L("Home (English)", SITE, "today's matches, the most likely outcomes, live scores"),
    L("Accueil (français)", SITE + "fr/", "version française"),
    L("Method and reliability", SITE + "method/", "how probabilities are computed and how often the most likely outcome happened"),
    L("Blog", SITE + "blog/", "match previews written by the AI, daily AI recap, guides"),
    L("Predicted league tables", SITE + "table/", "title, top and relegation chances"),
    L("Widgets", SITE + "widget/", "free embeddable widgets for other websites"),
    L("Club widgets", SITE + "widget/clubs/", "one ready-made widget per club"),
    L("API", SITE + "api/", "probabilities and match previews as JSON"),
    L("RSS feed", SITE + "feed.xml", "latest match previews"),
    "",
    "## Predicted league tables",
    ...TBL.map(x => L(x[2], tblUrl(false, x[1]))),
    "",
    "## Teams",
    ...TEAM_LINKS.map((t: any) => L(`${t.name} (${t.lg})`, t.en, "season, simulated finish, next matches with probabilities")),
    "",
    "## Players (top scorers)",
    ...PLAYER_LINKS.map((p: any) => L(`${p.name} (${p.team || p.lg})`, p.en, "season stats and chance to score in the next match")),
    "",
    "## Follow",
    L("Telegram channel", "https://t.me/aifootballpredictorchannel"),
    L("Bluesky", "https://bsky.app/profile/did:plc:nxkke6m5abp74xikyikzyuoz"),
    L("Telegram Mini App", "https://t.me/ai_football_predictorbot/app"),
    "",
  ].join("\n");
  await put("ai-football-predictor/llms.txt", llms, "blog: llms.txt");
  // IndexNow (8 nov 2026, SEO): tell Bing/Yandex/Seznam about pages changed in the last 36 h. Key file is at the site root.
  try {
    const key = "5f3c9a2e7b1d4e8fa06c2b9d71e4a3f8";
    const urlList = [SITE, SITE + "fr/", SITE + "blog/", SITE + "fr/blog/", ...TBL.flatMap(x => [tblUrl(false, x[1]), tblUrl(true, x[1])]), ...TEAM_URLS.flat(), ...PLAYER_URLS.flat(), ...all.filter((x: any) => Date.parse(x.updated_at || 0) > Date.now() - 36 * 3600e3).map((x: any) => blogUrl(x))].slice(0, 9000);
    const r = await fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify({ host: "aifootpredictor.com", key, keyLocation: SITE + key + ".txt", urlList }) });
    console.log("indexnow", r.status, urlList.length);
  } catch (e) { console.log("indexnow failed", String(e)); }
}

// ---------- public "Method and reliability" page (7 nov 2026, Jeremy: only our own matches since launch, no "pronos") ----------
async function method() {
  const c = await sb("rpc/afp_calib", { method: "POST", body: "{}" });
  const S = await sb("rpc/afp_scores", { method: "POST", body: "{}" }); // 9 nov 2026 (Jeremy, API buyers): Brier score and log loss vs the market
  const k = c?.picks || {}, n = c?.matches || 0, B = (c?.buckets || []).filter((x: any) => x.n >= 5);
  const p0 = (x: any) => x == null ? "-" : Math.round(Number(x) * 100) + " %";
  for (const lang of ["en", "fr"]) {
    const fr = lang === "fr", slug = fr ? "fr/methode/" : "method/", url = SITE + slug, alt = SITE + (fr ? "method/" : "fr/methode/");
    const sc = (() => { const C = S?.cmp; if (!C || !C.n || C.n < 20) return ""; const f = (x: any) => x == null ? "-" : (fr ? Number(x).toFixed(3).replace(".", ",") : Number(x).toFixed(3)); const d = Number(C.ours.brier) - Number(C.market.brier), dm = Number(C.model.brier) - Number(C.market.brier);
      const vs = (x: number, one = false) => Math.abs(x) < 0.003 ? (fr ? (one ? "fait" : "font") + " jeu égal avec" : (one ? "is" : "are") + " level with") : x < 0 ? (fr ? (one ? "fait" : "font") + " un peu mieux que" : (one ? "does" : "do") + " slightly better than") : (fr ? (one ? "fait" : "font") + " un peu moins bien que" : (one ? "does" : "do") + " slightly worse than");
      const row = (l: string, o: any, strong = false) => `<tr><td>${strong ? `<strong>${l}</strong>` : l}</td><td class="mono">${f(o.brier)}</td><td class="mono">${f(o.logloss)}</td></tr>`;
      return `<h2>${fr ? "Notre précision comparée aux bookmakers" : "Our accuracy against the bookmakers"}</h2>
<p>${fr ? "Deux mesures standard servent à noter des probabilités : le <strong>score de Brier</strong> et la <strong>perte logarithmique</strong> (log loss). Pour les deux, plus c'est bas, mieux c'est. Deviner au hasard (un tiers pour chaque issue) donne 0,667 et 1,099." : "Two standard measures are used to grade probabilities: the <strong>Brier score</strong> and the <strong>log loss</strong>. For both, lower is better. Guessing at random (one third for each outcome) gives 0.667 and 1.099."}</p>
<table><tr><th>${fr ? `Sur les mêmes ${C.n} matchs` : `On the same ${C.n} matches`}</th><th>Brier</th><th>Log loss</th></tr>${row(fr ? "Nos probabilités publiées" : "Our published probabilities", C.ours, true)}${row(fr ? "Notre modèle seul (sans les cotes)" : "Our model alone (without odds)", C.model)}${row(fr ? "Marché des bookmakers (marge retirée)" : "Bookmakers' market (margin removed)", C.market)}${row(fr ? "Hasard" : "Random guess", S.guess)}</table>
<p>${fr ? `Nos probabilités publiées ${vs(d)} le marché des bookmakers, la référence la plus difficile à battre. Notre modèle seul ${vs(dm, true)} le marché : c'est pour ça qu'on mélange les deux. Ces chiffres portent sur les matchs qui ont des cotes ; l'échantillon reste petit et se précise chaque jour.` : `Our published probabilities ${vs(d)} the bookmakers' market, the hardest benchmark to beat. Our model alone ${vs(dm, true)} the market: that is why we blend the two. These figures cover matches with odds; the sample is still small and gets sharper every day.`}</p>
`; })();
    const title = fr ? "Méthode et fiabilité : comment AI Football Predictor calcule ses probabilités" : "Method and reliability: how AI Football Predictor computes its probabilities";
    const desc = fr ? "Comment on calcule la probabilité de chaque match de foot, et la preuve qu'elle est juste : ce qu'on annonçait contre ce qui est arrivé, sur nos matchs depuis le lancement." : "How we compute the probability of every football match, and the proof it is right: what we announced against what happened, on our matches since launch.";
    let b = `<section class="ahero"><div class="w">${crumb(fr, fr ? "Méthode" : "Method")}<div style="margin-top:18px"><span class="tag"><span class="dot"></span>${fr ? "Transparence" : "Transparency"}</span></div><h1>${esc(fr ? "Méthode et fiabilité" : "Method and reliability")}</h1>
<p class="lede">${fr ? "Comment on calcule les probabilités, et ce qu'elles valent vraiment. Tous les chiffres de cette page viennent de nos propres matchs depuis le lancement, mis à jour tous les jours." : "How we compute the probabilities, and what they are really worth. Every figure on this page comes from our own matches since launch, updated every day."}</p>
<div class="chipsm"><span><b>${n}</b> ${fr ? "matchs terminés" : "finished matches"}</span><span><b>${k.n || 0}</b> ${fr ? "matchs à 65 %+" : "matches at 65%+"}</span></div></div></section>`;
    b += `<section style="padding-top:26px"><div class="w"><div class="kv"><div><b>${k.n ? p0(k.won / k.n) : "-"}</b><small>${fr ? "des matchs les plus probables arrivés" : "of the most likely matches happened"}${k.n ? ` (${k.won}/${k.n})` : ""}</small></div><div><b>${k.n ? p0(k.announced) : "-"}</b><small>${fr ? "ce qu'on annonçait en moyenne" : "what we announced on average"}</small></div><div><b>${n}</b><small>${fr ? "matchs vérifiés depuis le lancement" : "matches checked since launch"}</small></div></div></div></section>`;
    b += `<section style="padding-top:20px"><div class="w art prose">
<h2>${fr ? "Comment on calcule" : "How we compute"}</h2>
<p>${fr ? "Pour chaque match, on mélange <strong>deux avis, moitié-moitié</strong> :" : "For each match we mix <strong>two opinions, half and half</strong>:"}</p><ul><li>${fr ? "<strong>Notre propre calcul</strong> : chaque équipe reçoit une note d'attaque et de défense à partir de ses matchs récents (les plus récents comptent plus). On en déduit combien de buts chaque équipe devrait marquer, puis ses chances de gagner, de faire nul ou de perdre." : "<strong>Our own calculation</strong>: each team gets an attack and defence rating from its recent matches (the latest count more). From that we work out how many goals each side should score, then its chances to win, draw or lose."}</li><li>${fr ? "<strong>L'avis des bookmakers</strong> : leurs cotes, dont on retire la marge. Elles tiennent déjà compte des blessés et des compositions." : "<strong>The bookmakers' view</strong>: their odds with the margin removed. They already account for injuries and line-ups."}</li></ul><p>${fr ? "Quand il n'y a pas de cotes, seul notre calcul compte." : "When there are no odds, only our calculation counts."}</p>
<p>${fr ? "Notre calcul donne aussi le nombre de buts attendus, le score le plus probable, la chance de voir plus de 2,5 buts et la forme récente." : "Our calculation also gives the expected number of goals, the most likely score, the chance of more than 2.5 goals and recent form."}</p>
<h2>${fr ? "Les matchs les plus probables" : "The most likely matches"}</h2>
<p>${fr ? "Un match est mis en avant quand une équipe a au moins <strong>65 %</strong> de chances de gagner. Chaque probabilité est verrouillée 3 h avant le coup d'envoi, puis comparée au vrai résultat. Rien n'est supprimé." : "A match is highlighted when a team has at least a <strong>65%</strong> chance to win. Every probability is locked 3 hours before kick-off, then checked against the real result. Nothing is deleted."}</p>
${sc}<h2>${fr ? "Est-ce que nos chiffres sont justes ?" : "Are our numbers right?"}</h2>
<p>${fr ? "Le test est simple : quand on dit 70 %, ça doit arriver environ 7 fois sur 10. Le tableau regroupe tous les cas où on a donné à peu près la même chance, et montre combien de fois c'est vraiment arrivé." : "The test is simple: when we say 70%, it should happen about 7 times out of 10. The table groups every case where we gave roughly the same chance and shows how often it really happened."}</p>
${B.length ? `<table><tr><th>${fr ? "Chance donnée" : "Chance given"}</th><th>${fr ? "Vraiment arrivé" : "Really happened"}</th><th>${fr ? "Nombre de cas" : "Number of cases"}</th></tr>${B.map((x: any) => `<tr><td>${p0(x.pred)}</td><td>${p0(x.real)}</td><td>${x.n}</td></tr>`).join("")}</table>` : `<p>${fr ? "Les premiers chiffres apparaîtront ici dès que assez de matchs seront terminés." : "The first figures will show here as soon as enough matches are finished."}</p>`}
${n < 100 ? `<p>${fr ? "Encore peu de matchs : les chiffres vont se stabiliser au fil des semaines." : "Few matches so far: the figures will settle over the weeks."}</p>` : ""}
<p>${fr ? "Le détail, match par match, est dans l'onglet Fiabilité." : "The match-by-match detail is in the Reliability tab."} <a href="${SITE}${fr ? "fr/" : ""}">${fr ? "Voir la fiabilité" : "See the reliability"}</a></p>
<h2>${fr ? "Pourquoi nous faire confiance ?" : "Why trust us?"}</h2>
<p>${fr ? "On ne prétend pas faire mieux que les bookmakers : ce sont des entreprises avec d'énormes moyens. Ce qu'on garantit, c'est que <strong>chaque chiffre est publié avant le match et n'est jamais modifié ensuite</strong>. Tout le monde peut vérifier, et les résultats restent affichés même quand ils sont mauvais." : "We do not claim to beat the bookmakers: they are companies with huge resources. What we guarantee is that <strong>every number is published before the match and never changed afterwards</strong>. Anyone can check, and the results stay up even when they are bad."}</p>
<h2>${fr ? "Ce qu'on ne promet pas" : "What we do not promise"}</h2>
<ul><li>${fr ? "Une probabilité n'est pas une certitude : même à 80 %, une issue sur cinq ne se produit pas." : "A probability is not a certainty: even at 80%, one outcome in five does not happen."}</li><li>${fr ? "Ce ne sont pas des conseils de pari." : "This is not betting advice."}</li><li>${fr ? "Les chiffres de cette page sont publiés tels quels, même quand ils sont mauvais." : "The figures on this page are published as they are, even when they are bad."}</li></ul>
</div></section>`;
    const ld = [{ "@context": "https://schema.org", "@type": "Article", headline: title, description: desc, dateModified: new Date().toISOString(), inLanguage: lang, author: { "@type": "Organization", name: "AI Football Predictor" }, mainEntityOfPage: url }, crumbLd(fr, fr ? "Méthode" : "Method", url)];
    await put(`ai-football-predictor/${slug}index.html`, page({ lang, url, alt, title, desc, body: b, ld }), `method page ${lang}`);
  }
}

// ---------- 7 nov 2026 (Jeremy, "Fait tout"): one indexable page per league with the likely final table (season simulation)
// and the probabilities of the next matches. EN: table/<slug>/, FR: fr/classement/<slug>/, plus an index page each.
const TBL: [string, string, string][] = [["F1", "ligue-1", "Ligue 1"], ["E0", "premier-league", "Premier League"], ["SP1", "laliga", "LaLiga"], ["I1", "serie-a", "Serie A"], ["D1", "bundesliga", "Bundesliga"], ["P1", "liga-portugal", "Liga Portugal"], ["N1", "eredivisie", "Eredivisie"], ["T1", "super-lig", "Süper Lig"]];
const tblUrl = (fr: boolean, slug = "") => SITE + (fr ? "fr/classement/" : "table/") + (slug ? slug + "/" : "");
const TCSS = `<style>.tt{width:100%;border-collapse:collapse;font-size:14px;margin:14px 0}.tt th{font-size:11px;color:#8b98a9;font-weight:600;text-align:right;padding:6px 5px;border-bottom:1px solid #1d2733}.tt td{padding:8px 5px;border-bottom:1px solid #141c26;text-align:right;font-family:'JetBrains Mono',monospace}.tt td.n,.tt th.n{text-align:left;font-family:Inter,sans-serif}.tt td.n img{width:18px;height:18px;vertical-align:-4px;margin-right:7px}.tt tr.z td{border-bottom:2px solid #3ee0a8}.tt tr.r td{border-bottom:2px solid #ff6b6b}.tt .g{color:#3ee0a8;font-weight:700}.tt .rd{color:#ff6b6b}.tsc{overflow-x:auto}.tbox{background:#0b1118;border:1px solid #1d2733;border-radius:12px;padding:14px 16px;margin:14px 0}.tbox pre{white-space:pre-wrap;word-break:break-all;font-size:12px;color:#cfe;margin:8px 0 0}.tlinks{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.tlinks a{border:1px solid #1d2733;border-radius:8px;padding:7px 11px;font-size:13px;text-decoration:none}</style>`;
const pcT = (x: number) => x >= 0.995 ? "99%" : x < 0.005 ? (x > 0 ? "<1%" : "-") : Math.round(x * 100) + "%";
// ---------- team pages (8 nov 2026, Jeremy: "blinde le SEO", static pages Google can read: one page per team of the 8 big leagues) ----------
// team/<slug>/ (EN) and fr/equipe/<slug>/ (FR): season, simulated finish (title, top, relegation), next matches with our probabilities
// seen from the team, last results and whether our most likely outcome happened. URLs are listed every run (sitemap), pages are
// written only in the morning and "all" runs (about 300 files).
const TEAM_URLS: [string, string][] = [];
const TEAM_LINKS: any[] = [], PLAYER_LINKS: any[] = [];
const teamUrl = (fr: boolean, name: string) => SITE + (fr ? "fr/equipe/" : "team/") + slugify(name) + "/";
const tid = (logo: any) => (String(logo || "").match(/teams\/(\d+)\./) || [])[1] || "";
async function teams(write: boolean) {
  TEAM_URLS.length = 0; TEAM_LINKS.length = 0;
  let nw = 0;
  for (const [code, slug, lname] of TBL) {
    const d = await sb("rpc/afp_widget_table", { method: "POST", body: JSON.stringify({ lg: code }) });
    if (!d?.teams?.length) continue;
    const since = new Date(Date.now() - 150 * 86400000).toISOString(), until = new Date(Date.now() + 30 * 86400000).toISOString();
    const P = (await sb(`afp_predictions?league=eq.${code}&kickoff=gt.${since}&kickoff=lt.${until}&order=kickoff.asc&limit=2000&select=n,home,away,home_logo,away_logo,kickoff,ph,pd,pa,hg,ag,status,pick,selected`)) || [];
    const ts = d.teams.slice().sort((a: any, b: any) => b.xpts - a.xpts || a.pos - b.pos), N = ts.length;
    const byPts = d.teams.slice().sort((a: any, b: any) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
    for (let i = 0; i < N; i++) {
      const t = ts[i], id = String(t.id), name = t.name;
      const en = teamUrl(false, name), frU = teamUrl(true, name);
      TEAM_URLS.push([en, frU]); TEAM_LINKS.push({ lg: lname, name, en, fr: frU });
      if (!write) continue;
      const ms = P.filter((p: any) => tid(p.home_logo) === id || tid(p.away_logo) === id);
      const pn = (ms.find((p: any) => tid(p.home_logo) === id) || {}).home || (ms.find((p: any) => tid(p.away_logo) === id) || {}).away || name;
      const next = ms.filter((p: any) => Date.parse(p.kickoff) > Date.now() && p.ph != null).slice(0, 5);
      const last = ms.filter((p: any) => p.hg != null && p.ag != null).slice(-6).reverse();
      const rank = byPts.findIndex((x: any) => String(x.id) === id) + 1;
      const ours = ms.filter((p: any) => p.status === "won" || p.status === "lost"), oursW = ours.filter((p: any) => p.status === "won").length;
      for (const lang of ["en", "fr"]) {
        const fr = lang === "fr", url = fr ? frU : en, alt = fr ? en : frU, pc = (x: any) => Math.round(Number(x) * 100) + (fr ? " %" : "%");
        const ss = `${d.season}/${String(d.season + 1).slice(2)}`;
        const title = fr ? `${name} : probabilités, classement probable et prochains matchs (${lname} ${ss})` : `${name}: win probabilities, predicted finish and next matches (${lname} ${ss})`;
        const brief = fr
          ? `${name} est ${rank === 1 ? "1er" : rank + "e"} de ${lname} avec ${t.pts} points après ${t.pl} matchs (${t.w} victoire${t.w > 1 ? "s" : ""}, ${t.d} nul${t.d > 1 ? "s" : ""}, ${t.l} défaite${t.l > 1 ? "s" : ""}, ${t.gf} buts marqués, ${t.ga} encaissés). D'après ${Number(d.sims).toLocaleString("fr-FR")} simulations de la fin de saison, le club finirait avec ${t.xpts} points : ${pcT(t.title)} de chances de titre, ${pcT(t.top)} de finir dans le top ${d.top} et ${t.rel < 0.005 ? "un risque de relégation quasi nul" : pcT(t.rel) + " de risque de relégation"}.`
          : `${name} are ${rank}${rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th"} in the ${lname} with ${t.pts} points from ${t.pl} matches (${t.w} wins, ${t.d} draws, ${t.l} losses, ${t.gf} goals scored, ${t.ga} conceded). Based on ${Number(d.sims).toLocaleString("en-GB")} simulations of the rest of the season, the club would finish on ${t.xpts} points: a ${pcT(t.title)} chance of the title, ${pcT(t.top)} of a top ${d.top} finish and ${t.rel < 0.005 ? "practically no relegation risk" : "a " + pcT(t.rel) + " relegation risk"}.`;
        const desc = brief.length > 158 ? brief.slice(0, 155).replace(/\s+\S*$/, "") + "…" : brief;
        const day = (s: string) => new Intl.DateTimeFormat(fr ? "fr-FR" : "en-GB", { timeZone: "Europe/Paris", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(s));
        const nrows = next.map((p: any) => {
          const hm = tid(p.home_logo) === id, w = Number(hm ? p.ph : p.pa), dr = Number(p.pd), l = Number(hm ? p.pa : p.ph), mx = Math.max(w, dr, l);
          const c = (x: number) => `<td class="${x === mx ? "g" : ""}">${pc(x)}</td>`;
          return `<tr><td class="n" style="font-family:'JetBrains Mono',monospace;font-size:12px;white-space:nowrap">${day(p.kickoff)}</td><td class="n"><a href="${SITE}${fr ? "fr/" : ""}?tab=m${p.n}" style="color:inherit">${hm ? (fr ? "contre " : "vs ") + esc(p.away) + (fr ? " (dom.)" : " (home)") : (fr ? "chez " : "at ") + esc(p.home)}</a></td>${c(w)}${c(dr)}${c(l)}</tr>`;
        }).join("");
        const lrows = last.map((p: any) => {
          const hm = tid(p.home_logo) === id, me = hm ? p.hg : p.ag, op = hm ? p.ag : p.hg, r = me > op ? (fr ? "V" : "W") : me === op ? (fr ? "N" : "D") : (fr ? "D" : "L");
          const okc = p.status === "won" ? `<td class="g">✓</td>` : p.status === "lost" ? `<td class="rd">✗</td>` : `<td>-</td>`;
          return `<tr><td class="n" style="font-family:'JetBrains Mono',monospace;font-size:12px;white-space:nowrap">${new Date(p.kickoff).toLocaleDateString(fr ? "fr-FR" : "en-GB", { day: "2-digit", month: "2-digit", timeZone: "Europe/Paris" })}</td><td class="n">${esc(p.home)} <b>${p.hg}-${p.ag}</b> ${esc(p.away)}</td><td><b>${r}</b></td>${okc}</tr>`;
        }).join("");
        const others = ts.filter((x: any) => x !== t).slice(0, 40).map((x: any) => `<a href="${teamUrl(fr, x.name)}" style="color:#8b98a9;white-space:nowrap">${esc(x.name)}</a>`).join(" · ");
        const body = `${TCSS}<section style="padding-top:28px"><div class="w"><nav class="crumb" aria-label="breadcrumb"><a href="${SITE}${fr ? "fr/" : ""}">${fr ? "Accueil" : "Home"}</a> / <a href="${tblUrl(fr, slug)}">${esc(lname)}</a> / ${esc(name)}</nav>
<div style="display:flex;align-items:center;gap:14px;margin-top:14px">${t.logo ? `<img src="${esc(t.logo)}" alt="${esc(name)}" width="56" height="56" style="width:56px;height:56px;object-fit:contain">` : ""}<h1 style="margin:0">${esc(title)}</h1></div>
<div class="tbox"><b>${fr ? "En bref" : "In short"}</b><p style="margin:6px 0 0">${esc(brief)}</p></div>
<div class="tsc"><table class="tt"><thead><tr><th class="n">${fr ? "Saison" : "Season"}</th><th>${fr ? "Rang" : "Pos"}</th><th>Pts</th><th>${fr ? "Fin" : "End"}</th><th>${fr ? "Titre" : "Title"}</th><th>Top ${d.top}</th><th>${fr ? "Relég." : "Releg."}</th></tr></thead><tbody><tr><td class="n">${esc(lname)} ${ss}</td><td>${rank}</td><td>${t.pts}</td><td><b>${t.xpts}</b></td><td class="${t.title >= 0.5 ? "g" : ""}">${pcT(t.title)}</td><td>${pcT(t.top)}</td><td class="${t.rel >= 0.5 ? "rd" : ""}">${pcT(t.rel)}</td></tr></tbody></table></div>
${nrows ? `<h2>${fr ? `Prochains matchs de ${esc(name)} : nos probabilités` : `${esc(name)} next matches: our probabilities`}</h2><div class="tsc"><table class="tt"><thead><tr><th class="n">Date</th><th class="n">Match</th><th>${fr ? "Victoire" : "Win"}</th><th>${fr ? "Nul" : "Draw"}</th><th>${fr ? "Défaite" : "Loss"}</th></tr></thead><tbody>${nrows}</tbody></table></div>` : ""}
${lrows ? `<h2>${fr ? `Derniers résultats de ${esc(name)}` : `${esc(name)} latest results`}</h2><div class="tsc"><table class="tt"><thead><tr><th class="n">Date</th><th class="n">Match</th><th>${fr ? "Rés." : "Res."}</th><th>${fr ? "Notre plus probable" : "Our most likely"}</th></tr></thead><tbody>${lrows}</tbody></table></div>${ours.length >= 3 ? `<p style="font-size:13px;color:#8b98a9">${fr ? `Sur les matchs de ${esc(name)} suivis par l'IA, l'issue la plus probable est arrivée ${oursW} fois sur ${ours.length}.` : `On the ${esc(name)} matches tracked by the AI, the most likely outcome happened ${oursW} times out of ${ours.length}.`}</p>` : ""}` : ""}
<p style="font-size:13px;color:#8b98a9">${fr ? `Probabilités calculées à partir des buts et des expected goals (xG) de la saison, mises à jour chaque jour. Ce sont des probabilités, pas des certitudes. Mis à jour le ${new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}.` : `Probabilities computed from the season's goals and expected goals (xG), updated every day. These are probabilities, not certainties. Updated ${new Date().toLocaleDateString("en-GB", { timeZone: "Europe/London" })}.`}</p>
<p><a class="btn" href="${tblUrl(fr, slug)}">${fr ? `Classement probable complet de ${esc(lname)}` : `Full ${esc(lname)} predicted table`}</a> <a class="btn o" href="${SITE}${fr ? "fr/" : ""}?app=1">${fr ? "Tous les matchs sur le site" : "Every match on the website"}</a></p>
<div class="tbox" id="widget" style="margin-top:26px"><b>${fr ? `📋 Le widget ${esc(name)} pour ton site` : `📋 The ${esc(name)} widget for your website`}</b><p style="margin:6px 0 0;font-size:14px">${fr ? `Gratuit, sans inscription : le prochain match de ${esc(name)} avec ses probabilités et les derniers résultats, mis à jour tout seul. Copie ces deux lignes sur ton site (WordPress, Wix, Blogger…).` : `Free, no sign-up: ${esc(name)}'s next match with its probabilities and the latest results, updated automatically. Copy these two lines into your site (WordPress, Wix, Blogger…).`}</p><pre style="white-space:pre-wrap;word-break:break-all;font:12px/1.5 'JetBrains Mono',monospace;background:#06090e;border:1px solid #1d2733;padding:10px;margin:8px 0;color:#cfd8e4">${esc(`<div class="afp-widget" data-type="team" data-team="${pn}" data-lang="${lang}"><a href="${url}">${fr ? `Probabilités ${name} par AI Football Predictor` : `${name} probabilities by AI Football Predictor`}</a></div>\n<script src="${SITE}embed.js" async></script>`)}</pre><button class="btn sm" type="button" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent).then(()=>{this.textContent='✓'})">${fr ? "Copier le code" : "Copy the code"}</button><div style="margin-top:14px"><div class="afp-widget" data-type="team" data-team="${esc(pn)}" data-lang="${lang}"><a href="${url}">${fr ? `Probabilités ${esc(name)} par AI Football Predictor` : `${esc(name)} probabilities by AI Football Predictor`}</a></div><script src="${SITE}embed.js" async></script></div><p style="margin:10px 0 0;font-size:13px"><a href="${SITE}${fr ? "fr/" : ""}widget/clubs/">${fr ? "Les widgets de tous les clubs" : "Widgets for every club"}</a></p></div>
${PLAYER_LINKS.some((x: any) => x.team === name) ? `<h2 style="font-size:16px">${fr ? `Les buteurs de ${esc(name)}` : `${esc(name)} scorers`}</h2><p style="font-size:14px;line-height:1.9">${PLAYER_LINKS.filter((x: any) => x.team === name).map((x: any) => `<a href="${fr ? x.fr : x.en}">${esc(x.name)}</a>`).join(" · ")}</p>` : ""}
<h2 style="font-size:16px">${fr ? `Les autres équipes de ${esc(lname)}` : `Other ${esc(lname)} teams`}</h2><p style="font-size:13px;line-height:1.9">${others}</p>
</div></section>`;
        const ld = [
          { "@context": "https://schema.org", "@type": "SportsTeam", name, sport: "Football", url, ...(t.logo ? { logo: t.logo } : {}), memberOf: { "@type": "SportsOrganization", name: lname } },
          { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: fr ? "Accueil" : "Home", item: SITE + (fr ? "fr/" : "") }, { "@type": "ListItem", position: 2, name: lname, item: tblUrl(fr, slug) }, { "@type": "ListItem", position: 3, name, item: url }] },
        ];
        await put(`ai-football-predictor/${fr ? "fr/equipe" : "team"}/${slugify(name)}/index.html`, page({ lang, url, alt, title, desc, body, ld, type: "website" }), `blog: team ${lang} ${name}`);
        nw++;
      }
    }
  }
  console.log("team pages", TEAM_URLS.length, "written", nw);
}
// ---------- player pages (8 nov 2026, Jeremy: "des fiches joueurs") ----------
// The 10 top scorers of each of the 8 big leagues: player/<slug>/ (EN) and fr/joueur/<slug>/ (FR). Data from the app API (api_ts,
// /api/league and /api/player, cached 6 h in afp_tdata): season stats and our chance he scores in his team's next match.
const PLAYER_URLS: [string, string][] = [];
const playerUrl = (fr: boolean, s: string) => SITE + (fr ? "fr/joueur/" : "player/") + s + "/";
async function xapiGet(path: string) {
  try { const r = await fetch(`https://afp-blog-production.up.railway.app${path}`, { headers: { "x-web": "1" }, signal: AbortSignal.timeout(30000) }); return r.ok ? await r.json() : null; } catch { return null; }
}
async function players(write: boolean) {
  PLAYER_URLS.length = 0; PLAYER_LINKS.length = 0;
  let nw = 0;
  for (const [code, slug, lname] of TBL) {
    const n = (await sb(`afp_predictions?league=eq.${code}&af_id=not.is.null&order=kickoff.desc&limit=1&select=n`))?.[0]?.n;
    if (!n) continue;
    const L: any = await xapiGet(`/api/league?n=${n}`);
    const sc = (L?.scorers || []).filter((s: any) => s.id).slice(0, 10);
    for (const s of sc) {
      const P: any = await xapiGet(`/api/player?n=${n}&id=${s.id}`);
      if (!P?.ok) continue;
      // usual name for titles and URLs: first first name + last name ("Amine Gouiri", not "Amine Ferid Gouiri" or "A. Gouiri")
      const full = [String(P.first || "").split(" ")[0], P.last].filter(Boolean).join(" ").trim() || P.name;
      const ps = slugify(full);
      const en = playerUrl(false, ps), frU = playerUrl(true, ps);
      PLAYER_URLS.push([en, frU]); PLAYER_LINKS.push({ lg: lname, name: P.name, team: (P.main || {}).team, en, fr: frU });
      if (!write) continue;
      const m = P.main || {}, nx = P.next;
      const rank = sc.indexOf(s) + 1;
      for (const lang of ["en", "fr"]) {
        const fr = lang === "fr", url = fr ? frU : en, alt = fr ? en : frU, pc = (x: any) => Math.round(Number(x) * 100) + (fr ? " %" : "%");
        const opp = nx ? (nx.atHome ? nx.away : nx.home) : "";
        const title = fr
          ? `${full} : statistiques ${lname}${nx && nx.prob != null ? ` et chances de marquer contre ${opp}` : ""} (${m.team || ""})`
          : `${full}: ${lname} stats${nx && nx.prob != null ? ` and chance to score vs ${opp}` : ""} (${m.team || ""})`;
        const brief = fr
          ? `${full} (${m.team || ""}, ${m.pos === "Attacker" ? "attaquant" : m.pos === "Midfielder" ? "milieu" : m.pos === "Defender" ? "défenseur" : (m.pos || "joueur").toLowerCase()}${P.age ? `, ${P.age} ans` : ""}) est ${rank === 1 ? "le meilleur buteur" : `le ${rank}e meilleur buteur`} de ${lname} avec ${m.g} but${m.g > 1 ? "s" : ""} et ${m.a} passe${m.a > 1 ? "s" : ""} décisive${m.a > 1 ? "s" : ""} en ${m.app} matchs (${m.min} minutes).${nx && nx.prob != null ? ` Pour son prochain match, ${nx.atHome ? "contre" : "chez"} ${opp}, notre IA estime ses chances de marquer à ${pc(nx.prob)}.` : ""}`
          : `${full} (${m.team || ""}, ${(m.pos || "player").toLowerCase()}${P.age ? `, ${P.age}` : ""}) is ${rank === 1 ? "the top scorer" : `number ${rank} in the scoring chart`} in the ${lname} with ${m.g} goal${m.g === 1 ? "" : "s"} and ${m.a} assist${m.a === 1 ? "" : "s"} in ${m.app} matches (${m.min} minutes).${nx && nx.prob != null ? ` For his next match, ${nx.atHome ? "against" : "at"} ${opp}, our AI puts his chance to score at ${pc(nx.prob)}.` : ""}`;
        const desc = brief.length > 158 ? brief.slice(0, 155).replace(/\s+\S*$/, "") + "…" : brief;
        const day = (t: string) => new Intl.DateTimeFormat(fr ? "fr-FR" : "en-GB", { timeZone: "Europe/Paris", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(t));
        const v = (x: any) => (x == null ? "-" : x);
        const kv = `<div class="tsc"><table class="tt"><thead><tr><th class="n">${fr ? "Saison" : "Season"}</th><th>${fr ? "Matchs" : "Apps"}</th><th>Min</th><th>${fr ? "Buts" : "Goals"}</th><th>${fr ? "Passes" : "Assists"}</th><th>${fr ? "Tirs (cadrés)" : "Shots (on)"}</th><th>${fr ? "Note" : "Rating"}</th></tr></thead><tbody>${(P.stats || []).map((x: any) => `<tr><td class="n">${x.llogo ? `<img src="${esc(x.llogo)}" alt="" loading="lazy">` : ""}${esc(x.lg || "")}</td><td>${x.app}</td><td>${x.min}</td><td><b>${x.g}</b></td><td>${x.a}</td><td>${v(x.shots)} (${v(x.sot)})</td><td>${v(x.rating)}</td></tr>`).join("")}</tbody></table></div>`;
        const nxB = nx ? `<h2>${fr ? `Prochain match : ${nx.atHome ? "contre" : "chez"} ${esc(opp)}` : `Next match: ${nx.atHome ? "vs" : "at"} ${esc(opp)}`}</h2><div class="tbox"><b>${esc(nx.home)} - ${esc(nx.away)}</b> · ${day(nx.ko)}${nx.prob != null ? `<p style="margin:8px 0 0;font-size:18px">${fr ? "Chances qu'il marque" : "Chance he scores"} : <b style="color:#3ee0a8">${pc(nx.prob)}</b></p><p style="margin:6px 0 0;font-size:13px;color:#8b98a9">${fr ? `Calculé avec les buts attendus de ${esc(m.team || "son équipe")} dans ce match (${String(nx.xg).replace(".", ",")}) et sa part des buts de l'équipe cette saison (${pc(nx.share)}). Une probabilité, pas une certitude.` : `Based on ${esc(m.team || "his team")}'s expected goals in this match (${nx.xg}) and his share of the team's goals this season (${pc(nx.share)}). A probability, not a certainty.`}</p>` : ""}<p style="margin:10px 0 0"><a class="btn sm" href="${SITE}${fr ? "fr/" : ""}?tab=m${nx.n}">${fr ? "Toutes les probabilités du match" : "All match probabilities"}</a></p></div>` : "";
        const others = sc.filter((x: any) => x !== s).map((x: any) => `<span style="white-space:nowrap">${esc(x.n)} (${x.g})</span>`).join(" · ");
        const body = `${TCSS}<section style="padding-top:28px"><div class="w"><nav class="crumb" aria-label="breadcrumb"><a href="${SITE}${fr ? "fr/" : ""}">${fr ? "Accueil" : "Home"}</a> / <a href="${tblUrl(fr, slug)}">${esc(lname)}</a> / ${m.team ? `<a href="${teamUrl(fr, m.team)}">${esc(m.team)}</a> / ` : ""}${esc(P.name)}</nav>
<div style="display:flex;align-items:center;gap:14px;margin-top:14px">${P.photo ? `<img src="${esc(P.photo)}" alt="${esc(full)}" width="64" height="64" style="width:64px;height:64px;border-radius:50%;object-fit:cover">` : ""}<h1 style="margin:0">${esc(title)}</h1></div>
<div class="tbox"><b>${fr ? "En bref" : "In short"}</b><p style="margin:6px 0 0">${esc(brief)}</p></div>
${nxB}
<h2>${fr ? `Statistiques de ${esc(P.name)} cette saison` : `${esc(P.name)} stats this season`}</h2>${kv}
<p style="font-size:13px;color:#8b98a9">${fr ? `Mis à jour le ${new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}.` : `Updated ${new Date().toLocaleDateString("en-GB", { timeZone: "Europe/London" })}.`}</p>
<p>${m.team ? `<a class="btn" href="${teamUrl(fr, m.team)}">${fr ? `Fiche ${esc(m.team)}` : `${esc(m.team)} page`}</a> ` : ""}<a class="btn o" href="${tblUrl(fr, slug)}">${fr ? `Classement probable de ${esc(lname)}` : `${esc(lname)} predicted table`}</a></p>
<h2 style="font-size:16px">${fr ? `Les autres meilleurs buteurs de ${esc(lname)}` : `Other ${esc(lname)} top scorers`}</h2><p style="font-size:13px;line-height:1.9;color:#8b98a9">${others}</p>
</div></section>`;
        const ld = [
          { "@context": "https://schema.org", "@type": "Person", name: full, url, ...(P.photo ? { image: P.photo } : {}), ...(P.nat ? { nationality: P.nat } : {}), jobTitle: "Footballer", ...(m.team ? { memberOf: { "@type": "SportsTeam", name: m.team, url: teamUrl(fr, m.team) } } : {}) },
          { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: fr ? "Accueil" : "Home", item: SITE + (fr ? "fr/" : "") }, { "@type": "ListItem", position: 2, name: lname, item: tblUrl(fr, slug) }, { "@type": "ListItem", position: 3, name: P.name, item: url }] },
        ];
        await put(`ai-football-predictor/${fr ? "fr/joueur" : "player"}/${ps}/index.html`, page({ lang, url, alt, title, desc, body, ld, type: "profile" }), `blog: player ${lang} ${P.name}`);
        nw++;
      }
    }
  }
  console.log("player pages", PLAYER_URLS.length, "written", nw);
}
async function tables() {
  const all: any[] = [];
  for (const [code, slug, name] of TBL) {
    const d = await sb("rpc/afp_widget_table", { method: "POST", body: JSON.stringify({ lg: code }) });
    if (!d?.teams?.length) continue;
    const nx = (await sb(`afp_predictions?league=eq.${code}&kickoff=gt.${new Date().toISOString()}&kickoff=lt.${new Date(Date.now() + 8 * 86400000).toISOString()}&ph=not.is.null&order=kickoff.asc&limit=12&select=home,away,kickoff,ph,pd,pa,selected`)) || [];
    all.push({ code, slug, name, d });
    const ts = d.teams.slice().sort((a: any, b: any) => b.xpts - a.xpts || a.pos - b.pos), N = ts.length;
    const fav = ts.slice().sort((a: any, b: any) => b.title - a.title)[0], rel = ts.slice().sort((a: any, b: any) => b.rel - a.rel).slice(0, d.rel);
    for (const lang of ["en", "fr"]) {
      const fr = lang === "fr", url = tblUrl(fr, slug), alt = tblUrl(!fr, slug);
      const title = fr ? `Classement probable ${name} ${d.season}/${String(d.season + 1).slice(2)} : chances de titre et de relégation` : `${name} ${d.season}/${String(d.season + 1).slice(2)} predicted table: title and relegation chances`;
      const brief = fr
        ? `Selon ${d.sims.toLocaleString("fr-FR")} simulations de la fin de saison par AI Football Predictor, ${fav.name} a ${pcT(fav.title)} de chances d'être champion de ${name} (${fav.xpts} points attendus). Les clubs les plus menacés de relégation sont ${rel.map((t: any) => `${t.name} (${pcT(t.rel)})`).join(", ")}. Il reste ${d.left} matchs à jouer.`
        : `According to ${d.sims.toLocaleString("en-GB")} simulations of the rest of the season by AI Football Predictor, ${fav.name} have a ${pcT(fav.title)} chance of winning the ${name} (${fav.xpts} expected points). The clubs most at risk of relegation are ${rel.map((t: any) => `${t.name} (${pcT(t.rel)})`).join(", ")}. ${d.left} matches are left to play.`;
      const desc = brief.length > 158 ? brief.slice(0, 155).replace(/\s+\S*$/, "") + "…" : brief;
      const day = (s: string) => new Intl.DateTimeFormat(fr ? "fr-FR" : "en-GB", { timeZone: fr ? "Europe/Paris" : "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(s));
      const rows = ts.map((t: any, i: number) => `<tr class="${i === d.top - 1 ? "z" : i === N - d.rel - 1 ? "r" : ""}"><td>${i + 1}</td><td class="n"><img src="${esc(t.logo || "")}" alt="" loading="lazy"><a href="${teamUrl(fr, t.name)}" style="color:inherit">${esc(t.name)}</a></td><td>${t.pts}</td><td><b>${t.xpts}</b></td><td class="${t.title >= 0.5 ? "g" : ""}">${pcT(t.title)}</td><td>${pcT(t.top)}</td><td class="${t.rel >= 0.5 ? "rd" : ""}">${pcT(t.rel)}</td></tr>`).join("");
      const mrows = nx.map((m: any) => { const top = Math.max(m.ph, m.pd, m.pa); const c = (x: number) => `<td class="${x === top ? "g" : ""}">${Math.round(x * 100)}%</td>`; return `<tr><td class="n" style="font-family:'JetBrains Mono',monospace;font-size:12px;white-space:nowrap">${day(m.kickoff)}</td><td class="n">${esc(m.home)} - ${esc(m.away)}</td>${c(m.ph)}${c(m.pd)}${c(m.pa)}</tr>`; }).join("");
      const snippet = `<div class="afp-widget" data-type="table" data-lg="${code}" data-lang="${lang}"><a href="${SITE}${fr ? "fr/" : ""}">${fr ? "Probabilités foot par AI Football Predictor" : "Football probabilities by AI Football Predictor"}</a></div>\n<script src="${SITE}embed.js" async></script>`;
      const faq = fr
        ? [[`Qui va être champion de ${name} ?`, `D'après nos ${d.sims.toLocaleString("fr-FR")} simulations, ${fav.name} est favori avec ${pcT(fav.title)} de chances de titre. Ce n'est pas une certitude : c'est la part des saisons simulées où ça arrive.`], ["Comment est calculé ce classement probable ?", `On estime la force offensive et défensive de chaque équipe à partir des buts et des expected goals (xG) de la saison, puis on joue ${d.sims.toLocaleString("fr-FR")} fois les ${d.left} matchs restants. Mis à jour chaque nuit.`]]
        : [[`Who will win the ${name}?`, `Based on our ${d.sims.toLocaleString("en-GB")} simulations, ${fav.name} are favourites with a ${pcT(fav.title)} chance of the title. It is not a certainty: it is the share of simulated seasons where it happens.`], ["How is this predicted table computed?", `We estimate each team's attacking and defensive strength from the season's goals and expected goals (xG), then play the ${d.left} remaining matches ${d.sims.toLocaleString("en-GB")} times. Updated every night.`]];
      const body = `${TCSS}<section style="padding-top:28px"><div class="w"><nav class="crumb" aria-label="breadcrumb"><a href="${SITE}${fr ? "fr/" : ""}">${fr ? "Accueil" : "Home"}</a> / <a href="${tblUrl(fr)}">${fr ? "Classements probables" : "Predicted tables"}</a> / ${esc(name)}</nav>
<h1>${esc(title)}</h1><div class="tbox"><b>${fr ? "En bref" : "In short"}</b><p style="margin:6px 0 0">${esc(brief)}</p></div>
<div class="tsc"><table class="tt"><thead><tr><th class="n">#</th><th class="n">${fr ? "Équipe" : "Team"}</th><th>Pts</th><th>${fr ? "Fin" : "End"}</th><th>${fr ? "Titre" : "Title"}</th><th>Top ${d.top}</th><th>${fr ? "Relég." : "Releg."}</th></tr></thead><tbody>${rows}</tbody></table></div>
<p style="font-size:13px;color:#8b98a9">${fr ? `Fin = points attendus en fin de saison. Pourcentages = part des ${d.sims.toLocaleString("fr-FR")} saisons simulées où ça arrive. Mis à jour le ${new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}.` : `End = expected points at the end of the season. Percentages = share of the ${d.sims.toLocaleString("en-GB")} simulated seasons where it happens. Updated ${new Date().toLocaleDateString("en-GB", { timeZone: "Europe/London" })}.`}</p>
${mrows ? `<h2>${fr ? `Prochains matchs de ${esc(name)} : probabilités` : `Next ${esc(name)} matches: probabilities`}</h2><div class="tsc"><table class="tt"><thead><tr><th class="n">${fr ? "Date" : "Date"}</th><th class="n">Match</th><th>1</th><th>${fr ? "N" : "X"}</th><th>2</th></tr></thead><tbody>${mrows}</tbody></table></div><p style="font-size:13px;color:#8b98a9">${fr ? "1 = victoire à domicile, N = nul, 2 = victoire à l'extérieur. Des probabilités, pas des certitudes." : "1 = home win, X = draw, 2 = away win. Probabilities, not certainties."}</p>` : ""}
<h2>${fr ? "Mettre ce classement sur votre site" : "Put this table on your website"}</h2><div class="tbox">${fr ? "Gratuit, mis à jour automatiquement. Copiez ce code :" : "Free, updated automatically. Copy this code:"}<pre>${esc(snippet)}</pre><a href="${SITE}${fr ? "fr/" : ""}widget/">${fr ? "Tous les widgets" : "All widgets"}</a></div>
<h2>${fr ? "Questions fréquentes" : "FAQ"}</h2>${faq.map(([q, a]) => `<h3 style="font-size:16px;margin:14px 0 4px">${esc(q)}</h3><p style="margin:0">${esc(a)}</p>`).join("")}
<div class="tlinks">${TBL.filter(x => x[1] !== slug).map(x => `<a href="${tblUrl(fr, x[1])}">${esc(x[2])}</a>`).join("")}</div>
</div></section>`;
      const ld = [
        { "@context": "https://schema.org", "@type": "WebPage", name: title, description: desc, url, inLanguage: lang, dateModified: new Date().toISOString(), isPartOf: { "@type": "WebSite", name: "AI Football Predictor", url: SITE } },
        { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: fr ? "Accueil" : "Home", item: SITE + (fr ? "fr/" : "") }, { "@type": "ListItem", position: 2, name: fr ? "Classements probables" : "Predicted tables", item: tblUrl(fr) }, { "@type": "ListItem", position: 3, name, item: url }] },
        { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
      ];
      await put(`ai-football-predictor/${fr ? "fr/classement/" : "table/"}${slug}/index.html`, page({ lang, url, alt, title, desc, body, ld, type: "website" }), `tables: ${slug} ${lang}`);
    }
  }
  for (const lang of ["en", "fr"]) {
    const fr = lang === "fr", url = tblUrl(fr), alt = tblUrl(!fr);
    const title = fr ? "Classements probables de fin de saison : Ligue 1, Premier League, LaLiga, Serie A, Bundesliga" : "Predicted final tables: Premier League, LaLiga, Serie A, Bundesliga, Ligue 1";
    const desc = fr ? "Chances de titre, de top 4 et de relégation pour 8 championnats, calculées chaque nuit en simulant 20 000 fois la fin de saison." : "Title, top 4 and relegation chances for 8 leagues, computed every night by simulating the rest of the season 20,000 times.";
    const body = `${TCSS}<section style="padding-top:28px"><div class="w"><h1>${esc(title)}</h1><p class="lead">${esc(desc)}</p>${all.map(x => { const f = x.d.teams.slice().sort((a: any, b: any) => b.title - a.title)[0]; return `<div class="tbox"><a href="${tblUrl(fr, x.slug)}"><b>${esc(x.name)}</b></a><p style="margin:6px 0 0">${fr ? `Favori : ${esc(f.name)} (${pcT(f.title)} de chances de titre)` : `Favourite: ${esc(f.name)} (${pcT(f.title)} title chance)`}</p></div>`; }).join("")}</div></section>`;
    const ld = [{ "@context": "https://schema.org", "@type": "CollectionPage", name: title, description: desc, url, inLanguage: lang, hasPart: all.map(x => ({ "@type": "WebPage", name: x.name, url: tblUrl(fr, x.slug) })) }];
    if (all.length) await put(`ai-football-predictor/${fr ? "fr/classement/" : "table/"}index.html`, page({ lang, url, alt, title, desc, body, ld, type: "website" }), `tables: index ${lang}`);
  }
}

// ---------- 7 nov 2026 (Jeremy, "pour chaque widget il faut avoir un SEO de fou"): one indexable landing page per widget type,
// EN + FR, rebuilt at every blog run with a fresh real example (biggest upcoming match, its team, league leader, reliability).
const WP: any[] = [
  { t: "match", en: "match", fr: "match", ic: "🎯",
    kw: { en: "football match prediction widget", fr: "widget probabilités match de foot" },
    title: { en: "Free football match prediction widget for your website (probabilities, xG)", fr: "Widget foot gratuit : probabilités d'un match pour votre site (victoire, nul, xG)" },
    what: { en: "a single match: win, draw and loss probabilities, expected goals, most likely score and the chance of more than 2.5 goals, updated until kickoff and then with the result", fr: "un seul match : probabilités de victoire, de nul et de défaite, buts attendus, score le plus probable et chance de plus de 2,5 buts, mis à jour jusqu'au coup d'envoi puis avec le résultat" },
    uses: { en: ["Match preview articles", "Derby and big-game pages", "Club fan blogs before kickoff", "Football newsletters"], fr: ["Articles d'avant-match", "Pages de derby et de gros matchs", "Blogs de supporters avant le coup d'envoi", "Newsletters foot"] } },
  { t: "team", en: "team", fr: "equipe", ic: "🛡️",
    kw: { en: "football team widget", fr: "widget équipe de foot" },
    title: { en: "Free football team widget: next match probabilities, form and results", fr: "Widget équipe de foot gratuit : prochain match, forme et probabilités" },
    what: { en: "one club: its next match with the win, draw and loss probabilities, its last five results and its current form, always up to date", fr: "un club : son prochain match avec les probabilités de victoire, de nul et de défaite, ses cinq derniers résultats et sa forme, toujours à jour" },
    uses: { en: ["Fan sites of one club", "Supporters' club pages", "Local news about a team", "Player or coach blogs"], fr: ["Sites de supporters d'un club", "Pages de clubs de supporters", "Presse locale sur une équipe", "Blogs de joueurs ou d'entraîneurs"] } },
  { t: "table", en: "table", fr: "classement", ic: "🏆",
    kw: { en: "football league table widget", fr: "widget classement foot" },
    title: { en: "Free football league table widget: predicted final standings, title and relegation chances", fr: "Widget classement foot gratuit : classement probable, chances de titre et de relégation" },
    what: { en: "the predicted final table of a league, from 20,000 simulations of the rest of the season: expected points, chances of title, top 4 and relegation, for up to 3 leagues", fr: "le classement probable de fin de saison d'un championnat, issu de 20 000 simulations de la fin de saison : points attendus, chances de titre, de top 4 et de relégation, jusqu'à 3 championnats" },
    uses: { en: ["League news sites", "Title race and relegation articles", "Fantasy football communities", "Forums and season previews"], fr: ["Sites d'actu d'un championnat", "Articles sur la course au titre ou au maintien", "Communautés de fantasy foot", "Forums et présentations de saison"] } },
  { t: "badge", en: "badge", fr: "badge", ic: "✅",
    kw: { en: "football prediction accuracy badge", fr: "badge fiabilité probabilités foot" },
    title: { en: "Football prediction accuracy badge: show how reliable AI probabilities are", fr: "Badge de fiabilité foot : montrez si les probabilités de l'IA sont justes" },
    what: { en: "a small badge with our public track record: the share of most likely outcomes that happened compared with what we announced, over every finished match since launch", fr: "un petit badge avec notre historique public : la part des issues les plus probables qui sont arrivées comparée à ce qu'on annonçait, sur tous les matchs terminés depuis le lancement" },
    uses: { en: ["Sidebars and footers", "Pages that quote our probabilities", "Data and analytics blogs", "About pages of football sites"], fr: ["Barres latérales et pieds de page", "Pages qui citent nos probabilités", "Blogs de data et de stats", "Pages « à propos » de sites foot"] } },
];
const wpUrl = (fr: boolean, w?: any) => SITE + (fr ? "fr/" : "") + "widget/" + (w ? (fr ? w.fr : w.en) + "/" : "");
// 7 nov 2026 (Jeremy, "on devrait pouvoir configurer dans chaque widget directement"): a configurator on every widget page
// (live preview + code updated as you choose). Client script kept as a raw string (no template interpolation inside).
const CFGJS = String.raw`<script>(function(){var C=window.AFPCFG,S="https://aifootpredictor.com/",R="https://txvrlvcxfnylnrpdrxtt.supabase.co/rest/v1/rpc/",H={apikey:"sb_publishable_7aA-njoU5fU2ialO0ExwQQ_REHjAEIe","Content-Type":"application/json"};
function $(i){return document.getElementById(i)}function esc(s){return String(s||"").replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function code(){var fr=C.lang=="fr",a=' data-type="'+C.t+'"'+(C.t=="match"?' data-match="'+esc(C.m)+'"':"")+(C.t=="team"?' data-team="'+esc(C.team)+'"':"")+(C.t=="table"?' data-lg="'+C.lg.join(",")+'"':"")+' data-lang="'+C.lang+'" data-theme="'+C.theme+'"';
 return '<div class="afp-widget"'+a+'><a href="'+S+(fr?"fr/":"")+'">'+(fr?"Probabilités foot par AI Football Predictor":"Football probabilities by AI Football Predictor")+'</a></div>'+String.fromCharCode(10)+'<script src="'+S+'embed.js" async></'+'script>'}
function upd(){$("afpcode").textContent=code();$("pvf").src=S+"w/x/?t="+C.t+"&m="+encodeURIComponent(C.m||"")+"&team="+encodeURIComponent(C.team||"")+"&lg="+encodeURIComponent(C.lg.join(","))+"&lang="+C.lang+"&theme="+C.theme+"&s=preview";var c=$("cpy");if(c)c.textContent=C.lang=="fr"?"Copier le code":"Copy the code"}
$("cl").onchange=function(){C.lang=this.value;upd()};$("ct").onchange=function(){C.theme=this.value;upd()};
if($("cm")){$("cm").onchange=function(){C.m=this.value;upd()};fetch(R+"afp_widget_match_list",{method:"POST",headers:H,body:"{}"}).then(function(r){return r.json()}).then(function(d){var o=(d||[]).map(function(x){var t=new Date(x.ko);return '<option value="'+x.n+'"'+(String(x.n)==String(C.m)?" selected":"")+'>'+t.toLocaleDateString(C.ui,{day:"2-digit",month:"2-digit"})+" "+t.toLocaleTimeString(C.ui,{hour:"2-digit",minute:"2-digit"})+" · "+esc(x.h)+" - "+esc(x.a)+'</option>'}).join("");if(o)$("cm").innerHTML=o}).catch(function(){})}
if($("ctm")){var tt;$("ctm").oninput=function(){var v=this.value;clearTimeout(tt);tt=setTimeout(function(){C.team=v;upd()},400)};fetch(R+"afp_widget_teams",{method:"POST",headers:H,body:"{}"}).then(function(r){return r.json()}).then(function(d){$("ctml").innerHTML=(d||[]).map(function(x){return '<option value="'+esc(x.t)+'">'}).join("")}).catch(function(){})}
if($("clg")){var bs=$("clg").querySelectorAll("button");for(var i=0;i<bs.length;i++)bs[i].onclick=function(){var k=this.getAttribute("data-lg"),j=C.lg.indexOf(k);if(j>=0){if(C.lg.length>1)C.lg.splice(j,1)}else{if(C.lg.length>=3)C.lg.shift();C.lg.push(k)}for(var q=0;q<bs.length;q++){var on=C.lg.indexOf(bs[q].getAttribute("data-lg"))>=0;bs[q].style.background=on?"#3ee0a8":"transparent";bs[q].style.color=on?"#06090e":"inherit"}upd()}}
$("cpy").onclick=function(){var b=this;try{navigator.clipboard.writeText($("afpcode").textContent).then(function(){b.textContent=C.lang=="fr"?"Copié ✓":"Copied ✓"})}catch(e){}};
})()</script>`;
function cfgHTML(w: any, fr: boolean, lang: string, def: { m?: any; team?: string; lg?: string }, snippet: string) {
  const SEL = "padding:10px 12px;background:#0b1118;border:1px solid #1d2733;color:#e6edf6;border-radius:8px;font:inherit";
  const lab = (t: string, x: string) => `<label style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:#8b98a9;flex:1;min-width:140px">${t}${x}</label>`;
  let ctl = "";
  if (w.t === "match") ctl += lab(fr ? "Match" : "Match", `<select id="cm" style="${SEL}"><option value="${esc(String(def.m || ""))}">${fr ? "Match du jour" : "Match of the day"}</option></select>`);
  if (w.t === "team") ctl += lab(fr ? "Équipe" : "Team", `<input id="ctm" list="ctml" value="${esc(def.team || "")}" placeholder="${fr ? "Tapez une équipe" : "Type a team"}" style="${SEL}"><datalist id="ctml"></datalist>`);
  if (w.t === "table") ctl += `<div style="flex-basis:100%"><div style="font-size:13px;color:#8b98a9;margin-bottom:6px">${fr ? "Championnats (jusqu'à 3)" : "Leagues (up to 3)"}</div><div id="clg" style="display:flex;flex-wrap:wrap;gap:6px">${TBL.map(x => `<button type="button" data-lg="${x[0]}" style="margin:0;padding:7px 11px;border:1px solid #3ee0a8;border-radius:16px;font-size:13px;cursor:pointer;${x[0] === def.lg ? "background:#3ee0a8;color:#06090e" : "background:transparent;color:inherit"}">${esc(x[2])}</button>`).join("")}</div></div>`;
  ctl += lab(fr ? "Langue" : "Language", `<select id="cl" style="${SEL}"><option value="${lang}">${fr ? "Français" : "English"}</option><option value="${fr ? "en" : "fr"}">${fr ? "Anglais" : "French"}</option></select>`);
  ctl += lab(fr ? "Thème" : "Theme", `<select id="ct" style="${SEL}"><option value="dark">${fr ? "Sombre" : "Dark"}</option><option value="light">${fr ? "Clair" : "Light"}</option></select>`);
  const src = `${SITE}w/x/?t=${w.t}&m=${encodeURIComponent(String(def.m || ""))}&team=${encodeURIComponent(def.team || "")}&lg=${encodeURIComponent(def.lg || "")}&lang=${lang}&theme=dark&s=preview`;
  const cfg = { t: w.t, lang, theme: "dark", m: String(def.m || ""), team: def.team || "", lg: def.lg ? [def.lg] : [], ui: fr ? "fr-FR" : "en-GB" };
  return `<h2>${fr ? "Configurez votre widget" : "Configure your widget"}</h2><div class="tbox"><div style="display:flex;flex-wrap:wrap;gap:10px">${ctl}</div></div>
<h2>${fr ? "Aperçu en direct" : "Live preview"}</h2><iframe id="pvf" src="${src}" title="${esc(fr ? w.kw.fr : w.kw.en)}" loading="lazy" style="width:100%;max-width:520px;border:0;height:${w.t === "table" ? 600 : 440}px;display:block"></iframe>
<h2>${fr ? "Le code à copier" : "The code to copy"}</h2><div class="tbox"><pre id="afpcode">${esc(snippet)}</pre><button class="btn sm" id="cpy" type="button">${fr ? "Copier le code" : "Copy the code"}</button></div>
<script>window.AFPCFG=${JSON.stringify(cfg)}</script>${CFGJS}`;
}

async function widgetPages() {
  const big = ["CL", "E0", "SP1", "I1", "D1", "F1"];
  const up = (await sb(`afp_predictions?kickoff=gt.${new Date(Date.now() + 3600000).toISOString()}&kickoff=lt.${new Date(Date.now() + 6 * 86400000).toISOString()}&ph=not.is.null&league=in.(${big.join(",")})&order=kickoff.asc&limit=60&select=n,league,home,away,kickoff,ph,pd,pa,xg_h,xg_a`)) || [];
  const ex = up.sort((a: any, b: any) => (big.indexOf(a.league) - big.indexOf(b.league)) || (Math.abs(a.ph - a.pa) - Math.abs(b.ph - b.pa)))[0] || null;
  const tb: Record<string, any> = {};
  for (const lg of ["F1", "E0"]) tb[lg] = await sb("rpc/afp_widget_table", { method: "POST", body: JSON.stringify({ lg }) });
  const bd = await sb("rpc/afp_widget_badge", { method: "POST", body: "{}" });
  const p0 = (x: any) => Math.round(Number(x) * 100) + "%";
  for (const w of WP) for (const lang of ["en", "fr"]) {
    const fr = lang === "fr", url = wpUrl(fr, w), alt = wpUrl(!fr, w), name = fr ? w.fr : w.en;
    const lgc = fr ? "F1" : "E0", T = tb[lgc], lead = T?.teams?.slice().sort((a: any, b: any) => b.title - a.title)[0];
    const attrs = w.t === "match" ? ` data-match="${ex ? ex.n : ""}"` : w.t === "team" ? ` data-team="${esc(ex ? ex.home : "")}"` : w.t === "table" ? ` data-lg="${lgc}"` : "";
    const snippet = `<div class="afp-widget" data-type="${w.t}"${attrs} data-lang="${lang}"><a href="${SITE}${fr ? "fr/" : ""}">${fr ? "Probabilités foot par AI Football Predictor" : "Football probabilities by AI Football Predictor"}</a></div>\n<script src="${SITE}embed.js" async></script>`;
    const example = w.t === "match" && ex ? (fr ? `Exemple du jour : ${ex.home} - ${ex.away}, victoire de ${ex.home} ${p0(ex.ph)}, nul ${p0(ex.pd)}, victoire de ${ex.away} ${p0(ex.pa)}.` : `Today's example: ${ex.home} vs ${ex.away}, ${ex.home} win ${p0(ex.ph)}, draw ${p0(ex.pd)}, ${ex.away} win ${p0(ex.pa)}.`)
      : w.t === "team" && ex ? (fr ? `Exemple du jour : ${ex.home}, prochain match contre ${ex.away} : victoire ${p0(ex.ph)}, nul ${p0(ex.pd)}, défaite ${p0(ex.pa)}.` : `Today's example: ${ex.home}, next match against ${ex.away}: win ${p0(ex.ph)}, draw ${p0(ex.pd)}, loss ${p0(ex.pa)}.`)
      : w.t === "table" && lead ? (fr ? `Exemple du jour : en ${T.name}, ${lead.name} a ${p0(lead.title)} de chances d'être champion selon ${Number(T.sims).toLocaleString("fr-FR")} simulations.` : `Today's example: in the ${T.name}, ${lead.name} have a ${p0(lead.title)} chance of the title according to ${Number(T.sims).toLocaleString("en-GB")} simulations.`)
      : w.t === "badge" && bd && bd.n ? (fr ? `Aujourd'hui : ${bd.won} issues sur ${bd.n} sont arrivées.` : `Today: ${bd.won} outcomes out of ${bd.n} happened.`) : "";
    const brief = fr
      ? `Le ${w.kw.fr} d'AI Football Predictor est gratuit, sans inscription et sans clé d'API. Il affiche ${w.what.fr}. Il s'installe en copiant deux lignes de code sur WordPress, Wix, Blogger, Shopify ou n'importe quel site, et se met à jour tout seul. ${example}`
      : `The AI Football Predictor ${w.kw.en} is free, with no signup and no API key. It shows ${w.what.en}. You install it by pasting two lines of code on WordPress, Wix, Blogger, Shopify or any website, and it updates itself. ${example}`;
    const title = fr ? w.title.fr : w.title.en;
    const desc = (fr ? `${w.title.fr.split(":")[0]} : gratuit, sans inscription, 2 lignes de code, mis à jour automatiquement.` : `${w.title.en.split(":")[0]}: free, no signup, 2 lines of code, updated automatically.`).slice(0, 160);
    const opts = (w.t === "match" ? [["data-match", fr ? "numéro du match (choisissez-le dans le configurateur)" : "match number (pick it in the configurator)"]]
      : w.t === "team" ? [["data-team", fr ? "nom exact de l'équipe, par exemple Paris SG" : "exact team name, for example Arsenal"]]
      : w.t === "table" ? [["data-lg", fr ? "codes de 1 à 3 championnats séparés par des virgules : F1, E0, SP1, I1, D1, P1, N1, T1" : "1 to 3 league codes separated by commas: E0, SP1, I1, D1, F1, P1, N1, T1"]] : [])
      .concat([["data-lang", fr ? "fr ou en" : "en or fr"], ["data-theme", fr ? "dark (sombre) ou light (clair)" : "dark or light"]]);
    const steps = fr
      ? [["Choisissez", "Configurez le widget ci-dessous ou dans la galerie, puis copiez le code."], ["WordPress", "Ajoutez un bloc « HTML personnalisé » et collez le code."], ["Wix", "Ajoutez un élément « Intégrer un code » (HTML iframe) et collez le code."], ["Blogger", "Mise en page, ajouter un gadget « HTML/JavaScript », collez le code."], ["Autres sites", "Collez le code à l'endroit voulu de votre page HTML (Shopify, Webflow, Squarespace, Joomla…)."]]
      : [["Pick", "Configure the widget below or in the gallery, then copy the code."], ["WordPress", "Add a \"Custom HTML\" block and paste the code."], ["Wix", "Add an \"Embed Code\" (HTML iframe) element and paste the code."], ["Blogger", "Layout, add an \"HTML/JavaScript\" gadget, paste the code."], ["Other sites", "Paste the code where you want it in your HTML page (Shopify, Webflow, Squarespace, Joomla…)."]];
    const faq = fr
      ? [[`Le ${w.kw.fr} est-il vraiment gratuit ?`, "Oui, gratuit, sans inscription, sans clé d'API et sans limite de pages. Un petit lien vers AI Football Predictor reste sous le widget."], ["D'où viennent les probabilités ?", "Moitié de notre propre calcul (à partir des buts marqués et encaissés et de la forme récente des équipes), moitié de l'avis des bookmakers. Chaque jour, on publie la chance qu'on donnait et ce qui est vraiment arrivé."], ["Est-ce que ça ralentit mon site ?", "Non : le script est minuscule, se charge en asynchrone et le widget est chargé en différé (lazy)."], ["Peut-on changer la langue et les couleurs ?", "Oui : data-lang pour le français ou l'anglais, data-theme pour le thème sombre ou clair. Besoin de plus ? Nos données sont disponibles par API."], ["Est-ce un site de paris ?", "Non. Nous publions des probabilités, pas des conseils de pari. Des probabilités, pas des certitudes."]]
      : [[`Is the ${w.kw.en} really free?`, "Yes, free, with no signup, no API key and no page limit. A small link to AI Football Predictor stays under the widget."], ["Where do the probabilities come from?", "Half from our own calculation (based on goals scored and conceded and recent form), half from the bookmakers' view. Every day we publish the chance we gave and what really happened."], ["Will it slow down my website?", "No: the script is tiny, loads asynchronously and the widget is lazy loaded."], ["Can I change the language and the colours?", "Yes: data-lang for English or French, data-theme for the dark or light theme. Need more? Our data is available through an API."], ["Is this a betting site?", "No. We publish probabilities, not betting advice. Probabilities, not certainties."]];
    const others = WP.filter(x => x !== w).map(x => `<a href="${wpUrl(fr, x)}">${x.ic} ${esc(fr ? x.kw.fr : x.kw.en)}</a>`).join("") + `<a href="${wpUrl(fr)}">📊 ${fr ? "Widget probabilités des matchs" : "Match probabilities widget"}</a>`;
    const body = `${TCSS}<section style="padding-top:28px"><div class="w"><nav class="crumb" aria-label="breadcrumb"><a href="${SITE}${fr ? "fr/" : ""}">${fr ? "Accueil" : "Home"}</a> / <a href="${wpUrl(fr)}">Widgets</a> / ${esc(fr ? w.kw.fr : w.kw.en)}</nav>
<h1>${w.ic} ${esc(title)}</h1><div class="tbox"><b>${fr ? "En bref" : "In short"}</b><p style="margin:6px 0 0">${esc(brief)}</p></div>
${cfgHTML(w, fr, lang, { m: ex ? ex.n : "", team: ex ? ex.home : "", lg: lgc }, snippet)}
<h2>${fr ? "Réglages" : "Settings"}</h2><div class="tsc"><table class="tt"><tbody>${opts.map(([k, v]: any) => `<tr><td class="n"><code>${k}</code></td><td class="n">${esc(v)}</td></tr>`).join("")}</tbody></table></div>
<h2>${fr ? "Installer en 2 minutes" : "Install in 2 minutes"}</h2><ol>${steps.map(([a, b]) => `<li><b>${esc(a)}</b>${fr ? " : " : ": "}${esc(b)}</li>`).join("")}</ol>
<h2>${fr ? "Pour qui ?" : "Who is it for?"}</h2><ul>${(fr ? w.uses.fr : w.uses.en).map((u: string) => `<li>${esc(u)}</li>`).join("")}</ul>
<h2>${fr ? "Questions fréquentes" : "FAQ"}</h2>${faq.map(([q, a]) => `<h3 style="font-size:16px;margin:14px 0 4px">${esc(q)}</h3><p style="margin:0">${esc(a)}</p>`).join("")}
<h2>${fr ? "Les autres widgets gratuits" : "The other free widgets"}</h2><div class="tlinks">${others}</div>
<div class="tlinks">${TBL.map(x => `<a href="${tblUrl(fr, x[1])}">${fr ? "Classement probable" : "Predicted table"} ${esc(x[2])}</a>`).join("")}</div>
</div></section>`;
    const ld = [
      { "@context": "https://schema.org", "@type": "WebPage", name: title, description: desc, url, inLanguage: lang, dateModified: new Date().toISOString(), isPartOf: { "@type": "WebSite", name: "AI Football Predictor", url: SITE } },
      { "@context": "https://schema.org", "@type": "SoftwareApplication", name: `AI Football Predictor - ${fr ? w.kw.fr : w.kw.en}`, applicationCategory: "WebApplication", operatingSystem: "Any (web browser)", description: brief, url, inLanguage: lang, offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" }, publisher: { "@type": "Organization", name: "AI Football Predictor", url: SITE } },
      { "@context": "https://schema.org", "@type": "HowTo", name: fr ? `Installer le ${w.kw.fr} sur son site` : `How to add the ${w.kw.en} to your website`, totalTime: "PT2M", step: steps.map(([a, b], i) => ({ "@type": "HowToStep", position: i + 1, name: a, text: b })) },
      { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: fr ? "Accueil" : "Home", item: SITE + (fr ? "fr/" : "") }, { "@type": "ListItem", position: 2, name: "Widgets", item: wpUrl(fr) }, { "@type": "ListItem", position: 3, name: fr ? w.kw.fr : w.kw.en, item: url }] },
    ];
    await put(`ai-football-predictor/${fr ? "fr/" : ""}widget/${name}/index.html`, page({ lang, url, alt, title, desc, body, ld, type: "website" }), `widget page: ${w.t} ${lang}`);
  }
}

// ---------- 7 nov 2026 (Jeremy, "je veux vendre mon API, pro"): public CSV of every finished match (shown probabilities, pure model,
// market without margin, xG, score), so experts can check everything themselves. ai-football-predictor/data/predictions.csv
async function exportCsv() {
  const rows = (await sb("rpc/afp_export", { method: "POST", body: "{}" })) || [];
  const cols = ["n", "kickoff", "league", "home", "away", "p_home", "p_draw", "p_away", "model_home", "model_draw", "model_away", "mkt_home", "mkt_draw", "mkt_away", "xg_home", "xg_away", "home_goals", "away_goals", "result"];
  const q = (v: any) => v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  const csv = cols.join(",") + "\n" + rows.map((r: any) => cols.map(c => q(r[c])).join(",")).join("\n") + "\n";
  await put("ai-football-predictor/data/predictions.csv", csv, `data: predictions.csv (${rows.length} matches)`);
}

// ---------- 7 nov 2026 (Jeremy, "fais une page API"): API landing page (EN api/, FR fr/api/), early access through the bot (src_api).
// Rebuilt at every blog run with a real example response (next big match) and live coverage numbers.
async function apiPages() {
  const big = ["CL", "E0", "SP1", "I1", "D1", "F1"];
  const up = (await sb(`afp_predictions?kickoff=gt.${new Date(Date.now() + 3600000).toISOString()}&kickoff=lt.${new Date(Date.now() + 6 * 86400000).toISOString()}&ph=not.is.null&league=in.(${big.join(",")})&order=kickoff.asc&limit=40&select=n,league,home,away,kickoff,ph,pd,pa,xg_h,xg_a,score,score_p,o25,af_id`)) || [];
  const arts = (await sb(`afp_blog?kind=eq.match&select=slug,lang,data`)) || []; /* 8 nov 2026 (Jeremy): pre-match articles in the API */
  const artN = new Set(arts.map((x: any) => Number(x.data?.n)));
  const srt = up.sort((a: any, b: any) => (big.indexOf(a.league) - big.indexOf(b.league)) || (Math.abs(a.ph - a.pa) - Math.abs(b.ph - b.pa)));
  const ex = srt.find((x: any) => artN.has(Number(x.n))) || srt[0] || null;
  const artOf = (l: string) => ex ? arts.find((x: any) => x.lang === l && Number(x.data?.n) === Number(ex.n)) : null;
  const artJ = (l: string) => { const x = artOf(l), A = x?.data?.a; if (!A) return null; const b = A[`body_${l}`] || []; return { title: A[`title_${l}`], lede: A[`lede_${l}`], body: b.length > 1 ? [b[0], "..."] : b, url: mUrl(l === "fr", x.slug) }; };
  const cnt = (await sb(`afp_predictions?kickoff=gt.${new Date(Date.now() - 86400000).toISOString()}&kickoff=lt.${new Date(Date.now() + 4 * 86400000).toISOString()}&ph=not.is.null&select=n`)) || [];
  const exp = await sb("rpc/afp_expert", { method: "POST", body: "{}" });
  const r3 = (x: any) => x == null ? null : Math.round(Number(x) * 1000) / 1000;
  const pvx = ex && ex.af_id ? ((await sb(`afp_mdata?af_id=eq.${ex.af_id}&select=data`))?.[0]?.data?.pv || null) : null; /* 8 nov 2026: AI match preview in the API */
  const sample = ex ? {
    id: ex.n, kickoff: ex.kickoff, competition: ex.league, home: ex.home, away: ex.away, url: `${SITE}?tab=m${ex.n}&utm_source=api`,
    probabilities: { home: r3(ex.ph), draw: r3(ex.pd), away: r3(ex.pa) },
    expected_goals: { home: Number(ex.xg_h), away: Number(ex.xg_a) },
    most_likely_score: { score: ex.score, probability: r3(ex.score_p) },
    over_2_5_goals: r3(ex.o25), preview: pvx ? { en: pvx.en, fr: pvx.fr } : null, article: artOf("en") ? { en: artJ("en"), fr: artJ("fr") } : null, locked: false, locks_at: new Date(Date.parse(ex.kickoff) - 3 * 3600000).toISOString(),
  } : null;
  // 9 nov 2026 (Jeremy): "une seule offre gratuite", key on the site for signed-in members, link to us mandatory (checked automatically), 1000 requests a day. Never mention another offer.
  const v1s = ex ? { id: `${ex.league}|${String(ex.kickoff).slice(0, 10)}|${ex.home}|${ex.away}`, competition: ex.league, kickoff: ex.kickoff, home: ex.home, away: ex.away, probabilities: { home: r3(ex.ph), draw: r3(ex.pd), away: r3(ex.pa) }, most_likely: (() => { const m = Math.max(ex.ph, ex.pd, ex.pa); return { outcome: m === ex.ph ? "home" : m === ex.pd ? "draw" : "away", probability: r3(m) }; })(), over_2_5_goals: r3(ex.o25), likely_score: ex.score ? { score: ex.score, probability: r3(ex.score_p) } : null, expected_goals: ex.xg_h != null ? { home: Number(ex.xg_h), away: Number(ex.xg_a) } : null, status: "upcoming", result: null, url: `${SITE}?tab=m${ex.n}&utm_source=api&utm_medium=yoursite.com` } : null;
  const json = v1s ? JSON.stringify({ attribution: { text: "Probabilities by AI Football Predictor", url: `${SITE}?utm_source=api`, html: `<a href="${SITE}?utm_source=api" target="_blank" rel="noopener">Probabilities by AI Football Predictor</a>`, required: true }, meta: { calls_left_today: 999, date: String(ex.kickoff).slice(0, 10), count: 1 }, data: [v1s] }, null, 2) : "";
  const BASE = "https://api.aifootpredictor.com/api/v1";
  for (const lang of ["en", "fr"]) {
    const fr = lang === "fr", url = SITE + (fr ? "fr/api/" : "api/"), alt = SITE + (fr ? "api/" : "fr/api/");
    const title = fr ? "API foot gratuite : probabilités de matchs, xG et score probable" : "Free football API: match probabilities, xG and likely score";
    const desc = fr ? "API foot gratuite pour vos sites et applis : probabilités victoire, nul, défaite, buts attendus et score le plus probable sur 29 compétitions. 5 000 requêtes par jour, clé immédiate." : "Free football API for your sites and apps: win, draw and loss probabilities, expected goals and most likely score in 29 competitions. 5,000 requests a day, instant key.";
    const brief = fr
      ? `Une API gratuite qui donne à votre site ou à votre appli nos probabilités de victoire, de nul et de défaite pour ${cnt.length > 50 ? "plus de " + Math.floor(cnt.length / 10) * 10 + " matchs par semaine dans " : ""}29 compétitions, avec les buts attendus, le score le plus probable et notre fiabilité mesurée en public. 5 000 requêtes par jour. Une seule condition : un lien visible vers aifootpredictor.com sur les pages qui affichent les données. Elle ne contient que nos propres calculs.`
      : `A free API that gives your site or app our win, draw and loss probabilities for ${cnt.length > 50 ? "more than " + Math.floor(cnt.length / 10) * 10 + " matches a week in " : ""}29 competitions, with expected goals, the most likely score and our publicly measured reliability. 5,000 requests a day. One condition: a visible link to aifootpredictor.com on the pages that show the data. It only contains our own calculations.`;
    const eps = fr
      ? [["GET /matches", "Les matchs d'un jour avec probabilités 1 / N / 2, issue la plus probable, double chance, plus de 2,5 buts, les deux équipes marquent, clean sheets, les 5 scores les plus probables, buts attendus, et le résultat une fois le match fini. Paramètres : date (AAAA-MM-JJ), competition, status (upcoming, finished)."], ["GET /articles", "Nos articles avant-match écrits par l'IA, en français ou en anglais : titre, chapeau et premier paragraphe, avec le lien « Lire l'analyse complète » à afficher dessous. Paramètres : lang (fr, en), date, limit."], ["GET /tables", "Le classement probable de fin de saison (20 000 simulations chaque nuit) : points attendus, chances de titre, de top 4 et de relégation, notes d'attaque et de défense. 8 championnats. Paramètre : competition (E0, SP1, I1, D1, F1, P1, N1, T1)."], ["GET /competitions", "Les codes des compétitions couvertes, avec le nombre de matchs sur 30 jours."], ["GET /reliability", "Notre fiabilité : score de Brier et log loss sur tous les matchs terminés, comparés au marché et au hasard."]]
      : [["GET /matches", "A day's matches with 1 / X / 2 probabilities, most likely outcome, double chance, over 2.5 goals, both teams to score, clean sheets, the 5 most likely scores, expected goals, and the result once the match is over. Parameters: date (YYYY-MM-DD), competition, status (upcoming, finished)."], ["GET /articles", "Our AI-written pre-match articles, in English or French: title, lede and first paragraph, with the « Read the full analysis » link to show under it. Parameters: lang (en, fr), date, limit."], ["GET /tables", "The predicted end-of-season table (20,000 simulations every night): expected points, title, top 4 and relegation chances, attack and defence ratings. 8 leagues. Parameter: competition (E0, SP1, I1, D1, F1, P1, N1, T1)."], ["GET /competitions", "The codes of the competitions covered, with the number of matches over 30 days."], ["GET /reliability", "Our reliability: Brier score and log loss on every finished match, compared with the market and with a random guess."]];
    const steps = fr
      ? ["Connectez-vous avec Google (bouton ci-dessous).", "Ajoutez sur votre page le lien fourni : « Probabilities by AI Football Predictor ». Il est aussi dans chaque réponse de l'API, prêt à afficher.", "Indiquez l'adresse de cette page : votre clé est créée tout de suite et le lien est vérifié automatiquement.", "Appelez l'API avec l'en-tête X-API-Key."]
      : ["Sign in with Google (button below).", "Add the link we give you to your page: « Probabilities by AI Football Predictor ». It is also in every API response, ready to display.", "Enter that page's address: your key is created at once and the link is checked automatically.", "Call the API with the X-API-Key header."];
    const faq = fr
      ? [["L'API est-elle vraiment gratuite ?", "Oui. 5 000 requêtes par jour, sans carte bancaire. En échange, un lien visible vers aifootpredictor.com sur les pages qui montrent nos données."], ["Comment le lien est-il vérifié ?", "Notre robot lit la page que vous avez indiquée et cherche un lien vers aifootpredictor.com dans le HTML. Il vérifie à la création, quand vous cliquez sur « Vérifier mon lien », puis une fois par jour. Le lien doit être présent dans le HTML envoyé par votre serveur, pas seulement ajouté plus tard par JavaScript."], ["Que se passe-t-il sans lien ?", "Vous avez 3 jours après la création de la clé pour l'ajouter. Ensuite, la clé est bloquée jusqu'à ce que le lien soit trouvé. Si le lien disparaît 3 vérifications de suite, la clé est aussi bloquée."], ["Quelles compétitions sont couvertes ?", "29 compétitions, dont la Premier League, la Liga, la Serie A, la Bundesliga, la Ligue 1, la Ligue des champions, la Ligue Europa et la Ligue Conférence."], ["Les probabilités sont-elles fiables ?", "Vous pouvez le vérifier : chaque probabilité est figée avant le match puis comparée au résultat, et l'endpoint /reliability donne nos scores en direct. Notre page Méthode explique tout."], ["Que contient l'API exactement ?", "Uniquement nos propres calculs et textes : probabilités, buts attendus, score le plus probable, fiabilité, le résultat final du match et des extraits de nos articles avant-match (avec le lien vers l'article complet). Pas de cotes, pas de logos, pas de données brutes de fournisseurs."]]
      : [["Is the API really free?", "Yes. 5,000 requests a day, no credit card. In return, a visible link to aifootpredictor.com on the pages that show our data."], ["How is the link checked?", "Our bot reads the page you entered and looks for a link to aifootpredictor.com in its HTML. It checks when you create the key, when you click « Check my link », then once a day. The link must be in the HTML your server sends, not only added later by JavaScript."], ["What happens without a link?", "You have 3 days after creating the key to add it. After that, the key is blocked until the link is found. If the link disappears for 3 checks in a row, the key is blocked too."], ["Which competitions are covered?", "29 competitions, including the Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, the Champions League, the Europa League and the Conference League."], ["Are the probabilities reliable?", "You can check: every probability is locked before kickoff then compared with the result, and the /reliability endpoint gives our live scores. Our Method page explains it all."], ["What exactly is in the API?", "Only our own calculations and writing: probabilities, expected goals, most likely score, reliability, the final result of the match and excerpts of our pre-match articles (with the link to the full article). No odds, no logos, no raw provider data."]];
    const T = fr
      ? { h: "Votre clé API gratuite", si: "Connectez-vous pour obtenir votre clé gratuite.", sib: "👤 Se connecter avec Google", pg: "Adresse de la page qui affichera les données (avec le lien vers nous)", mk: "Créer ma clé gratuite", ld: "Chargement…", key: "Votre clé", cp: "Copier", cpd: "Copié ✓", site: "Page vérifiée", ok: "✅ Lien vers aifootpredictor.com trouvé : votre clé est active.", gr: "⏳ Lien pas encore trouvé. Ajoutez-le : il vous reste {d} jour(s) avant le blocage de la clé.", bl: "⛔ Clé bloquée : aucun lien vers aifootpredictor.com sur votre page. Ajoutez-le puis vérifiez.", ck: "Vérifier mon lien", ch: "Changer de page", use: "Requêtes aujourd'hui", bad: "Adresse invalide : indiquez l'adresse complète d'une page publique (https://…).", nf: "Lien pas trouvé sur la page.", un: "Page injoignable.", wait: "Patientez 30 secondes entre deux vérifications.", snip: "Lien à ajouter sur votre page" }
      : { h: "Your free API key", si: "Sign in to get your free key.", sib: "👤 Sign in with Google", pg: "Address of the page that will show the data (with the link to us)", mk: "Create my free key", ld: "Loading…", key: "Your key", cp: "Copy", cpd: "Copied ✓", site: "Checked page", ok: "✅ Link to aifootpredictor.com found: your key is active.", gr: "⏳ Link not found yet. Add it: {d} day(s) left before the key is blocked.", bl: "⛔ Key blocked: no link to aifootpredictor.com on your page. Add it, then check.", ck: "Check my link", ch: "Change page", use: "Requests today", bad: "Invalid address: enter the full address of a public page (https://…).", nf: "Link not found on the page.", un: "Page unreachable.", wait: "Wait 30 seconds between two checks.", snip: "Link to add to your page" };
    const snip = `<a href="https://aifootpredictor.com/?utm_source=api" target="_blank" rel="noopener">Probabilities by AI Football Predictor</a>`;
    const keyJs = `<script>(function(){var T=${JSON.stringify(T)},A="https://afp-blog-production.up.railway.app/api/acct/apikey",el=document.getElementById("afpak");if(!el)return;
function e(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function tk(){return window.AIFPAcct&&AIFPAcct.token&&AIFPAcct.token()}
function rq(p,b){return fetch(A+p,{method:b?"POST":"GET",headers:{"Content-Type":"application/json","x-session":tk()||""},body:b?JSON.stringify(b):undefined}).then(function(r){return r.json()}).catch(function(){return{ok:false}})}
function msg(c){return c==="not_found"?T.nf:c==="unreachable"||/^http_/.test(c||"")?T.un:c==="wait"?T.wait:""}
function form(v){return '<form id="afpkf" style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0"><label style="width:100%;font-size:14px" for="afpku">'+T.pg+'</label><input id="afpku" type="url" required placeholder="https://yoursite.com/football/" value="'+e(v||"")+'" style="flex:1;min-width:220px;padding:11px 12px;background:#0b1118;border:1px solid #1d2733;color:#e6edf6;border-radius:8px;font:inherit"><button class="btn" type="submit">'+T.mk+'</button></form><small id="afpkm" role="status"></small>'}
function bind(){var f=document.getElementById("afpkf");if(f)f.onsubmit=function(ev){ev.preventDefault();var b=f.querySelector("button"),m=document.getElementById("afpkm");b.disabled=true;m.textContent=T.ld;rq("",{site_url:document.getElementById("afpku").value}).then(function(j){b.disabled=false;if(!j.ok){m.textContent=j.error==="site_url"?T.bad:"Error";return}show(j)})}}
function show(j){var k=j.key;if(!k){el.innerHTML="<b>"+T.h+"</b>"+form();bind();return}
var st=k.link_ok?T.ok:k.blocked?T.bl:T.gr.replace("{d}",k.grace_days);
el.innerHTML="<b>"+T.h+"</b><p style='margin:10px 0 4px;font-size:14px'>"+T.key+"</p><div style='display:flex;gap:8px;flex-wrap:wrap'><code id='afpkk' style='flex:1;min-width:220px;padding:10px;background:#0b1118;border:1px solid #1d2733;border-radius:8px;word-break:break-all'>"+e(k.key)+"</code><button class='btn' id='afpkc' type='button'>"+T.cp+"</button></div><p style='margin:10px 0 0;font-size:14px'>"+T.site+" : <a href='"+e(k.site_url)+"' rel='nofollow noopener' target='_blank'>"+e(k.site_url)+"</a></p><p style='margin:8px 0'>"+st+"</p><p id='afpkm2' role='status' style='margin:0 0 8px;font-size:14px'>"+e(msg(j.check))+"</p><div style='display:flex;gap:8px;flex-wrap:wrap'>"+(k.link_ok?"":"<button class='btn' id='afpkv' type='button'>"+T.ck+"</button>")+"<button class='btn' id='afpkx' type='button' style='background:transparent;border:1px solid #1d2733'>"+T.ch+"</button></div>"+(j.today!=null?"<p style='margin:10px 0 0;font-size:14px'>"+T.use+" : "+j.today+" / "+(j.limit||5000)+"</p>":"")+"<div id='afpkfw'></div>";
document.getElementById("afpkc").onclick=function(){var b=this;navigator.clipboard&&navigator.clipboard.writeText(k.key).then(function(){b.textContent=T.cpd;setTimeout(function(){b.textContent=T.cp},1500)})};
var v=document.getElementById("afpkv");if(v)v.onclick=function(){v.disabled=true;rq("/check",{}).then(function(r){if(r.ok)show(Object.assign({today:j.today,limit:j.limit},r));else v.disabled=false})};
document.getElementById("afpkx").onclick=function(){document.getElementById("afpkfw").innerHTML=form(k.site_url);bind()}}
function load(){if(!window.AIFPAcct){setTimeout(load,300);return}if(!tk()){el.innerHTML="<b>"+T.h+"</b><p style='margin:8px 0'>"+T.si+"</p><button class='btn' type='button' id='afpks'>"+T.sib+"</button>";document.getElementById("afpks").onclick=function(){AIFPAcct.open()};return}
el.innerHTML="<b>"+T.h+"</b><p>"+T.ld+"</p>";rq("").then(function(j){if(j&&j.ok)show(j);else el.innerHTML="<b>"+T.h+"</b><p>"+T.si+"</p>"})}
window.addEventListener("aifp-acct",load);document.addEventListener("aifp-acct",load);load()})();</script>`;
    const curl = `curl -H "X-API-Key: YOUR_KEY" "${BASE}/matches?date=${new Date().toISOString().slice(0, 10)}"`;
    const jsx = `fetch("${BASE}/matches", { headers: { "X-API-Key": "YOUR_KEY" } })\n  .then(r => r.json())\n  .then(({ attribution, data }) => {\n    // show data, and always show attribution.html on the page\n  });`;
    const score = (() => { const gain = exp && exp.n && exp.naive && exp.naive.rps ? Math.round(100 * (exp.naive.rps - exp.shown.rps) / exp.naive.rps) : 0; return gain > 0 ? (fr ? `Sur ${exp.n} matchs terminés, nos probabilités sont ${gain} % plus justes qu'un calcul de base.` : `On ${exp.n} finished matches, our probabilities are ${gain}% more accurate than a basic guess.`) : ""; })();
    const body = `${TCSS}<section style="padding-top:28px"><div class="w"><nav class="crumb" aria-label="breadcrumb"><a href="${SITE}${fr ? "fr/" : ""}">${fr ? "Accueil" : "Home"}</a> / API</nav>
<h1>${esc(title)}</h1><div class="tbox"><b>${fr ? "En bref" : "In short"}</b><p style="margin:6px 0 0">${esc(brief)}</p></div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0"><div class="tbox" style="margin:0;text-align:center"><div style="font-size:24px;font-weight:800">0 €</div><small>${fr ? "gratuit, sans carte" : "free, no card"}</small></div><div class="tbox" style="margin:0;text-align:center"><div style="font-size:24px;font-weight:800">${fr ? "5 000" : "5,000"}</div><small>${fr ? "requêtes par jour" : "requests a day"}</small></div><div class="tbox" style="margin:0;text-align:center"><div style="font-size:24px;font-weight:800">29</div><small>${fr ? "compétitions" : "competitions"}</small></div><div class="tbox" style="margin:0;text-align:center"><div style="font-size:24px;font-weight:800">1</div><small>${fr ? "lien vers nous, obligatoire" : "link to us, required"}</small></div></div>
<h2>${fr ? "Obtenir une clé en 2 minutes" : "Get a key in 2 minutes"}</h2><ol>${steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
<div class="tbox"><b>${esc(T.snip)}</b><pre style="white-space:pre-wrap;word-break:break-all">${esc(snip)}</pre></div>
<div class="tbox" id="afpak" style="border-color:#2b6cb0"><b>${esc(T.h)}</b><p>${esc(T.si)}</p></div>${keyJs}
<h2>${fr ? "Endpoints" : "Endpoints"}</h2><p style="font-size:14px">${fr ? "Adresse de base" : "Base URL"} : <code>${BASE}</code></p><div class="tsc"><table class="tt"><tbody>${eps.map(([e, d]) => `<tr><td class="n" style="white-space:nowrap"><code>${esc(e)}</code></td><td class="n">${esc(d)}</td></tr>`).join("")}</tbody></table></div>
<h2>${fr ? "Exemple d'appel" : "Example call"}</h2><div class="tbox"><pre style="white-space:pre-wrap;word-break:break-all">${esc(curl)}</pre><pre>${esc(jsx)}</pre></div>
${json ? `<h2>${fr ? "Exemple de réponse (vrai match)" : "Example response (real match)"}</h2><div class="tbox"><pre>${esc(json)}</pre></div>` : ""}
<h2>${fr ? "Les règles" : "The rules"}</h2><ul>${(fr ? ["Un lien visible et cliquable vers aifootpredictor.com sur chaque page qui affiche nos données (le bloc attribution de chaque réponse est prêt à afficher).", "Une clé par compte, liée à votre site. Les appels depuis un navigateur ne sont acceptés que depuis ce domaine.", "5 000 requêtes par jour, remises à zéro à minuit (UTC).", "Pas de revente des données."] : ["A visible, clickable link to aifootpredictor.com on every page that shows our data (the attribution block in every response is ready to display).", "One key per account, tied to your site. Browser calls are only accepted from that domain.", "5,000 requests a day, reset at midnight (UTC).", "No reselling of the data."]).map(s => `<li>${esc(s)}</li>`).join("")}</ul>
${score ? `<p style="font-size:14px">📊 ${esc(score)} <a href="${SITE}${fr ? "fr/methode/" : "method/"}">${fr ? "Notre méthode" : "Our method"}</a></p>` : ""}
<h2>${fr ? "Questions fréquentes" : "FAQ"}</h2>${faq.map(([q, a]) => `<h3 style="font-size:16px;margin:14px 0 4px">${esc(q)}</h3><p style="margin:0">${esc(a)}</p>`).join("")}
<div class="tlinks"><a href="${SITE}openapi.json">OpenAPI</a><a href="https://github.com/jeremstyke/ai-football-predictor/blob/main/postman/aifp-free-api.postman_collection.json">Postman</a><a href="https://github.com/jeremstyke/ai-football-predictor#free-api">GitHub</a><a href="${SITE}${fr ? "fr/" : ""}widget/">${fr ? "Widgets gratuits" : "Free widgets"}</a><a href="${SITE}data/predictions.csv">CSV</a><a href="${SITE}${fr ? "fr/methode/" : "method/"}">${fr ? "Méthode" : "Method"}</a></div>
</div></section>`;
    const ld = [
      { "@context": "https://schema.org", "@type": "WebPage", name: title, description: desc, url, inLanguage: lang, dateModified: new Date().toISOString(), isPartOf: { "@type": "WebSite", name: "AI Football Predictor", url: SITE } },
      { "@context": "https://schema.org", "@type": "WebAPI", name: "AI Football Predictor API", description: brief, url, documentation: url, provider: { "@type": "Organization", name: "AI Football Predictor", url: SITE } },
      { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: fr ? "Accueil" : "Home", item: SITE + (fr ? "fr/" : "") }, { "@type": "ListItem", position: 2, name: "API", item: url }] },
    ];
    await put(`ai-football-predictor/${fr ? "fr/" : ""}api/index.html`, page({ lang, url, alt, title, desc, body, ld, type: "website" }), `api page ${lang}`);
  }
}

// ---------- match previews (8 nov 2026, Jeremy: "ce genre d'article sur le blog, avec le prono") ----------
// One page per big match (EN + FR), written once by the AI ONLY from our data (probabilities, xG, likely score, form,
// standings, head to head, injuries), with the model's most likely outcome and score. Re-rendered after the match with the result.
// Stored in afp_blog (kind 'match', data.n = prediction n, data.a = the AI texts). Shown in the match widget too (afp_widget_match.art).
const BIGL = ["CL", "EL", "ECL", "E0", "SP1", "I1", "D1", "F1", "P1", "N1"];
const MP_SYS = "You write a football match preview for a statistics website, like a sports news site. Use ONLY the facts in the JSON. Never invent anything: no players, coaches, tactics, quotes, transfers, injuries, streaks or records that are not in the JSON. If injuries are 'not provided', do not mention injuries. Clearly state the model's most likely outcome and its most likely score: that is the prediction of the article. No betting language (no 'bet', 'stake', 'lock', 'sure thing', 'banker', 'tip'). Never use em dashes or en dashes. Reply with JSON only: {\"title_en\":\"...\",\"title_fr\":\"...\",\"lede_en\":\"...\",\"lede_fr\":\"...\",\"body_en\":[\"...\",\"...\",\"...\"],\"body_fr\":[\"...\",\"...\",\"...\"]}. Name the predictor 'the AI' or 'our AI' (French: 'l'IA' or 'notre IA', feminine), never 'the model' or 'le modèle' (8 nov 2026, Jeremy). Titles: a catchy news headline under 90 characters that starts with the AI's view and names both teams, for example 'AI sees Barcelona beating Atletico 2-1' and in French 'L'IA voit Barcelone s'imposer face à l'Atlético'. Lede: 2 sentences. Body: 3 short paragraphs (the probabilities; the goals: expected goals, most likely score, over 2.5; form, standings, head to head). French: natural French with French club names when common (Barcelone, Bayern Munich), same content. Recent form: describe it in words from the counts (for example 'four wins and one defeat in their last five'), never as letter strings like WDWWL. Mention the most likely score in the title only if it matches the most likely outcome. Write each fact once, never correct yourself in the text.";
const fcount = (f: any) => { const s = String(f || "").toUpperCase().replace(/[^WDL]/g, ""); if (!s) return null; const c = (x: string) => s.split("").filter((y) => y === x).length; return { matches: s.length, wins: c("W"), draws: c("D"), losses: c("L"), last_match: s.slice(-1) === "W" ? "win" : s.slice(-1) === "D" ? "draw" : "loss" }; };
const mUrl = (fr: boolean, slug: string) => `${SITE}${fr ? "fr/" : ""}blog/${slug}/`;
async function matchPreviews() {
  const now = Date.now();
  const rows = (await sb(`afp_predictions?af_id=not.is.null&ph=not.is.null&kickoff=gt.${new Date(now - 30 * 3600000).toISOString()}&kickoff=lt.${new Date(now + 40 * 3600000).toISOString()}&league=in.(${BIGL.join(",")})&order=kickoff.asc&limit=300&select=n,af_id,league,home,away,kickoff,ph,pd,pa,xg_h,xg_a,score,score_p,o25,form_home,form_away,selected,status,hg,ag,home_logo,away_logo`)) || [];
  const done = new Set<number>(((await sb("afp_blog?kind=eq.match&lang=eq.en&select=data&order=published_at.desc&limit=400")) || []).map((x: any) => Number(x.data?.n)));
  const bal = (p: any) => Math.abs(Number(p.ph) - Number(p.pa));
  const up = rows.filter((p: any) => Date.parse(p.kickoff) > now + 30 * 60000)
    .sort((a: any, b: any) => (BIGL.indexOf(a.league) - BIGL.indexOf(b.league)) || (Number(!!b.selected) - Number(!!a.selected)) || (bal(a) - bal(b))).slice(0, 8);
  const fin = rows.filter((p: any) => done.has(p.n) && !up.includes(p)); /* already published: re-rendered (result after the match) */
  let made = 0;
  for (const p of [...up, ...fin]) { try { if (await matchPage(p)) made++; } catch (e) { console.log("match page error", p.n, String(e)); } }
  console.log("match previews", made, "of", up.length + fin.length);
}
async function matchPage(p: any) {
  const day = parisDay(Date.parse(p.kickoff));
  const base = slugify(`${p.home} ${p.away}`) + "-" + day, sEn = `prediction-${base}`, sFr = `pronostic-${base}`;
  const old = (await sb(`afp_blog?kind=eq.match&lang=eq.en&slug=eq.${sEn}&select=data,published_at`))?.[0];
  const md = (await sb(`afp_mdata?af_id=eq.${p.af_id}&select=data`))?.[0]?.data || {};
  const P = [Number(p.ph), Number(p.pd), Number(p.pa)], k = P.indexOf(Math.max(...P));
  let A = old?.data?.a;
  if (!A) {
    if (Date.parse(p.kickoff) < Date.now()) return false;
    const pc = (x: any) => (x == null ? null : Math.round(Number(x) * 100));
    const facts = {
      match: `${p.home} vs ${p.away}`, competition: COMP[p.league] || p.league, kickoff_paris: `${day} ${hm(p.kickoff)}`, venue: md.venue || null, round: md.round || null,
      model_probabilities_pct: { home_win: pc(p.ph), draw: pc(p.pd), away_win: pc(p.pa) },
      model_most_likely_outcome: k === 0 ? `${p.home} win` : k === 2 ? `${p.away} win` : "draw",
      model_expected_goals: p.xg_h != null ? { home: Number(p.xg_h), away: Number(p.xg_a) } : null,
      model_most_likely_score: p.score ? { score: p.score, probability_pct: pc(p.score_p) } : null,
      model_over_2_5_goals_pct: pc(p.o25),
      recent_form_last_matches: { home: fcount(p.form_home), away: fcount(p.form_away) },
      standings: md.st || null, season_stats_home_team_at_home_and_away_team_away: md.season || null,
      head_to_head_last: md.h2h || null, injuries_and_suspensions: md.inj && md.inj.length ? md.inj : "not provided",
    };
    A = await ai(MP_SYS, JSON.stringify(facts), 4000);
    if (!A || !A.title_en || !A.title_fr || !Array.isArray(A.body_en) || !Array.isArray(A.body_fr)) { console.log("match ai failed", p.n); return false; }
    const cl = (s: any) => nodash(String(s || "")).trim();
    A = { title_en: cl(A.title_en), title_fr: cl(A.title_fr), lede_en: cl(A.lede_en), lede_fr: cl(A.lede_fr), body_en: A.body_en.map(cl).filter(Boolean), body_fr: A.body_fr.map(cl).filter(Boolean) };
  }
  const played = p.hg != null && p.ag != null && Date.parse(p.kickoff) < Date.now() - 100 * 60000;
  const res = played ? (p.hg > p.ag ? 0 : p.hg === p.ag ? 1 : 2) : null;
  const pub = old?.published_at || new Date().toISOString();
  for (const lang of ["en", "fr"]) {
    const fr = lang === "fr", slug = fr ? sFr : sEn, url = mUrl(fr, slug), alt = mUrl(!fr, fr ? sEn : sFr), t = L10(fr);
    const lab = (i: number) => i === 1 ? (fr ? "Match nul" : "Draw") : fr ? `Victoire ${i === 0 ? p.home : p.away}` : `${i === 0 ? p.home : p.away} win`;
    const title = A[`title_${lang}`], lede = A[`lede_${lang}`] || "", lg = COMP[p.league] || p.league;
    const desc = (lede || title).slice(0, 158);
    const app = `${SITE}${fr ? "fr/" : ""}?tab=m${p.n}`, tgl = `https://t.me/ai_football_predictorbot/app?startapp=m${p.n}`;
    const logo = (u: any) => u ? `<img src="${esc(u)}" alt="" width="56" height="56" loading="lazy">` : `<span class="mph">⚽</span>`;
    const dec = (x: any) => x == null ? "-" : (fr ? Number(x).toFixed(1).replace(".", ",") : Number(x).toFixed(1));
    const pc0 = (x: any) => Math.round(Number(x) * 100) + (fr ? " %" : "%");
    const css = `<style>.mimg{display:block;width:100%;height:auto;aspect-ratio:1200/630;border:1px solid var(--line);margin:6px 0 16px}.mimg+.mcard:not(.sc2){display:none}.wbox{border:1px dashed var(--line2);background:var(--panel);padding:16px;margin:26px 0}.wbox b{display:block;font-size:16px;margin-bottom:2px}.wbox>span{color:var(--mut);font-size:14px}.wbox pre{white-space:pre-wrap;word-break:break-all;font:12px/1.5 var(--mono);background:#06090e;border:1px solid var(--line);padding:10px;margin-top:8px;color:#cfd8e4}.wbox button{cursor:pointer;font-family:inherit}.mcard{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;border:1px solid var(--line);background:var(--panel);padding:18px 14px;margin:6px 0 16px;text-align:center}.mcard img,.mph{width:56px;height:56px;object-fit:contain;display:block;margin:0 auto 8px;font-size:40px;line-height:56px}.mcard b{display:block;font-size:16px;line-height:1.25}.mcard .vs{font:800 26px var(--mono);color:var(--mut)}.mcard .vs.sc{color:var(--txt)}.pbar{display:flex;height:10px;gap:3px;margin:14px 0 6px}.pbar i{display:block;background:var(--line2)}.pbar i.k{background:var(--acc)}.prow{display:flex;justify-content:space-between;font:600 12.5px var(--mono);color:var(--mut)}.prow .k{color:var(--acc)}.resb{border:1px solid var(--line2);background:var(--panel);padding:14px 16px;margin:16px 0;font-size:15px}.resb b{font-size:17px}</style>`;
    const bars = `<div class="pbar">${P.map((v, i) => `<i class="${i === k ? "k" : ""}" style="width:${Math.max(3, v * 100)}%"></i>`).join("")}</div><div class="prow">${P.map((v, i) => `<span class="${i === k ? "k" : ""}">${i === 0 ? "1" : i === 1 ? (fr ? "N" : "X") : "2"} · ${pc0(v)}</span>`).join("")}</div>`;
    const ticket = `<div class="tk"><div class="tkh"><div><b>${fr ? "LE PLUS PROBABLE" : "MOST LIKELY"}</b><small>${esc(lg)} · ${esc(longDate(day, lang))} · ${hm(p.kickoff)}</small></div><span class="mono">#AIFP-${p.n}</span></div>
<div class="tkl d4"><span class="t">1N2</span><span>${fr ? "Résultat le plus probable" : "Most likely result"}</span><span class="pk">${esc(lab(k))}<small>${pc0(P[k])}</small></span></div>
${p.score ? `<div class="tkl d4"><span class="t">${fr ? "SCORE" : "SCORE"}</span><span>${fr ? "Score le plus probable" : "Most likely score"}</span><span class="pk">${esc(p.score)}${p.score_p != null ? `<small>${pc0(p.score_p)}</small>` : ""}</span></div>` : ""}
${p.xg_h != null ? `<div class="tkl d4"><span class="t">xG</span><span>${fr ? "Buts attendus" : "Expected goals"}</span><span class="pk">${dec(p.xg_h)} - ${dec(p.xg_a)}</span></div>` : ""}
${p.o25 != null ? `<div class="tkl d4"><span class="t">+2.5</span><span>${fr ? "Plus de 2,5 buts" : "Over 2.5 goals"}</span><span class="pk">${pc0(p.o25)}</span></div>` : ""}
<div class="tkf"><span>${fr ? "Probabilités verrouillées avant le match, puis vérifiées" : "Probabilities locked before kickoff, then checked"}</span><a class="btn sm" href="${app}">${fr ? "Fiche du match" : "Match sheet"}</a></div></div>`;
    const result = res == null ? "" : `<div class="resb">${res === k ? "✅" : "❌"} <b>${fr ? "Résultat" : "Result"} : ${esc(p.home)} ${p.hg} - ${p.ag} ${esc(p.away)}</b><br><span class="mut">${fr ? `Le plus probable était « ${esc(lab(k))} » (${pc0(P[k])}) : ${res === k ? "c'est arrivé." : "ce n'est pas arrivé."}` : `The most likely outcome was "${esc(lab(k))}" (${pc0(P[k])}): ${res === k ? "it happened." : "it did not happen."}`}${p.score ? (fr ? ` Score le plus probable annoncé : ${esc(p.score)}.` : ` Most likely score announced: ${esc(p.score)}.`) : ""}</span></div>`;
    const paras = (A[`body_${lang}`] || []).map((x: string) => `<p>${esc(x)}</p>`).join("");
    const body = `${css}<section class="ahero"><div class="w art">${crumb(fr, `${p.home} - ${p.away}`)}
<span class="tag"><span class="dot"></span>${fr ? "Avant-match" : "Match preview"} · ${esc(lg)}</span><h1>${esc(title)}</h1><p class="lede">${esc(lede)}</p>
<div class="chipsm"><span>📅 <b>${esc(longDate(day, lang))}</b></span><span>⏱ <b>${hm(p.kickoff)}</b> ${fr ? "(Paris)" : "(Paris time)"}</span>${md.venue ? `<span>🏟 <b>${esc(md.venue)}</b></span>` : ""}</div></div></section>
<section style="padding-top:18px"><div class="w art">
<img class="mimg" src="https://txvrlvcxfnylnrpdrxtt.supabase.co/functions/v1/afp-og?n=${p.n}" alt="${esc(p.home)} - ${esc(p.away)}" width="1200" height="630"><div class="mcard${res != null ? " sc2" : ""}"><div>${logo(p.home_logo)}<b>${esc(p.home)}</b></div><div class="vs${res != null ? " sc" : ""}">${res != null ? `${p.hg} - ${p.ag}` : "vs"}</div><div>${logo(p.away_logo)}<b>${esc(p.away)}</b></div></div>
${result}${ticket}${bars}
<div class="prose" style="margin-top:26px">${paras}</div>
<div class="wbox" id="w"><b>${fr ? "📋 Mets ce match sur ton site" : "📋 Put this match on your site"}</b><span>${fr ? "Widget gratuit qui se met à jour tout seul : probabilités, direct et score. Copie ce code :" : "Free widget that updates itself: probabilities, live and score. Copy this code:"}</span><pre>${esc(`<div class="afp-widget" data-type="match" data-match="${p.n}" data-lang="${lang}"><a href="${url}">${p.home} - ${p.away} : ${fr ? "probabilités par AI Football Predictor" : "probabilities by AI Football Predictor"}</a></div>\n<script src="${SITE}embed.js" async></script>`)}</pre><div class="ctas" style="margin:10px 0 0"><button class="btn sm" type="button" onclick="var b=this;navigator.clipboard&&navigator.clipboard.writeText(b.closest('.wbox').querySelector('pre').textContent).then(function(){b.textContent='${fr ? "Copié ✓" : "Copied ✓"}'})">${fr ? "Copier le code" : "Copy code"}</button><a class="btn sm out" href="${SITE}${fr ? "fr/" : ""}widget/">${fr ? "Tous les widgets" : "All widgets"}</a></div><div class="afp-widget" data-type="match" data-match="${p.n}" data-lang="${lang}" style="margin-top:16px"></div></div><script src="${SITE}embed.js" async></script>
<div class="call"><span class="mark">AIFP</span><div><b>${fr ? "Suis ce match en direct" : "Follow this match live"}</b><span>${fr ? "Score, buts et probabilité en direct, gratuitement." : "Score, goals and live probability, free."}</span></div><div class="ctas" style="margin:0"><a class="btn sm" href="${app}">🌐 ${fr ? "Sur le site" : "On the website"}</a><a class="btn sm out" href="${tgl}">✈️ Telegram</a></div></div>
<p class="mut" style="font-size:13px">${fr ? "Article écrit par notre IA à partir de nos seules données (probabilités, buts attendus, forme, classement). Des probabilités, pas des certitudes. 18+." : "Article written by our AI from our own data only (probabilities, expected goals, form, standings). Probabilities, not certainty. 18+."}</p>
</div></section>${await alsoBlock(lang, slug)}`;
    const ld = [
      { "@context": "https://schema.org", "@type": "NewsArticle", headline: title, description: desc, image: `https://txvrlvcxfnylnrpdrxtt.supabase.co/functions/v1/afp-og?n=${p.n}`, datePublished: pub, dateModified: new Date().toISOString(), inLanguage: lang, mainEntityOfPage: url, author: { "@type": "Organization", name: "AI Football Predictor" }, publisher: { "@type": "Organization", name: "AI Football Predictor" } },
      { "@context": "https://schema.org", "@type": "SportsEvent", name: `${p.home} - ${p.away}`, startDate: p.kickoff, sport: "Football", homeTeam: { "@type": "SportsTeam", name: p.home }, awayTeam: { "@type": "SportsTeam", name: p.away }, ...(md.venue ? { location: { "@type": "Place", name: md.venue } } : {}) },
      crumbLd(fr, `${p.home} - ${p.away}`, url),
    ];
    await put(`ai-football-predictor/${fr ? "fr/" : ""}blog/${slug}/index.html`, page({ lang, url, alt, title: (fr ? `Pronostic ${p.home} - ${p.away}, ${longDate(day, lang)} : ` : `${p.home} vs ${p.away} prediction, ${longDate(day, lang)}: `) + title, desc, body, ld, img: `https://txvrlvcxfnylnrpdrxtt.supabase.co/functions/v1/afp-og?n=${p.n}` }), `blog: match ${lang} ${p.home} - ${p.away}`);
    await sb("afp_blog?on_conflict=slug,lang", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ slug, lang, kind: "match", title, descr: desc, published_at: pub, updated_at: new Date().toISOString(), data: { n: p.n, a: A, ko: p.kickoff } }) });
  }
  return true;
}

// ---------- ready-made articles for other sites (8 nov 2026, Jeremy: "des articles tout faits", then "un widget affiche les différents articles et c'est gratuit") ----------
// No copy-paste HTML, RSS or JSON (the link to our site could be removed): other sites get a free "articles" widget (iframe, our link
// inside it cannot be removed) that lists the match previews and opens each one. widget/articles/ (EN + FR) gives the code and a live preview.
// The old public feed.xml and data/articles-*.json files are replaced by an empty stub.
async function articlesKit() {
  for (const lang of ["en", "fr"]) {
    const fr = lang === "fr";
    await put(`ai-football-predictor/${fr ? "fr/" : ""}feed.xml`, await (async () => {
      /* 8 nov 2026 (Jeremy, "oui"): short RSS feed: title, one-sentence summary, image and link only; the full text stays on our site (and in the future API) */
      const its = (await sb(`afp_blog?kind=eq.match&lang=eq.${lang}&order=published_at.desc&limit=20&select=slug,title,descr,published_at,data`)) || [];
      const short = (s: string) => { s = String(s || ""); return s.length > 140 ? s.slice(0, 138).replace(/[\s,;:]+\S*$/, "") + "…" : s; };
      const home = `${SITE}${fr ? "fr/" : ""}`, self = `${home}feed.xml`;
      const items = its.map((x: any) => { const u = mUrl(fr, x.slug), img = `https://txvrlvcxfnylnrpdrxtt.supabase.co/functions/v1/afp-og?n=${x.data?.n}`; return `<item><title>${esc(x.title)}</title><link>${u}</link><guid isPermaLink="true">${u}</guid><pubDate>${new Date(x.published_at).toUTCString()}</pubDate><description>${esc(short(x.descr))}</description><media:content url="${esc(img)}" medium="image" type="image/png" width="1200" height="630"/></item>`; }).join("\n");
      return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>${fr ? "AI Football Predictor - avant-matchs" : "AI Football Predictor - match previews"}</title><link>${home}blog/</link><atom:link href="${self}" rel="self" type="application/rss+xml"/><description>${fr ? "Les avant-matchs des gros matchs vus par notre modèle : probabilités, buts attendus et score le plus probable." : "Big-match previews as seen by our model: probabilities, expected goals and most likely score."}</description><language>${fr ? "fr-fr" : "en-gb"}</language><lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n${items}\n</channel></rss>`;
    })(), `articles: rss ${lang}`);
    await put(`ai-football-predictor/data/articles-${lang}.json`, JSON.stringify({ source: "AI Football Predictor", info: fr ? "Nos articles s'affichent avec le widget gratuit" : "Our articles are shown with the free widget", url: `${SITE}${fr ? "fr/" : ""}widget/articles/` }), `articles: json stub ${lang}`);
    const url = `${SITE}${fr ? "fr/widget/articles/" : "widget/articles/"}`, alt = `${SITE}${fr ? "widget/articles/" : "fr/widget/articles/"}`;
    const title = fr ? "Widget gratuit d'articles foot : avant-matchs avec pronostic sur ton site" : "Free football articles widget: match previews with prediction on your site";
    const desc = fr ? "Un widget gratuit qui affiche sur ton site nos avant-matchs écrits par notre IA, avec le pronostic du modèle, mis à jour tout seul chaque jour." : "A free widget that shows our AI-written match previews on your site, with the model's prediction, updated automatically every day.";
    const snippet = `<div class="afp-widget" data-type="articles" data-lang="${lang}" data-n="6"><a href="${SITE}${fr ? "fr/" : ""}">${fr ? "Avant-matchs par AI Football Predictor" : "Match previews by AI Football Predictor"}</a></div>\n<script src="${SITE}embed.js" async></script>`;
    const body = `<style>.steps3{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--line);background:var(--panel);margin:18px 0 22px}.steps3 div{padding:16px;border-right:1px solid var(--line)}.steps3 div:last-child{border-right:0}.steps3 b{display:block;margin-bottom:4px}.steps3 span{font-size:14px;color:var(--mut)}.wcode{width:100%;background:#0b1118;border:1px solid #1d2733;color:#cfe;font:12.5px/1.5 var(--mono);padding:12px;resize:vertical}.wprev{border:1px solid var(--line);background:var(--panel);padding:14px;margin-top:10px}@media(max-width:700px){.steps3{grid-template-columns:1fr}.steps3 div{border-right:0;border-bottom:1px solid var(--line)}}</style>
<section class="ahero"><div class="w art"><nav class="crumb"><a href="${SITE}${fr ? "fr/" : ""}">${fr ? "Accueil" : "Home"}</a> / <a href="${SITE}${fr ? "fr/widget/" : "widget/"}">Widget</a> / Articles</nav>
<span class="tag"><span class="dot"></span>${fr ? "Gratuit · mis à jour chaque jour" : "Free · updated every day"}</span><h1>${fr ? "Nos articles foot sur ton site, gratuitement" : "Our football articles on your site, for free"}</h1><p class="lede">${esc(desc)}</p></div></section>
<section style="padding-top:10px"><div class="w art">
<div class="steps3"><div><b>📰 ${fr ? "Avant-matchs du jour" : "Today's match previews"}</b><span>${fr ? "Titre et résumé des gros matchs des 40 prochaines heures, avec le pronostic du modèle." : "The big matches of the next 40 hours, with the model's prediction."}</span></div><div><b>⚡ ${fr ? "Toujours à jour" : "Always up to date"}</b><span>${fr ? "Les nouveaux articles et les résultats s'affichent tout seuls." : "New articles and results show up automatically."}</span></div><div><b>🧩 ${fr ? "2 lignes de code" : "2 lines of code"}</b><span>${fr ? "Colle le code dans WordPress, Blogger ou ton site, c'est tout." : "Paste the code into WordPress, Blogger or your site, that's it."}</span></div></div>
<div class="sec">${fr ? "le code à coller" : "the code to paste"}</div>
<textarea class="wcode" id="wc" readonly rows="4">${esc(snippet)}</textarea>
<button class="btn sm" onclick="var t=document.getElementById('wc');t.select();try{navigator.clipboard.writeText(t.value)}catch(e){document.execCommand('copy')}this.textContent='✅ ${fr ? "Copié" : "Copied"}'">📋 ${fr ? "Copier le code" : "Copy the code"}</button>
<p class="mut" style="font-size:13px;margin:10px 0 0">${fr ? "Options : data-lang=\"fr\" ou \"en\", data-n = nombre d'articles (1 à 12), data-theme=\"light\" pour un fond clair." : "Options: data-lang=\"en\" or \"fr\", data-n = number of articles (1 to 12), data-theme=\"light\" for a light background."}</p>
<div class="tbox" style="margin-top:18px">🖱️ ${fr ? "Un clic sur un article ouvre l'article complet sur notre site." : "A click on an article opens the full article on our site."} ${fr ? "Les articles complets à publier directement chez toi arriveront avec notre" : "Full articles to publish directly on your site will come with our"} <a href="${SITE}${fr ? "fr/api/" : "api/"}">API</a>.</div>
<div class="sec" style="margin-top:26px">${fr ? "aperçu en direct" : "live preview"}</div>
<div class="wprev">${snippet}</div>
<p class="mut" style="font-size:13px;margin-top:18px">${fr ? "Probabilités statistiques, pas des certitudes ni un conseil de pari. 18+." : "Statistical probabilities, not certainty nor betting advice. 18+."}</p>
</div></section>`;
    const ld = [{ "@context": "https://schema.org", "@type": "WebPage", name: title, url, inLanguage: lang }];
    await put(`ai-football-predictor/${fr ? "fr/widget/articles/" : "widget/articles/"}index.html`, page({ lang, url, alt, title, desc, body, ld, type: "website" }), `articles: widget ${lang}`);
  }
}

// ---------- Bluesky @aifootpredictor.com (8 nov 2026, Jeremy: "les gens peuvent nous suivre sur Bluesky") ----------
// Free AT Protocol API, app password in BSKY_HANDLE / BSKY_APP_PASSWORD (afp-blog variables). English posts with a link card:
//   morning run: the AI recap of yesterday (daily page) + the big match of the day (match preview article, image afp-og).
// Each post is sent once (key in afp_tdata "bsky:<key>"). Off until afp_config bsky_on = true; GET /run?m=bsky&k=... (dry) stores
// the posts it would send in afp_tdata "bsky:preview" so Jeremy can check them first.
const BSKY = "https://bsky.social/xrpc/";
async function bskyLogin() {
  const id = Bun.env.BSKY_HANDLE || "", pw = Bun.env.BSKY_APP_PASSWORD || "";
  if (!id || !pw) return null;
  const r = await fetch(BSKY + "com.atproto.server.createSession", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: id, password: pw }) });
  const j: any = await r.json().catch(() => null);
  return j?.accessJwt ? { jwt: j.accessJwt as string, did: j.did as string } : (console.log("bsky login failed", r.status, JSON.stringify(j).slice(0, 200)), null);
}
async function bskyPost(s: { jwt: string; did: string }, p: { text: string; url: string; title: string; desc: string; img?: string }) {
  let thumb: any = undefined;
  if (p.img) {
    try {
      const ir = await fetch(p.img); if (ir.ok) {
        const b = new Uint8Array(await ir.arrayBuffer());
        if (b.length < 950000) { const u = await fetch(BSKY + "com.atproto.repo.uploadBlob", { method: "POST", headers: { Authorization: `Bearer ${s.jwt}`, "Content-Type": ir.headers.get("content-type") || "image/png" }, body: b }); const uj: any = await u.json(); thumb = uj?.blob; }
      }
    } catch (e) { console.log("bsky thumb error", String(e)); }
  }
  const enc = new TextEncoder(), facets: any[] = [];
  for (const m of p.text.matchAll(/#([A-Za-z0-9_]+)/g)) { const a = enc.encode(p.text.slice(0, m.index)).length; facets.push({ index: { byteStart: a, byteEnd: a + enc.encode(m[0]).length }, features: [{ $type: "app.bsky.richtext.facet#tag", tag: m[1] }] }); }
  const record: any = { $type: "app.bsky.feed.post", text: p.text, createdAt: new Date().toISOString(), langs: ["en"], facets,
    embed: { $type: "app.bsky.embed.external", external: { uri: p.url, title: p.title.slice(0, 300), description: p.desc.slice(0, 300), ...(thumb ? { thumb } : {}) } } };
  const r = await fetch(BSKY + "com.atproto.repo.createRecord", { method: "POST", headers: { Authorization: `Bearer ${s.jwt}`, "Content-Type": "application/json" }, body: JSON.stringify({ repo: s.did, collection: "app.bsky.feed.post", record }) });
  const j: any = await r.json().catch(() => null);
  return r.ok ? j?.uri : (console.log("bsky post failed", r.status, JSON.stringify(j).slice(0, 300)), null);
}
const BIG = ["CL", "EL", "ECL", "E0", "SP1", "I1", "D1", "F1", "P1", "N1"];
const TAG: Record<string, string> = { E0: "#PremierLeague", SP1: "#LaLiga", I1: "#SerieA", D1: "#Bundesliga", F1: "#Ligue1", P1: "#LigaPortugal", N1: "#Eredivisie", CL: "#UCL", EL: "#UEL", ECL: "#UECL", SC0: "#SPFL", T1: "#SuperLig" };
async function bskyBuild() {
  const out: any[] = [];
  const today = parisDay(), yday = parisDay(Date.now() - 86400000);
  // 1. AI recap of yesterday (daily page, re-rendered as a recap in the morning run)
  const d = (await sb(`afp_blog?slug=eq.football-predictions-${yday}&lang=eq.en&select=title,descr`))?.[0];
  if (d && /^AI recap/.test(d.title || "")) {
    const m = String(d.title).match(/(\d+) of (\d+)/);
    const txt = m ? `🤖 The AI recap for ${longDate(yday, "en").replace(/, \d{4}$/, "")}: ${m[1]} of the ${m[2]} most likely outcomes happened${Number(m[1]) === Number(m[2]) ? " ✅" : ""}.\n\nEvery probability is locked before kickoff and checked against the result, misses included.\n\n#football #FootballStats` : `🤖 ${d.title}\n\n#football #FootballStats`;
    out.push({ key: `recap:${yday}`, text: txt, url: `${SITE}blog/football-predictions-${yday}/?src=bsky`, title: d.title, desc: d.descr || "" });
  }
  // 2. big match of the day: highest win probability among today's previews in the big leagues
  const from = new Date(Date.parse(today + "T00:00:00+01:00") - 3600000).toISOString(), to = new Date(Date.parse(today + "T23:59:59+01:00") + 3600000).toISOString();
  const ps = ((await sb(`afp_predictions?kickoff=gte.${from}&kickoff=lte.${to}&ph=not.is.null&select=n,league,home,away,kickoff,ph,pd,pa&order=kickoff.asc&limit=500`)) || []).filter((p: any) => BIG.includes(p.league) && Date.parse(p.kickoff) > Date.now());
  const arts = new Set<string>(((await sb(`afp_blog?kind=eq.match&lang=eq.en&slug=like.prediction-*-${today}&select=slug`)) || []).map((x: any) => x.slug));
  const withArt = ps.filter((p: any) => arts.has(`prediction-${slugify(`${p.home} ${p.away}`)}-${today}`));
  const pool = withArt.length ? withArt : ps;
  const rank = (p: any) => BIG.indexOf(p.league) * 10 - Math.max(p.ph, p.pa) * 5;
  const pk = pool.sort((a: any, b: any) => rank(a) - rank(b))[0];
  if (pk) {
    const pc = (x: any) => Math.round(Number(x) * 100) + "%";
    const t = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(new Date(pk.kickoff));
    const slug = `prediction-${slugify(`${pk.home} ${pk.away}`)}-${today}`, hasArt = arts.has(slug);
    const lg = COMP[pk.league] || pk.league;
    out.push({ key: `match:${today}`, text: `⚽ ${pk.home} vs ${pk.away}, ${lg}, ${t} UK\n\nThe AI's probabilities:\n${pk.home} ${pc(pk.ph)} · Draw ${pc(pk.pd)} · ${pk.away} ${pc(pk.pa)}\n\n${TAG[pk.league] || ""} #football`.trim(),
      url: hasArt ? `${SITE}blog/${slug}/?src=bsky` : `${SITE}?tab=m${pk.n}&src=bsky`, title: hasArt ? `${pk.home} vs ${pk.away} prediction: the AI's view` : `${pk.home} vs ${pk.away}: win probabilities`,
      desc: `Win, draw and loss probabilities for ${pk.home} vs ${pk.away} (${lg}), checked against the real result after the match.`, img: `https://txvrlvcxfnylnrpdrxtt.supabase.co/functions/v1/afp-og?n=${pk.n}` });
  }
  return out;
}
async function bskyRun(dry: boolean) {
  const posts = await bskyBuild();
  if (dry) { await sb("afp_tdata?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: "bsky:preview", data: posts, updated_at: new Date().toISOString() }) }); console.log("bsky preview", posts.length); return; }
  const on = (await sb("afp_config?key=eq.bsky_on&select=value"))?.[0]?.value;
  if (on !== true && on !== "true") { console.log("bsky off"); return; }
  const s = await bskyLogin(); if (!s) return;
  for (const p of posts) {
    const k = `bsky:${p.key}`;
    if ((await sb(`afp_tdata?key=eq.${encodeURIComponent(k)}&select=key`))?.length) continue;
    const uri = await bskyPost(s, p);
    if (uri) await sb("afp_tdata?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: k, data: { uri, text: p.text }, updated_at: new Date().toISOString() }) });
    console.log("bsky posted", p.key, uri);
  }
}
export async function run(mode: string) {
  if (mode === "bsky") { await bskyRun(true); return; }
  if (mode === "bskypost") { await bskyRun(false); return; }
  // 8 nov 2026 (Jeremy): "fais un message sur le Channel et Bluesky avec toutes les nouveautés" (texts approved by Jeremy). One-off, sent once.
  // 8 nov 2026 (Jeremy): "fais un article sur le blog avec les nouveautés à chaque fois et c'est cet article que tu partages"
  if (mode === "weekly") { await loadCss(); await weekly(addDays(weekStart(parisDay()), -7)); await indexes(); console.log("blog run done weekly"); return; }
  if (mode === "guides") { await loadCss(); await rerenderGuides(); await indexes(); console.log("blog run done guides"); return; }
  if (mode === "announce4") {
    // 9 nov 2026 09:30 (Jeremy, "Je te fais confiance publie la"): weekly recap share, links to the blog article. Sent once.
    if ((await sb(`afp_tdata?key=eq.announce4:2026-11-09&select=key`))?.length) { console.log("announce4 already done"); return; }
    const art = `${SITE}blog/football-weekly-recap-2026-11-02/`;
    const chat = (await sb("afp_config?key=eq.channel_id&select=value"))?.[0]?.value || "@aifootballpredictorchannel";
    const text = "📊 <b>Weekly recap: 6 to 8 November</b>\n\n• The most likely outcome happened in 88 of 166 matches (53 %), vs 52 % announced\n• At 65 % or more: 25 of 27 happened\n• Our model alone vs the market: 54-54 on 99 matches\n• Biggest miss: Partizan at 74 %, lost 1-2 to Macva\n\nMisses included, every week. Full recap 👇";
    const r = await fetch(`https://api.telegram.org/bot${Bun.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: [[{ text: "📝 Read the weekly recap", url: art + "?src=channel" }], [{ text: "⚽ Open the app", url: "https://t.me/ai_football_predictorbot/app?startapp=src_channel" }]] } }) });
    const tj: any = await r.json().catch(() => null);
    console.log("announce4 telegram", tj?.ok, tj?.description || "", tj?.result?.message_id);
    let uri = null; const s = await bskyLogin();
    if (s) uri = await bskyPost(s, { text: "Our AI's first weekly recap ⚽🤖\nThe most likely outcome happened in 88 of 166 matches (53 %), vs 52 % announced. At 65 %+: 25 of 27. Model alone vs the market: 54-54. Biggest miss: Partizan at 74 %, lost 1-2 to Macva.", url: art + "?src=bsky", title: "Weekly recap: 53 % of the most likely outcomes happened", desc: "Announced vs happened, model vs market, surest calls and biggest misses, 6 to 8 November 2026.", img: `${SITE}icon-512.png` });
    console.log("announce4 bsky", uri);
    await sb("afp_tdata?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: "announce4:2026-11-09", data: { tg: tj?.ok || false, tg_err: tj?.description || null, msg: tj?.result?.message_id || null, bsky: uri }, updated_at: new Date().toISOString() }) });
    return;
  }
  
if (mode === "announce3") {
    // 9 nov 2026 09:00 (Jeremy, "oui demain matin vers 9h"): "Beat the model" update announcement, approved texts, links to the blog article. Sent once.
    if ((await sb(`afp_tdata?key=eq.announce3:2026-11-09&select=key`))?.length) { console.log("announce3 already done"); return; }
    const art = `${SITE}blog/beat-the-model-results-stats-weekly-challenge/`;
    const chat = (await sb("afp_config?key=eq.channel_id&select=value"))?.[0]?.value || "@aifootballpredictorchannel";
    const text = "📊 <b>Beat the model just got better</b>\n\n• Your result every day: your score, the model's score, and the matches where you beat it\n• Your stats by competition: where you beat the AI, and where it beats you\n• A weekly challenge: the leaderboard resets every Monday, top 3 announced\n• Sign in with Google on the website, with notifications in the web app\n\nFree, just for fun. Read what's new 👇";
    const r = await fetch(`https://api.telegram.org/bot${Bun.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: [[{ text: "📝 Read the article", url: art + "?src=channel" }]] } }) });
    const tj: any = await r.json().catch(() => null);
    console.log("announce3 telegram", tj?.ok, tj?.description || "", tj?.result?.message_id);
    let uri = null; const s = await bskyLogin();
    if (s) uri = await bskyPost(s, { text: "Beat the model got a big update ⚽🤖\nYour daily result vs our AI, your stats by competition, and a weekly challenge that resets every Monday. Free, in Telegram and on the web.", url: art + "?src=bsky", title: "Beat the model: daily results, your stats and a weekly challenge", desc: "Your daily result against the model, your stats by competition, a weekly challenge and notifications on Telegram and the web app.", img: `${SITE}icon-512.png` });
    console.log("announce3 bsky", uri);
    await sb("afp_tdata?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: "announce3:2026-11-09", data: { tg: tj?.ok || false, tg_err: tj?.description || null, msg: tj?.result?.message_id || null, bsky: uri }, updated_at: new Date().toISOString() }) });
    return;
  }
  if (mode === "announce2") {
    // 8 nov 2026 (Jeremy "oui vas-y"): Europa League + Conference League announcement, approved texts, links to the blog article
    if ((await sb(`afp_tdata?key=eq.announce2:2026-11-08&select=key`))?.length) { console.log("announce2 already done"); return; }
    const art = `${SITE}blog/europa-league-conference-league-probabilities/`;
    const chat = (await sb("afp_config?key=eq.channel_id&select=value"))?.[0]?.value || "@aifootballpredictorchannel";
    const text = "🏆 <b>Europa League and Conference League are in!</b>\n\nAI Football Predictor now gives the win, draw and loss probability of Europa League and Conference League matches, with the same cross-league model as the Champions League.\n\n📅 First probabilities on the next European matchday, right after the international break.";
    const r = await fetch(`https://api.telegram.org/bot${Bun.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: [[{ text: "📝 Read the article", url: art + "?src=channel" }], [{ text: "⚽ Open the app", url: "https://t.me/ai_football_predictorbot/app?startapp=src_channel" }]] } }) });
    const tj: any = await r.json().catch(() => null);
    console.log("announce2 telegram", tj?.ok, tj?.description || "", tj?.result?.message_id);
    let uri = null; const s = await bskyLogin();
    if (s) uri = await bskyPost(s, { text: "🏆 Europa League and Conference League are now covered on AI Football Predictor: win, draw and loss probabilities with our cross-league model, the same one we use for the Champions League.\n\nHow it works 👇\n#UEL #UECL #football", url: art + "?src=bsky", title: "Europa League and Conference League: win probabilities now covered", desc: "AI Football Predictor now gives the win, draw and loss probability of Europa League and Conference League matches, with the same cross-league model as the Champions League.", img: `${SITE}icon-512.png` });
    console.log("announce2 bsky", uri);
    await sb("afp_tdata?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: "announce2:2026-11-08", data: { tg: tj?.ok || false, tg_err: tj?.description || null, msg: tj?.result?.message_id || null, bsky: uri }, updated_at: new Date().toISOString() }) });
    return;
  }
  if (mode === "announce1b") {
    if ((await sb(`afp_tdata?key=eq.announce1b:2026-11-08&select=key`))?.length) { console.log("announce1b already done"); return; }
    await loadCss(); await rerenderGuides(); await indexes();
    const art = `${SITE}blog/whats-new-ai-live-player-pages/`;
    const chat = (await sb("afp_config?key=eq.channel_id&select=value"))?.[0]?.value || "@aifootballpredictorchannel";
    const r = await fetch(`https://api.telegram.org/bot${Bun.env.TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chat, message_id: 27, reply_markup: { inline_keyboard: [[{ text: "📝 Read the article", url: art + "?src=channel" }], [{ text: "⚽ Open the app", url: "https://t.me/ai_football_predictorbot/app?startapp=src_channel" }]] } }) });
    const tj: any = await r.json().catch(() => null);
    console.log("announce1b telegram", tj?.ok, tj?.description || "");
    let uri = null; const s = await bskyLogin();
    if (s) {
      await fetch(BSKY + "com.atproto.repo.deleteRecord", { method: "POST", headers: { Authorization: `Bearer ${s.jwt}`, "Content-Type": "application/json" }, body: JSON.stringify({ repo: s.did, collection: "app.bsky.feed.post", rkey: "3mztavwh3h32j" }) });
      uri = await bskyPost(s, { text: "🆕 New on AI Football Predictor:\n\n🤖 The AI live: win, draw and loss chances moving minute by minute\n👤 Player pages with his chance to score next match\n📝 Full match timeline, cards and subs included\n🏆 Follow a whole league\n\nAll free 👇 #football #FootballStats", url: art + "?src=bsky", title: "What's new: the AI live, player pages and full match timelines", desc: "The AI's win, draw and loss chances now move live during matches. Plus player pages, full match timelines, league alerts and a daily AI recap.", img: `${SITE}icon-512.png` });
    }
    console.log("announce1b bsky", uri);
    await sb("afp_tdata?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: "announce1b:2026-11-08", data: { tg: tj?.ok || false, tg_err: tj?.description || null, bsky: uri }, updated_at: new Date().toISOString() }) });
    return;
  }
  if (mode === "announce1") {
    if ((await sb(`afp_tdata?key=eq.announce:2026-11-08&select=key`))?.length) { console.log("announce already sent"); return; }
    const chat = (await sb("afp_config?key=eq.channel_id&select=value"))?.[0]?.value || "@aifootballpredictorchannel";
    const text = "🆕 <b>What's new on AI Football Predictor</b>\n\n🤖 <b>The AI, live</b>: watch the win, draw and loss chances move minute by minute during the match. Goals and red cards included, with the full curve after the final whistle.\n\n👤 <b>Player pages</b>: season stats and the AI's chance he scores in his next match. Tap any scorer to open one.\n\n📝 <b>Full match timeline</b>: goals with assists, yellow and red cards, substitutions, VAR.\n\n🏆 <b>Follow a whole league</b>: one tap and you get alerts for every match (kickoff, goals, half time, full time).\n\n📊 <b>Daily AI recap</b>: what the AI saw, and what really happened, misses included.\n\n🌐 <b>New website</b>: aifootpredictor.com, with team and player pages, predicted league tables and free widgets for your own site.";
    const r = await fetch(`https://api.telegram.org/bot${Bun.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: [[{ text: "⚽ Open the app", url: "https://t.me/ai_football_predictorbot/app?startapp=src_channel" }]] } }) });
    const tj: any = await r.json().catch(() => null);
    console.log("announce telegram", tj?.ok, tj?.description || tj?.result?.message_id);
    let uri = null; const s = await bskyLogin();
    if (s) uri = await bskyPost(s, { text: "🆕 New on AI Football Predictor:\n\n🤖 The AI live: win, draw and loss chances moving minute by minute\n👤 Player pages with his chance to score next match\n📝 Full match timeline, cards and subs included\n🏆 Follow a whole league\n\nAll free 👇 #football #FootballStats", url: `${SITE}?src=bsky`, title: "AI Football Predictor: the probability of every football match", desc: "Win, draw and loss probabilities for every football match, the AI live during matches, player and team pages. Free.", img: `${SITE}icon-512.png` });
    console.log("announce bsky", uri);
    await sb("afp_tdata?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: "announce:2026-11-08", data: { tg: tj?.ok || false, tg_err: tj?.description || null, bsky: uri }, updated_at: new Date().toISOString() }) });
    return;
  }
  if (mode === "bskyhello") {
    const s = await bskyLogin(); if (!s) return;
    if ((await sb(`afp_tdata?key=eq.bsky:hello&select=key`))?.length) { console.log("bsky hello already posted"); return; }
    const uri = await bskyPost(s, { text: "👋 Hello Bluesky! We're AI Football Predictor.\n\nEvery day, the win, draw and loss probability of every football match in 25+ competitions, locked before kickoff and checked against the real result. Misses included.\n\nFollow for the big match of the day and the daily AI recap. #football #FootballStats", url: `${SITE}?src=bsky`, title: "AI Football Predictor: the probability of every football match", desc: "Win, draw and loss probabilities for every football match, checked against real results. Predicted league tables, team pages and live scores. Free.", img: `${SITE}icon-512.png` });
    if (uri) await sb("afp_tdata?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: "bsky:hello", data: { uri }, updated_at: new Date().toISOString() }) });
    console.log("bsky hello", uri); return;
  }
  await loadCss(); if (!SITE_CSS) { console.log("no site css, abort"); return; }
  if (mode === "apipage") { await apiPages(); console.log("blog run done apipage"); return; }
  if (mode === "players") { await players(true); await teams(true); await indexes(); console.log("blog run done players"); return; }
  const today = parisDay(), yesterday = parisDay(Date.now() - 86400000);
  if (mode === "all") { await daily(yesterday); await daily(today); await rerenderGuides(); } else if (mode === "am") { await daily(yesterday); await daily(today); await guide(); if (new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short" }).format(new Date()) === "Mon") { try { await weekly(addDays(weekStart(today), -7)); } catch (e) { console.log("weekly error", String(e)); } } } else { await daily(today); }
  await method();
  try { await tables(); } catch (e) { console.log("tables error", String(e)); }
  try { await players(mode !== "pm"); } catch (e) { console.log("players error", String(e)); }
  try { await teams(mode !== "pm"); } catch (e) { console.log("teams error", String(e)); }
  try { await widgetPages(); } catch (e) { console.log("widget pages error", String(e)); }
  try { await exportCsv(); } catch (e) { console.log("csv error", String(e)); }
  try { await apiPages(); } catch (e) { console.log("api page error", String(e)); }
  try { await matchPreviews(); } catch (e) { console.log("match previews error", String(e)); }
  try { await articlesKit(); } catch (e) { console.log("articles kit error", String(e)); }
  await indexes();
  if (mode === "am") { try { await bskyRun(false); } catch (e) { console.log("bsky error", String(e)); } }
  console.log("blog run done", today, mode);
}

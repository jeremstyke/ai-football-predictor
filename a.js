/* 10 nov 2026 (Jeremy, "il faudrait qu'Infolinks soit chargé quand même"): Infolinks loads after either choice; without consent it serves contextual ads only (its own EEA default). Cookie consent for the ads (Google AdSense, Infolinks). The audience stats below use no cookies. The choice is kept 6 months. A "Cookies" link in the footer reopens it. */
(function () {
  try {
    var fr = (document.documentElement.lang || "").slice(0, 2) === "fr", K = "afp_consent", c = null, il = 0;
    try { var v = JSON.parse(localStorage.getItem(K) || "null"); if (v && v.t && Date.now() - v.t < 15552000000) c = v.v; } catch (e) {}
    var A = window.adsbygoogle = window.adsbygoogle || [];
    function apply(v) {
      try { A.requestNonPersonalizedAds = v === "yes" ? 0 : 1; A.pauseAdRequests = 0; } catch (e) {}
      if (!il && window.infolinks_pid) { il = 1; var s = document.createElement("script"); s.src = "https://resources.infolinks.com/js/infolinks_main.js"; s.async = true; document.body.appendChild(s); }
    }
    function hide() { var b = document.getElementById("afpck"); if (b) b.parentNode.removeChild(b); }
    function show() {
      hide();
      var b = document.createElement("div"); b.id = "afpck"; b.setAttribute("role", "dialog"); b.setAttribute("aria-label", "Cookies");
      var pv = "https://aifootpredictor.com/" + (fr ? "fr/confidentialite/" : "privacy/");
      b.innerHTML = '<style>#afpck{position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483646;max-width:640px;margin:0 auto;background:#0c121b;color:#e6edf5;border:1px solid #243246;border-radius:14px;padding:16px 18px;font:14px/1.5 Inter,system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.5)}#afpck p{margin:0 0 12px}#afpck a{color:#7cc4ff}#afpck .r{display:flex;gap:10px;flex-wrap:wrap}#afpck button{flex:1;min-width:130px;cursor:pointer;font:600 14px Inter,system-ui,sans-serif;padding:10px 14px;border-radius:10px;border:1px solid #3a4d66;background:#162131;color:#e6edf5}#afpck button:hover,#afpck button:focus-visible{background:#22324a;outline:2px solid #7cc4ff;outline-offset:1px}</style>'
        + '<p>' + (fr
          ? 'Ce site est financé par la publicité (Google AdSense, Infolinks). Acceptez-vous les cookies publicitaires pour des annonces personnalisées ? Si vous refusez, vous verrez seulement des annonces non personnalisées. Nos statistiques de visite n\'utilisent aucun cookie. <a href="' + pv + '">En savoir plus</a>'
          : 'This site is funded by ads (Google AdSense, Infolinks). Do you accept advertising cookies for personalised ads? If you refuse, you will only see non-personalised ads. Our visit statistics use no cookies. <a href="' + pv + '">Learn more</a>')
        + '</p><div class="r"><button type="button" data-v="no">' + (fr ? "Tout refuser" : "Refuse all") + '</button><button type="button" data-v="yes">' + (fr ? "Tout accepter" : "Accept all") + '</button></div>';
      b.addEventListener("click", function (e) {
        var v = e.target && e.target.getAttribute ? e.target.getAttribute("data-v") : null; if (!v) return;
        try { localStorage.setItem(K, JSON.stringify({ v: v, t: Date.now() })); } catch (x) {}
        hide();
        if (c && c !== v) { location.reload(); return; }
        c = v; apply(v);
      });
      document.body.appendChild(b);
    }
    window.afpCookies = show;
    function foot() {
      var f = document.querySelector("footer span:last-child"); if (!f || document.getElementById("afpckl")) return;
      if (!document.querySelector('footer a[href*="mentions-legales"],footer a[href*="legal-notice"]')) { var m = document.createElement("a"); m.href = "https://aifootpredictor.com/" + (fr ? "fr/mentions-legales/" : "legal-notice/"); m.textContent = fr ? "Mentions légales" : "Legal notice"; f.appendChild(document.createTextNode(" · ")); f.appendChild(m); }
      var a = document.createElement("a"); a.href = "#"; a.id = "afpckl"; a.textContent = "Cookies"; a.onclick = function (e) { e.preventDefault(); show(); };
      f.appendChild(document.createTextNode(" · ")); f.appendChild(a);
    }
    function init() { try { foot(); } catch (e) {} if (c) apply(c); else show(); }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  } catch (e) {}
})();
/* AI Football Predictor - anonymous audience measurement, no cookies, no storage */
(function () {
  try {
    if (navigator.webdriver || /bot|crawl|spider|headless/i.test(navigator.userAgent)) return;
    /* 10 nov 2026 (Jeremy): the owner's devices are not counted. Open any page once with ?nostat=1 on a device to stop counting it (?nostat=0 to count it again) */
    try { var q0 = new URLSearchParams(location.search).get("nostat"); if (q0 === "1") localStorage.setItem("afp_nostat", "1"); if (q0 === "0") localStorage.removeItem("afp_nostat"); if (localStorage.getItem("afp_nostat") === "1") return; } catch (e) {}
    var E = "https://afp-blog-production.up.railway.app/api/hit", t0 = Date.now(), mx = 0, sent = 0;
    var id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6), q = new URLSearchParams(location.search);
    function s(o) { o.id = id; var b = JSON.stringify(o); try { if (!navigator.sendBeacon || !navigator.sendBeacon(E, b)) fetch(E, { method: "POST", body: b, keepalive: true, mode: "no-cors" }); } catch (e) {} }
    function depth() { var h = document.documentElement, d = (h.scrollTop || document.body.scrollTop || 0) + innerHeight, t = Math.max(h.scrollHeight, document.body.scrollHeight || 0) || 1; if (d / t > mx) mx = d / t; }
    var tz = ""; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    s({ k: "pv", p: location.pathname, r: document.referrer, src: q.get("src") || q.get("utm_source") || q.get("ref") || "", l: navigator.language || "", tz: tz, w: screen.width, t: (document.title || "").slice(0, 150) });
    depth(); addEventListener("scroll", depth, { passive: true });
    function end() { if (sent) return; sent = 1; depth(); s({ k: "end", ms: Date.now() - t0, sc: Math.round(Math.min(1, mx) * 100) }); }
    addEventListener("pagehide", end);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") end(); });
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a") : null; if (!a || !a.href) return;
      var u; try { u = new URL(a.href, location.href); } catch (x) { return; }
      if (u.host && u.host !== location.host) s({ k: "out", p: location.pathname, to: (u.host.replace(/^www\./, "") + u.pathname).slice(0, 110) });
    }, true);
  } catch (e) {}
})();

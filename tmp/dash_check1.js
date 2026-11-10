
var K=new URLSearchParams(location.search).get("k")||"",D=null,P="today";
var SRC={direct:"Accès direct",google:"Google",bing:"Bing",search:"Autres moteurs",bluesky:"Bluesky",telegram:"Telegram",x:"X / Twitter",meta:"Facebook / Instagram",reddit:"Reddit",ai:"IA (ChatGPT, Perplexity...)",github:"GitHub",social:"Autres réseaux",site:"Autres sites",internal:"Navigation interne"};
var SEC={home:"Accueil",blog:"Accueil du blog",article:"Articles du blog",tables:"Classements",teams:"Équipes",players:"Joueurs",widgets:"Widgets",method:"Méthode",api:"API",other:"Autres"};
var DEV={mobile:"Mobile",desktop:"Ordinateur",tablet:"Tablette"};
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function fmt(n){return n==null?"-":Number(n).toLocaleString("fr-FR")}
function dur(s){if(s==null)return"-";s=Math.round(s);return s<60?s+" s":Math.floor(s/60)+" min "+String(s%60).padStart(2,"0")}
function flag(c){return /^[A-Z]{2}$/.test(c)?String.fromCodePoint.apply(null,c.split("").map(function(x){return 127397+x.charCodeAt(0)})):"🌐"}
function list(id,rows,label,val,cols){var el=document.getElementById(id);if(!rows||!rows.length){el.innerHTML='<div class="empty">Pas encore de données</div>';return}
 var mx=Math.max.apply(null,rows.map(val))||1,h='<table><tr><th>'+(cols&&cols[0]||"")+'</th><th class="n">'+(cols&&cols[1]||"Visiteurs")+'</th>'+(cols&&cols[2]?'<th class="n">'+cols[2]+'</th>':"")+'</tr>';
 rows.forEach(function(r){h+='<tr><td class="bar"><em style="width:'+(100*val(r)/mx).toFixed(1)+'%"></em><span>'+label(r)+'</span></td><td class="n">'+fmt(val(r))+'</td>'+(cols&&cols[3]?'<td class="n">'+cols[3](r)+'</td>':"")+'</tr>'});el.innerHTML=h+'</table>'}
function link(p){return '<a href="https://aifootpredictor.com'+esc(p)+'" target="_blank" rel="noopener">'+esc(p)+'</a>'}
function bars(id,data,a,b,lab){var s=document.getElementById(id),W=s.clientWidth||600,H=190,pad=24,n=data.length,mx=Math.max(1,Math.max.apply(null,data.map(function(d){return Math.max(d[a],d[b]||0)})));
 var bw=(W-pad)/n,h='';for(var i=0;i<=4;i++){var y=8+(H-30)*i/4;h+='<line x1="'+pad+'" x2="'+W+'" y1="'+y+'" y2="'+y+'" stroke="#1f2e47"/><text x="0" y="'+(y+4)+'" fill="#8496b0" font-size="10">'+Math.round(mx*(1-i/4))+'</text>'}
 data.forEach(function(d,i){var x=pad+i*bw,hh=(H-30)*d[a]/mx;h+='<rect x="'+(x+bw*.15)+'" y="'+(H-22-hh)+'" width="'+(bw*.7)+'" height="'+hh+'" rx="2" fill="#4aa3ff" opacity=".85"><title>'+lab(d)+' : '+d[a]+'</title></rect>';
  if(n<=24||i%3==0)h+='<text x="'+(x+bw/2)+'" y="'+(H-6)+'" fill="#8496b0" font-size="10" text-anchor="middle">'+lab(d)+'</text>'});
 var pts=data.map(function(d,i){return (pad+i*bw+bw/2)+","+(H-22-(H-30)*(d[b]||0)/mx)}).join(" ");h+='<polyline points="'+pts+'" fill="none" stroke="'+(b=="uv"?"#2fd08a":"#ffb547")+'" stroke-width="2.2"/>';
 data.forEach(function(d,i){h+='<circle cx="'+(pad+i*bw+bw/2)+'" cy="'+(H-22-(H-30)*(d[b]||0)/mx)+'" r="2.4" fill="'+(b=="uv"?"#2fd08a":"#ffb547")+'"><title>'+lab(d)+' : '+(d[b]||0)+'</title></circle>'});
 s.setAttribute("viewBox","0 0 "+W+" "+H);s.innerHTML=h}
function kpis(){var k=(D.kpi||{})[P]||{},ref=P=="today"?(D.kpi||{}).yesterday:null;
 function cmp(a,b){if(!ref||b==null||!b)return"";var d=Math.round(100*(a-b)/b);return '<i class="'+(d>=0?"up":"dn")+'">'+(d>=0?"+":"")+d+' %</i>'}
 var it=[["Visiteurs",fmt(k.uv)+cmp(k.uv||0,ref&&ref.uv)],["Pages vues",fmt(k.pv)+cmp(k.pv||0,ref&&ref.pv)],["Pages par visiteur",k.ppv==null?"-":String(k.ppv).replace(".",",")],["Temps moyen par page",dur(k.ms)],["Défilement moyen",k.scroll==null?"-":k.scroll+" %"],["Partis après 1 page",k.bounce==null?"-":k.bounce+" %"]];
 if(P=="today")it.push(["Clics vers d'autres sites",fmt(D.outs_today)]);
 document.getElementById("kpis").innerHTML=it.map(function(x){return '<div class="k"><span>'+x[0]+'</span><b>'+x[1]+'</b></div>'}).join("")}
function render(){if(!D)return;document.getElementById("live").textContent=D.live||0;kpis();
 bars("days",D.days||[],"pv","uv",function(d){return d.d});bars("hours",D.hours||[],"pv","pv7",function(d){return d.h+"h"});
 list("livepages",D.live_pages,function(r){return link(r.p)},function(r){return r.n},["Page","Visiteurs"]);
 list("depth",(D.depth||[]).map(function(r){return{k:r.k,c:r.c}}),function(r){return r.k>=5?"5 pages ou plus":r.k+" page"+(r.k>1?"s":"")},function(r){return r.c},["","Visiteurs"]);
 list("sources",D.sources,function(r){return esc(SRC[r.k]||r.k)},function(r){return r.uv},["Source","Visiteurs","Pages",function(r){return fmt(r.pv)}]);
 list("refs",D.refs,function(r){return esc(r.k)},function(r){return r.uv},["Site"]);
 list("landing",D.landing,function(r){return link(r.p)},function(r){return r.n},["Page","Entrées","Moteurs",function(r){return fmt(r.seo)}]);
 list("seo",D.seo_pages,function(r){return link(r.p)},function(r){return r.n},["Page","Entrées"]);
 list("pages",D.pages,function(r){return link(r.p)+(r.t?'<div class="mut">'+esc(r.t)+'</div>':"")},function(r){return r.pv},["Page","Vues","Visiteurs · temps · défilement",function(r){return fmt(r.uv)+" · "+dur(r.s)+" · "+(r.sc==null?"-":r.sc+" %")}]);
 list("sections",D.sections,function(r){return esc(SEC[r.k]||r.k)},function(r){return r.pv},["Rubrique","Vues","Visiteurs · temps",function(r){return fmt(r.uv)+" · "+dur(r.s)}]);
 list("outs",D.outs,function(r){return esc(r.k)},function(r){return r.n},["Lien","Clics","Visiteurs",function(r){return fmt(r.uv)}]);
 list("country",D.country,function(r){return flag(r.k)+" "+esc(r.k)},function(r){return r.uv},["Pays"]);
 list("blang",D.blang,function(r){return esc(r.k||"?")},function(r){return r.uv},["Langue"]);
 list("lang",D.lang,function(r){return r.k=="fr"?"🇫🇷 Français":"🇬🇧 Anglais"},function(r){return r.uv},["Version"]);
 list("dev",D.dev,function(r){return esc(DEV[r.k]||r.k)},function(r){return r.uv},["Appareil"]);
 list("os",D.os,function(r){return esc(r.k)},function(r){return r.uv},["Système"]);
 list("br",D.br,function(r){return esc(r.k)},function(r){return r.uv},["Navigateur"]);
 list("screens",D.screens,function(r){return esc(r.k)},function(r){return r.uv},["Largeur"]);
 list("tz",D.tz,function(r){return esc(r.k)},function(r){return r.uv},["Fuseau"]);
 list("srcs",D.srcs,function(r){return esc(r.k)},function(r){return r.uv},["Source"]);
 seo();
 var t=D.total||{};document.getElementById("foot").textContent="Mis à jour à "+new Date(D.gen).toLocaleTimeString("fr-FR")+" · "+fmt(t.pv)+" pages vues depuis le "+(t.since?new Date(t.since).toLocaleDateString("fr-FR"):"-")+" · sans cookies, robots et vos appareils exclus · actualisation toutes les 30 s"}
function seo(){var S=D.seo||{},el=document.getElementById("seok");
 var ev=(S.d7prev?Math.round(100*((S.d7||0)-S.d7prev)/S.d7prev):null);
 var it=[["Aujourd'hui",fmt(S.today)+(S.yesterday!=null?'<i class="mut"> hier '+fmt(S.yesterday)+'</i>':"")],["7 derniers jours",fmt(S.d7)+(ev==null?"":'<i class="'+(ev>=0?"up":"dn")+'">'+(ev>=0?"+":"")+ev+' %</i>')],["30 derniers jours",fmt(S.d30)],["Part des visiteurs (7 j)",S.share7==null?"-":S.share7+" %"]];
 el.innerHTML=it.map(function(x){return '<div class="k"><span>'+x[0]+'</span><b>'+x[1]+'</b></div>'}).join("");
 var s=document.getElementById("seow"),W=s.clientWidth||600,H=190,pad=24,data=S.weeks||[],n=data.length||1,C=[["google","#4aa3ff"],["bing","#2fd08a"],["other","#ffb547"],["ai","#b38cff"]];
 var mx=Math.max(1,Math.max.apply(null,data.map(function(d){return C.reduce(function(a,c){return a+(d[c[0]]||0)},0)}))),bw=(W-pad)/Math.max(n,6),h="";
 for(var i=0;i<=4;i++){var y=8+(H-30)*i/4;h+='<line x1="'+pad+'" x2="'+W+'" y1="'+y+'" y2="'+y+'" stroke="#1f2e47"/><text x="0" y="'+(y+4)+'" fill="#8496b0" font-size="10">'+Math.round(mx*(1-i/4))+'</text>'}
 data.forEach(function(d,i){var x=pad+i*bw,base=H-22,tot=0;C.forEach(function(c){var v=d[c[0]]||0;if(!v)return;var hh=(H-30)*v/mx;base-=hh;tot+=v;h+='<rect x="'+(x+bw*.15)+'" y="'+base+'" width="'+(bw*.7)+'" height="'+hh+'" fill="'+c[1]+'"><title>Semaine du '+d.w+' : '+v+'</title></rect>'});
  h+='<text x="'+(x+bw/2)+'" y="'+(H-6)+'" fill="#8496b0" font-size="10" text-anchor="middle">sem. '+d.w+'</text>';if(tot)h+='<text x="'+(x+bw/2)+'" y="'+(base-4)+'" fill="#e6edf7" font-size="10" text-anchor="middle">'+tot+'</text>'});
 s.setAttribute("viewBox","0 0 "+W+" "+H);s.innerHTML=h;
 var NM={google:"Google",bing:"Bing",search:"Autres moteurs (Yahoo, DuckDuckGo, Qwant...)",ai:"IA (ChatGPT, Perplexity...)"};
 list("seoe",S.engines,function(r){return esc(NM[r.k]||r.k)},function(r){return r.uv30},["Moteur","Visiteurs 30 j","7 jours",function(r){return fmt(r.uv7)}])}
function load(){fetch("/api/site-stats?k="+encodeURIComponent(K)).then(function(r){return r.json()}).then(function(j){D=j;render()}).catch(function(){})}
document.querySelectorAll(".tabs button").forEach(function(b){b.onclick=function(){document.querySelectorAll(".tabs button").forEach(function(x){x.classList.toggle("on",x==b)});P=b.dataset.p;render()}});
addEventListener("resize",function(){clearTimeout(window.__r);window.__r=setTimeout(render,200)});
load();setInterval(load,30000);

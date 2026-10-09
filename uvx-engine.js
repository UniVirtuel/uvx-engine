/*! UniVirtuel — moteur d'interface pour MPskin Extend-HTML · v1.2.3
 *  © UniVirtuel. Chargé par une ligne dans l'Extend-HTML du skin, après la fiche client :
 *    <script>window.UVX_OPTIONS = { mode:'complet', introTitle:'…', charte:{couleur:'#…'}, contact:{…} };</script>
 *    <script src="https://cdn.jsdelivr.net/gh/<compte>/<dépôt>@v1.2.3/uvx-engine.js"></script>
 *  Le contenu vient des balises MPskin (catégorie « Contenus »). Console : UVX.version, UVX.destroy().
 */
(function () {
  var VERSION = '1.2.3';
  if (window.__UVX_BOOT) { console.warn('[UVX] moteur déjà chargé (v' + window.__UVX_BOOT + ')'); return; }
  window.__UVX_BOOT = VERSION;

  function ENGINE() {
(function () {
  if (window.UVX && window.UVX.destroy) window.UVX.destroy();
  var $ = window.jQuery;
  var LS = 'uvx-visited-' + location.pathname;

  /* ---------- 0. Données propres au skin (seule partie à éditer) ---------- */
  var OPTIONS = {
    intro: true,
    hotspotMax: 30,          // F5 : distance max (m) d'un point de déplacement
    hotspotMin: 8,           // F5 : en deçà, on considère qu'on y est déjà
    /* F15 : configurations par nom d'étape du menu (partie avant « - »).
       url = photo 360 équirectangulaire ; yawOffset = calage en degrés, réglé une fois par photo. */
    configs: {},           // rempli par les balises « Nom · 360 · Libellé »
    /* F16 : épisodes vidéo. step = nom de l'étape du menu où la visite se place pendant l'épisode. */
    episodes: null,          // null = épisodes de démonstration construits plus bas
    vertical: true,          // F16 : cadre 9:16
    /* F17 + F20 : champ de question. Pas d'IA : FAQ du lieu d'abord, puis noms d'espaces, sinon renvoi vers l'équipe. */
    askLabel: null,          // fiche client : « Une question sur le … ? » ; à défaut « Une question ? »
    faqSyn: null,            // synonymes propres au lieu : { famille: 'mot,autre mot' } — ajoutés au dictionnaire commun
    /* Photos d'aperçu du menu : en production, la photo jointe à la balise-fiche ; ici, repli par nom d'étape. */
    photos: {},
    /* F18 : vidéo d'accueil plein écran (MP4 léger, sans son, en boucle). null = intro floutée simple. */
    introVideo: null, introPoster: null,
    introTitle: null,                       // null = nom du projet MPskin
    introButton: 'Démarrer la visite',
    /* F20 ⭐ FAQ du lieu. En production : balises « FAQ · Thème » (catégorie Contenus). En maquette : texte injecté ici. */
    faq: null,
    faqSeuil: 0.5,          // couverture minimale de la question pour répondre ; en dessous, renvoi vers l'équipe
    /* Contact du renvoi commercial (fiche client). null = pas de bouton. */
    contact: null,          // { nom: "l'équipe commerciale", email: '…', tel: '…', libelle: 'Accueil du lundi au vendredi…' }
    /* Charte du client : UNE ou DEUX couleurs (exigence de Mickaël, 07/10/2026). Tout le reste est calculé.
       couleur = couleur principale (fonds du menu, des boutons, des fenêtres) ; accent = facultative (pastilles,
       boutons d'action, repères). police = facultative. Défaut : gris anthracite neutre (à remplacer par la fiche client). */
    charte: { couleur: '#2B2F36', accent: null, police: null },
    /* Mode (décision de Mickaël, 07/10/2026) : 'complet' = standard v1 (le menu natif est redessiné) ;
       'champ' = interface MPskin classique intacte + le seul champ de question (FAQ + renvoi), avec son œil. */
    mode: 'complet',
    /* Vue aérienne d'accueil (popup d'entrée MPskin « Images interactives ») : effets de survol façon Juumo.
       'auto' = actif si la popup d'entrée est une image interactive ; false = jamais. halo = couleur de l'anneau. */
    aerien: 'auto', aerienHalo: '#ffffff'
  };
  if (window.UVX_OPTIONS) Object.keys(window.UVX_OPTIONS).forEach(function (k) { OPTIONS[k] = window.UVX_OPTIONS[k]; });
  var MODULES = OPTIONS.mode === 'modules';   /* interface MPskin intacte : seuls les modules autonomes (vue aérienne) */
  var CHAMP = OPTIONS.mode === 'champ' || MODULES;


  /* ---------- 0 bis. Charte : une ou deux couleurs → toute la palette ----------
     Règles : le texte posé sur une couleur est blanc ou foncé selon le meilleur contraste (WCAG) ;
     une couleur utilisée comme TEXTE sur le fond du menu est éclaircie/foncée jusqu'à 4,5:1 ;
     la surface claire des fiches dérive de l'accent ; aucune teinte n'est écrite en dur ailleurs. */
  function uvxCharte(ch) {
    ch = ch || {};
    function hx(c) { c = String(c || '').trim().replace('#', ''); if (c.length === 3) c = c.replace(/./g, '$&$&');
      if (!/^[0-9a-f]{6}$/i.test(c)) return null; return [0, 2, 4].map(function (i) { return parseInt(c.substr(i, 2), 16); }); }
    function hex(r) { return '#' + r.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
    function mix(a, b, t) { return a.map(function (v, i) { return v + (b[i] - v) * t; }); }
    function lum(r) { var c = r.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
    function ctr(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
    var W = [255, 255, 255], K = [0, 0, 0];
    function onColor(bg) { var dark = mix(bg, K, 0.82); return ctr(W, bg) >= ctr(dark, bg) ? W : dark; }
    function readable(c, bg, min) {          /* pousse c vers le blanc ou le noir jusqu'au contraste voulu */
      if (ctr(c, bg) >= min) return c;
      var to = lum(bg) < 0.18 ? W : K;
      for (var t = 0.05; t <= 1.0001; t += 0.05) { var m = mix(c, to, t); if (ctr(m, bg) >= min) return m; }
      return to;
    }
    var warn = [];
    var P = hx(ch.couleur) || (warn.push('couleur absente ou illisible : gris neutre par défaut'), hx('#2B2F36'));
    var A = hx(ch.accent);
    var light = lum(P) > 0.4;                                  /* couleur principale claire → interface claire */
    if (!A) A = light ? mix(P, K, 0.55) : mix(P, W, 0.62);     /* une seule couleur : accent tiré de la principale */
    var fg = onColor(P);
    var deep = light ? mix(P, W, 0.25) : mix(P, K, 0.35);
    var accTx = readable(A, P, 4.5);
    var scene = lum(P) < 0.03 ? P : mix(P, K, light ? 0.82 : 0.55);   /* voiles posés sur la 3D et la vidéo : toujours sombres */
    var accScene = readable(A, scene, 4.5);
    var sheet = mix(A, W, 0.88);
    var onSheet = readable(lum(P) < 0.18 ? P : mix(P, K, 0.6), sheet, 7);
    var sheetMuted = readable(mix(A, K, 0.3), sheet, 4.5);
    var onAcc = ctr(P, A) >= 4.5 ? P : onColor(A);           /* la couleur principale sur l'accent si lisible */
    if (ctr(A, P) < 1.6) warn.push('accent trop proche de la couleur principale : boutons peu distincts');
    if (lum(A) > 0.75 && !light) warn.push('accent très clair : vérifier les pastilles');
    var sat = (function (r) { var mx = Math.max.apply(0, r), mn = Math.min.apply(0, r); return mx ? (mx - mn) / mx : 0; })(P);
    if (sat > 0.85 && lum(P) > 0.25) warn.push('couleur principale très saturée : la proposer en accent sur fond neutre ?');
    function rgb(r) { return r.map(Math.round).join(','); }
    var v = {
      '--uvx-panel': hex(P), '--uvx-panel-rgb': rgb(P), '--uvx-glass': 'rgba(' + rgb(P) + ',.80)',
      '--uvx-fg': hex(fg), '--uvx-fg-rgb': rgb(fg), '--uvx-deep-rgb': rgb(deep), '--uvx-scene-rgb': rgb(scene), '--uvx-accent-scene': hex(accScene),
      '--uvx-accent': hex(A), '--uvx-accent-rgb': rgb(A), '--uvx-accent-tx': hex(accTx), '--uvx-on-accent': hex(onAcc),
      '--uvx-sheet': hex(sheet), '--uvx-sheet-rgb': rgb(sheet), '--uvx-on-sheet': hex(onSheet), '--uvx-sheet-muted': hex(sheetMuted),
      '--uvx-font': ch.police ? ch.police + ',system-ui,sans-serif' : 'Roboto,system-ui,sans-serif'
    };
    var report = {
      theme: light ? 'clair' : 'sombre',
      contrastes: {
        'texte / fond du menu': +ctr(fg, P).toFixed(2), 'accent en texte / fond du menu': +ctr(accTx, P).toFixed(2),
        'texte / bouton accent': +ctr(onAcc, A).toFixed(2), 'blanc / voile de scène': +ctr(W, scene).toFixed(2), 'accent / voile de scène': +ctr(accScene, scene).toFixed(2), 'texte / fiche claire': +ctr(onSheet, sheet).toFixed(2),
        'surtitre / fiche claire': +ctr(sheetMuted, sheet).toFixed(2)
      },
      alertes: warn
    };
    report.ok = report.contrastes['texte / fond du menu'] >= 4.5 && report.contrastes['accent en texte / fond du menu'] >= 4.5 &&
      report.contrastes['texte / bouton accent'] >= 4.5 && report.contrastes['texte / fiche claire'] >= 4.5;
    return { vars: v, report: report,
      css: ':root{' + Object.keys(v).map(function (k) { return k + ':' + v[k]; }).join(';') + '}\n' };
  }
  var CHARTE = uvxCharte(OPTIONS.charte);

  /* ---------- 1. CSS ---------- */
  var css = `
/* couleurs : variables posées par uvxCharte() à partir de la fiche client */
body:not(.uvx-champ-on) .ui-wrap .nav-box{display:none!important}
body:not(.uvx-champ-on) .action-box.my-ui.bottom .cnt.reel-mpskin{display:none!important}
.logo-box{z-index:2!important}
#uvx{position:absolute;inset:0;pointer-events:none;z-index:900;font-family:var(--uvx-font);color:var(--uvx-fg)}
#uvx *{box-sizing:border-box}
#uvx button{font:inherit;color:inherit;border:0;cursor:pointer;pointer-events:auto}
#uvx .uvx-glass{background:var(--uvx-glass)!important;backdrop-filter:blur(14px) saturate(1.2);-webkit-backdrop-filter:blur(14px) saturate(1.2);border:1px solid rgba(var(--uvx-fg-rgb),.14)}
/* calque arrière : sous l'interface native, au-dessus du modèle */
#uvx-back{position:absolute;inset:0;z-index:1;pointer-events:none}
#uvx-back .uvx-vign{position:absolute;inset:0;backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);
 -webkit-mask:radial-gradient(ellipse 72% 70% at 50% 48%,transparent 62%,#000 100%);mask:radial-gradient(ellipse 72% 70% at 50% 48%,transparent 62%,#000 100%)}
#uvx-back .uvx-grad{position:absolute;left:0;bottom:0;width:55%;height:70%;background:radial-gradient(ellipse at 0% 85%,rgba(var(--uvx-scene-rgb),.8),rgba(var(--uvx-scene-rgb),.3) 45%,transparent 72%);transition:opacity .4s}
body.uvx-novign #uvx-back .uvx-vign{display:none}
body.uvx-bare #uvx-back .uvx-grad{opacity:0}
/* F1 / F2 */
.uvx-zones{position:absolute;top:16px;left:50%;transform:translateX(-50%);display:flex;gap:6px;pointer-events:auto}
/* v1.2.2 : barre trop large pour tenir entre le logo et les outils → elle descend sous le logo, sur plusieurs lignes si besoin */
#uvx .uvx-zones.low{top:var(--uvx-logo-b,70px);flex-wrap:wrap;justify-content:center;row-gap:6px;width:max-content;max-width:calc(100% - 40px)}
.uvx-zone{position:relative}
.uvx-pill{display:flex;align-items:center;gap:8px;height:34px;padding:0 12px;border-radius:999px;font-size:13px;white-space:nowrap}
.uvx-pill .dot{width:7px;height:7px;border-radius:50%;background:var(--uvx-accent)}
.uvx-pill .n{font-size:11px;min-width:20px;height:18px;line-height:18px;border-radius:9px;background:rgba(var(--uvx-fg-rgb),.16);text-align:center}
#uvx .uvx-zone.on .uvx-pill{background:var(--uvx-sheet)!important;color:var(--uvx-on-sheet)}
.uvx-zone.on .uvx-pill .n{background:rgba(var(--uvx-deep-rgb),.1)}
.uvx-drop{position:absolute;top:40px;left:50%;transform:translateX(-50%);min-width:300px;max-height:60vh;overflow:auto;padding:6px;border-radius:12px;display:none}
.uvx-zone:hover .uvx-drop,.uvx-zone.open .uvx-drop{display:block}
.uvx-drop .grp{font-size:10px;letter-spacing:.12em;text-transform:uppercase;opacity:.6;padding:8px 10px 4px}
.uvx-step{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border-radius:8px;background:none;text-align:left;font-size:13px}
#uvx .uvx-step:hover{background:rgba(var(--uvx-fg-rgb),.1)!important}
#uvx .uvx-step.cur{background:rgba(var(--uvx-accent-rgb),.28)!important}
.uvx-step .k{width:20px;height:20px;border-radius:6px;background:rgba(var(--uvx-fg-rgb),.12);font-size:11px;display:grid;place-items:center;flex:none}
.uvx-step .v{margin-left:auto;color:var(--uvx-accent-tx);font-size:12px}
/* outils */
.uvx-tools{position:absolute;top:16px;right:16px;display:flex;gap:6px;pointer-events:auto}
.uvx-tool{width:38px;height:38px;border-radius:10px;display:grid;place-items:center}
.uvx-tool svg{width:18px;height:18px;stroke:var(--uvx-fg);fill:none;stroke-width:1.8}
.uvx-tool.off{opacity:.55}
/* F3 */
.uvx-car{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;pointer-events:auto}
.uvx-car .arr{width:40px;height:40px;border-radius:10px;display:grid;place-items:center;font-size:18px}
.uvx-car .arr:disabled{opacity:.35;cursor:default}
.uvx-car .mid{min-width:260px;max-width:420px;height:52px;padding:0 18px;border-radius:12px;display:flex;flex-direction:column;justify-content:center;text-align:center}
.uvx-car .mid b{font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.uvx-car .mid span{font-size:11px;opacity:.7}
.uvx-ask{position:absolute!important;bottom:82px;left:50%;transform:translateX(-50%);width:min(440px,70vw);pointer-events:auto}
.uvx-ask form{display:flex;align-items:center;height:40px;border-radius:999px;padding:0 5px 0 16px;margin:0}
.uvx-ask svg{width:16px;height:16px;stroke:var(--uvx-fg);fill:none;stroke-width:1.8;flex:none;opacity:.8}
#uvx .uvx-ask input{flex:1;min-width:0;height:100%;background:transparent!important;border:0!important;outline:0;color:var(--uvx-fg);font:400 13px var(--uvx-font);padding:0 10px;box-shadow:none!important}
#uvx .uvx-ask input::placeholder{color:rgba(var(--uvx-fg-rgb),.78)}
#uvx .uvx-ask .send{width:30px;height:30px;border-radius:50%;background:var(--uvx-accent)!important;color:var(--uvx-on-accent);font-size:15px;flex:none}
.uvx-ask .ans{position:absolute;left:0;right:0;bottom:48px;padding:14px 16px 12px;border-radius:14px;font-size:13px;line-height:1.5;display:none;max-height:min(52vh,420px);overflow:auto}
.uvx-ask .ans .eb{font-size:10px;letter-spacing:.12em;text-transform:uppercase;opacity:.6;margin:0 18px 4px 0}
.uvx-ask .ans .qq{font-weight:600;margin-bottom:4px}
.uvx-ask .ans .also{margin-top:10px;border-top:1px solid rgba(var(--uvx-fg-rgb),.15);padding-top:8px}
#uvx .uvx-ask .ans .also button{display:block;background:none!important;color:inherit;font-size:12px;text-align:left;padding:3px 0;opacity:.85;text-decoration:underline;text-underline-offset:3px}
#uvx .uvx-ask .ans .lnk.ghost{background:rgba(var(--uvx-fg-rgb),.14)!important;color:var(--uvx-fg)}
.uvx-ask .ans .foot{margin-top:10px;font-size:11px;opacity:.75}
#uvx .uvx-ask .ans .foot a{color:inherit;text-decoration:underline;text-underline-offset:3px}
.uvx-ask .ans.on{display:block}
.uvx-ask .ans .links{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
#uvx .uvx-ask .ans .lnk{display:inline-flex;align-items:center;text-decoration:none;height:28px;padding:0 12px;border-radius:999px;background:var(--uvx-accent)!important;color:var(--uvx-on-accent);font-size:12px;font-weight:600}
.uvx-ask .ans .note{margin-top:8px;font-size:10px;letter-spacing:.06em;opacity:.55}
#uvx .uvx-ask .ans .close{position:absolute!important;top:6px;right:8px;background:none!important;font-size:16px;opacity:.7}
/* F10 */
.uvx-card{position:absolute;left:24px;bottom:205px;width:340px;color:#fff;pointer-events:auto;transition:opacity .4s,transform .4s}
.uvx-card.hide{opacity:0;transform:translateY(8px);pointer-events:none}
.uvx-card .eb{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--uvx-accent-scene);font-weight:600}
.uvx-card h2{margin:4px 0 6px;font-size:28px;font-weight:500;line-height:1.1;text-shadow:0 2px 16px rgba(0,0,0,.5)}
.uvx-card .fig{display:inline-block;margin-bottom:8px;padding:3px 10px;border-radius:999px;background:var(--uvx-accent);color:var(--uvx-on-accent);font-size:12px;font-weight:600}
.uvx-card p{margin:0;font-size:13px;line-height:1.45;opacity:.92;text-shadow:0 1px 8px rgba(0,0,0,.6);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
#uvx .uvx-card .more{margin-top:6px;background:none;color:var(--uvx-accent-scene);font-size:13px;font-weight:600;padding:0}
/* F11 */
.uvx-modal{position:absolute;inset:0;background:rgba(var(--uvx-deep-rgb),.45);backdrop-filter:blur(6px);display:none;place-items:center;pointer-events:auto;z-index:2}
.uvx-modal.on{display:grid}
.uvx-sheet{position:relative;width:min(560px,92vw);max-height:80vh;overflow:auto;background:var(--uvx-sheet);color:var(--uvx-on-sheet);border-radius:22px;padding:28px 30px}
.uvx-sheet .eb{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--uvx-sheet-muted);font-weight:600}
.uvx-sheet h2{margin:6px 0 14px;font-size:26px;font-weight:500}
.uvx-sheet h3{font-size:16px;font-weight:600;margin:0 0 10px}
.uvx-sheet p{font-size:14px;line-height:1.6;margin:0 0 10px}
#uvx .uvx-x{position:absolute!important;top:14px!important;right:14px!important;left:auto!important;margin:0!important;padding:0!important;width:36px;height:36px;border-radius:50%;background:var(--uvx-panel)!important;color:var(--uvx-fg);font-size:18px}
/* F4 */
.uvx-full{position:absolute;inset:0;background:rgba(var(--uvx-deep-rgb),.9);backdrop-filter:blur(12px);display:none;pointer-events:auto;z-index:3;padding:86px 5vw 40px 4vw}
.uvx-full.on{display:flex;gap:4vw;align-items:flex-start}
.uvx-full .col1{width:min(420px,40%);max-height:100%;overflow:auto;padding-right:8px}
.uvx-full .col2{flex:1;position:sticky;top:0;display:flex;justify-content:center}
.uvx-full .lbl{font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.5;margin:0 0 12px}
.uvx-fz{display:flex;align-items:center;gap:14px;width:100%;text-align:left;background:none;padding:12px 0}
.uvx-fz .ico{width:30px;height:30px;border-radius:8px;border:1px solid rgba(var(--uvx-accent-rgb),.55);display:grid;place-items:center;color:var(--uvx-accent-tx);font-size:12px;flex:none}
.uvx-fz b{display:block;font-size:21px;font-weight:500;line-height:1.15}
.uvx-fz span.m{display:block;font-size:12px;opacity:.55;margin-top:2px}
.uvx-fz .chev{margin-left:auto;opacity:.5;transition:transform .25s}
.uvx-fz.open .chev{transform:rotate(90deg)}
.uvx-fz:hover b,.uvx-fz.open b{color:var(--uvx-accent-tx)}
.uvx-fl{display:none;padding:2px 0 12px 44px}
.uvx-fz.open + .uvx-fl{display:block}
.uvx-fl .grp{font-size:10px;letter-spacing:.16em;text-transform:uppercase;opacity:.45;margin:10px 0 4px}
.uvx-fstep{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none!important;padding:7px 0;font-size:14px;opacity:.82}
.uvx-fstep i{width:6px;height:6px;border-radius:50%;border:1px solid var(--uvx-accent);flex:none}
.uvx-fstep .f{font-size:11px;opacity:.55}
.uvx-fstep .v{margin-left:auto;color:var(--uvx-accent-tx);font-size:11px}
.uvx-fstep:hover,.uvx-fstep.sel{opacity:1}
.uvx-fstep.sel{color:var(--uvx-accent-tx)} .uvx-fstep.sel i{background:var(--uvx-accent)}
.uvx-prev{position:relative;width:min(100%,calc((100vh - 140px) * .8));border-radius:22px;overflow:hidden;background:rgba(var(--uvx-fg-rgb),.05);box-shadow:0 30px 80px rgba(0,0,0,.45)}
.uvx-prev .ph{position:relative;aspect-ratio:4/5;background:linear-gradient(135deg,rgba(var(--uvx-deep-rgb),.55),rgb(var(--uvx-deep-rgb))) center/cover no-repeat}
.uvx-prev .ph::before{content:'';position:absolute;inset:45% 0 0;background:linear-gradient(transparent,rgba(var(--uvx-deep-rgb),.92));z-index:1}
.uvx-prev .ph.ld::after{content:'';position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(var(--uvx-fg-rgb),.08) 50%,transparent 70%);animation:uvxsh 1.1s infinite}
@keyframes uvxsh{from{transform:translateX(-60%)}to{transform:translateX(60%)}}
.uvx-prev .ph .none{position:absolute;inset:0;display:grid;place-items:center;font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.4}
.uvx-prev .tx{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:22px 26px 24px}
.uvx-prev .eb{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--uvx-accent-tx);font-weight:600}
.uvx-prev h3{margin:6px 0 8px;font-size:26px;font-weight:500}
.uvx-prev .fig{display:inline-block;margin:0 0 8px;padding:3px 10px;border-radius:999px;background:var(--uvx-accent);color:var(--uvx-on-accent);font-size:12px;font-weight:600}
.uvx-prev p{margin:0 0 14px;font-size:13.5px;line-height:1.5;opacity:.85;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
#uvx .uvx-prev .goto{height:38px;padding:0 18px;border-radius:999px;background:var(--uvx-sheet)!important;color:var(--uvx-on-sheet);font-size:13px;font-weight:600}
#uvx .uvx-full .uvx-x{top:18px!important;right:18px!important;background:var(--uvx-accent)!important;color:var(--uvx-on-accent)}
/* F5 */
#uvx-hs{position:absolute;inset:0;pointer-events:none;z-index:850;overflow:hidden}
.uvx-hs{position:absolute!important;left:0;top:0;transform:translate(-50%,-50%);pointer-events:auto;display:none;align-items:center;border:0;padding:0;background:none!important;cursor:pointer;transition:opacity .25s}
.uvx-hs .c{width:40px;height:40px;border-radius:50%;background:rgba(var(--uvx-sheet-rgb),.92);box-shadow:0 0 0 4px rgba(var(--uvx-accent-rgb),.45),0 6px 18px rgba(0,0,0,.3);display:grid;place-items:center;color:var(--uvx-on-sheet);font-size:18px;font-weight:700}
.uvx-hs .l{max-width:0;overflow:hidden;white-space:nowrap;color:var(--uvx-fg);font:500 13px var(--uvx-font);background:rgba(var(--uvx-deep-rgb),.85);border-radius:999px;padding:0;height:30px;line-height:30px;margin-left:6px;transition:max-width .3s,padding .3s}
.uvx-hs:hover .l{max-width:320px;padding:0 14px}
#uvx-hs.hovering .uvx-hs:not(:hover){opacity:.35}
body.uvx-bare #uvx-hs{display:none}
/* F15 */
#uvx-360{position:absolute;inset:0;z-index:1;opacity:0;pointer-events:none;transition:opacity .7s;background:#000}
#uvx-360.on{opacity:1;pointer-events:auto}
#uvx-360 .pnlm-load-box,#uvx-360 .pnlm-about-msg,#uvx-360 .pnlm-controls-container{display:none!important}
.uvx-cfg{position:absolute;right:20px;bottom:90px;width:290px;padding:14px 16px;border-radius:14px;pointer-events:auto}
.uvx-cfg .eb{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--uvx-accent-tx);font-weight:600}
.uvx-cfg b{display:block;font-size:14px;font-weight:500;margin:4px 0 10px}
.uvx-cfg .chips{display:flex;flex-wrap:wrap;gap:6px}
#uvx .uvx-cfg .chip{height:30px;padding:0 12px;border-radius:999px;font-size:12px;background:rgba(var(--uvx-fg-rgb),.12)!important}
#uvx .uvx-cfg .chip.on{background:var(--uvx-accent)!important;color:var(--uvx-on-accent)}
/* F16 */
.uvx-ep{position:absolute;inset:0;z-index:6;display:none;place-items:center;pointer-events:auto;background:rgba(var(--uvx-scene-rgb),.6);color:#fff}
.uvx-ep.on{display:grid}
.uvx-ep .box{position:relative}
.uvx-ep .eb{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--uvx-accent-scene);font-weight:600}
.uvx-ep h3{margin:4px 0 12px;font-size:22px;font-weight:500}
.uvx-ep .frame{position:relative;aspect-ratio:16/9;width:min(720px,92vw);border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.5);background:#000}
.uvx-ep .frame.v916{aspect-ratio:9/16;width:auto;height:min(64vh,640px)}
.uvx-ep iframe,.uvx-ep video{position:absolute;inset:0;width:100%;height:100%;border:0;object-fit:cover}
.uvx-ep .chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;max-width:min(720px,92vw)}
#uvx .uvx-ep .chip{height:32px;padding:0 14px;border-radius:999px;font-size:12px;background:rgba(255,255,255,.14)!important;color:#fff}
#uvx .uvx-ep .chip.on{background:var(--uvx-accent)!important;color:var(--uvx-on-accent)}
#uvx .uvx-ep .uvx-x{top:-4px!important;right:-48px!important}
/* F18 */
.uvx-intro{position:absolute;inset:0;display:grid;place-items:center;text-align:center;pointer-events:auto;z-index:7;color:#fff;
 backdrop-filter:blur(18px) brightness(.8);-webkit-backdrop-filter:blur(18px) brightness(.8);transition:backdrop-filter 1.6s,opacity 1.2s 1s}
.uvx-intro.go{backdrop-filter:blur(0) brightness(1);-webkit-backdrop-filter:blur(0) brightness(1);opacity:0;pointer-events:none}
.uvx-intro .eb{font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:var(--uvx-accent-scene)}
.uvx-intro h1{font-size:44px;font-weight:400;margin:10px 0 26px;text-shadow:0 2px 24px rgba(0,0,0,.4)}
#uvx .uvx-intro .go-btn{padding:12px 26px;border-radius:999px;background:var(--uvx-sheet)!important;color:var(--uvx-on-sheet);font-size:14px;font-weight:600}
.uvx-intro .skip{position:absolute;right:20px;bottom:20px;font-size:12px;opacity:.7;background:none}
.uvx-intro.vid{backdrop-filter:none;-webkit-backdrop-filter:none;background:#000;transition:opacity 1.2s}
.uvx-intro.vid.go{opacity:0}
.uvx-intro .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.uvx-intro .shade{position:absolute;inset:0;background:radial-gradient(ellipse 60% 45% at 50% 50%,rgba(var(--uvx-scene-rgb),.68),rgba(var(--uvx-scene-rgb),.28) 70%,rgba(var(--uvx-scene-rgb),.4))}
.uvx-intro .in{position:relative}
.uvx-intro.vid h1{font-size:52px;text-shadow:0 2px 30px rgba(0,0,0,.6)}
#uvx .uvx-intro.vid .go-btn{padding:15px 32px;font-size:15px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
/* F7 */
#uvx.bare .uvx-zones,#uvx.bare .uvx-car,#uvx.bare .uvx-card,#uvx.bare .uvx-cfg,#uvx.bare .uvx-ask,#uvx.bare .uvx-tool:not(.eye){opacity:0;pointer-events:none}
/* F12 : fenêtre native des balises (Fancybox, page extérieure) */
body:not(.uvx-champ-on) .fancybox-container .fancybox-bg{background:rgba(var(--uvx-deep-rgb),.55)!important;backdrop-filter:blur(8px)}
body:not(.uvx-champ-on) .fancybox-container .fancybox-content{border-radius:18px 18px 0 0!important;overflow:hidden}
body:not(.uvx-champ-on) .fancybox-container .fancybox-caption{background:var(--uvx-sheet)!important;color:var(--uvx-on-sheet)!important;text-align:left!important;left:50%!important;right:auto!important;transform:translateX(-50%);
 width:min(800px,92vw)!important;bottom:22px!important;border-radius:0 0 18px 18px;padding:18px 24px 20px!important;box-shadow:0 20px 50px rgba(0,0,0,.35)}
body:not(.uvx-champ-on) .fancybox-container .fancybox-caption::before,body:not(.uvx-champ-on) .fancybox-container .fancybox-caption::after{display:none!important}
body:not(.uvx-champ-on) .fancybox-container .fancybox-caption .title{display:block;font:500 22px var(--uvx-font);margin-bottom:6px;color:var(--uvx-on-sheet)}
body:not(.uvx-champ-on) .fancybox-container .fancybox-caption .txt{font:400 13.5px/1.55 var(--uvx-font);color:var(--uvx-on-sheet)}
body:not(.uvx-champ-on) .fancybox-container .fancybox-caption .txt h3{font-size:14px;font-weight:600;margin:0 0 6px}
body:not(.uvx-champ-on) .fancybox-container .fancybox-button--close{background:var(--uvx-accent)!important;color:var(--uvx-on-accent)!important;border-radius:50%!important;margin:12px!important}
/* F9 */
.uvx-disc{display:none}
@media (max-width:760px){
 #uvx .uvx-zones{top:12px;left:0;right:0;transform:none;flex-direction:column;align-items:center;gap:6px}
 .uvx-disc{display:flex}
 .uvx-zones .uvx-zone{display:none}
 .uvx-zones.open .uvx-zone{display:block}
 .uvx-drop{position:fixed;top:auto;bottom:0;left:0;right:0;transform:none;border-radius:16px 16px 0 0;max-height:55vh;z-index:5;padding:10px 8px 24px}
 .uvx-zone:hover .uvx-drop{display:none}.uvx-zone.open .uvx-drop{display:block}
 #uvx .uvx-step{min-height:44px}
 .uvx-tools{flex-direction:column;top:12px;right:12px}
 .uvx-tool{width:44px;height:44px}
 .uvx-card{left:14px;right:14px;width:auto;bottom:172px}
 .uvx-card h2{font-size:22px}
 .uvx-card p{-webkit-line-clamp:2}
 body:not(.uvx-champ-on) .action-box.my-ui.bottom{bottom:78px!important}
 #uvx-back .uvx-grad{width:100%;height:55%}
 .uvx-car{left:12px;right:12px;transform:none;bottom:14px}
 .uvx-car .mid{flex:1;min-width:0}
 .uvx-car .arr{width:44px;height:52px}
 /* v1.1.0 (Mickaël, 09/10/2026) : sur téléphone, plus de carrousel « Commencer la visite » : le champ de question
    prend sa place en bas ; la carte de contexte se réduit au nom et au chiffre et ne capte plus les touchers. */
 .uvx-car{display:none!important}
 .uvx-ask{left:12px;right:12px;width:auto;transform:none;bottom:14px}
 #uvx .uvx-card{bottom:172px;pointer-events:none}
 /* v1.2.1 (Mickaël) : le bouton « Découvrir » masquait le logo → il se range sous le logo, aligné à gauche */
 #uvx .uvx-zones{top:var(--uvx-logo-b,70px);left:14px;right:auto;align-items:flex-start}
 .uvx-cfg{top:calc(var(--uvx-logo-b,70px) + 54px)}
 .uvx-card p,#uvx .uvx-card .more{display:none!important}
 .uvx-cfg{left:14px;right:70px;width:auto;bottom:auto;top:var(--uvx-logo-b,70px)}
 .uvx-full.on{flex-direction:column;padding:64px 16px 16px;gap:14px}
 .uvx-full .col2{order:-1;position:static;width:100%}
 .uvx-prev{width:100%}
 .uvx-prev .ph{aspect-ratio:16/9}
 .uvx-prev .ph::before{display:none}
 .uvx-prev .tx{position:static;padding:12px 16px 14px}
 .uvx-prev h3{font-size:20px}
 .uvx-prev p{-webkit-line-clamp:2}
 .uvx-full .col1{width:100%;max-height:none;flex:1;min-height:0}
 .uvx-intro h1{font-size:30px;padding:0 20px}
 .uvx-intro.vid h1{font-size:32px}
 #uvx .uvx-ep .uvx-x{right:0!important;top:-44px!important}
}
/* ---- Responsive systématique (exigence 07/10/2026) : tablette et téléphone couché ---- */
/* Tablette (761–1100 px) : les pastilles de zones ne tiennent plus à côté des outils → bouton « Découvrir » ;
   l'encart « même salle, autre configuration » monte sous le logo pour libérer le bas d'écran. */
@media (min-width:761px) and (max-width:1100px){
 #uvx .uvx-zones{top:16px;left:0;right:0;transform:none;flex-direction:column;align-items:center;gap:6px}
 .uvx-disc{display:flex}
 .uvx-zones .uvx-zone{display:none}
 .uvx-zones.open .uvx-zone{display:block}
 .uvx-zone:hover .uvx-drop{display:none}.uvx-zone.open .uvx-drop{display:block}
 #uvx .uvx-step{min-height:44px}
 .uvx-cfg{right:auto;left:20px;bottom:auto;top:var(--uvx-logo-b,90px);width:290px}
 .uvx-card{bottom:150px}
 .uvx-ask{width:min(440px,56vw)}
}
/* Téléphone couché (hauteur ≤ 500 px) : tout se resserre en bandeaux ; la carte de contexte se réduit au nom. */
@media (max-height:500px) and (min-width:500px){
 #uvx .uvx-zones{top:8px;left:0;right:0;transform:none;flex-direction:column;align-items:center;gap:4px}
 .uvx-disc{display:flex}
 .uvx-zones .uvx-zone{display:none}
 .uvx-zones.open .uvx-zone{display:block}
 .uvx-zone:hover .uvx-drop{display:none}.uvx-zone.open .uvx-drop{display:block}
 .uvx-drop{position:fixed;top:auto;bottom:0;left:50%;right:auto;transform:translateX(-50%);width:min(520px,90vw);border-radius:16px 16px 0 0;max-height:80vh;z-index:5}
 .uvx-pill{height:30px}
 .uvx-tools{top:8px;right:8px;gap:4px}
 .uvx-tool{width:34px;height:34px}
 .uvx-car{display:none!important}
 .uvx-card{pointer-events:none}
 .uvx-car .mid{height:40px;min-width:220px}
 .uvx-car .mid span{display:none}
 .uvx-ask{bottom:66px;width:min(380px,46vw)}
 .uvx-ask form{height:34px}
 .uvx-ask .ans{bottom:40px;max-height:calc(100vh - 120px)}
 .uvx-card{left:16px;bottom:auto;top:calc(var(--uvx-logo-b,70px) + 8px);width:min(260px,30vw)}
 .uvx-card h2{font-size:18px}
 .uvx-card p,#uvx .uvx-card .more{display:none}
 .uvx-cfg{right:16px;left:auto;bottom:auto;top:52px;width:240px;padding:10px 12px}
 .uvx-full.on{padding:52px 4vw 12px 3vw}
 .uvx-full .col1{width:52%}
 .uvx-prev{width:min(100%,calc((100vh - 70px) * 1.25))}
 .uvx-prev .ph{aspect-ratio:5/4}
 .uvx-fz{padding:8px 0}.uvx-fz b{font-size:17px}
 .uvx-intro h1,.uvx-intro.vid h1{font-size:30px;margin:6px 0 16px}
 .uvx-modal .uvx-sheet{max-height:88vh;padding:20px 22px}
 .uvx-ep .frame{width:min(560px,70vw)}
 .uvx-prev .eb,.uvx-prev p{display:none}
 .uvx-prev .tx{padding:12px 16px 14px}
 .uvx-prev h3{font-size:20px;margin:0 0 6px}
}
/* ---- Mode « champ seul » : interface MPskin classique + le seul champ de question ----
   Position calculée en JS (champPlace) : centré dans la zone laissée libre par le menu natif, au-dessus de sa barre basse. */
body.uvx-champ-on #uvx > :not(.uvx-ask){display:none!important}
body.uvx-aero-wait .fancybox-container.open-fancybox-pano{opacity:0!important;transition:none!important}
body.uvx-aero-wait .fancybox-container.open-fancybox-pano,body.uvx-aero-wait .fancybox-container.open-fancybox-pano *{pointer-events:none!important}
body .fancybox-container.open-fancybox-pano{transition:opacity .6s ease}
body:not(.uvx-champ-on) .fancybox-container.open-fancybox-pano .fancybox-content{border-radius:0!important}
body.uvx-champ-on #uvx-back,body.uvx-champ-on #uvx-hs,body.uvx-champ-on #uvx-360{display:none!important}
#uvx.uvx-champ .uvx-ask{left:var(--uvx-cl,12px);right:auto;width:var(--uvx-cw,440px);bottom:var(--uvx-cb,72px);transform:none;display:flex;align-items:center;gap:6px;transition:opacity .25s}
#uvx.uvx-champ .uvx-ask form{flex:1;min-width:0}
#uvx .uvx-ask .ceye{display:none}
#uvx.uvx-champ .uvx-ask .ceye{display:flex;align-items:center;justify-content:center;flex:none;width:40px;height:40px;border-radius:50%;padding:0}
#uvx.uvx-champ .uvx-ask .ceye svg{width:18px;height:18px;opacity:.9}
#uvx.uvx-champ .uvx-ask .ceye .off{display:none}
#uvx.uvx-champ .uvx-ask.hid .ceye .on{display:none}
#uvx.uvx-champ .uvx-ask.hid .ceye .off{display:block}
#uvx.uvx-champ .uvx-ask.hid form,#uvx.uvx-champ .uvx-ask.hid .ans{display:none!important}
#uvx.uvx-champ .uvx-ask.cov{opacity:0;pointer-events:none}
#uvx.uvx-champ .uvx-ask.cov *{pointer-events:none!important}
@media (max-height:500px) and (min-width:500px){ #uvx.uvx-champ .uvx-ask .ceye{width:34px;height:34px} }
`;

  /* ---------- 2. Lecture du menu natif ---------- */
  function label(a) { var n = a.querySelector(':scope > .name'); return (n ? n.textContent : a.textContent).trim(); }
  /* Étape navigable = a.init OU lien dont le href porte un point de scan (ss=). Double contrôle conseillé par DEVY (07/10/2026) :
     .init peut disparaître un instant quand MPskin reconstruit le menu (langue, skin). Vérifié sur 27tet492gc : mêmes 20 étapes. */
  function isStep(a) { return !!a && (a.classList.contains('init') || /[?&]ss=/.test(a.getAttribute('href') || '')); }
  function ssOf(a) { var m = /[?&]ss=([^&#]*)/.exec((a && a.getAttribute('href')) || ''); return m ? m[1] : ''; }
  /* DEVY 09/10 : si MPskin reconstruit le menu (langue…), les liens mémorisés sont détachés du document.
     On retrouve l'étape dans le menu actuel par sa valeur ss=, puis par son nom normalisé. */
  function liveEl(st) {
    if (st.el && st.el.isConnected) return st.el;
    var links = Array.from(document.querySelectorAll('.nav-cnt a')).filter(isStep), f = null;
    if (st.ss) f = links.filter(function (a) { return ssOf(a) === st.ss; })[0];
    if (!f) { var k = key(st.label); f = links.filter(function (a) { return key(label(a)) === k; })[0]; }
    if (f) st.el = f;
    return f || null;
  }
  function readMenu() {
    var zones = [];
    document.querySelectorAll('.nav-cnt .section.cnt').forEach(function (s) {
      var t = s.querySelector(':scope > .icnt.cnt-title');
      var z = { label: (t ? t.textContent : '').trim(), steps: [] };
      var tl = t ? t.querySelector(':scope > a') : null; if (!isStep(tl)) tl = null;
      if (tl) z.steps.push({ label: label(tl) || z.label, el: tl, group: '', depth: 0 });
      /* v1.2.2 : arborescence d'origine respectée — groupe = chemin complet des intertitres (« Le Couvent › Le Quartier Latin »),
         profondeur = nombre d'étapes parentes (« La Charrue » › « La Sarclette (Sous-com) » est décalée d'un cran). */
      function walk(el, path, depth) {
        var a = el.querySelector(':scope > a');
        var kids = Array.from(el.children).filter(function (c) { return c.classList && c.classList.contains('nav-level'); });
        var step = isStep(a);
        if (step) z.steps.push({ label: label(a), el: a, group: path.join(' › '), depth: depth });
        var p = (a && !step && label(a)) ? path.concat([label(a)]) : path;
        kids.forEach(function (k) { walk(k, p, step ? depth + 1 : depth); });
      }
      var w = s.querySelector(':scope > .icnt-wrap');
      if (w) w.querySelectorAll(':scope > .icnt > .nav-level').forEach(function (n) { walk(n, [], 0); });
      if (!z.label && z.steps.length) z.label = z.steps[0].label;
      if (z.steps.length) zones.push(z);
    });
    zones.forEach(function (z, zi) { z.steps.forEach(function (st, i) { st.zi = zi; st.i = i; st.key = zi + ':' + i; st.ss = ssOf(st.el); }); });
    return zones;
  }

  /* ---------- 3. Balises-fiches : contenu rendu par MPskin dans le DOM dès le chargement ---------- */
  /* Clé d'appariement UNIQUE (contrat de contenu) : sans tiret conditionnel, accents, casse, apostrophes typographiques ni
     espaces multiples — puis égalité STRICTE, jamais « contient » (« Hall 1 » ne doit pas trouver « Hall 10 »). */
  function key(s) { return String(s || '').replace(/\u00ad/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[’`´]/g, "'").replace(/\s+/g, ' ').trim(); }
  function byKey(obj, name) { var k = key(name), f = Object.keys(obj || {}).filter(function (x) { return key(x) === k; })[0]; return f === undefined ? null : obj[f]; }
  /* Séparateur des libellés de balises : « · » (point médian), « • » toléré ; jamais « - », « : » ou « . », présents dans de vrais noms. */
  var SEP = /\s*[·•]\s*/;
  function norm(s) {
    return (s || '').replace(/­/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[’']/g, ' ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
      .filter(function (w) { return w.length > 3 && ['salle', 'espace', 'places'].indexOf(w) < 0; });
  }
  function readFiches() {
    return Array.from(document.querySelectorAll('[class*="click-trigger-cnt-"]')).map(function (d) {
      var title = d.querySelector('.caption .title'), txt = d.querySelector('.caption .txt');
      return { title: title ? title.textContent.replace(/­/g, '').trim() : '', html: txt ? txt.innerHTML : '',
               lead: txt ? (txt.querySelector('h3,p') || txt).textContent.replace(/­/g, '').trim() : '', el: d,
               photo: d.dataset.mediaType === 'photo' ? d.getAttribute('href') : null };
    }).filter(function (f) { return f.title; });   /* une balise de contenu (photo, vidéo) peut n'avoir aucun texte */
  }
  /* Balise-fiche = balise dont le titre est le nom EXACT de l'étape (clé normalisée, égalité stricte). */
  function ficheFor(name, fiches) { var k = key(name); return fiches.filter(function (f) { return key(f.title) === k; })[0] || null; }
  function split(lbl) { var m = lbl.split(/\s+[-–]\s+/); return { name: m[0], fig: m.slice(1).join(' · ') }; }

  /* ---------- F20 ⭐ : FAQ du lieu (module phare). Pas d'IA : index local + dictionnaire + score. ----------
     Source : balises « FAQ · Thème » (catégorie Contenus) ; en maquette, OPTIONS.faq (même texte).
     Entrée = bloc séparé d'une ligne vide : « Q : » / « Mots-clés : » / « R : » / « → Étape » (facultatif). */
  function uvxFaq(raw) {
    var STOP = ('a au aux avec ce ces cet cette c ca d de des du dans en et est etre il ils elle elles j je l la le les leur lui ' +
      'm ma me mes mon n ne nous on ou par pas pour qu que quel quelle quelles quels qui sa se ses si son sont sur t ta te tes ' +
      'toi ton tu un une vos votre vous y ont sera seront serai depuis devant exactement faites service avez avons ai as peut peuvent pouvez puis puisse faut faire fait ' +
      'est ce que estce comment combien quoi quand pourquoi possible bien tres plus moins svp merci bonjour aussi donc alors ' +
      'chez dispose disposez avoir etes suis sommes proche proches proximite alentour alentours pres loin gratuit gratuite payant payante inclus demander demande obtenir prevoir prevu sur place exactement existe exister propose proposez proposer offre-t y-a-t-il ya cela ceci tout tous toute toutes').split(' ');
    /* Dictionnaire MICE : forme canonique ← variantes (expressions avant mots). Commun à tous les lieux ; enrichi au fil des clients. */
    var SYN = {   /* variantes séparées par des virgules ; une variante à plusieurs mots est une expression */
      capacite: 'capacite,capacites,personnes,personne,participants,participant,pax,invites,invite,places,place,jauge,accueillir,accueille,contenir,convives,gens,sieges,siege,places assises',
      auditorium: 'auditorium,auditoriums,amphi,amphitheatre,pleniere,plenieres,salle de conference,salle pleniere',
      atelier: 'sous commission,sous commissions,salle de reunion,salles de reunion,reunion,reunions,atelier,ateliers,workshop,workshops,commission,commissions,breakout,sous groupe,sous groupes',
      exposition: 'exposition,expo,salon professionnel,stand,stands,exposant,exposants,foire',
      hall: 'hall,halls',
      restauration: 'restauration,traiteur,repas,dejeuner,dejeuners,diner,diners,buffet,buffets,manger,nourriture,plateau repas,cocktail,dejeunatoire,catering',
      soiree: 'soiree,soirees,gala,fete,dinner,diner de gala',
      hebergement: 'hebergement,hotel,hotels,dormir,chambre,chambres,nuit,nuits,loger,logement,nuitee,nuitees',
      train: 'train,trains,gare,gares,sncf,tgv,ter,ferroviaire',
      avion: 'avion,avions,aeroport,aeroports,vol,vols,aerien,charter,jet',
      voiture: 'voiture,voitures,route,autoroute,autoroutes,conduire',
      acces: 'acces,venir,aller,rejoindre,trajet,itineraire,arriver,se rendre',
      parking: 'parking,parkings,garer,stationner,stationnement,se garer',
      pmr: 'pmr,handicap,handicape,handicapes,fauteuil,fauteuil roulant,mobilite reduite,accessibilite',
      wifi: 'wifi,wi fi,internet,connexion,fibre,debit,reseau',
      technique: 'technique,techniques,audiovisuel,son,sono,sonorisation,video,videos,ecran,ecrans,projecteur,micro,micros,regie,lumiere,eclairage,materiel,equipement,equipements',
      tarif: 'tarif,tarifs,prix,cout,couts,coute,budget,cher,ca coute,devis',
      exterieur: 'exterieur,exterieurs,dehors,plein air,terrasse,terrasses,chapiteau,chapiteaux,vue mer,vue sur la mer,jardin',
      rse: 'rse,eco responsable,ecoresponsable,durable,developpement durable,environnement,environnemental,ecologique,ecologie,carbone,bilan carbone,label,labels,iso 20121,20121',
      livraison: 'livraison,livraisons,livrer,quai,camion,camions,decharger,dechargement,montage,demontage,monte charge,logistique,poids lourd',
      contact: 'contact,contacter,telephone,appeler,mail,email,e mail,joindre,commercial,commerciale,commerciaux,interlocuteur,numero',
      pause: 'pause,pauses,cafe,pause cafe,networking',
      accueil: 'accueil,enregistrement,badge,badges,vestiaire,entree',
      petit: 'petit,petite,petits,petites,intime,intimiste,restreint,comite,codir,petit groupe',
      grand: 'grand,grande,grands,grandes,vaste,plus grand,plus grande,maximum,maximale,max',
      securite: 'securite,surete,securi site,safe congress,sanitaire',
      activite: 'activite,activites,team building,incentive,loisirs,excursion,excursions,visite touristique,accompagnants,conjoints,golf,plage',
      captation: 'captation,live,en direct,streaming,hybride,diffusion,diffuser,filmer,webinar,plateau tv',
      adresse: 'adresse,localisation,gps,ou se trouve,ou est,ou situe,c est ou,situe',
      navette: 'navette,navettes,autocar,autocars,bus,transfert,transferts',
      regime: 'vegetarien,vegetariens,vegetarienne,vegan,allergie,allergies,allergique,regime,alimentaire,alimentaires,sans gluten,gluten,halal,casher',
      surface: 'surface,surfaces,m2,metres carres,superficie,taille,dimensions,dimension,hauteur,hauteur sous plafond'
    };
    /* Synonymes propres au lieu (fiche client) : ajoutés aux familles existantes ou en créent de nouvelles. */
    Object.keys(OPTIONS.faqSyn || {}).forEach(function (k) { var v = String(OPTIONS.faqSyn[k] || ''); if (v) SYN[k] = SYN[k] ? SYN[k] + ',' + v : v; });
    var phr = [], one = {};
    Object.keys(SYN).forEach(function (c) {
      SYN[c].split(',').forEach(function (v) { if (v.indexOf(' ') > 0) phr.push([v, c]); else one[v] = c; });
    });
    function base(s) {
      return ' ' + (s || '').replace(/­/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/m²/g, ' m2 ').replace(/[’'`\-]/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
    }
    function stem(w) { return w.length > 4 && /[sx]$/.test(w) ? w.slice(0, -1) : w; }
    function toks(s) {
      var t = base(s);
      phr.forEach(function (p) { t = t.split(' ' + p[0] + ' ').join(' ' + p[1] + ' '); });
      var out = [];
      t.split(' ').forEach(function (w) {
        if (!w || STOP.indexOf(w) >= 0) return;
        var c = one[w] || one[stem(w)] || stem(w);
        if (c.length < 2) return;
        if (out.indexOf(c) < 0) out.push(c);
      });
      return out;
    }
    /* Lecture du texte de balise : tolère « Q: », « Q - », listes HTML aplaties, retours Windows. */
    var entries = [], theme = '';
    /* Constaté le 07/10/2026 sur le skin de test : MPskin conserve les retours simples mais SUPPRIME les lignes vides
       (« …face au casino.Q : Comment… »). On recrée donc une coupure devant chaque « Q : » et devant « ## ». */
    String(raw || '').replace(/\r/g, '').replace(/\u00a0/g, ' ')
      .replace(/(^|[^A-Za-z0-9À-ÿ])[ \t]*(Q\s*:\s)/g, '$1\n\n$2')
      /* « → Perspective 3DQ : … » : la ligne d'étape collée à la question suivante (constaté le 07/10/2026) */
      .replace(/(\S)(Q\s*:\s[^\n]*\n\s*(?:Mots?[\s-]*cl|R\s*:))/g, '$1\n\n$2')
      .split(/\n\s*\n/).forEach(function (blk) {
      var e = { q: '', k: '', r: '', step: '', theme: '' };
      blk.split('\n').forEach(function (ln) {
        var l = ln.trim(), m;
        if ((m = l.match(/^#+\s*(.*)$/))) { theme = m[1].replace(/^FAQ\s*[·.:-]\s*/i, ''); return; }
        if ((m = l.match(/^Q\s*[:\-–]\s*(.*)$/i))) e.q = m[1];
        else if ((m = l.match(/^Mots?[\s-]*cl[ée]s?\s*[:\-–]\s*(.*)$/i))) e.k = m[1];
        else if ((m = l.match(/^R\s*[:\-–]\s*(.*)$/i))) e.r = m[1];
        else if ((m = l.match(/^(?:→|->|=>)\s*(.*)$/))) e.step = m[1].trim();
        else if (e.r && l && !/^Source\s*:/i.test(l)) e.r += ' ' + l;   /* réponse sur plusieurs lignes */
      });
      e.theme = theme;
      /* une même question présente deux fois (balise + fiche) n'est gardée qu'une fois */
      if (e.q && e.r && !entries.some(function (x) { return x.q === e.q; })) entries.push(e);
    });
    /* Index : question poids 1.2, mots-clés 1, réponse 0.2 ; mot inconnu de la FAQ = 2 (signe de hors-champ). IDF pour que « salle » pèse moins que « parking ». */
    var df = {};
    entries.forEach(function (e) {
      e.w = {};
      [[e.r, 0.2], [e.k, 1], [e.q, 1.2]].forEach(function (p) { toks(p[0]).forEach(function (t) { e.w[t] = Math.max(e.w[t] || 0, p[1]); }); });
      Object.keys(e.w).forEach(function (t) { df[t] = (df[t] || 0) + 1; });
    });
    var N = entries.length || 1;
    var UNK = (typeof UVX_FAQ_UNK !== 'undefined') ? UVX_FAQ_UNK : 3;
    function idf(t) { return df[t] ? Math.log(1 + N / df[t]) : UNK; }
    function ask(text) {
      /* un nombre absent de la FAQ (« 800 personnes ») n'est pas un mot hors-champ : on l'ignore */
      var qt = toks(text).filter(function (t) { return !/^\d+$/.test(t) || df[t]; });
      if (!qt.length) return { qt: qt, hits: [], unk: 0 };
      var unk = qt.filter(function (t) { return !df[t]; }).length;
      var den = qt.reduce(function (s, t) { return s + idf(t); }, 0);
      var hits = entries.map(function (e) {
        var sc = 0;
        qt.forEach(function (t) {
          var w = e.w[t] || 0;
          if (!w && t.length >= 6) Object.keys(e.w).forEach(function (u) { if (u.length >= 6 && u.slice(0, 5) === t.slice(0, 5)) w = Math.max(w, e.w[u] * 0.6); });
          sc += w * idf(t);
        });
        return { e: e, sc: sc, cov: Math.min(1, sc / den) };
      }).filter(function (h) { return h.sc > 0; }).sort(function (a, b) { return b.sc - a.sc; });
      return { qt: qt, hits: hits, unk: unk };
    }
    /* Décision : réponse fiable ou renvoi vers l'équipe. Un mot inconnu + un seul mot connu = trop fragile. */
    function decide(r, th) {
      var h = r.hits[0]; if (!h) return null;
      var need = (r.unk && r.qt.length - r.unk <= 1) ? Math.max(th, 0.7) : th;
      return h.cov >= need && h.sc >= 1.2 ? h : null;
    }
    return { entries: entries, ask: ask, toks: toks, decide: decide };
  }

  /* ---------- 4. État ---------- */
  var zones = readMenu(), allFiches = readFiches(), cur = null, visited = {}, cardAway = false;
  function isFaq(f) { return /^FAQ\b/i.test(f.title); }
  /* F21 : contrat de contenu. Une balise « Nom · 360 · Libellé » (type Hotspot Images) ou « Nom · Vidéo · Titre »
     n'est jamais la fiche d'une salle : c'est un contenu rattaché à l'étape « Nom » du menu. */
  function isContent(f) { return /\s[·•]\s*(360|vid[ée]o|photo)\s*([·•]|$)/i.test(f.title); }
  var fiches = allFiches.filter(function (f) { return f.html && !isFaq(f) && !isContent(f); });
  var tagCfg = {};
  allFiches.filter(isContent).forEach(function (f) {
    var p = f.title.split(SEP), txt = htmlText(f.html), m = txt.match(/calage\s*:\s*(-?\d+(?:[.,]\d+)?)/i);
    if (!/^360$/i.test(p[1] || '')) return;
    var href = f.el.getAttribute('href') || '';
    if (!href) return;
    (tagCfg[p[0]] = tagCfg[p[0]] || []).push({ label: p.slice(2).join(' · ') || 'Autre configuration',
      pano: f.el.dataset.mediaType === 'pano' ? href : null, url: f.el.dataset.mediaType === 'pano' ? null : href,
      yawOffset: m ? parseFloat(m[1].replace(',', '.')) : 0, fromTag: true });
  });
  /* « Nom · Vidéo · Ép. N Titre » (type Vidéo, cible Popup) : href = lecteur MPskin /player?s=… ; le MP4 est lu dans cette page. */
  var tagEps = [];
  allFiches.filter(isContent).forEach(function (f) {
    var p = f.title.split(SEP);
    if (!/^vid[ée]o$/i.test(p[1] || '')) return;
    if (/^accueil$/i.test(p[0]) && p.length < 3) return;   /* « Accueil · Vidéo » = vidéo d'accueil, pas un épisode */
    var t = p.slice(2).join(' · '), n = t.match(/^[ÉE]p\.?\s*(\d+)\s*/i), href = f.el.getAttribute('href') || '';
    if (!href) return;
    tagEps.push({ title: n ? t.slice(n[0].length) : t, n: n ? +n[1] : 99, step: p[0],
      video: /\.mp4(\?|$)/i.test(href) ? href : null, player: /\.mp4(\?|$)/i.test(href) ? null : href, fromTag: true });
  });
  tagEps.sort(function (a, b) { return a.n - b.n; });
  /* « Nom · Photo » (type Photo, cible Popup) : href = fichier de la médiathèque → aperçu du menu plein écran.
     « Accueil · Photo » = image d'attente de la vidéo d'accueil ; « Accueil · Vidéo » = vidéo d'accueil (lecteur MPskin). */
  var tagIntro = null;
  allFiches.filter(isContent).forEach(function (f) {
    var p = f.title.split(SEP), href = f.el.getAttribute('href') || '';
    if (!href) return;
    if (/^photo$/i.test(p[1] || '')) {
      if (/^accueil$/i.test(p[0])) OPTIONS.introPoster = href; else OPTIONS.photos[p[0]] = href;
    } else if (/^vid[ée]o$/i.test(p[1] || '') && /^accueil$/i.test(p[0]) && p.length < 3) tagIntro = href;
  });
  if (tagIntro) { if (/\.mp4(\?|$)/i.test(tagIntro)) OPTIONS.introVideo = tagIntro; else { OPTIONS.introVideo = null; OPTIONS.introPlayer = tagIntro; } }
  if (tagEps.length) OPTIONS.episodes = tagEps;   /* les balises vidéo remplacent les épisodes écrits dans la fiche client */
  /* une salle décrite par ses balises remplace la configuration écrite dans la fiche client */
  Object.keys(tagCfg).forEach(function (n) { OPTIONS.configs[n] = tagCfg[n]; });   /* une balise FAQ ne doit jamais devenir la fiche d'une salle */
  function htmlText(h) { var d = document.createElement('div'); d.innerHTML = h.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d)>/gi, '\n'); return d.textContent; }
  var faqText = allFiches.filter(isFaq).map(function (f) { return '## ' + f.title + '\n' + htmlText(f.html); }).join('\n\n');
  /* Constaté le 07/10/2026 : une balise texte « Point d'information Matterport » n'a pas de bloc .click-trigger-cnt ;
     son texte n'est rendu que dans le bloc .tag-infos (h2 = titre, p = texte avec retours simples). On lit les deux. */
  var seenFaq = {};
  allFiches.filter(isFaq).forEach(function (f) { seenFaq[f.title] = 1; });
  Array.from(document.querySelectorAll('.tag-infos .info')).forEach(function (inf) {
    var h = inf.querySelector('h2'), p = inf.querySelector('p');
    var t = h ? h.textContent.replace(/\u00ad/g, '').trim() : '';
    if (!p || !/^FAQ\b/i.test(t) || seenFaq[t]) return;
    seenFaq[t] = 1; faqText += '\n\n## ' + t + '\n' + p.textContent;
  });
  if (OPTIONS.faq) faqText += '\n\n' + OPTIONS.faq;
  var FAQ = uvxFaq(faqText);

  try { visited = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) {}
  /* v1.2.3 : « ?demo » dans l'adresse = visite neuve (aucun espace coché), pour commencer une démonstration */
  if (/[?&]demo(=|&|$)/.test(location.search)) { visited = {}; try { localStorage.removeItem(LS); } catch (e) {} }
  zones.forEach(function (z) {
    z.nFiches = 0;
    z.steps.forEach(function (st) { st.parts = split(st.label); st.fiche = ficheFor(st.parts.name, fiches); if (st.fiche) z.nFiches++; });
  });
  function flat() { var a = []; zones.forEach(function (z) { a = a.concat(z.steps); }); return a; }
  function stepByName(n) { var k = key(n); return flat().filter(function (s) { return key(s.parts.name) === k; })[0]; }

  /* ---------- 5. Sons d'interface (F19) ---------- */
  var actx = null, ticks = true;
  function tick() {
    if (!ticks) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = 1400; g.gain.setValueAtTime(0.04, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.06);
      o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.07);
    } catch (e) {}
  }

  /* ---------- 6. DOM ---------- */
  var host = document.querySelector('.ui-wrap') || document.body;
  /* Hauteur réelle du logo du client : les encarts placés en haut à gauche se rangent dessous (logo de taille libre). */
  function placeUnderLogo() { var l = document.querySelector('.logo-box'), b = l ? l.getBoundingClientRect().bottom : 0;
    document.documentElement.style.setProperty('--uvx-logo-b', Math.round(Math.max(56, b + 10)) + 'px'); }
  placeUnderLogo(); window.addEventListener('resize', placeUnderLogo); setTimeout(placeUnderLogo, 1500); setTimeout(placeUnderLogo, 5000);
  var style = document.createElement('style'); style.id = 'uvx-style'; style.textContent = CHARTE.css + css; document.head.appendChild(style);
  var back = document.createElement('div'); back.id = 'uvx-back';
  back.innerHTML = '<div class="uvx-vign"></div><div class="uvx-grad"></div>';
  var model = host.querySelector('.mp-model');
  host.insertBefore(back, model ? model.nextSibling : host.firstChild);
  var pano = document.createElement('div'); pano.id = 'uvx-360'; host.insertBefore(pano, back);
  var root = document.createElement('div'); root.id = 'uvx'; host.appendChild(root);
  var hsLayer = document.createElement('div'); hsLayer.id = 'uvx-hs'; host.appendChild(hsLayer);
  var ic = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    snd: '<svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    fs: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    blur: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    ask: '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
  };
  root.innerHTML =
    '<div class="uvx-zones"><button class="uvx-pill uvx-glass uvx-disc">Découvrir ▾</button></div>' +
    '<div class="uvx-tools">' +
      '<button class="uvx-tool uvx-glass home" title="Retour à l\'accueil">' + ic.home + '</button>' +
      '<button class="uvx-tool uvx-glass eye" title="Masquer l\'interface">' + ic.eye + '</button>' +
      '<button class="uvx-tool uvx-glass blur" title="Flou périphérique">' + ic.blur + '</button>' +
      '<button class="uvx-tool uvx-glass snd off" title="Musique">' + ic.snd + '</button>' +
      '<button class="uvx-tool uvx-glass fs" title="Plein écran">' + ic.fs + '</button>' +
      '<button class="uvx-tool uvx-glass uvx-epbtn" title="Visite guidée en vidéo">' + ic.play + '</button>' +
      '<button class="uvx-tool uvx-glass menu" title="Tous les espaces">' + ic.menu + '</button>' +
    '</div>' +
    '<div class="uvx-card hide"><div class="eb"></div><h2></h2><span class="fig"></span><p></p><button class="more">Voir plus</button></div>' +
    '<div class="uvx-cfg uvx-glass" style="display:none"></div>' +
    '<div class="uvx-ask"><div class="ans uvx-glass"><button class="close" type="button">×</button><div class="txt"></div><div class="links"></div></div>' +
      '<button class="ceye uvx-glass" type="button" title="Masquer le champ de question"><svg class="on" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg><svg class="off" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/></svg></button>' +
      '<form class="uvx-glass">' + ic.ask + '<input type="text" autocomplete="off"><button class="send" type="submit">↑</button></form></div>' +
    '<div class="uvx-car"><button class="arr uvx-glass prev">‹</button><button class="mid uvx-glass"><b></b><span></span></button><button class="arr uvx-glass next">›</button></div>' +
    '<div class="uvx-modal"><div class="uvx-sheet"><button class="uvx-x">×</button><div class="eb"></div><h2></h2><div class="body"></div></div></div>' +
    '<div class="uvx-full"><button class="uvx-x">×</button><div class="col1"><div class="lbl">Tous les espaces</div></div><div class="col2"><div class="uvx-prev"><div class="ph"><div class="none">Photo à venir</div></div><div class="tx"><div class="eb"></div><h3></h3><span class="fig"></span><p></p><button class="goto">Découvrir cet espace →</button></div></div></div></div>' +
    '<div class="uvx-ep"><div class="box"><div class="eb">Visite guidée en vidéo</div><h3></h3><button class="uvx-x">×</button><div class="frame"></div><div class="chips"></div></div></div>';
  var q = function (s) { return root.querySelector(s); };

  /* F1 + F2 */
  var bar = q('.uvx-zones');
  zones.forEach(function (z, zi) {
    var d = document.createElement('div'); d.className = 'uvx-zone'; d.dataset.zi = zi;
    var html = '<button class="uvx-pill uvx-glass"><i class="dot"></i>' + z.label + (z.steps.length > 1 ? ' <span class="n">' + z.steps.length + '</span>' : '') + '</button>';
    if (z.steps.length > 1) {
      html += '<div class="uvx-drop uvx-glass">';
      var g = null;
      z.steps.forEach(function (st) {
        if (st.group !== g) { g = st.group; if (g) html += '<div class="grp">' + g + '</div>'; }
        html += '<button class="uvx-step' + (st.depth ? ' sub' : '') + '" style="' + (st.depth ? 'padding-left:' + (10 + 22 * st.depth) + 'px' : '') + '" data-key="' + st.key + '"><span class="k">' + (st.i + 1) + '</span>' + st.parts.name + '<span class="v"></span></button>';
      });
      html += '</div>';
    }
    d.innerHTML = html; bar.appendChild(d);
    d.querySelector('.uvx-pill').addEventListener('click', function () {
      if (z.steps.length === 1) return go(z.steps[0]);
      var o = d.classList.contains('open'); bar.querySelectorAll('.uvx-zone').forEach(function (x) { x.classList.remove('open'); });
      if (!o) d.classList.add('open');
    });
  });
  q('.uvx-disc').addEventListener('click', function () { bar.classList.toggle('open'); });
  function fitZones() {
    bar.classList.remove('low');
    if (!window.matchMedia('(min-width:1101px)').matches) return;
    var r = bar.getBoundingClientRect(), t = q('.uvx-tools').getBoundingClientRect(),
        l = document.querySelector('.logo-box'), lr = l ? l.getBoundingClientRect() : null;
    var hitTools = r.right > t.left - 12, hitLogo = lr && lr.width && r.left < lr.right + 12 && r.top < lr.bottom;
    if (hitTools || hitLogo) bar.classList.add('low');
  }
  fitZones(); window.addEventListener('resize', fitZones); setTimeout(fitZones, 1500); setTimeout(fitZones, 5000);
  root.addEventListener('click', function (e) {
    var b = e.target.closest('.uvx-step'); if (!b) return;
    var k = b.dataset.key.split(':'); go(zones[+k[0]].steps[+k[1]]);
  });

  /* Navigation : on déclenche le lien natif du menu (jQuery obligatoire, a.click() ne fait rien) */
  function go(st) {
    var el = st && liveEl(st);
    if (!el) return;
    tick();
    if ($) $(el).trigger('click'); else el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    cur = st; visited[st.key] = 1; cardAway = false;
    try { localStorage.setItem(LS, JSON.stringify(visited)); } catch (e) {}
    if (!CHAMP) try {   /* F8 — pas en mode champ seul : l'interface classique ne réécrit pas l'adresse */
      var u = new URL(el.href, location.href); u.searchParams.delete('play');
      history.replaceState(null, '', location.pathname + '?' + u.searchParams.toString());
      document.title = st.parts.name + ' — ' + baseTitle;
    } catch (e) {}
    bar.classList.remove('open'); bar.querySelectorAll('.uvx-zone').forEach(function (x) { x.classList.remove('open'); });
    q('.uvx-full').classList.remove('on');
    render(); cfgRefresh();
  }
  /* titre d'origine mémorisé une fois : une relance du moteur ne doit pas empiler les noms d'étapes */
  if (!window.__UVX_TITLE0) window.__UVX_TITLE0 = document.title;
  var baseTitle = window.__UVX_TITLE0;

  /* F3 + F10 */
  function render() {
    var all = flat(), idx = cur ? all.indexOf(cur) : -1;
    bar.querySelectorAll('.uvx-zone').forEach(function (d) { d.classList.toggle('on', !!cur && +d.dataset.zi === cur.zi); });
    bar.querySelectorAll('.uvx-step').forEach(function (b) {
      b.classList.toggle('cur', !!cur && b.dataset.key === cur.key);
      var v = b.querySelector('.v'); if (v) v.textContent = visited[b.dataset.key] ? '✓' : '';
    });
    var mid = q('.uvx-car .mid');
    if (!cur) { mid.querySelector('b').textContent = 'Commencer la visite'; mid.querySelector('span').textContent = all.length + ' espaces'; }
    else {
      var z = zones[cur.zi];
      mid.querySelector('b').textContent = cur.parts.name;
      mid.querySelector('span').textContent = (cur.i + 1) + ' / ' + z.steps.length + ' — ' + z.label;
    }
    q('.uvx-car .prev').disabled = idx <= 0;
    q('.uvx-car .next').disabled = idx >= all.length - 1;
    var card = q('.uvx-card');
    if (!cur || cardAway) { card.classList.add('hide'); return; }
    card.querySelector('.eb').textContent = cur.group || zones[cur.zi].label;
    card.querySelector('h2').textContent = cur.parts.name;
    var fig = card.querySelector('.fig'); fig.textContent = cur.parts.fig; fig.style.display = cur.parts.fig ? '' : 'none';
    var p = card.querySelector('p'), more = card.querySelector('.more');
    p.textContent = cur.fiche ? cur.fiche.lead : ''; p.style.display = cur.fiche ? '' : 'none';
    more.style.display = cur.fiche ? '' : 'none';
    card.classList.remove('hide');
  }
  q('.uvx-car .mid').addEventListener('click', function () { if (!cur) go(flat()[0]); });
  q('.uvx-car .prev').addEventListener('click', function () { var a = flat(); go(a[a.indexOf(cur) - 1]); });
  q('.uvx-car .next').addEventListener('click', function () { var a = flat(); go(a[cur ? a.indexOf(cur) + 1 : 0]); });

  /* F11 */
  var modal = q('.uvx-modal');
  q('.uvx-card .more').addEventListener('click', function () {
    if (!cur || !cur.fiche) return; tick();
    modal.querySelector('.eb').textContent = cur.group || zones[cur.zi].label;
    modal.querySelector('h2').textContent = cur.fiche.title;
    modal.querySelector('.body').innerHTML = cur.fiche.html;
    modal.classList.add('on');
  });
  modal.addEventListener('click', function (e) { if (e.target === modal || e.target.classList.contains('uvx-x')) modal.classList.remove('on'); });

  /* F4 + F14 : menu plein écran — arborescence alignée à gauche, aperçu photo à droite */
  var full = q('.uvx-full'), c1 = full.querySelector('.col1'), prev = full.querySelector('.uvx-prev'), sel = null;
  function photoFor(st) { return byKey(OPTIONS.photos, st.parts.name) || (st.fiche && st.fiche.photo) || null; }   /* photo dédiée d'abord, sinon celle de la balise-fiche */
  function preview(st) {
    sel = st;
    full.querySelectorAll('.uvx-fstep').forEach(function (b) { b.classList.toggle('sel', b.dataset.key === st.key); });
    var ph = photoFor(st), box = prev.querySelector('.ph'), token = (preview.t = (preview.t || 0) + 1);
    box.style.backgroundImage = ''; box.classList.add('ld');
    box.querySelector('.none').style.display = ph ? 'none' : '';
    if (ph) {   /* on ne montre la photo qu'une fois chargée, et seulement si c'est toujours la bonne */
      var im = new Image();
      im.onload = function () { if (preview.t !== token) return; box.style.backgroundImage = 'url("' + ph + '")'; box.classList.remove('ld'); };
      im.onerror = function () { if (preview.t !== token) return; box.querySelector('.none').style.display = ''; box.classList.remove('ld'); };
      im.src = ph;
    } else box.classList.remove('ld');
    prev.querySelector('.eb').textContent = st.group || zones[st.zi].label;
    prev.querySelector('h3').textContent = st.parts.name;
    var f = prev.querySelector('.fig'); f.textContent = st.parts.fig; f.style.display = st.parts.fig ? '' : 'none';
    var p = prev.querySelector('p'); p.textContent = st.fiche ? st.fiche.lead : ''; p.style.display = st.fiche ? '' : 'none';
  }
  function openZone(zi, only) {
    c1.querySelectorAll('.uvx-fz').forEach(function (b) { if (+b.dataset.zi === zi) b.classList.toggle('open', only ? true : !b.classList.contains('open')); });
  }
  zones.forEach(function (z, zi) {
    var b = document.createElement('button'); b.className = 'uvx-fz'; b.dataset.zi = zi;
    b.innerHTML = '<span class="ico">' + (zi + 1) + '</span><span><b>' + z.label + '</b><span class="m">' + z.steps.length + (z.steps.length > 1 ? ' espaces' : ' espace') +
      (z.nFiches ? ' · ' + z.nFiches + ' fiche' + (z.nFiches > 1 ? 's' : '') : '') + '</span></span><span class="chev">›</span>';
    b.addEventListener('click', function () { tick(); openZone(zi); if (z.steps.length) preview(z.steps[0]); });
    c1.appendChild(b);
    var l = document.createElement('div'); l.className = 'uvx-fl'; var h = '', g = null;
    z.steps.forEach(function (st) {
      if (st.group !== g) { g = st.group; if (g) h += '<div class="grp">' + g + '</div>'; }
      h += '<button class="uvx-fstep' + (st.depth ? ' sub' : '') + '" style="' + (st.depth ? 'padding-left:' + (22 * st.depth) + 'px' : '') + '" data-key="' + st.key + '"><i></i>' + st.parts.name + (st.parts.fig ? ' <span class="f">· ' + st.parts.fig + '</span>' : '') + '<span class="v"></span></button>';
    });
    l.innerHTML = h; c1.appendChild(l);
  });
  c1.addEventListener('mouseover', function (e) { var b = e.target.closest('.uvx-fstep'); if (b && window.matchMedia('(hover:hover)').matches) { var k = b.dataset.key.split(':'); preview(zones[+k[0]].steps[+k[1]]); } });
  c1.addEventListener('click', function (e) {
    var b = e.target.closest('.uvx-fstep'); if (!b) return;
    var k = b.dataset.key.split(':'), st = zones[+k[0]].steps[+k[1]];
    if (sel === st && e.detail >= 1 && b.dataset.armed === '1') { go(st); return; }   /* second clic : on y va */
    full.querySelectorAll('.uvx-fstep').forEach(function (x) { x.dataset.armed = ''; }); b.dataset.armed = '1';
    tick(); preview(st);
  });
  c1.addEventListener('dblclick', function (e) { var b = e.target.closest('.uvx-fstep'); if (!b) return; var k = b.dataset.key.split(':'); go(zones[+k[0]].steps[+k[1]]); });
  prev.querySelector('.goto').addEventListener('click', function () { if (sel) go(sel); });
  function showZone(zi) {
    full.querySelectorAll('.uvx-fstep .v').forEach(function (v) { v.textContent = visited[v.parentNode.dataset.key] ? '✓' : ''; });
    c1.querySelectorAll('.uvx-fz').forEach(function (b) { b.classList.toggle('open', +b.dataset.zi === zi); });
    preview(cur || zones[zi].steps[0]);
  }
  full.querySelector('.uvx-x').addEventListener('click', function () { full.classList.remove('on'); });

  /* Outils : F7, F20, F19, plein écran, F4 */
  q('.menu').addEventListener('click', function () { tick(); showZone(cur ? cur.zi : 0); full.classList.add('on'); });
  q('.eye').addEventListener('click', function () { tick(); root.classList.toggle('bare'); document.body.classList.toggle('uvx-bare'); this.classList.toggle('off'); });
  q('.blur').addEventListener('click', function () { document.body.classList.toggle('uvx-novign'); this.classList.toggle('off'); });
  var sndOn = false;
  q('.snd').addEventListener('click', function () {   /* musique native MPskin : cfg.bgAudio.play / stop */
    sndOn = !sndOn; this.classList.toggle('off', !sndOn);
    try { if (cfg.bgAudio) { sndOn ? cfg.bgAudio.play() : cfg.bgAudio.stop(); } } catch (e) {}
  });
  q('.fs').addEventListener('click', function () {
    var d = document; if (!d.fullscreenElement) d.documentElement.requestFullscreen && d.documentElement.requestFullscreen(); else d.exitFullscreen();
  });
  function onKey(e) { if (e.key === 'Escape') { modal.classList.remove('on'); full.classList.remove('on'); epClose(); var a = root.querySelector('.uvx-ask .ans'); if (a) a.classList.remove('on'); } }
  window.addEventListener('keydown', onKey, true);

  /* ---------- F5 : points de déplacement libellés (projection SDK) ---------- */
  /* SDK : DEVY conseille cfg.extendMPskin.push(fn). Constaté le 07/10/2026 : c'est un simple tableau, un rappel poussé APRÈS
     l'initialisation n'est jamais appelé. Donc : SDK déjà prêt → on le prend ; sinon → extendMPskin. */
  /* DEVY 09/10 : cfg.extendMPskin n'est lu qu'une fois au démarrage ; cfg.mpSdk est renseigné dès que le SDK est prêt ;
     aucun événement officiel « SDK prêt ». Donc : cfg.mpSdk s'il existe, sinon inscription ET scrutation (100 ms, 30 s max).
     Chaque module n'est appelé qu'UNE fois, chacun isolé dans un try. */
  var sdk = (window.cfg && cfg.mpSdk) || null, hsSubs = [], sdkWait = [], sdkPoll = null, sdkT0 = Date.now();
  function sdkRun(fn, s) { try { fn(s); } catch (e) { console.warn('[UVX] module SDK en erreur', e); } }
  function sdkReady(s) {
    if (!s || !sdkWait) return; sdk = sdk || s;
    if (sdkPoll) { clearInterval(sdkPoll); sdkPoll = null; }
    var w = sdkWait; sdkWait = []; w.forEach(function (fn) { sdkRun(fn, sdk); });
  }
  function withSdk(fn) {
    if (!sdk && window.cfg && cfg.mpSdk) sdk = cfg.mpSdk;
    if (sdk) return sdkRun(fn, sdk);
    if (!sdkWait) return;
    sdkWait.push(fn);
    if (sdkPoll) return;
    try { cfg.extendMPskin.push(sdkReady); } catch (e) {}
    sdkPoll = setInterval(function () {
      if (window.cfg && cfg.mpSdk) sdkReady(cfg.mpSdk);
      else if (Date.now() - sdkT0 > 30000) { clearInterval(sdkPoll); sdkPoll = null; sdkWait = [];
        console.warn('[UVX] SDK Matterport absent après 30 s : modules qui en dépendent désactivés'); }
    }, 100);
  }
  /* v1.2.3 : le « ss » des liens MPskin compte à partir de 1, l'index Matterport (cfg.sweepR) à partir de 0.
     Vérifié en ouvrant ?ss=451 / 447 / 624 : le point atteint a l'index 450 / 446 / 623. */
  var byIdx = {}; try { Object.values(cfg.sweepR || {}).forEach(function (r) { byIdx[r.index + 1] = r.uuid; }); } catch (e) {}
  var dests = [];
  flat().forEach(function (st) {
    try {
      var sid = byIdx[new URL(st.el.href, location.href).searchParams.get('ss')];
      var sw = sid && cfg.sweepData && cfg.sweepData[sid];
      if (!sw) return;
      var b = document.createElement('button'); b.className = 'uvx-hs';
      b.innerHTML = '<span class="c">↑</span><span class="l">' + st.parts.name + (st.parts.fig ? ' · ' + st.parts.fig : '') + '</span>';
      b.onmouseenter = function () { hsLayer.classList.add('hovering'); };
      b.onmouseleave = function () { hsLayer.classList.remove('hovering'); };
      b.onclick = function () { hsLayer.classList.remove('hovering'); go(st); };
      hsLayer.appendChild(b);
      dests.push({ st: st, sid: sid, pos: sw.position, floor: sw.floorInfo && sw.floorInfo.sequence, b: b });
    } catch (e) {}
  });
  if (!CHAMP) withSdk(function (sdk) { if (!sdk.Camera || !sdk.Conversion) return;
    var pose = null, curSid = null;
    var hsUpdate = function () {
      if (!pose || !curSid) return;
      var f = host.querySelector('iframe.showcase'), size = { w: f.clientWidth, h: f.clientHeight };
      var cs = cfg.sweepData[curSid], fl = cs && cs.floorInfo && cs.floorInfo.sequence;
      dests.forEach(function (d) {
        var dist = Math.hypot(d.pos.x - pose.position.x, d.pos.y - pose.position.y, d.pos.z - pose.position.z);
        if (d.sid !== curSid && d.floor === fl && dist > OPTIONS.hotspotMin && dist < OPTIONS.hotspotMax) {
          var s = sdk.Conversion.worldToScreen({ x: d.pos.x, y: d.pos.y - 1.2, z: d.pos.z }, pose, size);
          if (s.z > 0 && s.z < 1 && s.x > 20 && s.x < size.w - 20 && s.y > 60 && s.y < size.h - 90) {
            d.b.style.display = 'flex'; d.b.style.left = s.x + 'px'; d.b.style.top = s.y + 'px'; return;
          }
        }
        d.b.style.display = 'none';
      });
    };
    try { hsSubs.push(sdk.Sweep.current.subscribe(function (s) { curSid = s.sid || s.id; hsUpdate(); })); } catch (e) {}
    try { hsSubs.push(sdk.Camera.pose.subscribe(function (p) { pose = p; hsUpdate(); })); } catch (e) {}
  });

  /* ---------- v1.2.2 : le carton suit le visiteur ----------
     Arrivée à pied sur un point de scan qui est aussi une étape du menu → cette étape devient l'étape courante
     (carton, menu, compteur), sans relancer de déplacement. Point partagé par plusieurs étapes : on garde la zone en cours. */
  var stepsBySid = {};
  flat().forEach(function (st) {
    try { var sid = byIdx[new URL(st.el.href, location.href).searchParams.get('ss')];
      if (sid) { st.sid = sid; (stepsBySid[sid] = stepsBySid[sid] || []).push(st); } } catch (e) {}
  });
  if (!CHAMP) withSdk(function (sdk) {
    try { hsSubs.push(sdk.Sweep.current.subscribe(function (s) {
      var sid = s && (s.sid || s.id), list = sid && stepsBySid[sid];
      /* v1.2.3 (demande de Mickaël) : point de scan sans fiche propre → le carton disparaît plutôt que de décrire un autre espace */
      if (!list || !list.length) { if (cur && cur.sid && sid && sid !== cur.sid && !cardAway) { cardAway = true; render(); } return; }
      if (cur && list.indexOf(cur) >= 0) { if (cardAway) { cardAway = false; render(); } return; }
      cardAway = false;
      var st = (cur && list.filter(function (x) { return x.zi === cur.zi; })[0]) || list[0];
      cur = st; visited[st.key] = 1;
      try { localStorage.setItem(LS, JSON.stringify(visited)); } catch (e) {}
      try { document.title = st.parts.name + ' — ' + baseTitle; } catch (e) {}
      render(); cfgRefresh();
    })); } catch (e) {}
  });

  /* ---------- F15 : même salle, autre configuration (photo 360 en surimpression) ---------- */
  var pv = null, cfgBox = q('.uvx-cfg');
  function loadPannellum(cb) {
    if (window.pannellum) return cb();
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css'; document.head.appendChild(l);
    var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js'; s.onload = cb; document.head.appendChild(s);
  }
  /* Une balise Hotspot Images pointe vers la page panorama de MPskin (/fr/pano/…) : on y lit l'URL de l'image équirectangulaire. */
  function cfgResolve(c, cb) {
    if (c.url || !c.pano) return cb(c.url);
    fetch(c.pano, { credentials: 'same-origin' }).then(function (r) { return r.text(); }).then(function (t) {
      /* panoramaFull = image pleine définition ; panorama = aperçu 800 px chargé en premier par MPskin */
      var m = t.match(/["']?panoramaFull["']?\s*:\s*["']([^"']+)["']/) || t.match(/["']?panorama["']?\s*:\s*["']([^"']+)["']/);
      c.url = m ? m[1].replace(/\\\//g, '/') : null;
      if (!c.url) console.warn('[UVX] panorama introuvable dans', c.pano);
      cb(c.url);
    }).catch(function (e) { console.warn('[UVX] panorama', e); cb(null); });
  }
  function cfgShow(c) {
    if (!c.url) return cfgResolve(c, function (u) { if (u) cfgShow(c); });
    loadPannellum(function () {
      if (!sdk) return;
      sdk.Camera.getPose().then(function (p) {
        if (pv) { try { pv.destroy(); } catch (e) {} }
        pv = pannellum.viewer(pano, { type: 'equirectangular', panorama: c.url, autoLoad: true, yaw: -p.rotation.y + (c.yawOffset || 0),
          pitch: p.rotation.x, hfov: 100, showControls: false, compass: false, crossOrigin: 'anonymous' });
        pv.on('load', function () { pano.classList.add('on'); });
      });
    });
  }
  function cfgHide() {
    pano.classList.remove('on');
    setTimeout(function () { if (pv && !pano.classList.contains('on')) { try { pv.destroy(); } catch (e) {} pv = null; } }, 800);
  }
  function cfgRefresh() {
    cfgHide();
    var list = cur && byKey(OPTIONS.configs, cur.parts.name);
    if (!list) { cfgBox.style.display = 'none'; return; }
    cfgBox.innerHTML = '<div class="eb">Même salle, autre configuration</div><b>' + cur.parts.name + '</b><div class="chips"><button class="chip on" data-i="-1">Vue 3D</button>' +
      list.map(function (c, i) { return '<button class="chip" data-i="' + i + '">' + c.label + '</button>'; }).join('') + '</div>';
    cfgBox.style.display = '';
    cfgBox.querySelectorAll('.chip').forEach(function (b) {
      b.onclick = function () {
        tick(); cfgBox.querySelectorAll('.chip').forEach(function (x) { x.classList.toggle('on', x === b); });
        var i = +b.dataset.i; if (i < 0) cfgHide(); else cfgShow(list[i]);
      };
    });
  }

  /* ---------- F16 : épisodes vidéo, la visite se place sur l'étape de l'épisode ---------- */
  var eps = OPTIONS.episodes;
  if (!eps) eps = [];   /* v1.2.0 : sans balises « · Vidéo · Ép. N » ni épisodes dans la fiche, pas de visite guidée */
  if (false) {
    var mp4 = ((cfg.vsConf && cfg.vsConf.objects) || []).filter(function (o) { return /\.mp4/i.test(o.srcUrl || ''); }).map(function (o) { return o.srcUrl; });
    var all = flat();
    eps = mp4.slice(0, 3).map(function (v, i) { var st = all[[0, 1, all.length - 1][i]]; return { title: st ? st.parts.name : 'Épisode ' + (i + 1), video: v, step: st && st.parts.name }; });
  }
  var ep = q('.uvx-ep'), epBtn = q('.uvx-epbtn');
  if (!eps.length) epBtn.style.display = 'none';
  ep.querySelector('.chips').innerHTML = eps.map(function (e, i) { return '<button class="chip" data-i="' + i + '">Ép. ' + (i + 1) + ' · ' + e.title + '</button>'; }).join('');
  ep.querySelector('.frame').classList.toggle('v916', !!OPTIONS.vertical);
  function epResolve(e, cb) {
    if (e.video || !e.player) return cb();
    fetch(e.player, { credentials: 'same-origin' }).then(function (r) { return r.text(); }).then(function (t) {
      var m = t.match(/https?:[^"'\s<>]+?\.mp4[^"'\s<>]*/i);
      e.video = m ? m[0].replace(/\\\//g, '/').replace(/&amp;/g, '&') : null;
      if (!e.video) console.warn('[UVX] vidéo introuvable dans', e.player);
      cb();
    }).catch(function (x) { console.warn('[UVX] vidéo', x); cb(); });
  }
  function epPlay(i) {
    var e = eps[i];
    if (!e.video && e.player) return epResolve(e, function () { if (e.video) epPlay(i); });
    tick();
    ep.querySelector('h3').textContent = e.title;
    ep.querySelector('.frame').innerHTML = /youtu|vimeo/.test(e.video)
      ? '<iframe allow="autoplay; fullscreen" src="' + e.video + (e.video.indexOf('?') < 0 ? '?' : '&') + 'autoplay=1&rel=0"></iframe>'
      : '<video src="' + e.video + '" autoplay playsinline controls></video>';
    ep.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('on', +c.dataset.i === i); });
    if (e.step) go(stepByName(e.step));
    ep.classList.add('on');
  }
  function epClose() { ep.classList.remove('on'); ep.querySelector('.frame').innerHTML = ''; }
  ep.querySelectorAll('.chip').forEach(function (c) { c.onclick = function () { epPlay(+c.dataset.i); }; });
  ep.querySelector('.uvx-x').onclick = epClose;
  ep.onclick = function (e) { if (e.target === ep) epClose(); };
  epBtn.onclick = function () { epPlay(0); };

  /* ---------- F17 (maquette) : une question sur le lieu ---------- */
  var ask = q('.uvx-ask'), askIn = ask.querySelector('input'), ans = ask.querySelector('.ans');
  askIn.placeholder = OPTIONS.askLabel || 'Une question ?';   /* le libellé du lieu (« Une question sur le CID ? ») vient de la fiche client */
  ['keydown', 'keyup', 'keypress'].forEach(function (t) { askIn.addEventListener(t, function (e) { e.stopPropagation(); }); });
  function esc(x) { return String(x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function stepFor(name) {
    if (!name) return null;
    var n = norm(name).join(' ');
    return stepByName(name) || flat().filter(function (s) { return norm(s.parts.name).join(' ') === n; })[0] || null;
  }
  function spaceHits(text) {   /* recherche d'espaces par leur nom (inchangée) */
    var w = norm(text);
    return flat().map(function (st) {
      var hay = norm(st.label + ' ' + (st.group || '') + ' ' + (st.fiche ? st.fiche.title + ' ' + st.fiche.lead : ''));
      var sc = w.filter(function (x) { return hay.some(function (h) { return h.indexOf(x) === 0 || x.indexOf(h) === 0; }); }).length;
      return { st: st, sc: sc };
    }).filter(function (h) { return h.sc > 0; }).sort(function (a, b) { return b.sc - a.sc; });
  }
  function mailto(question) {
    var c = OPTIONS.contact; if (!c || !c.email) return '';
    var body = 'Bonjour,\n\nMa question : ' + question + '\n\n(Question posée depuis la visite virtuelle' + (cur ? ', espace « ' + cur.parts.name + ' »' : '') + '.)\n';
    return 'mailto:' + c.email + '?subject=' + encodeURIComponent('Question depuis la visite virtuelle') + '&body=' + encodeURIComponent(body);
  }
  function contactBtns(question) {
    var c = OPTIONS.contact; if (!c) return '';
    return (c.email ? '<a class="lnk" href="' + mailto(question) + '">✉ Écrire à ' + esc(c.nom || "l'équipe") + '</a>' : '') +
      (c.tel ? '<a class="lnk ghost" href="tel:' + c.tel.replace(/[^\d+]/g, '') + '">☎ ' + esc(c.tel) + '</a>' : '');
  }
  function logMiss(question) {   /* questions sans réponse : matière première pour enrichir la FAQ */
    try { var k = 'uvx-faq-miss', a = JSON.parse(localStorage.getItem(k) || '[]'); a.push({ q: question, t: Date.now(), espace: cur ? cur.parts.name : '' }); localStorage.setItem(k, JSON.stringify(a.slice(-200))); } catch (e) {}
  }
  function showEntry(e, question, others, spaces) {
    var t = ans.querySelector('.txt'), l = ans.querySelector('.links');
    var st = stepFor(e.step), btn = [];
    if (st) btn.push({ st: st, lbl: 'Voir ' + st.parts.name + ' →' });
    (spaces || []).forEach(function (h) { if (btn.length < 3 && !btn.some(function (b) { return b.st === h.st; })) btn.push({ st: h.st, lbl: h.st.parts.name + ' →', ghost: 1 }); });
    t.innerHTML = '<div class="eb">' + esc(e.theme || 'Questions fréquentes') + '</div><div class="qq">' + esc(e.q) + '</div>' + esc(e.r) +
      (others && others.length ? '<div class="also"><div class="eb">Voir aussi</div>' + others.map(function (o, i) { return '<button type="button" data-o="' + i + '">' + esc(o.e.q) + '</button>'; }).join('') + '</div>' : '') +
      (OPTIONS.contact && OPTIONS.contact.email ? '<div class="foot">Besoin d\'une précision ? <a href="' + mailto(question) + '">Écrire à ' + esc(OPTIONS.contact.nom || "l'équipe") + '</a></div>' : '');
    l.innerHTML = btn.map(function (b, i) { return '<button class="lnk' + (b.ghost ? ' ghost' : '') + '" type="button" data-i="' + i + '">' + esc(b.lbl) + '</button>'; }).join('');
    l.querySelectorAll('.lnk').forEach(function (b) { b.onclick = function () { go(btn[+b.dataset.i].st); ans.classList.remove('on'); }; });
    t.querySelectorAll('.also button').forEach(function (b) { b.onclick = function () { showEntry(others[+b.dataset.o].e, question, [], []); }; });
    ans.scrollTop = 0;
  }
  function answer(text) {
    var r = FAQ.ask(text), h = FAQ.decide(r, OPTIONS.faqSeuil), sp = spaceHits(text);
    var t = ans.querySelector('.txt'), l = ans.querySelector('.links');
    var named = sp.filter(function (x) { return norm(x.st.parts.name).some(function (w) { return norm(text).indexOf(w) >= 0 && w.length > 4; }); });
    /* la question n'est qu'un nom d'espace (« salle Gatsby ») et la FAQ ne parle pas de cet espace : on y conduit */
    var qw = norm(text), pure = named.length && qw.length && qw.every(function (w) { return norm(named[0].st.parts.name).indexOf(w) >= 0; });
    if (h && pure && stepFor(h.e.step) !== named[0].st) h = null;
    if (h) {
      var others = r.hits.slice(1, 4).filter(function (o) { return o.cov >= 0.4 && o.e !== h.e; }).slice(0, 2);
      showEntry(h.e, text, others, named.slice(0, 2));
    } else if (sp.length && sp[0].sc >= Math.max(1, norm(text).length - 1)) {
      /* pas de FAQ, mais la question nomme un espace : on y conduit */
      var top = sp[0].st, hits = sp.slice(0, 3);
      t.textContent = top.fiche ? top.fiche.lead : (top.parts.name + (top.parts.fig ? ' — ' + top.parts.fig : '') + '.');
      l.innerHTML = hits.map(function (x, i) { return '<button class="lnk" type="button" data-i="' + i + '">' + esc(x.st.parts.name) + ' →</button>'; }).join('');
      l.querySelectorAll('.lnk').forEach(function (b) { b.onclick = function () { go(hits[+b.dataset.i].st); ans.classList.remove('on'); }; });
    } else {
      logMiss(text);
      var c = OPTIONS.contact;
      t.innerHTML = '<div class="eb">Une question précise</div>Je n\'ai pas de réponse fiable à cette question dans les informations du lieu.' +
        (c ? ' ' + esc(c.nom ? c.nom.charAt(0).toUpperCase() + c.nom.slice(1) : "L'équipe") + ' vous répond directement' + (c.libelle ? ' (' + esc(c.libelle) + ')' : '') + '.' : ' Essayez avec le nom d\'une salle, une capacité ou un usage.');
      l.innerHTML = contactBtns(text);
    }
    ans.classList.add('on');
  }
  ask.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); if (askIn.value.trim()) { tick(); answer(askIn.value); } });
  ans.querySelector('.close').onclick = function () { ans.classList.remove('on'); };

  /* ---------- Mode « champ seul » : placement autour de l'interface MPskin classique ----------
     Ordinateur / tablette : le menu natif ouvert occupe 360 px à droite → le champ se centre dans l'espace restant.
     Téléphone : menu rabattu par défaut ; ouvert, il couvre l'écran → le champ s'efface (classe cov).
     Toujours au-dessus de la barre native du bas (.action-box.bottom), mesurée. */
  var champObs = null, champT = [];
  function champPlace() {
    if (!CHAMP) return;
    var W = window.innerWidth, H = window.innerHeight, left = 0, right = W, bottom = 16;
    /* L'état du menu se lit sur la classe « on » de .nav-box (posée dès le clic) ; sa largeur sur .nav-cnt.
       On ne se fie pas à la position de .nav-cnt : il glisse pendant ~1 s à l'ouverture comme à la fermeture. */
    var nb = document.querySelector('.nav-box'), nc = document.querySelector('.nav-cnt');
    if (nb && nc && nb.classList.contains('on') && getComputedStyle(nb).display !== 'none') {
      var mw = Math.min(W, nc.offsetWidth || 360);
      if (document.querySelector('.ui-wrap.ui-pos-2')) left = mw; else right = W - mw;
    }
    var ab = document.querySelector('.action-box.my-ui.bottom');
    if (ab) { var b = ab.getBoundingClientRect(); if (b.height > 0 && b.top < H) bottom = Math.round(H - b.top + 10); }
    /* Clavier virtuel (téléphone) : il réduit la zone visible sans toujours changer innerHeight → remonter le champ au-dessus. */
    var vv = window.visualViewport;
    if (vv && ask.contains(document.activeElement)) { var kb = Math.round(H - (vv.height + vv.offsetTop)); if (kb > 80) bottom = Math.max(bottom, kb + 10); }
    var avail = right - left - 24, w = Math.min(480, avail);
    ask.classList.toggle('cov', avail < 240);
    if (avail < 240) { ans.classList.remove('on'); return; }
    var st = root.style; st.setProperty('--uvx-cw', Math.round(w) + 'px');
    st.setProperty('--uvx-cl', Math.round(left + (right - left - w) / 2) + 'px'); st.setProperty('--uvx-cb', bottom + 'px');
  }
  function champFrame() { (window.requestAnimationFrame || setTimeout)(champPlace); }
  function champSoon() { champPlace(); champT.forEach(clearTimeout); champT = [120, 400, 1200].map(function (t) { return setTimeout(champFrame, t); }); }
  if (CHAMP) {
    root.classList.add('uvx-champ'); document.body.classList.add('uvx-champ-on');
    if (MODULES) { root.style.display = 'none'; document.body.classList.add('uvx-modules-on'); }
    ask.querySelector('.ceye').addEventListener('click', function () {
      tick(); var h = ask.classList.toggle('hid'); if (h) ans.classList.remove('on');
      this.title = h ? 'Afficher le champ de question' : 'Masquer le champ de question';
    });
    champObs = new MutationObserver(champSoon);
    ['.nav-box', '.nav-cnt', '.action-box.my-ui.bottom'].forEach(function (s) { var n = document.querySelector(s); if (n) champObs.observe(n, { attributes: true, attributeFilter: ['class', 'style'] }); });
    window.addEventListener('resize', champSoon);
    if (window.visualViewport) { visualViewport.addEventListener('resize', champSoon); visualViewport.addEventListener('scroll', champSoon); }
    ask.addEventListener('focusin', champSoon); ask.addEventListener('focusout', champSoon);
    champSoon(); setTimeout(champPlace, 1500); setTimeout(champPlace, 5000);
  }
  /* v1.1.0 — mode complet sur téléphone : le champ est en bas d'écran ; quand le clavier virtuel s'ouvre, on le remonte
     au-dessus (visualViewport), puis on le rend à sa place à la fermeture. */
  function kbPlace() {
    if (CHAMP) return;
    var vv = window.visualViewport, kb = 0;
    if (vv && ask.contains(document.activeElement)) kb = Math.round(window.innerHeight - (vv.height + vv.offsetTop));
    ask.style.bottom = kb > 80 ? (kb + 12) + 'px' : '';
  }
  function kbSoon() { kbPlace(); setTimeout(kbPlace, 300); setTimeout(kbPlace, 800); }
  if (!CHAMP) {
    if (window.visualViewport) { visualViewport.addEventListener('resize', kbSoon); visualViewport.addEventListener('scroll', kbSoon); }
    ask.addEventListener('focusin', kbSoon); ask.addEventListener('focusout', kbSoon);
  }


  /* ---------- Vue aérienne d'accueil (v1.2.0) — effets façon Juumo sur les hotspots des images interactives MPskin ----------
     La popup d'entrée MPskin (.click-trigger-cnt-start, data-media-type="pano") ouvre /fr/pano/<id> dans une iframe
     Fancybox du même site. On y injecte une feuille de style et deux écouteurs :
       · halo battant sur tous les hotspots, interrompu dès qu'un hotspot est survolé ;
       · hotspot survolé (souris) : icône agrandie, libellé en pastille, les autres voilés ;
       · écran tactile : pas d'effet de survol, le 1er toucher déclenche directement l'action MPskin (comme Juumo).
     MPskin recrée les hotspots au chargement de l'image pleine définition : tout passe par la feuille de style et
     par des écouteurs posés sur le document, jamais sur les hotspots eux-mêmes.
     Avec l'écran d'accueil du moteur : la popup est masquée pendant l'accueil (elle se charge derrière),
     puis révélée — ou ouverte — au clic sur « Démarrer la visite ». */
  var aero = (function () {
    if (OPTIONS.aerien === false) return null;
    var trig = document.querySelector('.click-trigger-cnt-start');
    if (!trig || trig.getAttribute('data-media-type') !== 'pano') return null;
    /* pastille = couleur principale de la charte du client, texte clair ou foncé selon le contraste (exigence de Mickaël) */
    var pill = CHARTE.vars['--uvx-panel-rgb'] || '43,47,54', pillTx = CHARTE.vars['--uvx-fg'] || '#ffffff', font = CHARTE.vars['--uvx-font'];
    var halo = String(OPTIONS.aerienHalo || '#ffffff');
    var hr = /^#?([0-9a-f]{6})$/i.exec(halo.trim()); var hrgb = hr ? [0, 2, 4].map(function (i) { return parseInt(hr[1].substr(i, 2), 16); }).join(',') : '255,255,255';
    var CSS = '@keyframes uvxAeroHalo{0%{box-shadow:0 0 0 0 rgba(' + hrgb + ',.6)}70%{box-shadow:0 0 0 11px rgba(' + hrgb + ',0)}100%{box-shadow:0 0 0 0 rgba(' + hrgb + ',0)}}\n' +
      'html.pano div.custom-tooltip{transition:opacity .35s ease}\n' +
      'html.pano div.custom-tooltip .icon{display:block;border-radius:50%;box-shadow:0 0 0 2px rgba(255,255,255,.95),0 3px 12px rgba(0,0,0,.35);animation:uvxAeroHalo 2.2s infinite;transition:transform .35s cubic-bezier(.2,.8,.2,1);transform-origin:50% 50%}\n' +
      'html.pano.uvx-aero-focus div.custom-tooltip .icon{animation:none}\n' +
      'html.pano.uvx-aero-focus div.custom-tooltip:not(.uvx-on){opacity:.28}\n' +
      'html.pano div.custom-tooltip.uvx-on{z-index:1000!important}\n' +
      'html.pano div.custom-tooltip.uvx-on .icon{transform:scale(1.35)}\n' +
      'html.pano div.custom-tooltip .tt-wrap{visibility:hidden!important;opacity:0;position:absolute!important;left:100%!important;top:50%!important;margin:0 0 0 14px!important;width:auto!important;max-width:none!important;transform:translate(-6px,-50%);transition:opacity .3s,transform .3s;pointer-events:none;white-space:nowrap}\n' +
      'html.pano div.custom-tooltip.uvx-left .tt-wrap{left:auto!important;right:100%!important;margin:0 14px 0 0!important;transform:translate(6px,-50%)}\n' +
      'html.pano div.custom-tooltip.uvx-on .tt-wrap{visibility:visible!important;opacity:1;transform:translate(0,-50%)}\n' +
      'html.pano div.custom-tooltip .tt-wrap .tt{display:inline-block;background:rgba(' + pill + ',.9)!important;color:' + pillTx + '!important;font:600 11px/1 ' + font + ';letter-spacing:.2em;text-transform:uppercase;padding:9px 14px 8px;border-radius:999px;box-shadow:0 0 0 1px rgba(255,255,255,.18),0 6px 18px rgba(0,0,0,.25);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}\n' +
      'html.pano div.custom-tooltip span:after,html.pano div.custom-tooltip:hover span:after{display:none!important;content:none!important}\n' +
      '@media (max-width:767px){html.pano div.custom-tooltip .icon{transform:scale(.8)}html.pano div.custom-tooltip.uvx-on .icon{transform:scale(1.1)}html.pano div.custom-tooltip .tt-wrap .tt{font-size:10px;letter-spacing:.16em;padding:8px 12px 7px}}\n';
    var obs = null, timers = [], touch = window.matchMedia && matchMedia('(hover: none)').matches;
    function enhance(fr) {
      var d; try { d = fr.contentDocument; } catch (e) { return; }
      if (!d || !d.documentElement || !/\bpano\b/.test(d.documentElement.className) || d.getElementById('uvx-aero')) return;
      var st = d.createElement('style'); st.id = 'uvx-aero'; st.textContent = CSS; (d.head || d.documentElement).appendChild(st);
      var w = fr.contentWindow, cur = null;
      function hsOf(t) { return t && t.closest ? t.closest('div.custom-tooltip') : null; }
      function focus(h) {
        if (cur && cur !== h) cur.classList.remove('uvx-on', 'uvx-left');
        cur = h;
        if (h) { var r = h.getBoundingClientRect(); h.classList.toggle('uvx-left', r.left > w.innerWidth * 0.62); h.classList.add('uvx-on'); }
        d.documentElement.classList.toggle('uvx-aero-focus', !!h);
      }
      d.addEventListener('mouseover', function (e) { if (!touch) focus(hsOf(e.target)); }, true);
      d.addEventListener('mouseout', function (e) { if (!touch && !e.relatedTarget) focus(null); }, true);
      /* téléphone et tablette (pas de survol) : aucun effet, le 1er toucher envoie directement dans la visite,
         comme chez Juumo (décision de Mickaël, 09/10/2026) — le halo reste. */
    }
    function scan() { document.querySelectorAll('.fancybox-container iframe').forEach(function (fr) {
      if (!/\/pano\//.test(fr.src || '')) return;
      enhance(fr); if (!fr.__uvxAero) { fr.__uvxAero = 1; fr.addEventListener('load', function () { enhance(fr); }); }
    }); }
    function popOpen() { return !!document.querySelector('.fancybox-container.open-fancybox-pano, .fancybox-container iframe[src*="/pano/"]'); }
    obs = new MutationObserver(function () { scan(); });
    obs.observe(document.body, { childList: true, subtree: true });
    scan();
    return {
      hold: function () { document.body.classList.add('uvx-aero-wait'); },
      reveal: function () {
        document.body.classList.remove('uvx-aero-wait');
        if (window.cfg && cfg.targetUrl) return;            /* lien profond : MPskin n'ouvre pas la popup, nous non plus */
        timers.push(setTimeout(function () {                 /* laisser à MPskin le temps de l'ouvrir lui-même */
          if (!popOpen() && window.jQuery) jQuery('.click-trigger-cnt-start').first().trigger('click');
        }, 450));
        timers.push(setTimeout(scan, 600), setTimeout(scan, 2000));
      },
      open: function () { if (!popOpen() && window.jQuery) jQuery('.click-trigger-cnt-start').first().trigger('click'); timers.push(setTimeout(scan, 800)); },
      stop: function () { if (obs) obs.disconnect(); timers.forEach(clearTimeout); },
      scan: scan
    };
  })();

  /* ---------- F18 : intro (rappelable par le bouton Accueil) ---------- */
  function showIntro() {
    var old = root.querySelector('.uvx-intro'); if (old) old.remove();
    var intro = document.createElement('div'); intro.className = 'uvx-intro';
    var pj = document.querySelector('.nav-cnt .section.title .project');
    var hasVid = OPTIONS.introVideo || OPTIONS.introPlayer;
    var vid = hasVid ? '<video class="bg"' + (OPTIONS.introVideo ? ' src="' + OPTIONS.introVideo + '"' : '') + (OPTIONS.introPoster ? ' poster="' + OPTIONS.introPoster + '"' : '') + ' autoplay muted loop playsinline></video><div class="shade"></div>' : '';
    if (!OPTIONS.introVideo && OPTIONS.introPlayer) {   /* vidéo d'accueil lue dans le lecteur MPskin : URL du MP4 résolue à la demande */
      var ie = { player: OPTIONS.introPlayer };
      epResolve(ie, function () { if (!ie.video) return; OPTIONS.introVideo = ie.video;
        var v = intro.querySelector('video.bg'); if (v) { v.src = ie.video; var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); } });
    }
    if (vid) intro.classList.add('vid');
    intro.innerHTML = vid + '<div class="in"><div class="eb">Bienvenue</div><h1>' + (OPTIONS.introTitle || (pj ? pj.textContent.trim() : baseTitle)) + '</h1>' +
      '<button class="go-btn">' + OPTIONS.introButton + '</button></div>' + (vid ? '' : '<button class="skip">Passer l\'intro</button>');
    root.appendChild(intro);
    if (aero) aero.hold();
    var leave = function () { tick(); intro.classList.add('go'); setTimeout(function () { intro.remove(); }, 2400); if (aero) aero.reveal(); };
    var sk = intro.querySelector('.skip'); if (!sk) { sk = document.createElement('i'); }
    intro.querySelector('.go-btn').addEventListener('click', leave);
    sk.addEventListener('click', leave);
  }
  function goHome() {
    tick();
    /* fermer tout ce qui est ouvert */
    root.querySelectorAll('.uvx-ep.on .uvx-x, .uvx-modal.on .uvx-x, .uvx-full.on .uvx-x').forEach(function (b) { b.click(); });
    var ans2 = root.querySelector('.uvx-ask .ans'); if (ans2) ans2.classList.remove('on');
    var c3d = root.querySelector('.uvx-cfg .chip'); if (pano.classList.contains('on') && c3d) c3d.click();
    root.classList.remove('bare'); document.body.classList.remove('uvx-bare');
    var eyeB = root.querySelector('.uvx-tool.eye'); if (eyeB) eyeB.classList.remove('off');
    var first = flat()[0]; if (first) go(first);
    if (aero) aero.open(); else showIntro();   /* v1.2.1 : avec une vue aérienne, la maison la rouvre */
  }
  root.querySelector('.uvx-tool.home').addEventListener('click', goHome);
  /* v1.2.1 (décision de Mickaël) : s'il y a une vue aérienne d'accueil, pas d'écran d'accueil — elle s'affiche en premier */
  if (OPTIONS.intro && !CHAMP && !aero && !window.__UVX_NOINTRO) showIntro();

  render();
  window.UVX = {
    key: key, zones: zones, fiches: fiches, go: go, options: OPTIONS, charte: CHARTE,
    setCharte: function (ch) { CHARTE = uvxCharte(ch); OPTIONS.charte = ch; style.textContent = CHARTE.css + css; window.UVX.charte = CHARTE; return CHARTE.report; },
    home: goHome, mode: OPTIONS.mode, champPlace: champPlace,
    faq: FAQ, ask: answer, aero: aero,
    faqMisses: function () { try { return JSON.parse(localStorage.getItem('uvx-faq-miss') || '[]'); } catch (e) { return []; } },
    destroy: function () {
      hsSubs.forEach(function (s) { try { s.cancel(); } catch (e) {} });
      if (sdkPoll) clearInterval(sdkPoll); sdkWait = null;
      if (window.visualViewport) { visualViewport.removeEventListener('resize', champSoon); visualViewport.removeEventListener('scroll', champSoon); }
      if (window.visualViewport) { visualViewport.removeEventListener('resize', kbSoon); visualViewport.removeEventListener('scroll', kbSoon); }
      if (pv) { try { pv.destroy(); } catch (e) {} }
      [root, style, back, pano, hsLayer].forEach(function (n) { n.remove(); });
      document.body.classList.remove('uvx-bare', 'uvx-novign', 'uvx-champ-on', 'uvx-modules-on', 'uvx-aero-wait');
      if (aero) aero.stop();
      if (champObs) champObs.disconnect(); champT.forEach(clearTimeout); window.removeEventListener('resize', champSoon);
      window.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', placeUnderLogo);
    }
  };
})();

  }

  /* ---------- Démarrage : la page MPskin doit être prête (menu + modèle) ; le SDK est attendu 20 s au plus,
     les modules qui en dépendent s'y raccrochent ensuite d'eux-mêmes. Aucun recours à DOMContentLoaded :
     le script peut arriver après. ---------- */
  var sentinel = null, lang = null;
  function menuReady() { return !!(window.jQuery && document.querySelector('.nav-cnt .section.cnt a') && document.querySelector('.ui-wrap .mp-model')); }
  function run(again) {
    window.__UVX_NOINTRO = !!again;
    try {
      ENGINE();
      if (window.UVX) window.UVX.version = VERSION;
      console.log('[UVX] v' + VERSION + (again ? ' relancé (menu reconstruit)' : ' démarré') + ' — mode ' + (window.UVX && window.UVX.mode));
    } catch (e) { console.error('[UVX] démarrage impossible', e); }
    window.__UVX_NOINTRO = false;
    sentinel = document.querySelector('.nav-cnt .section.cnt');
    lang = document.documentElement.getAttribute('lang');
  }
  function whenReady(fn, label) {
    var t0 = Date.now();
    (function poll() {
      var waited = Date.now() - t0;
      if (menuReady() && ((window.cfg && window.cfg.mpSdk) || waited > 20000)) return setTimeout(fn, 300);
      if (waited > 45000) return console.warn('[UVX] ' + label + ' : page MPskin non prête après 45 s, moteur non démarré');
      setTimeout(poll, 250);
    })();
  }
  whenReady(function () { run(false); }, 'démarrage');

  /* ---------- Changement de langue (ou reconstruction du menu par MPskin) : MPskin recrée le menu et les
     balises ; on relance le moteur, sans l'accueil, une fois le nouveau menu en place. ---------- */
  var pending = false;
  setInterval(function () {
    if (pending || !sentinel || !window.UVX) return;
    var langNow = document.documentElement.getAttribute('lang');
    if (sentinel.isConnected && langNow === lang) return;
    pending = true;
    setTimeout(function () { whenReady(function () { pending = false; run(true); }, 'relance'); }, 800);
  }, 1000);
})();

/* „Woasch no?" – die Spieler-App */
(function () {
  'use strict';
  var W = window.WN, esc = W.esc, el = W.el, I = W.ICON;
  var S = { token: null, stand: null, ansicht: 'kalender', rang: 'einzel', tuer: null, tag: null, entwurf: {}, nachfrage: null, laeuft: false };
  var app, uhr;
  var TYPNAME = { auswahl: 'Rätselfrage', schaetzen: 'Schätzfrage', dalli: 'Dalli Klick', zoom: 'Zoom-Rätsel', zeitstrahl: 'Zeitstrahl', video: 'Video-Stopp', frei: 'Freitext' };
  var BST = 'ABCDEFGH';
  var weniger = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function zahl(x) { return String(x).replace('.', ','); }

  /* ───────── Start & Laden ───────── */
  async function start(token) {
    S.token = token;
    app = document.getElementById('app');
    document.body.classList.remove('ohne-nav');
    if (!token) return fehlerSeite({ fehler: 'link' });
    app.innerHTML = '<div class="meldung"><div class="spinner"></div><p class="leise">Das Christkindl sucht die Fotos zusammen …</p></div>';
    await standLaden();
    if (!uhr) uhr = setInterval(ticken, 20000);
  }

  async function standLaden() {
    var r = await W.anfrage({ a: 'stand', t: S.token });
    if (!r.ok) return fehlerSeite(r);
    S.stand = r;
    zeichne();
  }

  function fehlerSeite(r) {
    document.body.classList.add('ohne-nav');
    var titel = 'Hoppla!', text = r.text || 'Da ist etwas schiefgegangen.';
    if (r.fehler === 'link') { titel = 'Dieser Link passt nicht'; text = 'Bitte lass dir deinen persönlichen Link nochmal schicken – er steht in der Einladung im Familien-Chat.'; }
    if (r.fehler === 'vorbei') { titel = 'Frohe Weihnachten!'; text = 'Der Adventskalender ist vorbei. Danke fürs Mitraten – bis zum nächsten Advent! ⭐'; }
    app.innerHTML = '<div class="wrap meldung"><div class="stern-deko">' + I.stern + '</div><h2>' + esc(titel) + '</h2><p>' + esc(text) + '</p>' +
      (r.fehler === 'netz' || r.fehler === 'server' ? '<button class="knopf" type="button" id="nochmal">Nochmal probieren</button>' : '') + '</div>';
    var b = document.getElementById('nochmal'); if (b) b.onclick = function () { start(S.token); };
  }

  function ticken() {
    if (!S.stand) return;
    var j = W.jetzt();
    var wechsel = S.stand.tueren.some(function (t) {
      return (t.status === 'zu' && j >= t.oeffnet) || ((t.status === 'offen' || t.status === 'beantwortet') && j >= t.schliesst);
    });
    if (wechsel) { standLaden(); if (S.tuer) tuerLaden(S.tag); return; }
    var cd = document.querySelector('[data-countdown]');
    if (cd) cd.textContent = W.dauer(Number(cd.dataset.countdown) - j);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && S.stand && !S.laeuft) { standLaden(); if (S.tuer) tuerLaden(S.tag); }
  });

  /* ───────── Gerüst ───────── */
  function zeichne() {
    var st = S.stand;
    app.innerHTML =
      '<header class="kopf"><div class="wrap"><div class="kopf-zeile"><div><p class="eyebrow">' + esc(st.untertitel || 'Familien-Adventskalender') + '</p>' +
      '<h1>' + esc(st.titel) + '</h1></div><div class="stern-deko">' + I.stern + '</div></div>' +
      '<p class="hallo">Griaß di, <b>' + esc(st.ich.name) + '</b>!</p></div>' + I.berge + '</header>' +
      '<main class="wrap" id="inhalt"></main>' +
      '<nav class="nav" aria-label="Bereiche"><div class="wrap">' +
      navKnopf('kalender', 'Kalender', I.kalender) + navKnopf('rangliste', 'Rangliste', I.pokal) + navKnopf('regeln', 'So geht\'s', I.buch) +
      '</div></nav>';
    app.querySelectorAll('.nav button').forEach(function (b) {
      b.onclick = function () { S.ansicht = b.dataset.ansicht; zeichne(); window.scrollTo(0, 0); };
    });
    var inhalt = document.getElementById('inhalt');
    if (S.ansicht === 'rangliste') zeichneRangliste(inhalt);
    else if (S.ansicht === 'regeln') zeichneRegeln(inhalt);
    else zeichneKalender(inhalt);
  }

  function navKnopf(id, text, icon) {
    return '<button type="button" data-ansicht="' + id + '"' + (S.ansicht === id ? ' aria-current="page"' : '') + '>' + icon + '<span>' + text + '</span></button>';
  }

  /* ───────── Kalender ───────── */
  function heuteTuer() {
    var iso = W.heuteIso(), tt = S.stand.tueren;
    return tt.find(function (t) { return t.datum === iso; }) || tt.find(function (t) { return t.status === 'zu'; }) || tt[tt.length - 1];
  }

  function zeichneKalender(ziel) {
    var st = S.stand, h = heuteTuer(), j = W.jetzt();
    var name = h.tag === 0 ? 'Probetürchen' : 'Türchen ' + h.tag;
    var karte = '';
    var specialHtml = h.special ? '<span class="abzeichen special">' + esc(h.special) + (h.faktor > 1 ? ' · Punkte ×' + h.faktor : '') + '</span>' : '';
    if (h.status === 'zu') {
      var heute = h.datum === W.heuteIso();
      karte = '<p class="datum">' + esc(W.fmtDatum(h.datum)) + '</p>' +
        '<h2>' + name + (heute ? ' öffnet um ' + st.oeffnen + ' Uhr' : ' kommt bald') + '</h2>' + specialHtml +
        '<p class="unter">Das Christkindl ist noch nicht so weit. Noch</p>' +
        '<p class="countdown" data-countdown="' + h.oeffnet + '">' + W.dauer(h.oeffnet - j) + '</p>';
      var probe = st.tueren.find(function (t) { return t.tag === 0; });
      if (probe && probe.status === 'offen') karte += '<button class="knopf zart breit" type="button" data-tag="0">Probetürchen ausprobieren</button>';
    } else if (h.status === 'offen') {
      karte = '<p class="datum">' + esc(W.fmtDatum(h.datum)) + '</p><h2>' + name + ' ist offen!</h2>' + specialHtml +
        (h.titel ? '<p class="unter">„' + esc(h.titel) + '“</p>' : '') +
        '<button class="knopf gold breit" type="button" data-tag="' + h.tag + '">' + I.stern + ' ' + name + ' öffnen</button>' +
        fortschritt(h) + '<p class="leise">Mitraten bis ' + st.schluss + ' Uhr.</p>';
    } else if (h.status === 'beantwortet') {
      karte = '<p class="datum">' + esc(W.fmtDatum(h.datum)) + '</p><h2>Erledigt! ' + I.haken + '</h2>' +
        '<p class="unter">Die Auflösung kommt um ' + st.schluss + ' Uhr – oder schon früher, sobald alle fertig sind.</p>' + fortschritt(h) +
        '<button class="knopf zart breit" type="button" data-tag="' + h.tag + '">' + name + ' nochmal anschauen</button>';
    } else {
      var letzte = h.tag === 24;
      karte = '<p class="datum">' + esc(W.fmtDatum(h.datum)) + '</p><h2>' + (letzte ? 'Frohe Weihnachten!' : 'Die Auflösung ist da!') + '</h2>' +
        (h.wertung ? '<p class="unter">Deine Punkte für ' + name + ': <b class="zahl">' + (h.punkte || 0) + '</b></p>' : '') +
        '<div class="zeile"><button class="knopf breit" type="button" data-tag="' + h.tag + '">Auflösung ansehen</button>' +
        '<button class="knopf zart breit" type="button" data-zu="rangliste">' + (letzte ? 'Endstand' : 'Rangliste') + '</button></div>';
      var naechste = st.tueren.find(function (t) { return t.status === 'zu'; });
      if (naechste) karte += '<p class="leise">Nächstes Türchen: ' + esc(W.fmtDatum(naechste.datum)) + ', ' + st.oeffnen + ' Uhr.</p>';
    }

    var tueren = st.tueren.map(function (t) { return tuerchenHtml(t, t.tag === h.tag); }).join('');
    ziel.innerHTML =
      '<section class="karte heute" aria-live="polite">' + karte + '</section>' +
      '<section class="abschnitt"><h2>Der Kalender</h2><div class="kalender">' + tueren + '</div>' +
      '<p class="kalender-hinweis">Die Türchen sind im Bild versteckt – such einmal! Das heutige leuchtet.</p></section>' +
      gedichtHtml();
    ziel.querySelectorAll('[data-tag]').forEach(function (b) { b.onclick = function () { tuerKlick(Number(b.dataset.tag)); }; });
    ziel.querySelectorAll('[data-zu]').forEach(function (b) { b.onclick = function () { S.ansicht = b.dataset.zu; zeichne(); window.scrollTo(0, 0); }; });
  }

  function fortschritt(t) {
    if (t.fertigAnzahl == null) return '';
    var n = S.stand.spieler.length, punkte = '';
    for (var i = 0; i < n; i++) punkte += '<i class="' + (i < t.fertigAnzahl ? 'an' : '') + '"></i>';
    var fehlen = t.fehlen && t.fehlen.length ? ' · Es fehlen noch: ' + esc(t.fehlen.join(', ')) : ' · Alle sind fertig!';
    return '<div class="fortschritt"><span class="punktreihe" aria-hidden="true">' + punkte + '</span><span>' + t.fertigAnzahl + ' von ' + n + ' fertig' + fehlen + '</span></div>';
  }

  function tuerchenHtml(t, istHeute) {
    var cls = 'tuerchen', innen = '', zustand;
    if (t.status === 'zu') { cls += ' zu'; zustand = 'noch zu'; }
    else if (t.status === 'offen') { cls += istHeute ? ' heute-offen' : ''; zustand = 'offen'; if (t.geoeffnet) cls += ' angelehnt'; }
    else if (t.status === 'beantwortet') { cls += ' angelehnt'; innen = I.haken; zustand = 'beantwortet'; }
    else {
      cls += ' offen';
      if (!t.wertung) { innen = '<span>Probe<small>ausprobiert</small></span>'; zustand = 'Probe'; }
      else if (t.mitgespielt) { innen = '<span class="zahl">+' + t.punkte + '<small>Punkte</small></span>'; zustand = t.punkte + ' Punkte'; }
      else { cls += ' verpasst'; innen = '<span>–<small>verpasst</small></span>'; zustand = 'verpasst'; }
    }
    if (t.tag === 0) cls += ' probe';
    var nr = t.tag === 0 ? 'Probe' : t.tag;
    var marke = t.faktor > 1 ? '<span class="marke">×' + t.faktor + '</span>' : '';
    var P = (window.WN_TUERPLAN || {})[t.tag], stil = '';
    if (P) {
      stil = ' style="left:' + P[0] + '%;top:' + P[1] + '%;width:' + P[2] + '%;height:' + P[3] + '%;' +
        '--bgs:' + (10000 / P[2]).toFixed(2) + '% ' + (10000 / P[3]).toFixed(2) + '%;' +
        '--bgp:' + (P[0] / (100 - P[2]) * 100).toFixed(2) + '% ' + (P[1] / (100 - P[3]) * 100).toFixed(2) + '%"';
    }
    return '<button type="button" class="' + cls + '" data-tag="' + t.tag + '"' + stil + ' aria-label="' + (t.tag === 0 ? 'Probetürchen' : 'Türchen ' + t.tag) + ', ' + zustand + '">' +
      '<span class="innen">' + innen + '</span><span class="blatt"><span class="nr">' + nr + '</span><span class="knauf"></span>' + marke + '</span></button>';
  }

  function gedichtHtml() {
    var zeilen = S.stand.tueren.filter(function (t) { return t.tag > 0 && t.status !== 'zu'; });
    if (!zeilen.length) {
      return '<section class="abschnitt"><h2>Das Christkindl-Gedicht</h2><p class="leise">Jeden Tag gibt es nach dem Raten eine Zeile dazu. Am Heiligen Abend ist das Gedicht komplett.</p></section>';
    }
    var anzahl = zeilen.filter(function (t) { return t.vers; }).length;
    var html = zeilen.map(function (t) {
      return t.vers ? '<span class="' + (t.status === 'beantwortet' ? 'neu' : '') + '">' + esc(t.vers) + '</span>' : '<span class="fehlt" title="Türchen ' + t.tag + '">· · ·</span>';
    }).join('');
    return '<section class="abschnitt"><h2>Das Christkindl-Gedicht</h2><p class="leise" style="margin-bottom:10px">' + anzahl + ' von 24 Zeilen gesammelt</p>' +
      '<div class="karte gedicht">' + html + '</div></section>';
  }

  function tuerKlick(tag) {
    var t = S.stand.tueren.find(function (x) { return x.tag === tag; });
    if (!t) return;
    if (t.status === 'zu') {
      W.toast((tag === 0 ? 'Das Probetürchen' : 'Türchen ' + tag) + ' öffnet am ' + W.fmtDatumKurz(t.datum) + ' um ' + S.stand.oeffnen + ' Uhr.');
      return;
    }
    oeffneTuer(tag, !t.geoeffnet);
  }

  /* ───────── Rangliste ───────── */
  function zeichneRangliste(ziel) {
    var r = S.stand.rangliste, ich = S.stand.ich;
    var info = r.letzterTag == null
      ? 'Noch keine Punkte – die erste Auflösung gibt\'s am 1. Dezember um ' + S.stand.schluss + ' Uhr.'
      : 'Stand nach Türchen ' + r.letzterTag + '.';
    var liste = S.rang === 'teams' ? r.teams : r.einzel;
    var max = Math.max.apply(null, liste.map(function (x) { return x.punkte; }).concat([1]));
    var zeilen = liste.map(function (x) {
      var istIch = S.rang === 'teams' ? x.id === ich.team : x.id === ich.id;
      var unter = '';
      if (S.rang === 'teams') {
        unter = S.stand.spieler.filter(function (s) { return s.team === x.id; }).map(function (s) { return s.name; }).join(' & ');
      } else {
        var tm = S.stand.teams.find(function (t) { return t.id === x.team; });
        unter = 'Team ' + (tm ? tm.name : '');
      }
      var trend = '';
      if (x.vorher != null) {
        var d = x.vorher - x.platz;
        trend = d > 0 ? '<span class="trend-auf">▲ ' + d + '</span>' : d < 0 ? '<span class="trend-ab">▼ ' + (-d) + '</span>' : '<span class="leise">–</span>';
      }
      var medaille = x.platz <= 3 && r.letzterTag != null
        ? W.ICON.medaille(['#d9a93a', '#b9c0c6', '#c58a52'][x.platz - 1]) + '<b>' + x.platz + '</b>'
        : String(x.platz);
      return '<div class="rangzeile' + (istIch ? ' ich' : '') + '">' +
        '<div class="platz zahl">' + medaille + '</div>' +
        '<div class="name">' + esc(x.name) + (istIch ? ' <span class="abzeichen gold">' + (S.rang === 'teams' ? 'dein Team' : 'du') + '</span>' : '') + '<small>' + esc(unter) + '</small></div>' +
        '<div class="wert zahl">' + x.punkte + '<small>' + (x.zuletzt != null ? '+' + x.zuletzt + ' zuletzt ' : '') + trend + '</small></div>' +
        '<div class="balken"><i style="width:' + Math.round(100 * x.punkte / max) + '%"></i></div></div>';
    }).join('');
    ziel.innerHTML = '<section class="abschnitt" style="margin-top:14px"><h2>Rangliste</h2>' +
      '<div class="umschalter" role="group" aria-label="Wertung"><button type="button" data-r="einzel" aria-pressed="' + (S.rang === 'einzel') + '">Einzeln</button>' +
      '<button type="button" data-r="teams" aria-pressed="' + (S.rang === 'teams') + '">Teams</button></div>' +
      '<p class="leise" style="margin-bottom:12px">' + info + '</p><div class="rang">' + zeilen + '</div></section>';
    ziel.querySelectorAll('[data-r]').forEach(function (b) { b.onclick = function () { S.rang = b.dataset.r; zeichne(); }; });
  }

  /* ───────── Regeln ───────── */
  function zeichneRegeln(ziel) {
    var st = S.stand;
    var ausgleich = st.spieler.filter(function (s) { return s.ausgleich > 1; }).map(function (s) { return esc(s.name) + ' ×' + zahl(s.ausgleich); }).join(', ');
    var j = st.joker || {};
    ziel.innerHTML = '<section class="abschnitt regeln" style="margin-top:14px"><h2 style="font-family:var(--f-zier);font-weight:800;font-size:28px">So geht\'s</h2>' +
      '<div class="karte regeln"><ul>' +
      '<li>Jeden Tag ab <b>' + st.oeffnen + ' Uhr</b> geht ein Türchen auf – mit einem alten Familienfoto und einer Frage.</li>' +
      '<li>Du kannst raten, wann du willst – bis <b>' + st.schluss + ' Uhr</b>.</li>' +
      '<li>Die Auflösung kommt um ' + st.schluss + ' Uhr. Wenn alle früher fertig sind, auch früher.</li>' +
      '<li>Ein verpasstes Türchen kannst du später noch anschauen, es gibt dann nur keine Punkte mehr.</li>' +
      '<li>Jeder sieht die Antworten in einer anderen Reihenfolge. „Es war B“ verrät also nichts 😉</li></ul></div>' +
      '<h3>Punkte</h3><div class="karte"><table class="regeltabelle"><tbody>' +
      '<tr><td>Richtige Antwort</td><td>10</td></tr>' +
      '<tr><td>Dalli Klick &amp; Zoom-Rätsel: sofort richtig</td><td>bis 15</td></tr>' +
      '<tr><td>… jedes Aufdecken kostet etwas</td><td>−2 bis −5</td></tr>' +
      '<tr><td>Schätzfrage: genau / knapp / ungefähr</td><td>10 / 6 / 3</td></tr>' +
      '<tr><td>Zeitstrahl: je Foto am richtigen Platz</td><td>anteilig</td></tr>' +
      '<tr><td>„Wie viele liegen richtig?“ genau getippt</td><td>+5</td></tr>' +
      '<tr><td>… um eins daneben</td><td>+2</td></tr>' +
      '<tr><td>Sonntags-Specials &amp; Feiertag</td><td>×2</td></tr>' +
      '<tr><td>Großes Finale am 24.</td><td>×3</td></tr></tbody></table></div>' +
      '<h3>Fairer Ausgleich</h3><div class="karte"><p>Manche Fragen sind <span class="abzeichen insider">Insider-Fragen</span> – die kann nur wissen, wer damals dabei war. Damit alle eine Chance haben, zählen sie für manche mehr: <b>' + (ausgleich || '–') + '</b>.</p></div>' +
      '<h3>Joker</h3><div class="karte"><ul>' +
      '<li><b>50:50</b> (' + (j.fifty || 0) + '×): Zwei falsche Antworten verschwinden.</li>' +
      '<li><b>Christkindl-Tipp</b> (' + (j.tipp || 0) + '×): Ein kleiner Hinweis zur Frage.</li>' +
      '<li><b>Doppelt</b> (' + (j.doppelt || 0) + '×): Alle Punkte eines Türchens zählen doppelt. Am Finale-Tag besonders spannend …</li>' +
      '<li>Im Probetürchen sind alle Joker gratis zum Ausprobieren.</li></ul></div>' +
      '<h3>Zwei Wertungen</h3><div class="karte"><p>Jeder spielt für sich. Zusätzlich werden die Punkte der Teams zusammengezählt: ' +
      st.teams.map(function (t) { return '<b>' + esc(t.name) + '</b>'; }).join(' gegen ') + '.</p></div>' +
      '<p class="leise" style="margin-top:6px">Tipp: Leg dir den Link auf den Startbildschirm, dann ist der Kalender immer nur einen Fingertipp entfernt.</p></section>';
  }

  /* ───────── Türchen ───────── */
  var ansicht = null;

  function oeffneTuer(tag, animiert) {
    S.tag = tag; S.tuer = null; S.nachfrage = null;
    if (!ansicht) {
      ansicht = el('<div class="tueransicht" role="dialog" aria-modal="true"></div>');
      document.body.appendChild(ansicht);
      document.body.style.overflow = 'hidden';
      if (!W.K.demo) { try { history.pushState({ tuer: tag }, ''); } catch (e) { /* egal */ } }
    }
    ansicht.innerHTML = leiste(tag) + '<div class="wrap meldung"><div class="spinner"></div><p class="leise">Das Christkindl packt aus …</p></div>';
    verbindeLeiste();
    if (animiert && !weniger) fluegel(tag);
    tuerLaden(tag);
  }

  function fluegel(tag) {
    var f = el('<div class="fluegel" aria-hidden="true"><div class="l"><span>' + (tag || '★') + '</span></div><div class="r"><span>' + (tag || '★') + '</span></div></div>');
    document.body.appendChild(f);
    requestAnimationFrame(function () { requestAnimationFrame(function () { setTimeout(function () { f.classList.add('auf'); }, 250); }); });
    setTimeout(function () { f.remove(); }, 1400);
  }

  function schliesseTuer(ohneHistory) {
    if (!ansicht) return;
    ansicht.remove(); ansicht = null; S.tuer = null; S.tag = null;
    document.body.style.overflow = '';
    if (!ohneHistory && !W.K.demo) { try { if (history.state && history.state.tuer != null) history.back(); } catch (e) { /* egal */ } }
    zeichne();
  }
  window.addEventListener('popstate', function () { if (ansicht) schliesseTuer(true); });

  function leiste(tag) {
    var t = S.stand.tueren.find(function (x) { return x.tag === tag; });
    return '<div class="leiste wrap"><button class="zurueck" type="button" data-zurueck>' + I.pfeil + ' Kalender</button>' +
      '<span class="leise" style="font-size:16px">' + esc(t ? W.fmtDatumKurz(t.datum) : '') + '</span></div>';
  }
  function verbindeLeiste() {
    var b = ansicht.querySelector('[data-zurueck]');
    if (b) b.onclick = function () { schliesseTuer(); };
  }

  async function tuerLaden(tag) {
    var r = await W.anfrage({ a: 'tuer', t: S.token, tag: tag });
    if (S.tag !== tag || !ansicht) return;
    if (!r.ok) {
      ansicht.innerHTML = leiste(tag) + '<div class="wrap meldung"><h2>Noch nicht!</h2><p>' + esc(r.text || 'Das ging leider nicht.') + '</p></div>';
      verbindeLeiste();
      return;
    }
    S.tuer = r;
    zeichneTuer();
  }

  async function aktion(params, body, erfolg) {
    if (S.laeuft) return;
    S.laeuft = true;
    var knoepfe = ansicht ? ansicht.querySelectorAll('button') : [];
    knoepfe.forEach(function (b) { b.disabled = true; });
    try {
      var r = body ? await W.anfrage(params, body) : await W.anfrage(params);
      if (!r.ok) {
        W.toast(r.text || 'Das ging leider nicht.');
        if (r.fehler === 'gesperrt') await tuerLaden(S.tag);
        else knoepfe.forEach(function (b) { b.disabled = false; });
        return;
      }
      S.tuer = r; S.nachfrage = null;
      zeichneTuer();
      if (erfolg) W.toast(erfolg);
      W.anfrage({ a: 'stand', t: S.token }).then(function (s) { if (s.ok) S.stand = s; });
    } finally { S.laeuft = false; }
  }

  function zeichneTuer() {
    var r = S.tuer, t = r.tuer, st = r.stand, auf = r.aufgeloest;
    var scroll = ansicht.scrollTop;
    var name = t.tag === 0 ? 'Probetürchen' : 'Türchen ' + t.tag;
    var kopf = '<header class="tuerkopf"><p class="eyebrow">' + name + ' · ' + esc(W.fmtDatum(t.datum)) + '</p>' +
      '<h2>' + esc(t.titel) + '</h2>' +
      (t.special || t.faktor > 1 ? '<div class="zeile">' + (t.special ? '<span class="abzeichen special">' + esc(t.special) + '</span>' : '') + (t.faktor > 1 ? '<span class="abzeichen gold">Alle Punkte ×' + t.faktor + '</span>' : '') + '</div>' : '') +
      (t.gruss ? '<div class="christkind">' + I.stern + '<p>' + esc(t.gruss) + '</p></div>' : '') + '</header>';

    var oben = '';
    if (!auf && !st.fertig) oben += doppeltHtml();
    if (st.doppelt) oben += '<div class="hinweisbox"><span>✨</span><span><b>Doppelt-Joker aktiv:</b> Alle Punkte dieses Türchens zählen doppelt.</span></div>';
    if (t.bonus) oben += '<div class="hinweisbox"><span>🎁</span><span><b>Bonusaufgabe:</b> ' + esc(t.bonus) + '</span></div>';
    if (auf && !st.fertig && t.wertung) oben += '<div class="hinweisbox"><span>🕯️</span><span>Dieses Türchen ist schon aufgelöst. Anschauen geht noch – Punkte gibt es dafür keine mehr.</span></div>';

    var fragen = t.fragen.map(function (q, i) { return frageHtml(q, i, t.fragen.length); }).join('');

    var unten = '';
    if (st.fertig && !auf) {
      unten += versHtml(r.vers, t) +
        '<div class="karte heute"><h2 style="font-size:24px">Fertig für heute!</h2><p>Die Auflösung kommt um ' + S.stand.schluss + ' Uhr – oder schon früher, sobald alle fertig sind.</p>' +
        fortschritt({ fertigAnzahl: r.fertigAnzahl, fehlen: r.fehlen }) + '</div>';
    }
    if (auf) unten += ergebnisHtml(r) + versHtml(r.vers, t);
    unten += '<button class="knopf zart breit" type="button" data-zurueck2>Zurück zum Kalender</button>';

    ansicht.innerHTML = leiste(t.tag) + '<div class="wrap">' + kopf + '<div class="stapel">' + oben + fragen + unten + '</div></div>';
    verbindeLeiste();
    ansicht.querySelector('[data-zurueck2]').onclick = function () { schliesseTuer(); };
    verbindeTuer();
    medienLaden(ansicht);
    ansicht.scrollTop = scroll;
  }

  function versHtml(vers, t) {
    if (!vers) return '';
    var titel = t.tag === 0 ? 'Das Christkindl-Gedicht' : 'Zeile ' + t.tag + ' vom Christkindl-Gedicht';
    return '<div class="verskarte"><p class="eyebrow">' + titel + '</p><p class="vers">' + esc(vers) + '</p></div>';
  }

  function jokerRest(art) {
    if (!S.tuer.tuer.wertung) return { uebrig: 9, probe: true };
    var j = S.stand.joker[art] || { uebrig: 0 };
    return { uebrig: j.uebrig, probe: false };
  }

  function doppeltHtml() {
    var j = jokerRest('doppelt');
    if (S.stand.joker.doppelt == null) return '';
    if (S.nachfrage === '|doppelt') {
      return '<div class="nachfrage"><span>Doppelt-Joker hier einsetzen? Alle Punkte dieses Türchens zählen dann doppelt' + (j.probe ? ' (im Probetürchen gratis)' : ', und du hast keinen mehr übrig') + '.</span>' +
        '<button class="knopf klein gold" type="button" data-joker-ja="|doppelt">Ja, einsetzen</button><button class="knopf klein zart" type="button" data-joker-nein>Lieber nicht</button></div>';
    }
    return '<div class="joker"><button class="jokerchip" type="button" data-joker="|doppelt"' + (j.uebrig > 0 ? '' : ' disabled') + '>✨ Doppelt-Joker <span class="anz">' + (j.probe ? 'gratis' : j.uebrig) + '</span></button></div>';
  }

  /* ───────── Fragen ───────── */
  function entwurf(q) {
    var k = S.tag + '|' + q.id;
    if (!S.entwurf[k]) S.entwurf[k] = { reihenfolge: [] };
    return S.entwurf[k];
  }

  function fotoHtml(name, alt, extra) {
    if (!name) return '';
    return '<figure class="foto" style="margin:6px 4px" data-medium="' + esc(name) + '" data-alt="' + esc(alt || 'Foto') + '"' + (extra || '') + '><div class="laden">Das Christkindl packt aus …</div></figure>';
  }

  function frageHtml(q, idx, anzahl) {
    var r = S.tuer, st = r.stand, auf = r.aufgeloest, beantwortet = st.antworten[q.id], gesperrt = auf || !!beantwortet;
    var e = entwurf(q), a = beantwortet || e;
    var kopf = '<div class="kopfzeile"><span class="typ">' + (anzahl > 1 ? 'Frage ' + (idx + 1) + ' von ' + anzahl + ' · ' : '') + TYPNAME[q.typ] + '</span>' +
      (q.insider ? '<span class="abzeichen insider" title="Für manche zählt diese Frage mehr">Insider-Frage</span>' : '') + '</div>';
    var medien = '', eingabe = '', joker = '';
    var m = q.medien;

    if (q.typ === 'dalli' || q.typ === 'zoom') {
      var schritte = st.schritte[q.id] || 0, n = m.stufen.length;
      var zeige = gesperrt && m.danach[0] && r.schluessel[m.danach[0]] ? m.danach[0] : m.stufen[Math.min(schritte, n - 1)];
      medien = fotoHtml(zeige, TYPNAME[q.typ]);
      if (!gesperrt) {
        var jetztP = q.punkteStufen[Math.min(schritte, q.punkteStufen.length - 1)];
        var dannP = q.punkteStufen[Math.min(schritte + 1, q.punkteStufen.length - 1)];
        var balken = ''; for (var i = 0; i < n; i++) balken += '<i class="' + (i <= schritte ? 'an' : '') + '"></i>';
        medien += '<div class="aufdecken"><div class="stufen" aria-hidden="true">' + balken + '</div>' +
          '<p class="punkteinfo">Wenn du jetzt richtig rätst: <b>' + jetztP + ' Punkte</b>' + (schritte < n - 1 ? ' · nach dem nächsten ' + (q.typ === 'dalli' ? 'Aufdecken' : 'Rauszoomen') + ': ' + dannP : '') + '</p>' +
          (schritte < n - 1 ? '<button class="knopf zart breit" type="button" data-schritt="' + q.id + '">' + (q.typ === 'dalli' ? 'Ein Stück mehr aufdecken' : 'Weiter rauszoomen') + ' (−' + (jetztP - dannP) + ')</button>' : '<p class="punkteinfo">Mehr gibt es nicht aufzudecken.</p>') +
          '</div>';
      } else if (beantwortet && !auf) {
        medien += '<p class="punkteinfo">Aufgedeckt: Stufe ' + (schritte + 1) + ' von ' + n + '.</p>';
      }
    } else if (q.typ === 'video') {
      var v = q.video;
      if (!gesperrt) medien = '<figure class="foto" data-medium="' + esc(v.teil1) + '" data-poster="' + esc(v.poster) + '" data-video="1"><div class="laden">Das Christkindl legt den Film ein …</div></figure><p class="punkteinfo">Das Video hört an der spannendsten Stelle auf.</p>';
      else medien = '<p class="punkteinfo"><b>So ging\'s weiter:</b></p><figure class="foto" data-medium="' + esc(r.schluessel[v.voll] ? v.voll : v.teil1) + '" data-poster="' + esc(v.poster) + '" data-video="1"><div class="laden">Das Christkindl legt den Film ein …</div></figure>';
    } else if (q.typ === 'zeitstrahl') {
      medien = '';
    } else if (m.start && m.start[0]) {
      medien = fotoHtml(m.start[0], 'Foto zur Frage');
    }

    // Eingabe
    if (['auswahl', 'video', 'dalli', 'zoom'].indexOf(q.typ) >= 0) {
      var weg = (st.joker[q.id] && st.joker[q.id].fifty) || [];
      var ln = auf ? r.aufloesung.fragen[q.id] : null;
      var liste = W.mischen(q.optionen, S.token + '|' + S.tag + '|' + q.id);
      eingabe = '<div class="optionen" role="group" aria-label="Antworten">' + liste.map(function (o, i) {
        var cls = 'option', gedrueckt = a.wahl === o.id;
        if (weg.indexOf(o.id) >= 0) cls += ' weg';
        if (ln) { if (o.id === ln.richtig) cls += ' richtig'; else if (gedrueckt) cls += ' falsch'; }
        var dis = gesperrt || weg.indexOf(o.id) >= 0;
        return '<button type="button" class="' + cls + '" data-wahl="' + o.id + '" data-q="' + q.id + '" aria-pressed="' + gedrueckt + '"' + (dis ? ' disabled' : '') + '><span class="bst">' + BST[i] + '</span><span>' + esc(o.text) + '</span></button>';
      }).join('') + '</div>';
    } else if (q.typ === 'schaetzen') {
      if (!gesperrt) {
        if (e.zahl == null) e.zahl = q.start != null ? q.start : Math.round((q.min + q.max) / 2);
        eingabe = '<div class="schaetzer"><button type="button" data-minus="' + q.id + '" aria-label="weniger">−</button>' +
          '<output id="z-' + q.id + '" class="zahl">' + e.zahl + '<small>' + esc(q.einheit || '') + '</small></output>' +
          '<button type="button" data-plus="' + q.id + '" aria-label="mehr">+</button></div>' +
          '<input type="range" id="r-' + q.id + '" min="' + q.min + '" max="' + q.max + '" step="' + q.schritt + '" value="' + e.zahl + '" data-regler="' + q.id + '" aria-label="Schätzung">';
      } else {
        eingabe = '<p>Deine Schätzung: <b class="zahl">' + (beantwortet ? beantwortet.zahl : '–') + ' ' + esc(q.einheit || '') + '</b>' +
          (auf ? ' · Richtig: <b class="zahl">' + r.aufloesung.fragen[q.id].richtig + ' ' + esc(q.einheit || '') + '</b>' : '') + '</p>';
      }
    } else if (q.typ === 'zeitstrahl') {
      var bilder = W.mischen(q.bilder, S.token + '|' + S.tag + '|' + q.id);
      var reihe = auf ? r.aufloesung.fragen[q.id].richtig : (beantwortet ? beantwortet.reihenfolge : e.reihenfolge);
      if (auf) bilder = reihe.map(function (id) { return q.bilder.find(function (b) { return b.id === id; }); });
      eingabe = (gesperrt ? (auf ? '<p><b>Die richtige Reihenfolge:</b></p>' : '<p>Deine Reihenfolge:</p>') : '<p class="punkteinfo">Tipp die Fotos der Reihe nach an: zuerst das älteste. Nochmal antippen nimmt es wieder raus.</p>') +
        '<div class="zeitstrahl">' + bilder.map(function (b, i) {
          var pos = reihe.indexOf(b.id);
          var meinPos = beantwortet ? beantwortet.reihenfolge.indexOf(b.id) : -1;
          var markierung = auf && meinPos >= 0 ? (meinPos === pos ? ' ✓' : ' ✗') : '';
          return '<div class="zs-zelle"><button type="button" class="zs-bild' + (pos >= 0 ? ' gewaehlt' : '') + '" data-zs="' + b.id + '" data-q="' + q.id + '"' + (gesperrt ? ' disabled' : '') + ' aria-label="Foto ' + BST[i] + (pos >= 0 ? ', Platz ' + (pos + 1) : '') + '">' +
            '<img alt="" data-medium-img="' + esc(b.n) + '">' + (pos >= 0 ? '<span class="nummer">' + (pos + 1) + '</span>' : '') +
            (b.text ? '<span class="bst">' + esc(b.text) + '</span>' : (auf ? '' : '<span class="bst">' + BST[i] + markierung + '</span>')) + '</button>' +
            '<button type="button" class="lupe" data-gross="' + esc(b.n) + '" aria-label="Foto ' + BST[i] + ' groß anzeigen">' + I.lupe + '</button></div>';
        }).join('') + '</div>' + (!gesperrt ? '<button class="textknopf" type="button" data-zs-reset="' + q.id + '">Reihenfolge zurücksetzen</button>' : '');
    } else if (q.typ === 'frei') {
      eingabe = gesperrt ? '<p>Deine Antwort: <b>„' + esc(beantwortet ? beantwortet.text : '') + '“</b></p>'
        : '<textarea id="t-' + q.id + '" data-text="' + q.id + '" maxlength="500" placeholder="Deine Antwort …">' + esc(e.text || '') + '</textarea>';
    }

    // Tipp auf die anderen
    var tipp = '';
    if (q.tippAndere) {
      var n6 = S.stand.spieler.length;
      if (!gesperrt) {
        var knoepfe = ''; for (var k = 0; k <= n6; k++) knoepfe += '<button type="button" data-tipp="' + k + '" data-q="' + q.id + '" aria-pressed="' + (e.tipp === k) + '">' + k + '</button>';
        tipp = '<div class="tippandere"><p><b>Und:</b> Was glaubst du – wie viele von euch ' + n6 + ' liegen bei dieser Frage richtig?</p><div class="reihe" role="group" aria-label="Anzahl">' + knoepfe + '</div></div>';
      } else if (beantwortet) {
        tipp = '<p class="punkteinfo">Dein Tipp: ' + beantwortet.tipp + ' von ' + n6 + ' liegen richtig' + (auf ? ' · Tatsächlich: <b>' + r.aufloesung.fragen[q.id].richtigAnzahl + '</b>' : '') + '</p>';
      }
    }

    // Joker je Frage
    if (!gesperrt) {
      var genutzt = st.joker[q.id] || {};
      if (genutzt.tipp) joker += '<div class="hinweisbox"><span>⭐</span><span><b>Christkindl-Tipp:</b> ' + esc(genutzt.tipp) + '</span></div>';
      var chips = '';
      if (q.optionen && q.optionen.length >= 3 && !genutzt.fifty) chips += jokerChip(q.id, 'fifty', '50:50');
      if (q.hatTipp && !genutzt.tipp) chips += jokerChip(q.id, 'tipp', '⭐ Christkindl-Tipp');
      if (S.nachfrage && S.nachfrage.indexOf(q.id + '|') === 0) {
        var art = S.nachfrage.split('|')[1], jr = jokerRest(art);
        joker += '<div class="nachfrage"><span>' + (art === 'fifty' ? '50:50' : 'Christkindl-Tipp') + ' einsetzen?' + (jr.probe ? ' Im Probetürchen gratis.' : ' Danach hast du noch ' + (jr.uebrig - 1) + '.') + '</span>' +
          '<button class="knopf klein gold" type="button" data-joker-ja="' + S.nachfrage + '">Ja, einsetzen</button><button class="knopf klein zart" type="button" data-joker-nein>Lieber nicht</button></div>';
      } else if (chips) joker += '<div class="joker">' + chips + '</div>';
    }

    // Abschicken / Status
    var fuss = '';
    if (!gesperrt) fuss = '<button class="knopf breit" type="button" data-senden="' + q.id + '"' + (gueltig(q) ? '' : ' disabled') + '>Antwort abschicken</button>';
    else if (!auf) fuss = '<div class="gespeichert">' + I.haken + '<span>Deine Antwort ist gespeichert.</span></div>';
    else fuss = ergebnisFrage(q);

    return '<article class="karte frage" id="f-' + q.id + '">' + kopf + '<h3>' + esc(q.text) + '</h3>' + medien + joker + eingabe + tipp + fuss + '</article>';
  }

  function jokerChip(qid, art, text) {
    var j = jokerRest(art);
    return '<button class="jokerchip" type="button" data-joker="' + qid + '|' + art + '"' + (j.uebrig > 0 ? '' : ' disabled') + '>' + text + ' <span class="anz">' + (j.probe ? 'gratis' : j.uebrig) + '</span></button>';
  }

  function gueltig(q) {
    var e = entwurf(q);
    if (q.tippAndere && e.tipp == null) return false;
    switch (q.typ) {
      case 'schaetzen': return e.zahl != null && !isNaN(e.zahl);
      case 'zeitstrahl': return e.reihenfolge.length === q.bilder.length;
      case 'frei': return !!(e.text && e.text.trim());
      default: return !!e.wahl;
    }
  }

  function antwortText(q, a) {
    if (!a) return '<span class="leise">nicht geraten</span>';
    switch (q.typ) {
      case 'schaetzen': return esc(a.zahl + (q.einheit ? ' ' + q.einheit : ''));
      case 'zeitstrahl': return 'Reihenfolge';
      case 'frei': return '„' + esc(a.text) + '“';
      default: var o = q.optionen.find(function (x) { return x.id === a.wahl; }); return o ? esc(o.text) : '?';
    }
  }

  function punkteText(q, d) {
    if (!d || !d.beantwortet) return '';
    var teile = [];
    if (q.typ === 'zeitstrahl') teile.push(d.basis + ' von 10');
    if (d.ausgleich > 1 && d.basis > 0) teile.push('Ausgleich ×' + zahl(d.ausgleich));
    if (d.tipp) teile.push('Tipp +' + d.tipp);
    if (d.offen) teile.push('wird noch bewertet');
    return teile.join(' · ');
  }

  function ergebnisFrage(q) {
    var r = S.tuer, ln = r.aufloesung.fragen[q.id], meine = r.aufloesung.meine && r.aufloesung.meine.details[q.id];
    var html = '<div class="ergebnis">';
    if (meine && meine.beantwortet) {
      html += '<div class="punkte"><span class="gross zahl">+' + (meine.punkte + meine.tipp) + '</span><span>Punkte' + (punkteText(q, meine) ? ' · ' + punkteText(q, meine) : '') + '</span></div>';
    }
    if (q.typ === 'frei' && ln.richtig) html += '<p>Gesucht war: <b>' + esc(ln.richtig) + '</b></p>';
    if (ln.text) html += '<div class="notiz"><b>Die Geschichte dazu</b>' + esc(ln.text) + '</div>';
    (q.medien.loesung || []).forEach(function (n) { html += fotoHtml(n, 'Foto zur Auflösung'); });
    html += '<details><summary style="cursor:pointer;font-weight:700;min-height:44px;display:flex;align-items:center">So haben alle geraten (' + ln.richtigAnzahl + ' richtig)</summary><table class="alle"><tbody>' +
      ln.alle.map(function (x) {
        var d = x.details, p = d ? d.punkte + d.tipp : 0;
        return '<tr><td><b>' + esc(x.name) + '</b></td><td class="' + (d && d.beantwortet ? (d.richtig ? 'ok' : 'nein') : 'leise') + '">' + antwortText(q, x.antwort) +
          (punkteText(q, d) ? '<br><small class="leise">' + punkteText(q, d) + '</small>' : '') + '</td><td>' + (d && d.beantwortet ? '+' + p : '–') + '</td></tr>';
      }).join('') + '</tbody></table></details>';
    return html + '</div>';
  }

  function ergebnisHtml(r) {
    var t = r.tuer, a = r.aufloesung, m = a.meine;
    var html = '<section class="karte ergebnis"><h3 style="font-family:var(--f-zier);font-size:26px;font-weight:800">' + (t.wertung ? 'Deine Punkte heute' : 'Probetürchen – Ergebnis') + '</h3>';
    if (m) {
      var teile = [];
      if (m.zwischensumme) teile.push(m.zwischensumme + ' Punkte');
      if (m.faktor > 1) teile.push('×' + m.faktor + ' (' + esc(t.special || 'Special') + ')');
      if (m.doppelt) teile.push('×2 Doppelt-Joker');
      if (m.bonus) teile.push('+' + m.bonus + ' Bonus');
      html += '<div class="punkte"><span class="gross zahl">' + m.gesamt + '</span><span>Punkte</span></div>' +
        (teile.length > 1 ? '<p class="punkteinfo">So gerechnet: ' + teile.join(' ') + '</p>' : '');
      if (!t.wertung) html += '<p class="leise">Im Probetürchen zählen die Punkte noch nicht – ab dem 1. Dezember geht\'s richtig los!</p>';
    }
    html += '<p style="font-weight:700;margin-top:6px">Tageswertung</p><table class="alle"><tbody>' +
      a.tageswertung.map(function (x) {
        return '<tr' + (x.id === S.stand.ich.id ? ' style="font-weight:700"' : '') + '><td class="zahl">' + x.platz + '.</td><td>' + esc(x.name) + (x.doppelt ? ' ✨' : '') + (x.bonus ? ' 🎁' : '') + '</td><td>' + x.punkte + '</td></tr>';
      }).join('') + '</tbody></table></section>';
    return html;
  }

  /* ───────── Interaktion ───────── */
  function frageVon(id) { return S.tuer.tuer.fragen.find(function (q) { return q.id === id; }); }
  function sendenAktualisieren(q) {
    var b = ansicht.querySelector('[data-senden="' + q.id + '"]');
    if (b) b.disabled = !gueltig(q);
  }

  function verbindeTuer() {
    ansicht.querySelectorAll('[data-wahl]').forEach(function (b) {
      b.onclick = function () {
        var q = frageVon(b.dataset.q); entwurf(q).wahl = b.dataset.wahl;
        b.parentNode.querySelectorAll('[data-wahl]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        sendenAktualisieren(q);
      };
    });
    ansicht.querySelectorAll('[data-tipp]').forEach(function (b) {
      b.onclick = function () {
        var q = frageVon(b.dataset.q); entwurf(q).tipp = Number(b.dataset.tipp);
        b.parentNode.querySelectorAll('[data-tipp]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        sendenAktualisieren(q);
      };
    });
    function setzeZahl(q, wert) {
      var e = entwurf(q);
      e.zahl = Math.min(q.max, Math.max(q.min, Math.round(wert / q.schritt) * q.schritt));
      var o = document.getElementById('z-' + q.id); if (o) o.innerHTML = e.zahl + '<small>' + esc(q.einheit || '') + '</small>';
      var rg = document.getElementById('r-' + q.id); if (rg) rg.value = e.zahl;
      sendenAktualisieren(q);
    }
    ansicht.querySelectorAll('[data-minus]').forEach(function (b) { b.onclick = function () { var q = frageVon(b.dataset.minus); setzeZahl(q, entwurf(q).zahl - q.schritt); }; });
    ansicht.querySelectorAll('[data-plus]').forEach(function (b) { b.onclick = function () { var q = frageVon(b.dataset.plus); setzeZahl(q, entwurf(q).zahl + q.schritt); }; });
    ansicht.querySelectorAll('[data-regler]').forEach(function (rg) { rg.oninput = function () { setzeZahl(frageVon(rg.dataset.regler), Number(rg.value)); }; });
    ansicht.querySelectorAll('[data-text]').forEach(function (ta) { ta.oninput = function () { var q = frageVon(ta.dataset.text); entwurf(q).text = ta.value; sendenAktualisieren(q); }; });
    ansicht.querySelectorAll('[data-zs]').forEach(function (b) {
      b.onclick = function () {
        var q = frageVon(b.dataset.q), e = entwurf(q), i = e.reihenfolge.indexOf(b.dataset.zs);
        if (i >= 0) e.reihenfolge.splice(i, 1); else e.reihenfolge.push(b.dataset.zs);
        zeitstrahlMarken(q);
      };
    });
    ansicht.querySelectorAll('[data-zs-reset]').forEach(function (b) { b.onclick = function () { var q = frageVon(b.dataset.zsReset); entwurf(q).reihenfolge = []; zeitstrahlMarken(q); }; });
    ansicht.querySelectorAll('[data-schritt]').forEach(function (b) {
      b.onclick = function () { aktion({ a: 'schritt', t: S.token, tag: S.tag, q: b.dataset.schritt }); };
    });
    ansicht.querySelectorAll('[data-joker]').forEach(function (b) { b.onclick = function () { S.nachfrage = b.dataset.joker; zeichneTuer(); }; });
    ansicht.querySelectorAll('[data-joker-nein]').forEach(function (b) { b.onclick = function () { S.nachfrage = null; zeichneTuer(); }; });
    ansicht.querySelectorAll('[data-joker-ja]').forEach(function (b) {
      b.onclick = function () {
        var teile = b.dataset.jokerJa.split('|');
        aktion({ a: 'joker', t: S.token, tag: S.tag, q: teile[0], art: teile[1] }, null, 'Joker eingesetzt!');
      };
    });
    ansicht.querySelectorAll('[data-senden]').forEach(function (b) {
      b.onclick = function () {
        var q = frageVon(b.dataset.senden), e = entwurf(q), ant = {};
        if (q.typ === 'schaetzen') ant.zahl = e.zahl;
        else if (q.typ === 'zeitstrahl') ant.reihenfolge = e.reihenfolge.slice();
        else if (q.typ === 'frei') ant.text = e.text;
        else ant.wahl = e.wahl;
        if (q.tippAndere) ant.tipp = e.tipp;
        aktion({ a: 'antwort' }, { a: 'antwort', t: S.token, tag: S.tag, q: q.id, antwort: ant }, 'Gespeichert ✓');
      };
    });
  }

  function zeitstrahlMarken(q) {
    var e = entwurf(q);
    ansicht.querySelectorAll('[data-zs][data-q="' + q.id + '"]').forEach(function (b) {
      var pos = e.reihenfolge.indexOf(b.dataset.zs);
      b.classList.toggle('gewaehlt', pos >= 0);
      var n = b.querySelector('.nummer');
      if (pos >= 0) { if (!n) { n = el('<span class="nummer"></span>'); b.appendChild(n); } n.textContent = pos + 1; }
      else if (n) n.remove();
    });
    sendenAktualisieren(q);
  }

  async function medienLaden(wurzel) {
    var keys = S.tuer.schluessel;
    wurzel.querySelectorAll('[data-medium]').forEach(async function (fig) {
      var name = fig.dataset.medium, info = keys[name];
      try {
        var url = await W.medium(info);
        if (fig.dataset.video) {
          var poster = keys[fig.dataset.poster] ? await W.medium(keys[fig.dataset.poster]) : '';
          fig.innerHTML = '<video controls playsinline preload="metadata"' + (poster ? ' poster="' + poster + '"' : '') + ' src="' + url + '"></video>';
        } else {
          fig.innerHTML = '<img alt="' + esc(fig.dataset.alt) + '" src="' + url + '"><button class="lupe" type="button" aria-label="Foto groß anzeigen">' + I.lupe + '</button>';
          fig.querySelector('.lupe').onclick = function () { W.lightbox(url); };
          fig.querySelector('img').onclick = function () { W.lightbox(url); };
        }
      } catch (e) {
        fig.innerHTML = '<div class="laden" style="animation:none">Foto konnte nicht geladen werden.</div>';
      }
    });
    wurzel.querySelectorAll('[data-gross]').forEach(function (b) {
      b.onclick = async function () { try { W.lightbox(await W.medium(keys[b.dataset.gross])); } catch (e) { /* egal */ } };
    });
    wurzel.querySelectorAll('[data-medium-img]').forEach(async function (img) {
      try { img.src = await W.medium(keys[img.dataset.mediumImg]); } catch (e) { img.alt = 'Foto fehlt'; }
    });
  }

  window.WN_APP = {
    start: start,
    neuLaden: function () { if (ansicht) schliesseTuer(true); return start(S.token); },
    schliessen: function () { if (ansicht) { ansicht.remove(); ansicht = null; S.tuer = null; S.tag = null; document.body.style.overflow = ''; } }
  };

  /* ───────── Start ───────── */
  window.addEventListener('hashchange', function () { if (/t=[\w-]+/.test(location.hash)) location.reload(); });

  async function boot() {
    if (W.K.demo) {
      await W.anfrage({ a: 'ping' });
      return window.WN_DEMO.starteAnsicht();
    }
    if (document.body.dataset.modus === 'admin') return window.WN_ADMIN.start(W.tokenAusLink('wn-admin'));
    start(W.tokenAusLink('wn-token'));
  }
  boot();
})();

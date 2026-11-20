/* „Woasch no?" – Quizmaster-Seite (nur für den Admin-Link) */
(function () {
  'use strict';
  var W = window.WN, esc = W.esc, el = W.el, I = W.ICON;
  var A = { token: null, daten: null, tab: 'heute', vorschau: null, vorschauTag: null, rang: 'einzel', tuerCache: {} };
  var app;
  var TYPNAME = { auswahl: 'Rätselfrage', schaetzen: 'Schätzfrage', dalli: 'Dalli Klick', zoom: 'Zoom-Rätsel', zeitstrahl: 'Zeitstrahl', video: 'Video-Stopp', frei: 'Freitext' };

  async function start(token) {
    A.token = token;
    app = document.getElementById('app');
    document.body.classList.add('ohne-nav', 'admin');
    if (!token) { app.innerHTML = '<div class="wrap meldung"><h2>Kein Admin-Link</h2><p>Bitte den Admin-Link aus geheim/links.txt öffnen.</p></div>'; return; }
    app.innerHTML = '<div class="meldung"><div class="spinner"></div></div>';
    await laden();
  }

  async function laden() {
    var r = await W.anfrage({ a: 'admin_uebersicht', t: A.token });
    if (!r.ok) { app.innerHTML = '<div class="wrap meldung"><h2>Hoppla</h2><p>' + esc(r.text || 'Admin-Link ungültig.') + '</p></div>'; return; }
    A.daten = r;
    zeichne();
  }

  function zeichne() {
    var d = A.daten;
    app.innerHTML = '<header class="kopf"><div class="wrap"><p class="eyebrow">Quizmaster</p><h1>' + esc(d.titel) + '</h1>' +
      '<p class="hallo">Servus, Christkindl-Büro! Heute ist ' + esc(W.fmtTag(W.jetzt())) + ', ' + W.fmtZeit(W.jetzt()) + ' Uhr.</p></div>' + W.ICON.berge + '</header>' +
      '<main class="wrap"><div class="admin-tabs" role="group" aria-label="Bereich">' +
      tabKnopf('heute', 'Heute') + tabKnopf('pruefen', 'Türchen prüfen') + tabKnopf('punkte', 'Punkte') +
      '<button type="button" id="neu">↻ Aktualisieren</button></div><div id="admin-inhalt" class="stapel"></div></main>';
    app.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { A.tab = b.dataset.tab; A.vorschau = null; zeichne(); }; });
    document.getElementById('neu').onclick = async function () { A.tuerCache = {}; await W.anfrage({ a: 'admin_neuladen', t: A.token }); laden(); };
    var ziel = document.getElementById('admin-inhalt');
    if (A.tab === 'pruefen') A.vorschau ? zeichneVorschau(ziel) : zeichnePruefliste(ziel);
    else if (A.tab === 'punkte') zeichnePunkte(ziel);
    else zeichneHeute(ziel);
  }
  function tabKnopf(id, text) { return '<button type="button" data-tab="' + id + '" aria-pressed="' + (A.tab === id) + '">' + text + '</button>'; }

  function heuteTuer() {
    var iso = W.heuteIso(), tt = A.daten.tueren;
    return tt.find(function (t) { return t.datum === iso; }) || tt.find(function (t) { return t.status === 'zu'; }) || tt[tt.length - 1];
  }

  /* ───────── Heute ───────── */
  function zeichneHeute(ziel) {
    var d = A.daten, h = heuteTuer();
    var status = { zu: 'noch zu', offen: 'offen', aufgeloest: 'aufgelöst' }[h.status];
    var zeilen = h.spieler.map(function (s) {
      var punkt = s.fertig ? 'gruen' : s.geoeffnet ? 'gelb' : '';
      return '<tr><td><span class="statuspunkt ' + punkt + '"></span>' + esc(s.name) + (s.doppelt ? ' ✨' : '') + '</td>' +
        '<td>' + (s.geoeffnet ? W.fmtZeit(s.geoeffnet) : '–') + '</td><td>' + (s.fertig ? W.fmtZeit(s.fertigUm) : '–') + '</td>' +
        '<td class="r">' + (h.status === 'aufgeloest' ? s.punkte : '') + '</td></tr>';
    }).join('');
    var teaser = teaserText(h);
    var letzte = d.rangliste.letzterTag;
    var offen = d.offeneBewertungen.filter(function (b) { return b.punkte == null; });

    ziel.innerHTML =
      '<section class="karte stapel"><p class="leise">' + (h.tag === 0 ? 'Probetürchen' : 'Türchen ' + h.tag) + ' · ' + esc(W.fmtDatum(h.datum)) + ' · ' + status + '</p>' +
      '<h2 style="font-family:var(--f-zier);font-weight:800;font-size:28px">' + esc(h.titel) + '</h2>' +
      '<div class="tabelle-wrap"><table class="tabelle"><thead><tr><th>Spieler</th><th>geöffnet</th><th>fertig</th><th class="r">Punkte</th></tr></thead><tbody>' + zeilen + '</tbody></table></div>' +
      '<p class="leise" style="font-size:15px">Gelb = geöffnet, grün = fertig. Auflösung automatisch um ' + W.fmtZeit(h.schliesst) + ' Uhr oder sobald alle fertig sind.</p></section>' +

      '<section class="karte stapel"><h3>Morgen-Nachricht für WhatsApp</h3>' +
      '<textarea class="vorlage" id="teaser" style="min-height:120px">' + esc(teaser) + '</textarea>' +
      '<button class="knopf klein" type="button" data-kopie="teaser">Text kopieren</button></section>' +

      '<section class="karte stapel" id="ergebnis-karte"><h3>Ergebnis für WhatsApp</h3>' +
      (letzte == null ? '<p class="leise">Sobald das erste Türchen aufgelöst ist, steht hier der fertige Text mit Rangliste – und ein Ranglisten-Bild zum Teilen.</p>'
        : '<p class="leise">Für Türchen ' + letzte + ' (wird gerade erstellt …)</p>') + '</section>' +

      (d.offeneBewertungen.length ? '<section class="karte stapel"><h3>Freitext bewerten' + (offen.length ? ' <span class="abzeichen special">' + offen.length + ' offen</span>' : '') + '</h3>' +
        d.offeneBewertungen.map(function (b) {
          return '<div class="stapel" style="gap:8px;padding-top:10px;border-top:1px solid var(--linie)"><p class="leise" style="font-size:15px">Türchen ' + b.tag + ': ' + esc(b.frage) + '</p>' +
            '<p><b>' + esc(b.name) + ':</b> „' + esc(b.text) + '“</p><div class="zeile">' +
            [0, 3, 5, 8, 10].map(function (p) { return '<button type="button" class="knopf klein ' + (b.punkte === p ? '' : 'zart') + '" data-bewerten="' + b.tag + '|' + b.q + '|' + b.sp + '|' + p + '">' + p + '</button>'; }).join('') +
            '</div></div>';
        }).join('') + '</section>' : '') +

      '<section class="karte stapel"><h3>Bonuspunkte vergeben</h3><div class="formular">' +
      '<label class="feld" for="b-sp">Spieler<select id="b-sp">' + d.spieler.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="feld" for="b-tag">Türchen<select id="b-tag">' + d.tueren.filter(function (t) { return t.wertung; }).map(function (t) { return '<option value="' + t.tag + '"' + (t.tag === h.tag ? ' selected' : '') + '>' + t.tag + (t.bonusAufgabe ? ' 🎁' : '') + '</option>'; }).join('') + '</select></label>' +
      '<label class="feld" for="b-p">Punkte<input id="b-p" type="number" inputmode="numeric" value="5"></label></div>' +
      '<label class="feld" for="b-grund">Grund (sehen die Spieler nicht)<input id="b-grund" type="text" placeholder="z. B. schönster Nikolaus-Teller"></label>' +
      (h.bonusAufgabe ? '<p class="leise" style="font-size:15px">Heutige Bonusaufgabe: ' + esc(h.bonusAufgabe) + '</p>' : '') +
      '<button class="knopf klein" type="button" id="b-los">Bonus vergeben</button>' +
      (d.bonus.length ? '<div class="tabelle-wrap"><table class="tabelle"><thead><tr><th>Türchen</th><th>Spieler</th><th class="r">Punkte</th><th>Grund</th></tr></thead><tbody>' +
        d.bonus.map(function (b) { return '<tr><td>' + b.tag + '</td><td>' + esc(b.name) + '</td><td class="r">' + (b.punkte > 0 ? '+' : '') + b.punkte + '</td><td>' + esc(b.grund) + '</td></tr>'; }).join('') +
        '</tbody></table></div><p class="leise" style="font-size:15px">Vertippt? Einfach denselben Bonus mit Minus vergeben.</p>' : '') + '</section>';

    ziel.querySelectorAll('[data-kopie]').forEach(function (b) {
      b.onclick = async function () { var f = document.getElementById(b.dataset.kopie); W.toast(await W.kopieren(f.value, f) ? 'Kopiert – jetzt in WhatsApp einfügen.' : 'Text ist markiert – jetzt kopieren.'); };
    });
    ziel.querySelectorAll('[data-bewerten]').forEach(function (b) {
      b.onclick = async function () {
        var p = b.dataset.bewerten.split('|');
        var r = await W.anfrage({ a: 'admin_bewerten', t: A.token, tag: p[0], q: p[1], sp: p[2], punkte: p[3] });
        if (r.ok) { A.daten = r; zeichne(); W.toast('Bewertet.'); } else W.toast(r.text || 'Ging nicht.');
      };
    });
    document.getElementById('b-los').onclick = async function () {
      var r = await W.anfrage({ a: 'admin_bonus', t: A.token, sp: document.getElementById('b-sp').value, tag: document.getElementById('b-tag').value,
        punkte: document.getElementById('b-p').value, grund: document.getElementById('b-grund').value });
      if (r.ok) { A.daten = r; zeichne(); W.toast('Bonus vergeben.'); } else W.toast(r.text || 'Ging nicht.');
    };
    if (letzte != null) ergebnisKarte(letzte);
  }

  function teaserText(h) {
    var name = h.tag === 0 ? 'Das Probetürchen' : 'Türchen ' + h.tag;
    var text = h.teaser || ('🌟 ' + name + ' ist offen!');
    return text + '\n\nAb ' + W.fmtZeit(h.oeffnet) + ' Uhr geht\'s los, mitraten bis ' + W.fmtZeit(h.schliesst) + ' Uhr. Einfach euren persönlichen Link antippen 🕯️';
  }

  async function tuerDetails(tag) {
    if (!A.tuerCache[tag]) {
      var r = await W.anfrage({ a: 'admin_tuer', t: A.token, tag: tag });
      if (!r.ok) throw new Error(r.text);
      A.tuerCache[tag] = r;
    }
    return A.tuerCache[tag];
  }

  function richtigText(q, l) {
    if (q.typ === 'schaetzen') return l.richtig + (q.einheit ? ' ' + q.einheit : '');
    if (q.typ === 'zeitstrahl') return 'die richtige Reihenfolge';
    if (q.typ === 'frei') return l.richtig || '(Freitext)';
    var o = q.optionen.find(function (x) { return x.id === l.richtig; });
    return o ? o.text : '?';
  }

  function pfeil(x) {
    if (x.vorher == null) return '';
    var d = x.vorher - x.platz;
    return d > 0 ? ' ⬆️' : d < 0 ? ' ⬇️' : '';
  }

  async function ergebnisKarte(tag) {
    var karte = document.getElementById('ergebnis-karte');
    try {
      var r = await tuerDetails(tag), d = A.daten, t = r.tuer, a = r.aufloesung;
      var name = tag === 0 ? 'Probetürchen' : 'Türchen ' + tag;
      var sieger = a.tageswertung.filter(function (x) { return x.platz === 1; });
      var zeilen = ['🌟 *' + d.titel + '* – Auflösung ' + name + (t.special ? ' (' + t.special + ')' : ''), ''];
      t.fragen.forEach(function (q, i) {
        zeilen.push((t.fragen.length > 1 ? (i + 1) + '. ' : '') + 'Richtig war: *' + richtigText(q, a.fragen[q.id]) + '* (' + a.fragen[q.id].richtigAnzahl + ' von ' + d.spieler.length + ' lagen richtig)');
      });
      zeilen.push(sieger[0].punkte > 0 ? 'Tagessieg: ' + sieger.map(function (x) { return x.name; }).join(' & ') + ' mit ' + sieger[0].punkte + ' Punkten 🎉' : 'Heute hat leider niemand gepunktet – morgen wird\'s besser! 😅', '', '🏆 *Gesamtwertung*');
      d.rangliste.einzel.forEach(function (x) { zeilen.push(x.platz + '. ' + x.name + ' – ' + x.punkte + pfeil(x)); });
      zeilen.push('', '👨‍👩‍👧 *Teams*');
      d.rangliste.teams.forEach(function (x) { zeilen.push(x.platz + '. ' + x.name + ' – ' + x.punkte + pfeil(x)); });
      var naechste = d.tueren.find(function (x) { return x.tag > tag; });
      zeilen.push('', naechste ? 'Morgen um ' + W.fmtZeit(naechste.oeffnet) + ' Uhr geht\'s weiter! 🕯️' : 'Frohe Weihnachten euch allen! 🎄✨');
      var text = zeilen.join('\n');
      karte.innerHTML = '<h3>Ergebnis für WhatsApp</h3><p class="leise" style="font-size:15px">Für ' + name + '</p>' +
        '<textarea class="vorlage" id="ergebnis">' + esc(text) + '</textarea>' +
        '<div class="zeile"><button class="knopf klein" type="button" id="erg-kopie">Text kopieren</button>' +
        '<button class="knopf klein zart" type="button" id="erg-bild">Ranglisten-Bild erstellen</button></div><div id="bild-ziel" class="stapel"></div>';
      document.getElementById('erg-kopie').onclick = async function () { var f = document.getElementById('ergebnis'); W.toast(await W.kopieren(f.value, f) ? 'Kopiert – jetzt in WhatsApp einfügen.' : 'Text ist markiert – jetzt kopieren.'); };
      document.getElementById('erg-bild').onclick = function () { ranglistenBild(name); };
    } catch (e) {
      karte.innerHTML = '<h3>Ergebnis für WhatsApp</h3><p>Konnte nicht geladen werden: ' + esc(e.message) + '</p>';
    }
  }

  async function ranglistenBild(name) {
    var d = A.daten, ziel = document.getElementById('bild-ziel');
    try { await Promise.all(['600 80px "Grenze Gotisch"', '800 40px Alegreya', '700 40px "Atkinson Hyperlegible"'].map(function (f) { return document.fonts.load(f); })); } catch (e) { /* Ersatzschrift */ }
    var c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
    var g = c.getContext('2d');
    var grd = g.createLinearGradient(0, 0, 0, 1350); grd.addColorStop(0, '#5a1a29'); grd.addColorStop(1, '#22090f');
    g.fillStyle = grd; g.fillRect(0, 0, 1080, 1350);
    g.fillStyle = 'rgba(255,255,255,.08)';
    for (var i = 0; i < 70; i++) { var x = (i * 367) % 1080, y = (i * 211) % 1350, r = 2 + (i % 4); g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    g.fillStyle = '#e3b252'; g.font = '600 120px "Grenze Gotisch", Georgia, serif'; g.textAlign = 'center';
    g.fillText(d.titel, 540, 175);
    g.fillStyle = '#f6f1e4'; g.font = '700 40px "Atkinson Hyperlegible", sans-serif';
    g.fillText('Rangliste nach ' + name, 540, 250);
    var farben = ['#d9a93a', '#b9c0c6', '#c58a52'];
    var y0 = 330;
    d.rangliste.einzel.forEach(function (x, i) {
      var y = y0 + i * 108;
      g.fillStyle = 'rgba(255,255,255,' + (i === 0 ? .14 : .07) + ')'; rund(g, 90, y - 62, 900, 92, 20); g.fill();
      g.fillStyle = farben[x.platz - 1] || 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(160, y - 16, 34, 0, 7); g.fill();
      g.fillStyle = x.platz <= 3 ? '#1b1408' : '#f6f1e4'; g.font = '800 40px Alegreya, serif'; g.textAlign = 'center'; g.fillText(String(x.platz), 160, y - 2);
      g.textAlign = 'left'; g.fillStyle = '#f6f1e4'; g.font = '700 46px "Atkinson Hyperlegible", sans-serif'; g.fillText(x.name + pfeil(x).replace('⬆️', ' ▲').replace('⬇️', ' ▼'), 220, y);
      g.textAlign = 'right'; g.fillStyle = '#e3b252'; g.font = '800 54px Alegreya, serif'; g.fillText(String(x.punkte), 950, y);
    });
    var yt = y0 + d.rangliste.einzel.length * 108 + 40;
    g.textAlign = 'center'; g.fillStyle = '#f6f1e4'; g.font = '700 38px "Atkinson Hyperlegible", sans-serif'; g.fillText('Teams', 540, yt);
    d.rangliste.teams.forEach(function (x, i) {
      var y = yt + 70 + i * 66;
      g.textAlign = 'left'; g.fillStyle = '#f6f1e4'; g.font = '400 40px "Atkinson Hyperlegible", sans-serif'; g.fillText(x.platz + '.  ' + x.name, 180, y);
      g.textAlign = 'right'; g.fillStyle = '#e3b252'; g.font = '800 44px Alegreya, serif'; g.fillText(String(x.punkte), 900, y);
    });
    g.textAlign = 'center'; g.fillStyle = 'rgba(246,241,228,.7)'; g.font = '400 30px "Atkinson Hyperlegible", sans-serif';
    g.fillText('Familien-Adventskalender 2026', 540, 1300);
    c.toBlob(function (blob) {
      var url = URL.createObjectURL(blob);
      var datei = new File([blob], 'rangliste.png', { type: 'image/png' });
      var teilen = navigator.canShare && navigator.canShare({ files: [datei] });
      ziel.innerHTML = '<img class="rangbild" alt="Ranglisten-Bild" src="' + url + '">' +
        (teilen ? '<button class="knopf klein" type="button" id="teilen">Bild teilen (WhatsApp)</button>' : '') +
        (W.K.demo ? '<p class="leise" style="font-size:15px">Zum Speichern das Bild gedrückt halten (bzw. Rechtsklick → Bild speichern).</p>' : '<a class="knopf klein zart" download="rangliste.png" href="' + url + '">Bild speichern</a>');
      var t = document.getElementById('teilen');
      if (t) t.onclick = function () { navigator.share({ files: [datei], title: 'Rangliste' }).catch(function () { }); };
    }, 'image/png');
  }
  function rund(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  /* ───────── Prüfen ───────── */
  function geprueft(tag, v) {
    var k = 'wn-geprueft-' + tag;
    if (v === undefined) return W.speicherLesen(k) === '1';
    W.speicherSchreiben(k, v ? '1' : null);
  }

  function zeichnePruefliste(ziel) {
    var tt = A.daten.tueren, n = tt.filter(function (t) { return geprueft(t.tag); }).length;
    ziel.innerHTML = '<section class="karte stapel"><h3>Alle Türchen vorab prüfen</h3><p>Hier siehst du jedes Türchen mit Lösung, bevor es aufgeht. Hak ab, was passt. <b>' + n + ' von ' + tt.length + '</b> geprüft.</p>' +
      '<div class="tabelle-wrap"><table class="tabelle"><thead><tr><th></th><th>Tag</th><th>Titel</th><th>Special</th><th></th></tr></thead><tbody>' +
      tt.map(function (t) {
        return '<tr><td><input type="checkbox" id="g-' + t.tag + '" data-geprueft="' + t.tag + '"' + (geprueft(t.tag) ? ' checked' : '') + ' aria-label="Türchen ' + t.tag + ' geprüft" style="width:24px;height:24px"></td>' +
          '<td>' + (t.tag === 0 ? 'Probe' : t.tag) + '<br><small class="leise">' + esc(W.fmtDatumKurz(t.datum)) + '</small></td><td style="white-space:normal">' + esc(t.titel) + '</td>' +
          '<td>' + (t.special ? esc(t.special) : '') + (t.faktor > 1 ? ' ×' + t.faktor : '') + '</td>' +
          '<td><button class="knopf klein zart" type="button" data-vorschau="' + t.tag + '">Ansehen</button></td></tr>';
      }).join('') + '</tbody></table></div></section>';
    ziel.querySelectorAll('[data-geprueft]').forEach(function (c) { c.onchange = function () { geprueft(c.dataset.geprueft, c.checked); zeichne(); }; });
    ziel.querySelectorAll('[data-vorschau]').forEach(function (b) {
      b.onclick = async function () {
        b.disabled = true;
        try { A.vorschau = await tuerDetails(Number(b.dataset.vorschau)); A.vorschauTag = Number(b.dataset.vorschau); zeichne(); window.scrollTo(0, 0); }
        catch (e) { W.toast(e.message); b.disabled = false; }
      };
    });
  }

  function bild(name, keys, beschriftung) {
    if (!name || !keys[name]) return '';
    return '<figure style="margin:0;display:grid;gap:4px"><img alt="" data-adm-medium="' + esc(name) + '" style="width:100%;border-radius:6px;background:#ccc;min-height:60px">' +
      (beschriftung ? '<figcaption class="leise" style="font-size:14px">' + esc(beschriftung) + '</figcaption>' : '') + '</figure>';
  }

  function zeichneVorschau(ziel) {
    var r = A.vorschau, t = r.tuer, a = r.aufloesung, keys = r.schluessel;
    var html = '<div class="zeile"><button class="knopf klein zart" type="button" id="v-zurueck">← Alle Türchen</button>' +
      '<label class="zeile" for="v-ok" style="gap:8px;font-weight:700"><input type="checkbox" id="v-ok" style="width:24px;height:24px"' + (geprueft(t.tag) ? ' checked' : '') + '> geprüft</label></div>' +
      '<section class="karte stapel"><p class="leise">' + (t.tag === 0 ? 'Probetürchen' : 'Türchen ' + t.tag) + ' · ' + esc(W.fmtDatum(t.datum)) + (t.special ? ' · ' + esc(t.special) : '') + (t.faktor > 1 ? ' · ×' + t.faktor : '') + (t.wertung ? '' : ' · ohne Wertung') + '</p>' +
      '<h2 style="font-family:var(--f-zier);font-weight:800;font-size:28px">' + esc(t.titel) + '</h2>' +
      '<div class="christkind">' + I.stern + '<p>' + esc(t.gruss || '(kein Gruß)') + '</p></div>' +
      '<p><b>Gedichtzeile:</b> <i>' + esc(t.vers || '–') + '</i></p>' +
      '<p><b>Morgen-Nachricht:</b> ' + esc(t.teaser || '–') + '</p>' +
      (t.bonus ? '<p><b>Bonusaufgabe:</b> ' + esc(t.bonus) + '</p>' : '') + '</section>';
    t.fragen.forEach(function (q, i) {
      var l = a.fragen[q.id], m = q.medien;
      html += '<section class="karte stapel"><p class="leise">Frage ' + (i + 1) + ' · ' + TYPNAME[q.typ] + (l.insider ? ' · Insider' : '') + (q.tippAndere ? ' · mit „Wie viele liegen richtig?“' : '') + '</p>' +
        '<h3 style="font-size:22px">' + esc(q.text) + '</h3>';
      if (q.optionen) html += '<ul style="margin:0;padding-left:22px">' + q.optionen.map(function (o) { return '<li' + (o.id === l.richtig ? ' style="color:var(--gut);font-weight:700"' : '') + '>' + esc(o.text) + (o.id === l.richtig ? ' ✓' : '') + '</li>'; }).join('') + '</ul>';
      if (q.typ === 'schaetzen') html += '<p>Richtig: <b>' + l.richtig + ' ' + esc(q.einheit || '') + '</b> · Bereich ' + q.min + '–' + q.max + '</p>';
      if (q.typ === 'frei') html += '<p>Musterlösung: <b>' + esc(l.richtig || '–') + '</b></p>';
      if (q.punkteStufen) html += '<p class="leise" style="font-size:15px">Punkte je Stufe: ' + q.punkteStufen.join(' / ') + '</p>';
      if (l.tipp) html += '<p><b>Christkindl-Tipp:</b> ' + esc(l.tipp) + '</p>';
      html += '<div class="notiz"><b>Auflösung</b>' + esc(l.text || '(keine Geschichte)') + '</div>';
      var bilder = '';
      if (q.typ === 'zeitstrahl') bilder = l.richtig.map(function (id, k) { var b = q.bilder.find(function (x) { return x.id === id; }); return bild(b.n, keys, (k + 1) + '.' + (b.text ? ' ' + b.text : '')); }).join('');
      else if (q.typ === 'video') bilder = '<video controls playsinline data-adm-video="' + esc(q.video.teil1) + '" style="width:100%"></video><video controls playsinline data-adm-video="' + esc(q.video.voll) + '" style="width:100%"></video>';
      else {
        (m.stufen || []).forEach(function (n, k) { bilder += bild(n, keys, 'Stufe ' + (k + 1)); });
        (m.start || []).forEach(function (n) { bilder += bild(n, keys, ''); });
        (m.danach || []).forEach(function (n) { bilder += bild(n, keys, 'ganzes Foto'); });
      }
      (m.loesung || []).forEach(function (n) { bilder += bild(n, keys, 'Foto zur Auflösung'); });
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">' + bilder + '</div></section>';
    });
    ziel.innerHTML = html;
    document.getElementById('v-zurueck').onclick = function () { A.vorschau = null; zeichne(); };
    document.getElementById('v-ok').onchange = function (e) { geprueft(t.tag, e.target.checked); };
    ziel.querySelectorAll('[data-adm-medium]').forEach(async function (img) {
      try { var url = await W.medium(keys[img.dataset.admMedium]); img.src = url; img.onclick = function () { W.lightbox(url); }; } catch (e) { img.alt = 'fehlt'; }
    });
    ziel.querySelectorAll('[data-adm-video]').forEach(async function (v) { try { v.src = await W.medium(keys[v.dataset.admVideo]); } catch (e) { /* egal */ } });
  }

  /* ───────── Punkte ───────── */
  function zeichnePunkte(ziel) {
    var d = A.daten, r = d.rangliste;
    var tueren = d.tueren.filter(function (t) { return t.wertung && t.status === 'aufgeloest'; });
    var liste = A.rang === 'teams' ? r.teams : r.einzel;
    ziel.innerHTML = '<section class="karte stapel"><div class="umschalter"><button type="button" data-r="einzel" aria-pressed="' + (A.rang === 'einzel') + '">Einzeln</button><button type="button" data-r="teams" aria-pressed="' + (A.rang === 'teams') + '">Teams</button></div>' +
      '<table class="tabelle"><tbody>' + liste.map(function (x) { return '<tr><td class="r" style="width:40px">' + x.platz + '.</td><td>' + esc(x.name) + '</td><td class="r"><b>' + x.punkte + '</b></td></tr>'; }).join('') + '</tbody></table></section>' +
      '<section class="karte stapel"><h3>Punkte je Türchen</h3>' + (tueren.length ? '<div class="tabelle-wrap"><table class="tabelle"><thead><tr><th>Tag</th>' +
        d.spieler.map(function (s) { return '<th class="r">' + esc(s.name) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        tueren.map(function (t) {
          return '<tr><td>' + t.tag + '</td>' + t.spieler.map(function (s) { return '<td class="r">' + s.punkte + (s.doppelt ? '✨' : '') + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>' : '<p class="leise">Noch kein Türchen aufgelöst.</p>') + '</section>';
    ziel.querySelectorAll('[data-r]').forEach(function (b) { b.onclick = function () { A.rang = b.dataset.r; zeichne(); }; });
  }

  window.WN_ADMIN = { start: start };
})();

/* „Woasch no?" – gemeinsame Helfer: Server-Anfragen, Medien entschlüsseln, Zeit & Zufall. */
(function () {
  'use strict';
  var K = window.WN_KONFIG || {};
  var ZONE = 'Europe/Rome';
  var zeitDiff = 0;

  function warte(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  var demoBereit = null;
  function ladeSkript(src) {
    return new Promise(function (ok, fehler) {
      var s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = function () { fehler(new Error(src + ' nicht ladbar')); };
      document.head.appendChild(s);
    });
  }
  function demoStarten() {
    if (!demoBereit) {
      demoBereit = ladeSkript('gasmock.js?v=' + K.version)
        .then(function () { return ladeSkript('backend.js?v=' + K.version); })
        .then(function () { return ladeSkript('demo.js?v=' + K.version); })
        .then(function () { return window.WN_DEMO.start(); });
    }
    return demoBereit;
  }

  async function anfrage(params, body) {
    var res;
    if (K.demo) {
      await demoStarten();
      res = await window.WN_DEMO.anfrage(params, body);
    } else {
      if (!K.api) return { ok: false, fehler: 'konfig', text: 'Die Seite ist noch nicht fertig eingerichtet.' };
      var url = K.api + '?' + new URLSearchParams(params).toString();
      var opt = body ? { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain;charset=utf-8' } } : { method: 'GET' };
      for (var versuch = 0; ; versuch++) {
        try {
          var r = await fetch(url, opt);
          res = await r.json();
          break;
        } catch (e) {
          if (versuch >= 2) return { ok: false, fehler: 'netz', text: 'Keine Verbindung zum Christkindl-Server. Bitte gleich nochmal probieren.' };
          await warte(900 * (versuch + 1));
        }
      }
    }
    if (res && res.jetzt) zeitDiff = res.jetzt - Date.now();
    return res;
  }

  function jetzt() { return Date.now() + zeitDiff; }

  function b64bytes(s) { var b = atob(s), o = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) o[i] = b.charCodeAt(i); return o; }
  var medienCache = new Map();
  function medium(info) {
    if (!info) return Promise.reject(new Error('Kein Schlüssel'));
    if (medienCache.has(info.p)) return medienCache.get(info.p);
    var p = (async function () {
      var r = await fetch(info.p + (K.version ? '?v=' + K.version : ''));
      if (!r.ok) throw new Error('Datei fehlt (' + r.status + ')');
      var buf = await r.arrayBuffer();
      var key = await crypto.subtle.importKey('raw', b64bytes(info.k), 'AES-GCM', false, ['decrypt']);
      var klar = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(buf, 0, 12) }, key, new Uint8Array(buf, 12));
      return URL.createObjectURL(new Blob([klar], { type: info.t }));
    })();
    medienCache.set(info.p, p);
    p.catch(function () { medienCache.delete(info.p); });
    return p;
  }

  // Deterministischer Zufall (gleiche Reihenfolge bei jedem Aufruf, aber je Spieler verschieden)
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mischen(liste, saat) {
    var a = liste.slice(), x = hash(saat) || 1;
    function zufall() { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(zufall() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  var fmtTag = new Intl.DateTimeFormat('de-AT', { timeZone: ZONE, weekday: 'long', day: 'numeric', month: 'long' });
  var fmtKurz = new Intl.DateTimeFormat('de-AT', { timeZone: ZONE, day: 'numeric', month: 'long' });
  var fmtZeit = new Intl.DateTimeFormat('de-AT', { timeZone: ZONE, hour: '2-digit', minute: '2-digit' });
  var fmtIso = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
  function datumAus(iso) { return new Date(iso + 'T12:00:00+01:00'); }

  function dauer(ms) {
    if (ms <= 0) return '0 Min.';
    var min = Math.ceil(ms / 60000), t = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
    if (t > 0) return t + (t === 1 ? ' Tag ' : ' Tage ') + h + ' Std.';
    if (h > 0) return h + ' Std. ' + m + ' Min.';
    return m + ' Min.';
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

  function toast(text, ms) {
    var alt = document.querySelector('.toast'); if (alt) alt.remove();
    var t = el('<div class="toast" role="status"></div>'); t.textContent = text;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, ms || 3200);
  }

  function lightbox(src) {
    var lb = el('<div class="lightbox" role="dialog" aria-label="Foto groß"><img alt="Foto in groß"><button type="button">Schließen ✕</button></div>');
    lb.querySelector('img').src = src;
    function zu() { lb.remove(); document.removeEventListener('keydown', taste); }
    function taste(e) { if (e.key === 'Escape') zu(); }
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.tagName === 'BUTTON') zu(); });
    document.addEventListener('keydown', taste);
    document.body.appendChild(lb);
    lb.querySelector('button').focus();
  }

  async function kopieren(text, feld) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) { if (feld) { feld.focus(); feld.select(); } return false; }
  }

  function speicherLesen(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function speicherSchreiben(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* egal */ } }

  function tokenAusLink(schluessel) {
    var m = location.hash.match(/t=([\w-]+)/);
    if (m) {
      speicherSchreiben(schluessel, m[1]);
      return m[1];
    }
    return speicherLesen(schluessel);
  }

  var ICON = {
    berge: '<svg class="berge" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true"><path class="hinten" d="M0 60V30l22-8 18 10 26-22 12 9 14-15 16 20 24-8 22 12 26-6 20-20 10 8 12-12 14 18 22-4 30-14 22 16 26-8 24 10 20-6v40z"/><path class="vorne" d="M0 60V44l30-10 24 8 30-18 10 7 12-10 18 16 32-6 26 10 28-14 12 6 14-8 22 14 30-6 26 8 30-12 26 10 30-4v40z"/></svg>',
    stern: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.2l2.6 6.3 6.8.5-5.2 4.4 1.6 6.6L12 16.4 6.2 20l1.6-6.6L2.6 9l6.8-.5z"/></svg>',
    kalender: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M4 6h16v14H4zM4 10h16M8 3v5M16 3v5M9 14h2v2H9zm4 0h2v2h-2z"/></svg>',
    pokal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 20h8"/></svg>',
    buch: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7M8 11h7"/></svg>',
    pfeil: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M15 5l-7 7 7 7"/></svg>',
    lupe: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5L20 20M10.5 7.5v6M7.5 10.5h6"/></svg>',
    haken: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    medaille: function (farbe) { return '<svg viewBox="0 0 44 44" aria-hidden="true"><path fill="' + farbe + '" d="M22 3l5 11.2 12.2 1.1-9.2 8.1 2.7 12L22 29.1 11.3 35.4 14 23.4 4.8 15.3 17 14.2z"/></svg>'; }
  };

  window.WN = {
    K: K, anfrage: anfrage, jetzt: jetzt, medium: medium, mischen: mischen, hash: hash,
    fmtTag: function (ms) { return fmtTag.format(new Date(ms)); },
    fmtDatum: function (iso) { return fmtTag.format(datumAus(iso)); },
    fmtDatumKurz: function (iso) { return fmtKurz.format(datumAus(iso)); },
    fmtZeit: function (ms) { return fmtZeit.format(new Date(ms)); },
    heuteIso: function () { return fmtIso.format(new Date(jetzt())); },
    dauer: dauer, esc: esc, el: el, toast: toast, lightbox: lightbox, kopieren: kopieren, warte: warte,
    speicherLesen: speicherLesen, speicherSchreiben: speicherSchreiben, tokenAusLink: tokenAusLink, ICON: ICON
  };
})();

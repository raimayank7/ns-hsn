/* hsn.niveshsahayak.in: HSN/SAC code finder and checker.
   Searches every code of the GST portal's HSN directory (/data/hsn.json, built by scripts/hsn_data.py), checks how many
   digits a code needs on a tax invoice (Notification 78/2020-Central Tax, from 1 April 2021), and shows the GST rate
   entries for a goods code word for word from the CBIC notifications (/data/rates.json: 9/2025, 10/2025, 14/2025-CT(Rate)
   with their amendments). A rate is never guessed: one rate only when every entry for the code gives the same rate,
   otherwise the user picks the entry whose description fits. Service rates: the Table of 11/2017-CT(Rate) as amended
   (rates.json svc, built by scripts/hsn_src/svc/svc_build.py), matched by SAC heading; exemptions (12/2017) are not in it. */
(function () {
  'use strict';
  var NS = window.NS, $ = NS.$, $$ = NS.$$, esc = NS.esc, t = function (k, v) { return NS.t(k, v); };
  var PORTAL = 'https://services.gst.gov.in/services/searchhsnsac';
  var CBIC = 'https://cbic-gst.gov.in/gst-goods-services-rates.html';
  var BAND = 'ns-hsn-band';
  /* GST rates a tax invoice line may carry from 1 Feb 2026 (same list as docs.js RATE_SETS) */
  var RATES = [0, 0.1, 0.25, 1.5, 3, 5, 12, 18, 40];

  /* Harmonized System sections: [roman, first chapter, last chapter, title] */
  var SECTIONS = [
    ['I', 1, 5, 'Live animals; animal products'], ['II', 6, 14, 'Vegetable products'], ['III', 15, 15, 'Animal, vegetable or microbial fats and oils'],
    ['IV', 16, 24, 'Prepared foodstuffs; beverages, spirits and vinegar; tobacco'], ['V', 25, 27, 'Mineral products'],
    ['VI', 28, 38, 'Products of the chemical or allied industries'], ['VII', 39, 40, 'Plastics and rubber, and articles thereof'],
    ['VIII', 41, 43, 'Raw hides and skins, leather, furskins; saddlery, handbags, travel goods'], ['IX', 44, 46, 'Wood, cork, straw and basketware'],
    ['X', 47, 49, 'Pulp of wood, paper and paperboard; printed books'], ['XI', 50, 63, 'Textiles and textile articles'],
    ['XII', 64, 67, 'Footwear, headgear, umbrellas, artificial flowers'], ['XIII', 68, 70, 'Articles of stone, plaster, cement; ceramic products; glass'],
    ['XIV', 71, 71, 'Pearls, precious stones and metals, jewellery, coin'], ['XV', 72, 83, 'Base metals and articles of base metal'],
    ['XVI', 84, 85, 'Machinery and mechanical appliances; electrical equipment'], ['XVII', 86, 89, 'Vehicles, aircraft, vessels and transport equipment'],
    ['XVIII', 90, 92, 'Optical, medical and measuring instruments; clocks and watches; musical instruments'], ['XIX', 93, 93, 'Arms and ammunition'],
    ['XX', 94, 96, 'Miscellaneous manufactured articles'], ['XXI', 97, 98, 'Works of art and antiques; special classification (chapter 98, Indian tariff)']
  ];
  /* chapter titles (short forms of the official headings); 77 is reserved and has no goods */
  var CH = {
    1: 'Live animals', 2: 'Meat and edible meat offal', 3: 'Fish, crustaceans, molluscs', 4: 'Dairy produce; eggs; honey; edible animal products',
    5: 'Other products of animal origin', 6: 'Live trees, plants, bulbs, cut flowers', 7: 'Edible vegetables, roots and tubers', 8: 'Edible fruit and nuts; peel of citrus fruit or melons',
    9: 'Coffee, tea, mate and spices', 10: 'Cereals', 11: 'Products of the milling industry; malt; starches; wheat gluten', 12: 'Oil seeds, oleaginous fruits; grains, seeds; industrial or medicinal plants; straw and fodder',
    13: 'Lac; gums, resins and other vegetable saps and extracts', 14: 'Vegetable plaiting materials; other vegetable products', 15: 'Animal, vegetable or microbial fats and oils; edible fats; waxes',
    16: 'Preparations of meat, fish or crustaceans', 17: 'Sugars and sugar confectionery', 18: 'Cocoa and cocoa preparations', 19: 'Preparations of cereals, flour, starch or milk; bakers\' wares',
    20: 'Preparations of vegetables, fruit, nuts', 21: 'Miscellaneous edible preparations', 22: 'Beverages, spirits and vinegar', 23: 'Residues from the food industries; prepared animal fodder',
    24: 'Tobacco and manufactured tobacco substitutes; nicotine products', 25: 'Salt; sulphur; earths and stone; plastering materials, lime and cement', 26: 'Ores, slag and ash',
    27: 'Mineral fuels, mineral oils; bituminous substances; mineral waxes', 28: 'Inorganic chemicals; compounds of precious metals, rare-earth metals', 29: 'Organic chemicals',
    30: 'Pharmaceutical products', 31: 'Fertilisers', 32: 'Tanning or dyeing extracts; dyes, pigments, paints, varnishes; putty; inks', 33: 'Essential oils; perfumery, cosmetic or toilet preparations',
    34: 'Soap, washing and lubricating preparations, waxes, polishes, candles, modelling pastes', 35: 'Albuminoidal substances; modified starches; glues; enzymes', 36: 'Explosives; pyrotechnic products; matches',
    37: 'Photographic or cinematographic goods', 38: 'Miscellaneous chemical products', 39: 'Plastics and articles thereof', 40: 'Rubber and articles thereof',
    41: 'Raw hides and skins (other than furskins) and leather', 42: 'Articles of leather; saddlery; travel goods, handbags', 43: 'Furskins and artificial fur; manufactures thereof',
    44: 'Wood and articles of wood; wood charcoal', 45: 'Cork and articles of cork', 46: 'Manufactures of straw or plaiting materials; basketware', 47: 'Pulp of wood; recovered paper or paperboard',
    48: 'Paper and paperboard; articles of paper pulp, paper or paperboard', 49: 'Printed books, newspapers, pictures; manuscripts, plans', 50: 'Silk', 51: 'Wool, fine or coarse animal hair; horsehair yarn and fabric',
    52: 'Cotton', 53: 'Other vegetable textile fibres; paper yarn', 54: 'Man-made filaments', 55: 'Man-made staple fibres', 56: 'Wadding, felt, nonwovens; special yarns; twine, cordage, ropes',
    57: 'Carpets and other textile floor coverings', 58: 'Special woven fabrics; lace; tapestries; trimmings; embroidery', 59: 'Impregnated, coated or laminated textile fabrics; textile articles for industrial use',
    60: 'Knitted or crocheted fabrics', 61: 'Apparel and clothing accessories, knitted or crocheted', 62: 'Apparel and clothing accessories, not knitted or crocheted',
    63: 'Other made-up textile articles; sets; worn clothing; rags', 64: 'Footwear, gaiters and parts', 65: 'Headgear and parts', 66: 'Umbrellas, walking-sticks, whips and parts',
    67: 'Prepared feathers; artificial flowers; articles of human hair', 68: 'Articles of stone, plaster, cement, asbestos, mica', 69: 'Ceramic products', 70: 'Glass and glassware',
    71: 'Pearls, precious or semi-precious stones, precious metals, jewellery; coin', 72: 'Iron and steel', 73: 'Articles of iron or steel', 74: 'Copper and articles thereof',
    75: 'Nickel and articles thereof', 76: 'Aluminium and articles thereof', 78: 'Lead and articles thereof', 79: 'Zinc and articles thereof', 80: 'Tin and articles thereof',
    81: 'Other base metals; cermets', 82: 'Tools, implements, cutlery, spoons and forks, of base metal', 83: 'Miscellaneous articles of base metal',
    84: 'Machinery and mechanical appliances; boilers; computers; parts', 85: 'Electrical machinery and equipment; sound and TV recorders and reproducers; parts',
    86: 'Railway or tramway locomotives, rolling stock, track fixtures; traffic signals', 87: 'Vehicles other than railway or tramway rolling stock; parts and accessories',
    88: 'Aircraft, spacecraft and parts', 89: 'Ships, boats and floating structures', 90: 'Optical, photographic, measuring, checking, medical or surgical instruments',
    91: 'Clocks and watches and parts', 92: 'Musical instruments; parts and accessories', 93: 'Arms and ammunition; parts and accessories',
    94: 'Furniture; bedding, mattresses, cushions; lamps and lighting; prefabricated buildings', 95: 'Toys, games and sports requisites; parts',
    96: 'Miscellaneous manufactured articles (brushes, pens, buttons, lighters…)', 97: 'Works of art, collectors\' pieces and antiques',
    98: 'Project imports, laboratory chemicals, passengers\' baggage, personal importations, ship stores (Indian tariff)'
  };
  /* SAC headings (services: chapter 99, scheme of classification of services under GST) */
  var SAC = {
    9954: 'Construction services', 9961: 'Services in wholesale trade', 9962: 'Services in retail trade', 9963: 'Accommodation, food and beverage services',
    9964: 'Passenger transport services', 9965: 'Goods transport services', 9966: 'Rental services of transport vehicles with operators', 9967: 'Supporting services in transport',
    9968: 'Postal and courier services', 9969: 'Electricity, gas, water and other distribution services', 9971: 'Financial and related services', 9972: 'Real estate services',
    9973: 'Leasing or rental services, without operator', 9981: 'Research and development services', 9982: 'Legal and accounting services',
    9983: 'Other professional, technical and business services', 9984: 'Telecommunications, broadcasting and information supply services', 9985: 'Support services',
    9986: 'Support services to agriculture, hunting, forestry, fishing, mining and utilities', 9987: 'Maintenance, repair and installation (except construction) services',
    9988: 'Manufacturing services on physical inputs (goods) owned by others (job work)', 9989: 'Other manufacturing services; publishing, printing and reproduction; materials recovery',
    9991: 'Public administration and other services to the community as a whole', 9992: 'Education services', 9993: 'Human health and social care services',
    9994: 'Sewage and waste collection, treatment and disposal; other environmental protection services', 9995: 'Services of membership organisations',
    9996: 'Recreational, cultural and sporting services', 9997: 'Other services (washing, cleaning, beauty, personal care…)', 9998: 'Domestic services',
    9999: 'Services provided by extraterritorial organisations and bodies'
  };

  function section(ch) { return SECTIONS.filter(function (s) { return ch >= s[1] && ch <= s[2]; })[0]; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* everything the digits tell, plus what the turnover band needs on an invoice */
  function check(raw, band, b2c) {
    var c = String(raw || '').replace(/[\s.\-]/g, '');
    if (!c) return null;
    var r = { c: c, errs: [], notes: [] };
    if (!/^[0-9]+$/.test(c)) { r.errs.push(t('hs.e.digits')); return r; }
    var ch = parseInt(c.slice(0, 2), 10);
    if (c.length < 2) { r.errs.push(t('hs.e.short')); return r; }
    if (ch === 99) {
      r.sac = true;
      if (c.length !== 4 && c.length !== 6) r.errs.push(t('hs.e.saclen', { n: c.length }));
      var h = SAC[c.slice(0, 4)];
      if (c.length >= 4) { if (h) r.title = h; else r.errs.push(t('hs.e.sachead', { h: c.slice(0, 4) })); }
    } else {
      if (!CH[ch]) { r.errs.push(t(ch === 77 ? 'hs.e.77' : 'hs.e.chapter', { c: c.slice(0, 2) })); return r; }
      r.ch = ch; r.title = CH[ch]; r.sec = section(ch);
      if ([2, 4, 6, 8].indexOf(c.length) < 0) r.errs.push(t('hs.e.len', { n: c.length }));
    }
    var need = band === 'gt5' ? 6 : 4;
    r.need = need;
    if (!r.errs.length) {
      if (band !== 'gt5' && b2c) r.notes.push(t('hs.n.b2c'));
      else if (c.length < need) r.errs.push(t('hs.e.need', { n: need }));
      else r.ok = true;
      if (band === 'gt5' && b2c) r.notes.push(t('hs.n.b2cbig'));
    }
    return r;
  }
  NS.hsnCheck = check;

  function words(s) { return String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(function (w) { return w.length > 1; }); }

  /* official data, loaded once when first needed */
  var DATA = null, dataP = null;
  function loadData() {
    if (!dataP) {
      var get = function (u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); };
      var v = (window.NS_CFG && NS_CFG.data) || {};
      dataP = Promise.all([get(v['hsn.json'] || '/data/hsn.json'), get(v['rates.json'] || '/data/rates.json')]).then(function (a) {
        var h = a[0], r = a[1], desc = {};
        h.goods.forEach(function (x) { desc[x[0]] = x[1]; });
        h.sac.forEach(function (x) { desc[x[0]] = x[1]; });
        r.entries.forEach(function (e) { e._w = words(e.d); });
        (r.svc || []).forEach(function (e) { e._w = words(e.d + ' ' + e.h); });
        DATA = { h: h, r: r, desc: desc, all: h.goods.concat(h.sac.map(function (x) { return [x[0], x[1], 1]; })) };
        DATA.all.forEach(function (x) { x._w = words(x[1]); });
        return DATA;
      });
      dataP.catch(function () { dataP = null; });
    }
    return dataP;
  }
  NS.hsnData = loadData;

  /* rate entries for a goods code: kind 'all' = the entry covers the whole code, 'part' = only some codes under it */
  function rateMatch(code) {
    var out = [];
    if (!DATA || !code) return out;
    if (code.slice(0, 2) === '99') {   /* services: every option of every item under the SAC heading */
      svcMatch(code).forEach(function (e) { e.o.forEach(function (o) { out.push({ e: { g: o.g, d: e.d }, kind: 'all', svc: 1 }); }); });
      return out;
    }
    DATA.r.entries.forEach(function (e) {
      var kind = null, spec = 0;
      e.i.forEach(function (tk) {
        if (code.indexOf(tk) === 0) { kind = 'all'; spec = Math.max(spec, tk.length); }
        else if (kind !== 'all' && tk.indexOf(code) === 0) { kind = 'part'; spec = Math.max(spec, code.length); }
      });
      if (!kind) return;
      if (e.x && e.x.some(function (x) { return code.indexOf(x) === 0; })) return;
      if (kind === 'all' && e.x && e.x.some(function (x) { return x.indexOf(code) === 0; })) kind = 'part';
      out.push({ e: e, kind: kind, spec: spec });
    });
    /* whole-code entries first, the most specific code first, then by rate */
    return out.sort(function (a, b) { return (a.kind === 'all' ? 0 : 1) - (b.kind === 'all' ? 0 : 1) || b.spec - a.spec || a.e.g - b.e.g; });
  }
  function svcMatch(code) {
    var h = String(code).slice(0, 4);
    return (DATA && DATA.r.svc || []).filter(function (e) { return !e.a && e.k.indexOf(h) >= 0; });
  }
  /* the one rate for a code, or null when the user has to choose */
  function oneRate(m) {
    if (!m.length || m.some(function (x) { return x.kind !== 'all'; })) return null;
    var g = m[0].e.g;
    return m.every(function (x) { return x.e.g === g; }) ? g : null;
  }
  function rates(m) { var s = []; m.forEach(function (x) { if (x.e.g != null && s.indexOf(x.e.g) < 0) s.push(x.e.g); }); return s.sort(function (a, b) { return a - b; }); }
  NS.hsnRate = function (code) { var m = rateMatch(String(code || '').replace(/\D/g, '')); return { one: oneRate(m), all: rates(m), entries: m }; };

  function scoreWords(ws, tw) {
    return ws.filter(function (w) { return tw.some(function (x) { return x.indexOf(w) === 0 || (w.length > 4 && x.indexOf(w.slice(0, -1)) === 0); }); }).length;
  }
  /* full search over the official list (codes) and the rate entries (words only) */
  function findAll(q) {
    var digits = q.replace(/\s/g, ''), res = { codes: [], rates: [], svc: [], more: 0 };
    if (/^[0-9]+$/.test(digits)) {
      DATA.all.forEach(function (x) { if (x[0].indexOf(digits) === 0) res.codes.push(x); });
      res.codes.sort(function (a, b) { return a[0].length - b[0].length || (a[0] < b[0] ? -1 : 1); });
    } else {
      var ws = words(q); if (!ws.length) return res;
      var sc = [];
      DATA.all.forEach(function (x) { var s = scoreWords(ws, x._w); if (s === ws.length) sc.push([s, x]); });
      res.codes = sc.map(function (p) { return p[1]; }).sort(function (a, b) { return a[0].length - b[0].length || (a[0] < b[0] ? -1 : 1); });
      DATA.r.entries.forEach(function (e) { if (scoreWords(ws, e._w) === ws.length) res.rates.push(e); });
      DATA.r.svc.forEach(function (e) { if (scoreWords(ws, e._w) === ws.length) res.svc.push(e); });
    }
    res.more = Math.max(0, res.codes.length - 60);
    res.codes = res.codes.slice(0, 60);
    res.rates = res.rates.slice(0, 20);
    res.svc = res.svc.slice(0, 12);
    return res;
  }
  function rateTxt(g) { return g == null ? t('hs.s.same') : g === 0 ? t('hs.r.nil') : g + '%'; }
  /* one item of the services Table: every rate option with its condition, word for word */
  function svcHtml(e, btn) {
    var iv = e.o.some(function (o) { return /Explanation [Nn]o\.? ?\(iv\)|clause \(iv\) of paragraph 4/.test(o.c); });
    return '<li class="hs-ent hs-svc"><div>' + (btn ? '<button type="button" class="btn sm hs-use" data-code="' + esc(e.k[0] || '') + '">' + esc(e.k[0] || '') + '</button> ' : '') +
      '<p dir="ltr" lang="en">' + esc(e.d) + '</p>' +
      '<ul class="hs-opts">' + e.o.map(function (o, k) {
        return '<li>' + (k ? '<span class="hs-or">' + esc(t('hs.s.or')) + '</span>' : '') + '<span class="hs-rt' + (o.g === 0 ? ' nil' : '') + '">' + esc(rateTxt(o.g)) + '</span>' +
          (o.c && o.c !== '-' ? '<small dir="ltr" lang="en">' + esc(o.c) + '</small>' : '') + '</li>';
      }).join('') + '</ul>' +
      '<small dir="ltr" lang="en">11/2017-CT(Rate), S. No. ' + esc(e.s) + (e.id ? ' ' + esc(e.id) : '') + ' · ' + esc(e.h) + '</small>' +
      (e.chg ? ' <small class="hs-chg">' + esc(t('hs.r.chg', { n: e.chg[e.chg.length - 1] })) + '</small>' : '') +
      (iv ? '<details><summary>' + esc(t('hs.s.iv')) + '</summary><p dir="ltr" lang="en">' + esc(DATA.r.svcDefs.iv) + '</p></details>' : '') +
      '</div></li>';
  }
  function entryHtml(e, kind) {
    return '<li class="hs-ent"><span class="hs-rt' + (e.g === 0 ? ' nil' : '') + '">' + esc(rateTxt(e.g)) + '</span><div>' +
      '<p dir="ltr" lang="en">' + esc(e.d) + '</p>' +
      '<small dir="ltr" lang="en">' + esc(e.n) + ', S. No. ' + esc(e.s) + ' · ' + esc(e.c) + '</small>' +
      (kind === 'part' ? ' <small class="hs-part">' + esc(t('hs.r.part')) + '</small>' : '') +
      (e.chg ? ' <small class="hs-chg">' + esc(t('hs.r.chg', { n: e.chg })) + '</small>' : '') +
      (e.list ? '<details><summary>' + esc(t('hs.r.list', { n: e.list.length })) + '</summary><ol dir="ltr" lang="en">' + e.list.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></details>' : '') +
      '</div></li>';
  }
  function ratePanel(c, sac) {
    if (!DATA) return '<div class="shim" style="height:60px"></div>';
    var h = '<h3 class="hs-sub">' + esc(t('hs.r.h')) + '</h3>';
    if (sac) {
      var sm = svcMatch(c), flat = rateMatch(c), sone = oneRate(flat);
      if (!sm.length) h += '<p class="note">' + esc(t('hs.s.none')) + '</p>';
      else {
        h += sone != null ? '<p class="gt-badge ok">' + esc(t('hs.r.one', { r: rateTxt(sone) })) + '</p><p class="soft">' + esc(t('hs.r.fit')) + '</p>'
          : '<p class="gt-badge warn">' + esc(t('hs.s.many')) + '</p>';
        h += '<ul class="hs-ents">' + sm.map(function (e) { return svcHtml(e); }).join('') + '</ul>';
      }
      return h + '<p class="note">' + esc(t('hs.s.ex')) + '</p><p class="soft hs-src">' + esc(t('hs.s.src', { d: NS.fmtDate(DATA.r.checked) })) + '</p>';
    }
    var m = rateMatch(c), one = oneRate(m);
    if (!m.length) h += '<p class="note">' + esc(t('hs.r.none')) + '</p>';
    else {
      h += one != null ? '<p class="gt-badge ok">' + esc(t('hs.r.one', { r: rateTxt(one) })) + '</p><p class="soft">' + esc(t('hs.r.fit')) + '</p>'
        : '<p class="gt-badge warn">' + esc(t('hs.r.many')) + '</p>';
      h += '<ul class="hs-ents">' + m.map(function (x) { return entryHtml(x.e, x.kind); }).join('') + '</ul>';
    }
    return h + '<p class="soft hs-src">' + esc(t('hs.r.src', { d: NS.fmtDate(DATA.r.checked) })) + '</p>';
  }
  function officialHtml(c, sac) {
    if (!DATA) return '';
    var d = DATA.desc[c];
    if (d) return '<tr><th scope="row">' + esc(t('hs.d.off')) + '</th><td><span dir="ltr" lang="en">' + esc(d) + '</span></td></tr>';
    var under = DATA.all.filter(function (x) { return x[0].length > c.length && x[0].indexOf(c) === 0; }).length;
    return '<tr><th scope="row">' + esc(t('hs.d.off')) + '</th><td>' + esc(under ? t('hs.d.sub', { n: under }) : t('hs.d.notin')) + '</td></tr>';
  }

  /* finder before the data has loaded: chapter titles and SAC headings */
  function find(q) {
    q = String(q || '').trim();
    if (!q) return [];
    var digits = q.replace(/\s/g, '');
    if (/^[0-9]+$/.test(digits)) {
      var out = [];
      Object.keys(CH).forEach(function (k) { var p = pad(+k); if (p.indexOf(digits.slice(0, 2)) === 0 || digits.indexOf(p) === 0) out.push({ code: p, title: CH[k], ch: +k }); });
      Object.keys(SAC).forEach(function (k) { if (k.indexOf(digits) === 0 || digits.indexOf(k) === 0) out.push({ code: k, title: SAC[k], sac: true }); });
      return out.slice(0, 30);
    }
    var ws = words(q);
    var scored = [];
    function score(title) { var tw = words(title); return ws.filter(function (w) { return tw.some(function (x) { return x.indexOf(w) === 0 || (w.length > 4 && x.indexOf(w.slice(0, -1)) === 0); }); }).length; }
    Object.keys(CH).forEach(function (k) { var s = score(CH[k]); if (s) scored.push({ s: s, code: pad(+k), title: CH[k], ch: +k }); });
    Object.keys(SAC).forEach(function (k) { var s = score(SAC[k]); if (s) scored.push({ s: s, code: k, title: SAC[k], sac: true }); });
    return scored.sort(function (a, b) { return b.s - a.s; }).slice(0, 20);
  }

  var root, items = [];
  function band() { var b = ''; try { b = localStorage.getItem(BAND) || ''; } catch (e) {} return b || 'le5'; }

  function portalBtns(code) {
    return '<div class="row"><button type="button" class="btn primary" data-hs-portal="' + esc(code) + '">' + esc(t('hs.portal')) + ' ↗</button>' +
      '<a class="btn" href="' + CBIC + '" target="_blank" rel="noopener">' + esc(t('hs.cbic')) + ' ↗</a></div>';
  }

  function showCheck() {
    var out = $('[data-hs-out]', root), r = check($('#hs-in', root).value, band(), $('#hs-b2c', root).checked);
    if (!r) { out.innerHTML = '<p class="soft">' + esc(t('hs.empty')) + '</p>'; return; }
    var h = r.ok ? '<p class="gt-badge ok">✓ ' + esc(t('hs.ok', { n: r.c.length })) + '</p>' : r.errs.length ? '<p class="gt-badge bad">✕ ' + esc(t('hs.bad')) + '</p>' : '';
    var list = r.errs.concat(r.notes);
    if (list.length) h += '<ul class="gt-msgs">' + list.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    if (r.title) {
      h += '<table class="gt-tbl">' + (r.sac ? '<tr><th scope="row">' + esc(t('hs.p.kind')) + '</th><td>' + esc(t('hs.k.sac')) + '</td></tr>' +
          '<tr><th scope="row">' + esc(t('hs.p.head')) + '</th><td><b class="mono">' + esc(r.c.slice(0, 4)) + '</b> · <span dir="ltr">' + esc(r.title) + '</span></td></tr>'
        : '<tr><th scope="row">' + esc(t('hs.p.kind')) + '</th><td>' + esc(t('hs.k.hsn')) + '</td></tr>' +
          '<tr><th scope="row">' + esc(t('hs.p.sec')) + '</th><td><b class="mono">' + esc(r.sec[0]) + '</b> · <span dir="ltr">' + esc(r.sec[3]) + '</span></td></tr>' +
          '<tr><th scope="row">' + esc(t('hs.p.ch')) + '</th><td><b class="mono">' + esc(pad(r.ch)) + '</b> · <span dir="ltr">' + esc(r.title) + '</span></td></tr>') +
        officialHtml(r.c, r.sac) +
        '<tr><th scope="row">' + esc(t('hs.p.need')) + '</th><td>' + esc(t(band() === 'gt5' ? 'hs.need.gt5' : 'hs.need.le5')) + '</td></tr></table>';
      h += ratePanel(r.c, r.sac) + portalBtns(r.c);
    }
    out.innerHTML = h;
  }

  function showFind() {
    var q = $('#hs-q', root).value, out = $('[data-hs-found]', root);
    if (!q.trim()) { out.innerHTML = ''; return; }
    if (!DATA) {
      var res = find(q);
      out.innerHTML = '<p class="soft">' + esc(t('hs.d.load')) + '</p>' + (res.length ? '<ul class="hs-list">' + res.map(function (x) {
        return '<li><button type="button" class="hs-pick" data-code="' + esc(x.code) + '"><b class="mono">' + esc(x.code) + '</b><span dir="ltr">' + esc(x.title) + '</span><small>' + esc(t(x.sac ? 'hs.k.sac' : 'hs.k.ch')) + '</small></button></li>';
      }).join('') + '</ul>' : '');
      return;
    }
    var f = findAll(q);
    if (!f.codes.length && !f.rates.length && !f.svc.length) { out.innerHTML = '<p class="soft">' + esc(t('hs.f.none')) + '</p>' + portalBtns(''); return; }
    var h = '';
    if (f.codes.length) h += '<h3 class="hs-sub">' + esc(t('hs.f.codes')) + '</h3><ul class="hs-list">' + f.codes.map(function (x) {
      var kind = x[2] ? 'hs.k.sac' : x[0].length === 2 ? 'hs.k.ch' : 'hs.k.hsn';
      return '<li><button type="button" class="hs-pick" data-code="' + esc(x[0]) + '"><b class="mono">' + esc(x[0]) + '</b><span dir="ltr" lang="en">' + esc(x[1]) + '</span><small>' + esc(t(kind)) + '</small></button></li>';
    }).join('') + '</ul>' + (f.more ? '<p class="soft">' + esc(t('hs.f.more', { n: 60 })) + '</p>' : '');
    if (f.rates.length) h += '<h3 class="hs-sub">' + esc(t('hs.f.rates')) + '</h3><ul class="hs-ents">' + f.rates.map(function (e) {
      return entryHtml(e, 'all').replace('<div>', '<div>' + (e.i.length ? '<button type="button" class="btn sm hs-use" data-code="' + esc(e.i[0]) + '">' + esc(e.i[0]) + '</button> ' : ''));
    }).join('') + '</ul>';
    if (f.svc.length) h += '<h3 class="hs-sub">' + esc(t('hs.s.found')) + '</h3><ul class="hs-ents">' + f.svc.map(function (e) { return svcHtml(e, true); }).join('') + '</ul>';
    out.innerHTML = h + '<p class="soft">' + esc(t('hs.f.next2')) + '</p>';
  }

  /* the saved items and services: HSN digits and GST % */
  function itemIssues(it) {
    var is = [], hsn = String(it.hsn || '').replace(/\s/g, '');
    if (!hsn) is.push(t('hs.i.nohsn'));
    else {
      var r = check(hsn, band(), false);
      if (r.errs.length) is.push(r.errs[0]);
      if (it.kind === 'service' && !r.sac) is.push(t('hs.i.svc'));
      if (it.kind !== 'service' && r.sac) is.push(t('hs.i.goods'));
    }
    if (it.gst !== '' && it.gst != null && RATES.indexOf(NS.num(it.gst)) < 0) is.push(t('hs.i.rate', { r: it.gst }));
    else if (DATA && hsn && it.gst !== '' && it.gst != null) {
      var all = rates(rateMatch(hsn));
      if (all.length && all.indexOf(NS.num(it.gst)) < 0) is.push(t('hs.i.notr', { r: it.gst, list: all.map(rateTxt).join(', ') }));
    }
    return is;
  }
  /* after a code is typed in the items table: fill the GST % when there is one rate, else offer the choices */
  function rateHelp(i, box) {
    var hsn = $('.hs-cell[data-i="' + i + '"][data-f="hsn"]', box), gst = $('.hs-cell[data-i="' + i + '"][data-f="gst"]', box), help = $('[data-help="' + i + '"]', box);
    if (!DATA || !hsn || !help) return;
    var m = rateMatch(hsn.value.replace(/\D/g, '')), one = oneRate(m);
    if (!m.length) { help.innerHTML = ''; return; }
    if (one != null) {
      var changed = gst.value !== String(one);
      gst.value = one;
      help.innerHTML = changed ? '<small class="hs-auto">' + esc(t('hs.i.auto', { r: one })) + '</small>' : '';
      return;
    }
    help.innerHTML = '<select class="hs-choose" aria-label="' + esc(t('hs.i.pick')) + '"><option value="">' + esc(t('hs.i.pick')) + '</option>' +
      m.filter(function (x) { return x.e.g != null; }).map(function (x) { var d = x.e.d.length > 70 ? x.e.d.slice(0, 68) + '…' : x.e.d; return '<option value="' + x.e.g + '">' + esc(rateTxt(x.e.g) + ' · ' + d) + '</option>'; }).join('') + '</select>';
    $('select', help).onchange = function () { if (this.value !== '') gst.value = this.value; };
  }
  function loadItems() {
    var box = $('[data-hs-items]', root);
    return NSStore.list('item').then(function (all) {
      items = all.sort(function (a, b) { return String(a.desc).localeCompare(String(b.desc)); });
      if (!items.length) { box.innerHTML = '<p class="soft">' + esc(t('hs.i.none')) + '</p>'; return; }
      var bad = items.filter(function (it) { return itemIssues(it).length; }).length;
      box.innerHTML = '<p>' + esc(t('hs.i.sum', { n: items.length, bad: bad })) + '</p><div class="gt-scroll"><table class="gt-tbl gt-list"><thead><tr><th>' + esc(t('hs.i.name')) + '</th><th>HSN/SAC</th><th>GST %</th><th>' + esc(t('gi.m.res')) + '</th><th></th></tr></thead><tbody>' +
        items.map(function (it, i) {
          var is = itemIssues(it);
          return '<tr class="' + (is.length ? 'bad' : '') + '"><td>' + esc(it.desc) + '</td><td><input class="mono hs-cell" data-i="' + i + '" data-f="hsn" value="' + esc(it.hsn || '') + '" inputmode="numeric" dir="ltr" aria-label="HSN/SAC"></td>' +
            '<td><input class="mono hs-cell hs-rate" data-i="' + i + '" data-f="gst" value="' + esc(it.gst == null ? '' : it.gst) + '" inputmode="decimal" dir="ltr" aria-label="GST %"><div data-help="' + i + '"></div></td><td>' + (is.length ? esc(is.join(' · ')) : '✓') + '</td>' +
            '<td><button type="button" class="btn sm" data-save="' + i + '">' + esc(t('hs.i.save')) + '</button></td></tr>';
        }).join('') + '</tbody></table></div>';
      $$('.hs-cell[data-f="hsn"]', box).forEach(function (inp) {
        inp.addEventListener('change', function () { rateHelp(inp.getAttribute('data-i'), box); });
      });
      $$('[data-save]', box).forEach(function (b) {
        b.onclick = function () {
          var i = +b.getAttribute('data-save'), it = items[i];
          $$('.hs-cell[data-i="' + i + '"]', box).forEach(function (inp) { it[inp.getAttribute('data-f')] = inp.value.trim(); });
          NSStore.put('item', it).then(function () { NS.toast(t('hs.i.saved', { n: it.desc })); loadItems(); }, function (e) { NS.toast(t('nosave', { e: e.message }), 'bad'); });
        };
      });
    }).catch(function () { box.innerHTML = '<p class="soft">' + esc(t('hs.i.none')) + '</p>'; });
  }

  function render() {
    var keep = ($('#hs-in', root) || {}).value || new URLSearchParams(location.search).get('c') || '', keepQ = ($('#hs-q', root) || {}).value || '';
    var bd = band();
    root.innerHTML =
      '<div class="gt-grid">' +
      '<section class="gt-card" aria-labelledby="hs-h1"><h2 id="hs-h1">' + esc(t('hs.h.check')) + '</h2>' +
      '<label for="hs-in" class="gt-lbl">' + esc(t('hs.lbl')) + '</label>' +
      '<input id="hs-in" class="gt-big mono" dir="ltr" inputmode="numeric" maxlength="12" autocomplete="off" placeholder="8471 / 998314">' +
      '<div class="fg2"><label for="hs-band" class="gt-lbl">' + esc(t('hs.band')) + '</label><select id="hs-band"><option value="le5"' + (bd === 'le5' ? ' selected' : '') + '>' + esc(t('hs.b.le5')) + '</option><option value="gt5"' + (bd === 'gt5' ? ' selected' : '') + '>' + esc(t('hs.b.gt5')) + '</option></select>' +
      '<label class="chk"><input type="checkbox" id="hs-b2c"> ' + esc(t('hs.b2c')) + '</label></div>' +
      '<div data-hs-out aria-live="polite"></div></section>' +
      '<section class="gt-card" aria-labelledby="hs-h2"><h2 id="hs-h2">' + esc(t('hs.h.find2')) + '</h2><p class="soft">' + esc(t('hs.f.help2')) + '</p>' +
      '<label for="hs-q" class="gt-lbl">' + esc(t('hs.f.lbl')) + '</label><input id="hs-q" type="search" dir="ltr" autocomplete="off" placeholder="cotton, furniture, 61, repair">' +
      '<div data-hs-found aria-live="polite"></div></section>' +
      '</div>' +
      '<section class="gt-card gt-noprint" aria-labelledby="hs-h3"><h2 id="hs-h3">' + esc(t('hs.h.items')) + '</h2><p class="soft">' + esc(t('hs.i.help')) + '</p><div data-hs-items><div class="shim" style="height:80px"></div></div></section>';
    var inp = $('#hs-in', root);
    inp.value = keep; $('#hs-q', root).value = keepQ;
    inp.addEventListener('input', showCheck);
    $('#hs-b2c', root).addEventListener('change', showCheck);
    $('#hs-band', root).addEventListener('change', function (e) { try { localStorage.setItem(BAND, e.target.value); } catch (err) {} showCheck(); loadItems(); });
    $('#hs-q', root).addEventListener('input', showFind);
    root.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-code')) { inp.value = b.getAttribute('data-code'); showCheck(); inp.scrollIntoView({ block: 'center' }); }
      else if (b.hasAttribute('data-hs-portal')) {
        var c = b.getAttribute('data-hs-portal'), go = function () { window.open(PORTAL, '_blank', 'noopener'); };
        if (c && navigator.clipboard) navigator.clipboard.writeText(c).then(function () { NS.toast(t('hs.copied')); go(); }, go); else go();
      }
    };
    showCheck(); showFind();
    NSStore.ready().then(loadItems);
    loadData().then(function () { if (!root) return; showCheck(); showFind(); loadItems(); },
      function () { var o = $('[data-hs-out]', root); if (o) o.insertAdjacentHTML('beforeend', '<p class="soft">' + esc(t('hs.d.err')) + '</p>'); });
  }

  function start() { root = $('#hsn-tool'); if (root) render(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  document.addEventListener('ns-lang', function () { if (root) render(); });
})();

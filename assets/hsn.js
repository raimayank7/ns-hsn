/* hsn.niveshsahayak.in: HSN/SAC code finder and checker.
   Finds the HS chapter (goods) or SAC heading (services) for a code or English words, checks how many digits a code
   needs on a tax invoice (Notification 78/2020-Central Tax, from 1 April 2021), checks the HSN and GST % of the saved items,
   and sends the user to the official GST portal HSN search for the exact rate. We print no item-wise rates: they live in
   CBIC rate notifications that keep changing (GST 2.0 from 22 Sept 2025, amended again in 2026). */
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
  /* finder: by code prefix or English words over chapter titles and SAC headings */
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
        '<tr><th scope="row">' + esc(t('hs.p.need')) + '</th><td>' + esc(t(band() === 'gt5' ? 'hs.need.gt5' : 'hs.need.le5')) + '</td></tr></table>';
      h += '<p class="note">' + esc(t('hs.rate')) + '</p>' + portalBtns(r.c);
    }
    out.innerHTML = h;
  }

  function showFind() {
    var q = $('#hs-q', root).value, out = $('[data-hs-found]', root), res = find(q);
    if (!q.trim()) { out.innerHTML = ''; return; }
    if (!res.length) { out.innerHTML = '<p class="soft">' + esc(t('hs.f.none')) + '</p>' + portalBtns(''); return; }
    out.innerHTML = '<ul class="hs-list">' + res.map(function (x) {
      return '<li><button type="button" class="hs-pick" data-code="' + esc(x.code) + '"><b class="mono">' + esc(x.code) + '</b><span dir="ltr">' + esc(x.title) + '</span><small>' + esc(t(x.sac ? 'hs.k.sac' : 'hs.k.ch')) + '</small></button></li>';
    }).join('') + '</ul><p class="soft">' + esc(t('hs.f.next')) + '</p>';
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
    return is;
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
            '<td><input class="mono hs-cell hs-rate" data-i="' + i + '" data-f="gst" value="' + esc(it.gst == null ? '' : it.gst) + '" inputmode="decimal" dir="ltr" aria-label="GST %"></td><td>' + (is.length ? esc(is.join(' · ')) : '✓') + '</td>' +
            '<td><button type="button" class="btn sm" data-save="' + i + '">' + esc(t('hs.i.save')) + '</button></td></tr>';
        }).join('') + '</tbody></table></div>';
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
      '<section class="gt-card" aria-labelledby="hs-h2"><h2 id="hs-h2">' + esc(t('hs.h.find')) + '</h2><p class="soft">' + esc(t('hs.f.help')) + '</p>' +
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
  }

  function start() { root = $('#hsn-tool'); if (root) render(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  document.addEventListener('ns-lang', function () { if (root) render(); });
})();

/* Integration Studio — application logic (vanilla ES2020, no modules). */
(function () {
  'use strict';

  var B = window.__BUILTIN__;
  var GOLDEN = window.__GOLDEN__;

  // ------------------------------------------------------------------ utils
  function xe(s) { // XML-escape element text
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function xa(s) { // XML-escape attribute value
    return xe(s).replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  function cm(s) { // safe comment text: collapse -- sequences
    return String(s == null ? '' : s).replace(/-{2,}/g, '-');
  }
  function crlf(s) { return String(s).replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'); }

  function b64(str) {
    // UTF-8 safe base64
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function')
        e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  // -------------------------------------------------------------- storage
  var LS_STATE = 'is.state', LS_HIST = 'is.history', LS_TPL = 'is.templates';
  function lsGet(k, def) {
    try { var v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); }
    catch (e) { return def; }
  }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }

  // Templates: built-in overridden by stored edits.
  function allTemplates() {
    var stored = lsGet(LS_TPL, {});
    var out = {};
    Object.keys(B.templates).forEach(function (id) {
      out[id] = Object.assign({}, B.templates[id], stored[id] || {});
    });
    return out;
  }
  function T(iface) {
    var t = allTemplates();
    return t[iface] || t.MBFS;
  }
  function ready(id) {
    var t = T(id);
    if (!t) return false;
    var hasXslt = !!(t.xslt || (t.xsltList && t.xsltList.length));
    if (xsltOnly(id)) return hasXslt;
    if (!t.bp || !t.export) return false;
    return hasXslt;
  }
  // True when an interface emits only the XSLT block(s) (no BP / import XML).
  function xsltOnly(iface) {
    return !!(B.IFACES[iface] || {}).xsltOnly;
  }

  // Normalised list of XSLT blocks for an interface (handles stored overrides).
  function xsltBlocks(iface) {
    var t = T(iface);
    var storedIf = (lsGet(LS_TPL, {})[iface]) || {};
    var list;
    if (t.xsltList && t.xsltList.length) {
      list = t.xsltList.map(function (b) {
        var ov = storedIf['block:' + b.key];
        return { key: b.key, label: b.label, file: b.file, tpl: (ov != null ? ov : b.tpl) };
      });
    } else {
      list = [{ key: 'xslt', label: 'XSLT block', file: '_xslt.txt', tpl: t.xslt }];
    }
    return list;
  }
  function blockByLabel(iface, label) {
    var bs = xsltBlocks(iface);
    for (var i = 0; i < bs.length; i++) if (bs[i].label === label) return bs[i];
    return null;
  }
  // True when the BP consumes a source mailbox (so a Mailbox step/tab applies).
  function hasMailbox(iface) {
    var bp = T(iface).bp;
    if (!bp) return false;
    return tokensOf(bp).indexOf('SOURCE_MAILBOX_ASSIGN') >= 0;
  }

  // ------------------------------------------------- token scanning + engine
  function tokensOf(tpl) {
    var set = {}, m, re = /\{\{([#\/]?)([A-Za-z0-9_]+)\}\}/g;
    while ((m = re.exec(tpl))) { if (!m[1]) set[m[2]] = true; }
    return Object.keys(set);
  }
  function blockFieldKeys(tpl) {
    var seen = {}, order = [];
    tokensOf(tpl).forEach(function (tok) {
      if (B.RESERVED.indexOf(tok) >= 0) return;
      if (!seen[tok]) { seen[tok] = true; order.push(tok); }
    });
    return order;
  }

  // Human-readable label for an XSLT/envelope token. Strips the EDI block
  // prefix (rr_/sg_/sp_/ib_/ob_/fm_/pp_/pi_/em_/dm_/ex_), looks it up in the
  // friendly LABELS map, then falls back to a prettified token.
  var _PREFIX = /^(rr|sg|sp|ib|ob|fm|pp|pi|em|dm|ex)_/;
  function prettify(key) {
    var k = String(key || '').replace(_PREFIX, '');
    k = k.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();
    return k ? k.charAt(0).toUpperCase() + k.slice(1) : key;
  }
  function labelFor(key) {
    var labels = B.LABELS || {};
    if (labels[key]) return labels[key];
    var base = String(key || '').replace(_PREFIX, '');
    if (labels[base]) return labels[base];
    return prettify(key);
  }
  function fieldKeys(iface) {
    var t = T(iface), seen = {}, order = [];
    var keepReserved = xsltOnly(iface);
    var sources = [t.bp, t.export];
    xsltBlocks(iface).forEach(function (b) { sources.push(b.tpl); });
    sources.forEach(function (tpl) {
      tokensOf(tpl).forEach(function (tok) {
        if (!keepReserved && B.RESERVED.indexOf(tok) >= 0) return;
        if (!seen[tok]) { seen[tok] = true; order.push(tok); }
      });
    });
    return order;
  }

  // Render: {{#FLAG}}..{{/FLAG}} blocks first, then {{TOKEN}}.
  function render_(tpl, vals, flags) {
    flags = flags || {};
    var out = tpl.replace(/\{\{#([A-Za-z0-9_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
      function (_, name, body) { return flags[name] ? body : ''; });
    out = out.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, function (m, name) {
      return (vals[name] != null) ? vals[name] : m;
    });
    return out;
  }
  function unresolved(text) {
    var m, re = /\{\{[#\/]?[A-Za-z0-9_]+\}\}/g, hits = [];
    while ((m = re.exec(text))) hits.push(m[0]);
    return hits;
  }

  // ----------------------------------------------------------------- state
  function newState(iface) {
    var def = B.IFACES[iface] || B.IFACES.MBFS;
    var bpd = def.bpDefaults || {};
    var x = {};
    fieldKeys(iface).forEach(function (k) {
      x[k] = (B.DEFAULTS[k] != null) ? B.DEFAULTS[k] : '';
    });
    return {
      iface: iface, step: 0, dynamicMb: !!def.dynamicDefault,
      bp: {
        name: '', desc: '', author: 'Integration Studio',
        date: fmtDate(new Date()), version: '1',
        wfdId: (bpd.wfdId != null ? bpd.wfdId : '5262'),
        lastUsed: '1', confDesc: '',
        genericBp: (bpd.genericBp || 'SCE_Generic_MB_To_FS_Multiple'),
        errorBp: (bpd.errorBp || 'SCE_Error_Handler'),
        dateFormat: 'yyyyMMdd', dateVar: 'MyCurrentDayDate'
      },
      mb: {
        pattern: (def.dynamicDefault ? 'cycle' : 'static'),
        prefix: '/HPCC_Technosylva/sce-inbound/init_',
        dateVar: 'MyCurrentDayDate', cycles: ['00z'],
        suffix: '/post/station_ecmwf', staticPath: '', custom: '',
        appendCycle: true
      },
      x: x, out: null, env: {}
    };
  }
  function fmtDate(d) {
    var mm = ('0' + (d.getMonth() + 1)).slice(-2), dd = ('0' + d.getDate()).slice(-2);
    return mm + '/' + dd + '/' + d.getFullYear();
  }

  var S = lsGet(LS_STATE, null);
  function saveState() { lsSet(LS_STATE, S); }

  // ----------------------------------------------------------- mailbox info
  function mbInfo(cycle, st) {
    st = st || S;
    var sub = function (v) { return String(v || '').replace(/\{cycle\}/g, cycle || ''); };
    var dv = st.bp.dateVar || st.mb.dateVar || 'MyCurrentDayDate';
    var r = { dynamic: false, expr: '', resolved: '', assign: '', xslt: '' };
    var mbx = st.mb;
    if (mbx.pattern === 'cycle') {
      r.dynamic = true;
      var pre = sub(mbx.prefix), suf = sub(mbx.suffix), cyc = sub(cycle);
      r.expr = "concat('" + pre + "',/ProcessData/" + dv + ",'" + cyc + suf + "')";
      r.resolved = pre + '<' + dv + '>' + cyc + suf;
      r.xslt = '<xsl:value-of select="' + xa(r.expr) + '"/>';
      r.assign = '<assign to="SourceMailbox" from="' + xa(r.expr) + '"></assign>';
    } else if (mbx.pattern === 'date') {
      r.dynamic = true;
      var pre2 = sub(mbx.prefix), suf2 = sub(mbx.suffix);
      r.expr = "concat('" + pre2 + "',/ProcessData/" + dv + ",'" + suf2 + "')";
      r.resolved = pre2 + '<' + dv + '>' + suf2;
      r.xslt = '<xsl:value-of select="' + xa(r.expr) + '"/>';
      r.assign = '<assign to="SourceMailbox" from="' + xa(r.expr) + '"></assign>';
    } else if (mbx.pattern === 'custom') {
      r.dynamic = true;
      r.expr = sub(mbx.custom);
      r.resolved = r.expr;
      r.xslt = '<xsl:value-of select="' + xa(r.expr) + '"/>';
      r.assign = '<assign to="SourceMailbox" from="' + xa(r.expr) + '"></assign>';
    } else { // static
      r.dynamic = false;
      var p = sub(mbx.staticPath);
      r.expr = p; r.resolved = p; r.xslt = xe(p);
      r.assign = '<assign to="SourceMailbox">' + xe(p) + '</assign>';
    }
    return r;
  }

  // ---------------------------------------------------------- cycles/variants
  function variants() {
    if ((S.mb.pattern === 'cycle') && S.mb.cycles && S.mb.cycles.length)
      return S.mb.cycles.slice();
    return [''];
  }

  // ------------------------------------------------------------- build one BP
  function buildOne(cycle) {
    var t = T(S.iface);
    var bp = S.bp;
    var xo = xsltOnly(S.iface);
    var name = xo
      ? String(S.x.ProcessName || bp.name || '').replace(/\{cycle\}/g, cycle || '')
      : String(bp.name || '').replace(/\{cycle\}/g, cycle || '');
    if (!xo && S.mb.pattern === 'cycle' && S.mb.appendCycle && cycle &&
      !new RegExp('_' + cycle + '$').test(name)) name = name + '_' + cycle;

    var mi = mbInfo(cycle);

    // extras: every non-reserved token -> escaped x value (cycle-substituted)
    var extras = {};
    fieldKeys(S.iface).forEach(function (k) {
      var v = String(S.x[k] == null ? '' : S.x[k]).replace(/\{cycle\}/g, cycle || '');
      extras[k] = xe(v);
    });
    // Smart defaults when a field is present in the templates but left blank.
    if ('MailName' in extras && !S.x.MailName) extras.MailName = xe(name);
    if ('ErrMailSubject' in extras && !S.x.ErrMailSubject) extras.ErrMailSubject = xe(name + ' - Failed');
    if ('MailSubject' in extras && !S.x.MailSubject) extras.MailSubject = xe(name);
    if ('SystemName' in extras && !S.x.SystemName)
      extras.SystemName = xe(name.replace(/^SCE_SFTPGET_/i, ''));

    var reserved = {
      BP_NAME: xe(name),
      DESCRIPTION: cm(xe(bp.desc)),
      GENERIC_BP: xe(bp.genericBp),
      ERROR_BP: xe(bp.errorBp),
      AUTHOR: xe(bp.author),
      DATE: xe(bp.date),
      DATE_VAR: xe(bp.dateVar),
      DATE_FORMAT: xe(bp.dateFormat),
      SOURCE_MAILBOX_ASSIGN: mi.assign,
      ProcessName: xe(name),
      MailboxPath: mi.xslt
    };

    var bpVals = Object.assign({}, extras, reserved);
    var bpText = '', payload = '', impText = '';
    if (!xsltOnly(S.iface)) {
      bpText = crlf(render_(t.bp, bpVals, { DYNAMIC: mi.dynamic }));
      payload = b64(bpText);

      var impVals = {
        BP_B64: payload,
        BP_NAME: xe(name),
        CONF_DESC: cm(xe(bp.confDesc || bp.desc)),
        WFD_ID: xe(bp.wfdId),
        VERSION: xe(bp.version),
        LAST_USED: xe(bp.lastUsed)
      };
      impText = render_(t.export, impVals, {});
    }

    var blocks = xsltBlocks(S.iface).map(function (blk) {
      var vals = xo
        ? Object.assign({}, extras)
        : Object.assign({}, extras, {
          ProcessName: xe(name),
          MailboxPath: mi.xslt,
          MailName: extras.MailName
        });
      return {
        key: blk.key, label: blk.label, file: blk.file,
        text: crlf(render_(blk.tpl, vals, {}))
      };
    });

    return {
      cycle: cycle, name: name, mi: mi,
      bp: bpText, imp: impText, b64: payload,
      blocks: blocks, xslt: (blocks[0] ? blocks[0].text : ''),
      mailbox: mi.resolved
    };
  }

  function buildAll() {
    return variants().map(function (c) { return buildOne(c); });
  }

  // --------------------------------------------------------------- validation
  function wellFormed(text, kind) {
    try {
      var s = text;
      if (kind === 'xslt') {
        s = '<root xmlns:xsl="http://www.w3.org/1999/XSL/Transform">' + text + '</root>';
      }
      var doc = new DOMParser().parseFromString(s, 'application/xml');
      return doc.getElementsByTagName('parsererror').length === 0;
    } catch (e) { return false; }
  }

  function checks() {
    var out = [];
    var nameRe = /^[A-Za-z][A-Za-z0-9_]*$/;
    var builds = buildAll();
    if (xsltOnly(S.iface)) {
      if (!S.x.ProcessName) out.push({ t: 'e', m: 'ProcessName is required.' });
      else if (!nameRe.test(String(S.x.ProcessName).replace(/\{cycle\}/g, 'x')))
        out.push({ t: 'e', m: 'ProcessName must match ^[A-Za-z][A-Za-z0-9_]*$.' });
    } else if (!S.bp.name) out.push({ t: 'e', m: 'BP name is required.' });
    else if (!nameRe.test(S.bp.name.replace(/\{cycle\}/g, 'x')))
      out.push({ t: 'e', m: 'BP name must match ^[A-Za-z][A-Za-z0-9_]*$.' });
    if (!ready(S.iface)) out.push({ t: 'e', m: 'Templates for this interface are missing.' });

    builds.forEach(function (b) {
      if (!xsltOnly(S.iface)) {
        ['bp', 'imp'].forEach(function (k) {
          var un = unresolved(b[k]);
          if (un.length) out.push({ t: 'w', m: b.name + ': unresolved token(s) in ' + k + ': ' + un.join(', ') });
        });
      }
      b.blocks.forEach(function (blk) {
        var un = unresolved(blk.text);
        if (un.length) out.push({ t: 'w', m: b.name + ': unresolved token(s) in ' + blk.label + ': ' + un.join(', ') });
        if (!wellFormed(blk.text, 'xslt')) out.push({ t: 'e', m: b.name + ': ' + blk.label + ' block is not well-formed.' });
      });
      if (!xsltOnly(S.iface)) {
        if (!wellFormed(b.bp, 'bp')) out.push({ t: 'e', m: b.name + ': BPML is not well-formed XML.' });
        if (!wellFormed(b.imp, 'imp')) out.push({ t: 'e', m: b.name + ': Import XML is not well-formed.' });
      }
    });
    if (!out.some(function (o) { return o.t === 'e'; }))
      out.push({ t: 'g', m: 'All generated artefacts are well-formed.' });
    return out;
  }

  // ------------------------------------------------------- import PROCNAME block
  function parseBlock(text) {
    var get = function (tag) {
      var m = new RegExp('<' + tag + '>([\\s\\S]*?)<\\/' + tag + '>').exec(text);
      return m ? m[1] : null;
    };
    var name = (/<PROCNAME\s+name="([^"]*)"/.exec(text) || [])[1] ||
      (get('ProcessName') || '');
    var fields = {};
    fieldKeys('MBFS').forEach(function (k) {
      var v = get(k);
      if (v != null) fields[k] = v.replace(/<xsl:[\s\S]*?\/>|<[^>]+>/g, '').trim();
    });
    var mbRaw = get('MailboxPath') || '';
    return { name: name, fields: fields, mailbox: mbRaw };
  }
  function stateFromBlock(block) {
    var st = newState('MBFS');
    st.bp.name = block.name;
    Object.keys(block.fields).forEach(function (k) {
      if (st.x[k] !== undefined) st.x[k] = block.fields[k];
    });
    var mb = analyse(block.mailbox);
    if (mb) {
      st.mb.pattern = mb.pattern;
      if (mb.prefix != null) st.mb.prefix = mb.prefix;
      if (mb.dateVar) st.bp.dateVar = mb.dateVar;
      if (mb.suffix != null) st.mb.suffix = mb.suffix;
      if (mb.cycle) st.mb.cycles = [mb.cycle];
      if (mb.staticPath != null) st.mb.staticPath = mb.staticPath;
      st.dynamicMb = mb.pattern !== 'static';
    }
    return st;
  }
  // analyse a MailboxPath value -> pattern
  function analyse(raw) {
    var m = /concat\('([^']*)',\/ProcessData\/([A-Za-z0-9_]+),'([^']*)'\)/.exec(raw);
    if (m) {
      var pre = m[1], dv = m[2], tail = m[3];
      var cm2 = /^(\d{2}z)(.*)$/.exec(tail);
      if (cm2) return { pattern: 'cycle', prefix: pre, dateVar: dv, cycle: cm2[1], suffix: cm2[2] };
      return { pattern: 'date', prefix: pre, dateVar: dv, suffix: tail };
    }
    var plain = raw.replace(/<[^>]+>/g, '').trim();
    if (plain) return { pattern: 'static', staticPath: plain };
    return null;
  }

  // =====================================================================
  // VIEWS
  // =====================================================================
  var view = function () { return document.getElementById('view'); };

  // Highlight the active sidebar item and set the page title/subtitle.
  function setActive(navId, title, sub) {
    ['nav-home', 'nav-templates', 'nav-import', 'nav-analysis', 'nav-selftest', 'nav-accounts', 'nav-ai']
      .forEach(function (id) {
        var e = document.getElementById(id);
        if (e) e.classList.toggle('active', id === navId);
      });
    var t = document.getElementById('page-title');
    var s = document.getElementById('page-sub');
    if (t && title != null) t.textContent = title;
    if (s && sub != null) s.textContent = sub;
  }

  function toast(msg, kind) {
    var c = document.getElementById('toast');
    var t = el('div', { class: 'toastmsg ' + (kind || ''), text: msg });
    c.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 2600);
  }

  function modal(title, bodyNodes, buttons) {
    var host = document.getElementById('modal');
    host.innerHTML = '';
    var box = el('div', { class: 'modalbox' }, [
      el('h3', { text: title }),
      el('div', { class: 'modalbody' }, bodyNodes),
      el('div', { class: 'modalfoot' }, (buttons || []).map(function (b) {
        return el('button', { class: b.cls || 'btn', onclick: function () { if (b.fn) b.fn(); } }, [b.label]);
      }))
    ]);
    host.appendChild(box);
    host.classList.add('open');
    host.onclick = function (e) { if (e.target === host) closeModal(); };
  }
  function closeModal() { var h = document.getElementById('modal'); h.classList.remove('open'); h.innerHTML = ''; }

  // ------------------------------------------------------------- home view
  function renderHome() {
    setActive('nav-home', 'Integrations', 'Choose an interface and generate Sterling Integrator artefacts.');

    // Build one card per interface.
    function ifaceCard(id) {
      var i = B.IFACES[id], ok = ready(id);
      var stepCount = (i.steps || []).filter(function (s) { return s !== 'Review'; }).length;
      return el('div', { class: 'card iface' + (ok ? '' : ' disabled') }, [
        el('div', { class: 'ifhead' }, [
          el('h3', { text: i.title }),
          el('span', { class: 'badge ' + (ok ? 'ok' : 'todo'), text: ok ? 'READY' : 'TEMPLATE NEEDED' })
        ]),
        el('p', { class: 'muted', text: i.desc }),
        el('div', { class: 'row' }, [
          el('span', { class: 'muted small', text: stepCount + (stepCount === 1 ? ' step' : ' steps') }),
          el('span', { class: 'spacer' }),
          el('button', {
            class: 'btn primary', disabled: ok ? null : 'disabled',
            onclick: function () { A.start(id); }
          }, ['New business process'])
        ])
      ]);
    }

    // Group interfaces by category, preserving definition order.
    var order = [], groups = {};
    Object.keys(B.IFACES).forEach(function (id) {
      var cat = B.IFACES[id].category || 'Other';
      if (!groups[cat]) { groups[cat] = []; order.push(cat); }
      groups[cat].push(id);
    });

    var sections = order.map(function (cat) {
      var ids = groups[cat];
      var readyCount = ids.filter(function (id) { return ready(id); }).length;
      return el('div', { class: 'stack' }, [
        el('div', { class: 'cat-head' }, [
          el('h3', { text: cat }),
          el('span', { class: 'muted small', text: readyCount + ' / ' + ids.length + ' ready' })
        ]),
        el('div', { class: 'grid' }, ids.map(ifaceCard))
      ]);
    });

    var v = view(); v.innerHTML = '';
    v.appendChild(el('div', { class: 'stack' }, [
      el('div', { class: 'hero' }, [
        el('h2', { text: 'Choose an interface' }),
        el('p', { class: 'muted', text: 'Generate the BPML, SI import XML and XSLT block from a short form.' })
      ])
    ].concat(sections).concat([renderHistory()])));
  }

  function renderHistory() {
    var hist = lsGet(LS_HIST, []);
    if (!hist.length) return el('div');
    return el('div', { class: 'card' }, [
      el('h3', { text: 'Recent business processes' }),
      el('div', { class: 'list' }, hist.slice(0, 12).map(function (h) {
        return el('div', { class: 'listrow' }, [
          el('div', {}, [el('strong', { text: h.name }), el('div', { class: 'muted small', text: h.iface + ' \u2022 ' + h.when })]),
          el('button', { class: 'btn', onclick: function () { A.reload(h); } }, ['Load'])
        ]);
      }))
    ]);
  }

  // ------------------------------------------------------------- wizard
  function SK() { return (B.IFACES[S.iface] || B.IFACES.MBFS).steps; }

  function stepper() {
    var steps = SK();
    return el('div', { class: 'stepper' }, steps.map(function (name, i) {
      return el('div', {
        class: 'step' + (i === S.step ? ' active' : '') + (i < S.step ? ' done' : ''),
        onclick: function () { if (i <= S.step) { S.step = i; saveState(); renderWizard(); } }
      }, [el('span', { class: 'dot', text: String(i + 1) }), el('span', { text: name })]);
    }));
  }

  function field(label, node, hint) {
    return el('label', { class: 'field' }, [
      el('span', { class: 'flabel', text: label }),
      node,
      hint ? el('span', { class: 'hint', text: hint }) : null
    ]);
  }
  function input(val, on, attrs) {
    var e = el('input', Object.assign({ class: 'in', value: val == null ? '' : val }, attrs || {}));
    e.addEventListener('input', function () { on(e.value); });
    return e;
  }
  function textarea(val, on) {
    var e = el('textarea', { class: 'in', rows: '3' }); e.value = val || '';
    e.addEventListener('input', function () { on(e.value); });
    return e;
  }
  function toggle(val, on) {
    var yes = (val === 'Yes');
    return el('button', {
      class: 'toggle ' + (yes ? 'on' : 'off'),
      type: 'button', text: yes ? 'Yes' : 'No',
      onclick: function () { on(yes ? 'No' : 'Yes'); renderWizard(); }
    });
  }

  function stepDetails() {
    var b = S.bp;
    var xo = xsltOnly(S.iface);
    var basic = el('div', { class: 'formgrid' }, [
      field('BP name', input(b.name, function (v) { b.name = v; saveState(); }, { placeholder: 'SCE_IB_..._From_..._To_...' }),
        xo ? 'Used as ProcessName / MailName. Use {cycle} to inject 00z/12z.' : 'Use {cycle} to inject 00z/12z.'),
      xo ? null : field('Version', input(b.version, function (v) { b.version = v; saveState(); })),
      xo ? null : field('Description', textarea(b.desc, function (v) { b.desc = v; if (!b._cdEdited) b.confDesc = v; saveState(); })),
      xo ? null : field('Author', input(b.author, function (v) { b.author = v; saveState(); })),
      xo ? null : field('Date', input(b.date, function (v) { b.date = v; saveState(); }))
    ].filter(Boolean));
    var staticField = (S.iface === 'MBFS' && !S.dynamicMb) ?
      field('Source mailbox path', input(S.mb.staticPath, function (v) { S.mb.staticPath = v; S.mb.pattern = 'static'; saveState(); }), 'Fixed mailbox path.') : null;

    var dynToggle = el('label', { class: 'chk' }, [
      (function () {
        var c = el('input', { type: 'checkbox' }); c.checked = S.dynamicMb;
        c.addEventListener('change', function () {
          S.dynamicMb = c.checked;
          S.mb.pattern = c.checked ? 'cycle' : 'static';
          saveState(); renderWizard();
        });
        return c;
      })(),
      el('span', { text: 'Use a dynamic (dated) mailbox' })
    ]);

    var adv = xo ? null : el('details', { class: 'adv' }, [
      el('summary', { text: 'Advanced' }),
      el('div', { class: 'formgrid' }, [
        field('Generic BP', input(b.genericBp, function (v) { b.genericBp = v; saveState(); })),
        field('Error BP', input(b.errorBp, function (v) { b.errorBp = v; saveState(); })),
        field('WFD id', input(b.wfdId, function (v) { b.wfdId = v; saveState(); })),
        field('Date variable', input(b.dateVar, function (v) { b.dateVar = v; saveState(); })),
        field('Date format', input(b.dateFormat, function (v) { b.dateFormat = v; saveState(); })),
        field('Conf description', input(b.confDesc, function (v) { b.confDesc = v; b._cdEdited = true; saveState(); })),
        field('Last used', input(b.lastUsed, function (v) { b.lastUsed = v; saveState(); }))
      ])
    ]);
    return el('div', { class: 'stack' }, [basic, staticField, S.iface === 'MBFS' ? dynToggle : null, adv]);
  }

  function stepDynamic() {
    var mb = S.mb;
    var patterns = [
      ['cycle', 'Dated + cycle'], ['date', 'Dated folder'],
      ['static', 'Static path'], ['custom', 'Custom XPath']
    ];
    var picker = el('div', { class: 'pills' }, patterns.map(function (p) {
      return el('button', {
        class: 'pill' + (mb.pattern === p[0] ? ' active' : ''),
        type: 'button', text: p[1],
        onclick: function () { mb.pattern = p[0]; S.dynamicMb = p[0] !== 'static'; saveState(); renderWizard(); }
      });
    }));

    var body;
    if (mb.pattern === 'cycle' || mb.pattern === 'date') {
      var cyc = (mb.pattern === 'cycle') ? el('div', { class: 'stack' }, [
        el('span', { class: 'flabel', text: 'Cycles' }),
        el('div', { class: 'pills' }, ['00z', '12z'].map(function (c) {
          var on = mb.cycles.indexOf(c) >= 0;
          return el('button', {
            class: 'pill' + (on ? ' active' : ''), type: 'button', text: c,
            onclick: function () {
              var i = mb.cycles.indexOf(c);
              if (i >= 0) mb.cycles.splice(i, 1); else mb.cycles.push(c);
              mb.cycles.sort(); saveState(); renderWizard();
            }
          });
        })),
        el('label', { class: 'chk' }, [
          (function () { var c = el('input', { type: 'checkbox' }); c.checked = mb.appendCycle; c.addEventListener('change', function () { mb.appendCycle = c.checked; saveState(); }); return c; })(),
          el('span', { text: 'Append _<cycle> to the BP name' })
        ])
      ]) : null;
      body = el('div', { class: 'stack' }, [
        el('div', { class: 'formgrid' }, [
          field('Prefix', input(mb.prefix, function (v) { mb.prefix = v; saveState(); renderPreview(); })),
          field('Date variable', input(S.bp.dateVar, function (v) { S.bp.dateVar = v; saveState(); renderPreview(); })),
          field('Suffix', input(mb.suffix, function (v) { mb.suffix = v; saveState(); renderPreview(); }))
        ]),
        cyc
      ]);
    } else if (mb.pattern === 'static') {
      body = el('div', { class: 'formgrid' }, [
        field('Static mailbox path', input(mb.staticPath, function (v) { mb.staticPath = v; saveState(); renderPreview(); }))
      ]);
    } else {
      body = el('div', { class: 'formgrid' }, [
        field('Custom XPath', input(mb.custom, function (v) { mb.custom = v; saveState(); renderPreview(); }), 'Free XPath expression.')
      ]);
    }

    var prev = el('div', { class: 'card preview', id: 'mbpreview' });
    setTimeout(renderPreview, 0);
    return el('div', { class: 'stack' }, [picker, body, prev]);
  }
  function renderPreview() {
    var host = document.getElementById('mbpreview'); if (!host) return;
    var rows = variants().map(function (c) {
      var mi = mbInfo(c);
      return el('div', { class: 'kv' }, [
        el('code', { text: c || '(single)' }),
        el('code', { text: mi.expr })
      ]);
    });
    host.innerHTML = '';
    host.appendChild(el('div', { class: 'stack' }, [el('strong', { text: 'Mailbox preview' })].concat(rows)));
  }

  function stepXslt() {
    return renderFieldGroups(fieldKeys(S.iface));
  }

  function stepXsltBlock(block) {
    var keys = blockFieldKeys(block.tpl);
    return el('div', { class: 'stack' }, [
      el('div', { class: 'al g', text: 'Configures the ' + block.label + ' block (' + block.file.replace(/^_/, '') + '). Fields are shown in XSLT order.' }),
      el('div', { class: 'card' }, [
        el('h3', { text: block.label }),
        el('div', { class: 'formgrid' }, keys.map(function (k) {
          var node = (B.YN.indexOf(k) >= 0)
            ? toggle(S.x[k], function (v) { S.x[k] = v; saveState(); })
            : input(S.x[k], function (v) { S.x[k] = v; saveState(); });
          return field(labelFor(k), node, B.HINT[k]);
        }))
      ])
    ]);
  }

  function renderFieldGroups(keys) {
    var grouped = {}, used = {};
    Object.keys(B.GROUPS).forEach(function (g) {
      var members = B.GROUPS[g].filter(function (k) { return keys.indexOf(k) >= 0 && !used[k]; });
      if (members.length) { grouped[g] = members; members.forEach(function (k) { used[k] = true; }); }
    });
    var others = keys.filter(function (k) { return !used[k]; });
    if (others.length) grouped['Other template fields'] = others;

    var sections = Object.keys(grouped).map(function (g) {
      return el('div', { class: 'card' }, [
        el('h3', { text: g }),
        el('div', { class: 'formgrid' }, grouped[g].map(function (k) {
          var node = (B.YN.indexOf(k) >= 0)
            ? toggle(S.x[k], function (v) { S.x[k] = v; saveState(); })
            : input(S.x[k], function (v) { S.x[k] = v; saveState(); });
          return field(k, node, B.HINT[k]);
        }))
      ]);
    });
    return el('div', { class: 'stack' }, sections);
  }

  // =====================================================================
  // EDI TRADING-PARTNER ENVELOPES (ISA / GS / ST segments)
  // =====================================================================
  var ENV = window.__EDI_ENV__;

  // True when the current interface has a mapped envelope export XML.
  function hasEnvelopes(iface) { return !!(ENV && ENV.has(iface)); }
  // Pretty labels for the top-level identity fields.
  var ENV_LABELS = {
    NAME: 'Envelope name', SENDER_ID: 'Sender ID', RECEIVER_ID: 'Receiver ID',
    CONTROL_NUMBER: 'Control number'
  };

  // Build the generated (developer-filled) envelope XML, or null if the source
  // XML has not been loaded yet.
  function envOutput() {
    if (!hasEnvelopes(S.iface) || !ENV._cache || !ENV._cache[S.iface]) return null;
    var src = ENV._cache[S.iface];
    if (!src || src.error) return null;
    return ENV.generate(src.xml, S.env || {});
  }
  function envFileName(name) {
    return (name || 'package') + '_Envelopes.xml';
  }

  function stepEnvelopes() {
    var host = el('div', { class: 'stack' });
    if (!ENV._cache) ENV._cache = {};
    // Trigger the (cached) load; re-render once resolved.
    if (!ENV._cache[S.iface]) {
      host.appendChild(el('div', { class: 'al g', text: 'Loading trading-partner envelopes\u2026' }));
      ENV.fetchFor(S.iface).then(function (data) {
        ENV._cache[S.iface] = data;
        if (SK()[S.step] === 'Envelopes') renderWizard();
      }, function (err) {
        ENV._cache[S.iface] = { error: String((err && err.message) || err) };
        if (SK()[S.step] === 'Envelopes') renderWizard();
      });
      return host;
    }
    var data = ENV._cache[S.iface];
    if (data.error) {
      host.appendChild(el('div', { class: 'al e', text: 'Could not load envelopes: ' + data.error }));
      return host;
    }

    host.appendChild(el('div', { class: 'al g', text:
      'Read ' + data.envelopes.length + ' TP envelope segment(s) from ' + data.url +
      '. Fill in the values for your trading partner below.' }));

    S.env = S.env || {};
    data.envelopes.forEach(function (env) {
      S.env[env.index] = S.env[env.index] || {};
      var ov = S.env[env.index];

      var coreRows = ENV.CORE.map(function (c) {
        var cur = (ov[c] != null) ? ov[c] : env.core[c];
        return field(ENV_LABELS[c] || c,
          input(cur, function (v) { ov[c] = v; saveState(); }),
          (c === 'SENDER_ID' || c === 'RECEIVER_ID') ? 'Trading-partner X12 identifier.' : '');
      });

      var parmRows = env.parmKeys.map(function (p) {
        var cur = (ov[p] != null) ? ov[p] : env.parms[p];
        var node = (ENV.YN.indexOf(p) >= 0)
          ? toggle(cur === 'YES' ? 'Yes' : 'No',
              function (v) { ov[p] = (v === 'Yes' ? 'YES' : 'NO'); saveState(); })
          : input(cur, function (v) { ov[p] = v; saveState(); });
        return field(labelFor(p), node);
      });

      host.appendChild(el('div', { class: 'card' }, [
        el('h3', { text: env.segment + ' \u00b7 ' + (env.name || env.type) }),
        el('div', { class: 'muted small', text: 'Segment ' + env.type + ' \u2022 standard ' + (env.standard || 'X12') }),
        el('div', { class: 'formgrid' }, coreRows),
        parmRows.length ? el('h3', { text: 'Envelope parameters' }) : null,
        parmRows.length ? el('div', { class: 'formgrid' }, parmRows) : null
      ].filter(Boolean)));
    });

    var out = envOutput();
    host.appendChild(el('details', { class: 'adv' }, [
      el('summary', { text: 'Preview generated envelope XML' }),
      el('pre', { class: 'code' }, [el('code', { text: out || '' })])
    ]));
    return host;
  }

  function stepReview() {
    var builds = buildAll();
    var problems = checks();
    var alerts = el('div', { class: 'stack' }, problems.map(function (p) {
      return el('div', { class: 'al ' + p.t, text: p.m });
    }));

    S._rb = Math.min(S._rb || 0, builds.length - 1);
    var bsel = builds.length > 1 ? el('div', { class: 'pills' }, builds.map(function (bb, i) {
      return el('button', { class: 'pill' + (i === S._rb ? ' active' : ''), type: 'button', text: bb.name, onclick: function () { S._rb = i; renderWizard(); } });
    })) : null;

    var b = builds[S._rb] || builds[0];
    var showMb = hasMailbox(S.iface);

    // Build the tab list dynamically: [Import XML, BPML], one per block, [Mailbox paths]
    var items = [];
    if (!xsltOnly(S.iface)) {
      items.push({ name: 'Import XML', content: b.imp, file: b.name + '.xml' });
      items.push({ name: 'BPML', content: b.bp, file: b.name + '.bpml' });
    }
    b.blocks.forEach(function (blk) {
      items.push({ name: blk.label, content: blk.text, file: b.name + blk.file });
    });
    if (showMb) items.push({
      name: 'Mailbox paths',
      content: builds.map(function (x) { return x.name + ': ' + x.mailbox; }).join('\n'),
      file: b.name + '_mailboxes.txt'
    });
    var envXml = envOutput();
    if (envXml) items.push({
      name: 'TP Envelopes',
      content: envXml,
      file: envFileName(b.name)
    });

    S._rt = Math.min(S._rt || 0, items.length - 1);

    var tabs = el('div', { class: 'tabs' }, items.map(function (it, i) {
      return el('button', { class: 'tab' + (i === S._rt ? ' active' : ''), type: 'button', text: it.name, onclick: function () { S._rt = i; renderWizard(); } });
    }));
    var active = items[S._rt] || items[0];
    var content = active.content;
    var pre = el('pre', { class: 'code' }, [el('code', { text: content })]);
    var bar = el('div', { class: 'row' }, [
      el('button', { class: 'btn', onclick: function () { A.copy(content); } }, ['Copy']),
      el('button', { class: 'btn', onclick: function () { A.save(active.file, content); } }, ['Save']),
      el('button', { class: 'btn primary', id: 'zipbtn', onclick: function () { A.zip(builds); } }, ['Download package (.zip)'])
    ]);

    return el('div', { class: 'stack' }, [
      el('div', { class: 'card' }, [el('h3', { text: 'Validation' }), alerts]),
      el('div', { class: 'card' }, [bsel, tabs, pre, bar].filter(Boolean))
    ]);
  }

  function renderWizard() {
    setActive('nav-home', (B.IFACES[S.iface] || {}).title || 'Business process',
      xsltOnly(S.iface) ? 'Fill the form to generate the XSLT block.'
        : 'Fill the form to generate the BPML, import XML and XSLT block.');
    var steps = SK();
    var stepName = steps[S.step];
    var body;
    if (stepName === 'Details') body = stepDetails();
    else if (stepName === 'Dynamic mailbox') body = stepDynamic();
    else if (stepName === 'XSLT fields') body = stepXslt();
    else if (stepName === 'Envelopes') body = stepEnvelopes();
    else if (stepName === 'Review') body = stepReview();
    else {
      var blk = blockByLabel(S.iface, stepName);
      body = blk ? stepXsltBlock(blk) : stepReview();
    }

    var nav = el('div', { class: 'navbar' }, [
      el('button', { class: 'btn', onclick: function () { A.home(); } }, ['\u2190 Home']),
      el('div', { class: 'spacer' }),
      S.step > 0 ? el('button', { class: 'btn', onclick: function () { S.step--; saveState(); renderWizard(); } }, ['Back']) : null,
      S.step < steps.length - 1 ? el('button', { class: 'btn primary', onclick: function () { S.step++; saveState(); renderWizard(); } }, ['Next']) :
        el('button', { class: 'btn primary', onclick: function () { A.finish(); } }, ['Save to history'])
    ].filter(Boolean));

    var v = view(); v.innerHTML = '';
    v.appendChild(el('div', { class: 'stack' }, [
      el('div', { class: 'hero small' }, [el('h2', { text: (B.IFACES[S.iface] || {}).title || S.iface })]),
      stepper(), body, nav
    ]));
  }

  // ------------------------------------------------------------ templates view
  function renderTemplates() {
    setActive('nav-templates', 'Templates', 'View and edit the built-in artefact templates.');
    var ids = Object.keys(B.templates);
    var cur = window.__tplSel || (window.__tplSel = { iface: ids[0], tab: 'bp' });
    var t = T(cur.iface);
    var blocks = xsltBlocks(cur.iface);
    var legacy = !t.xsltList;

    // Tabs: BPML, Export XML, then one per XSLT block.
    var xo = xsltOnly(cur.iface);
    var tabs = xo ? [] : [['bp', 'BPML'], ['export', 'Export XML']];
    blocks.forEach(function (b) {
      tabs.push([legacy ? 'xslt' : ('block:' + b.key), b.label]);
    });
    // Make sure the current tab is valid for this interface.
    if (!tabs.some(function (tb) { return tb[0] === cur.tab; })) cur.tab = tabs[0][0];

    var tabValue = function (tabId) {
      if (tabId === 'bp' || tabId === 'export' || tabId === 'xslt') return t[tabId] || '';
      var key = tabId.replace(/^block:/, '');
      for (var i = 0; i < blocks.length; i++) if (blocks[i].key === key) return blocks[i].tpl;
      return '';
    };
    var ta = el('textarea', { class: 'in mono', rows: '22' }); ta.value = tabValue(cur.tab);

    var ifsel = el('div', { class: 'pills' }, ids.map(function (id) {
      return el('button', { class: 'pill' + (id === cur.iface ? ' active' : ''), type: 'button', text: id, onclick: function () { cur.iface = id; cur.tab = 'bp'; renderTemplates(); } });
    }));
    var tabsel = el('div', { class: 'tabs' }, tabs.map(function (tb) {
      return el('button', { class: 'tab' + (tb[0] === cur.tab ? ' active' : ''), type: 'button', text: tb[1], onclick: function () { cur.tab = tb[0]; renderTemplates(); } });
    }));
    var bar = el('div', { class: 'row' }, [
      el('button', {
        class: 'btn primary', onclick: function () {
          var stored = lsGet(LS_TPL, {}); stored[cur.iface] = stored[cur.iface] || {};
          stored[cur.iface][cur.tab] = ta.value; lsSet(LS_TPL, stored);
          toast('Template saved', 'g');
        }
      }, ['Save']),
      el('button', {
        class: 'btn', onclick: function () {
          var stored = lsGet(LS_TPL, {}); if (stored[cur.iface]) { delete stored[cur.iface][cur.tab]; lsSet(LS_TPL, stored); }
          renderTemplates(); toast('Reset to built-in', 'g');
        }
      }, ['Reset to built-in'])
    ]);
    var v = view(); v.innerHTML = '';
    v.appendChild(el('div', { class: 'stack' }, [
      el('div', { class: 'hero small' }, [el('h2', { text: 'Templates' }), el('p', { class: 'muted', text: 'Edits are saved in your browser and override the built-ins.' })]),
      ifsel, tabsel, el('div', { class: 'card' }, [ta]), bar
    ]));
  }

  // ------------------------------------------------------------ import block
  function renderImport() {
    setActive('nav-import', 'Import XSLT block', 'Paste an existing block to detect the pattern and pre-fill the form.');
    var ta = el('textarea', { class: 'in mono', rows: '16', placeholder: 'Paste one <PROCNAME name="...">...</PROCNAME> block' });
    var v = view(); v.innerHTML = '';
    v.appendChild(el('div', { class: 'stack' }, [
      el('div', { class: 'hero small' }, [el('h2', { text: 'Import XSLT block' }), el('p', { class: 'muted', text: 'Detect the mailbox pattern and pre-fill the whole form.' })]),
      el('div', { class: 'card' }, [ta]),
      el('div', { class: 'row' }, [
        el('button', { class: 'btn', onclick: function () { A.home(); } }, ['Cancel']),
        el('button', {
          class: 'btn primary', onclick: function () {
            if (!ta.value.trim()) { toast('Paste a block first', 'w'); return; }
            var blk = parseBlock(ta.value);
            S = stateFromBlock(blk); S.step = 0; saveState();
            toast('Imported ' + (blk.name || 'block'), 'g'); location.hash = 'wizard'; renderWizard();
          }
        }, ['Import & edit'])
      ])
    ]));
  }

  // ------------------------------------------------------------ mailbox analysis
  function renderAnalysis() {
    setActive('nav-analysis', 'Mailbox analysis', 'How the mailbox pattern was derived from the training samples.');
    var rows = B.SAMPLES.map(function (s) {
      return el('div', { class: 'listrow' }, [
        el('div', {}, [el('strong', { text: s.name }), el('div', { class: 'muted small', text: 'cycle=' + s.cycle + ' \u2022 product=' + s.product })])
      ]);
    });
    var derived = "concat('/HPCC_Technosylva/sce-inbound/init_',/ProcessData/MyCurrentDayDate,'<cycle>/post/<product>')";
    var v = view(); v.innerHTML = '';
    v.appendChild(el('div', { class: 'stack' }, [
      el('div', { class: 'hero small' }, [el('h2', { text: 'Mailbox analysis' })]),
      el('div', { class: 'card' }, [el('h3', { text: 'Derived pattern' }), el('pre', { class: 'code' }, [el('code', { text: derived })])]),
      el('div', { class: 'card' }, [el('h3', { text: 'Training samples' }), el('div', { class: 'list' }, rows)])
    ]));
  }

  // =====================================================================
  // ACTIONS
  // =====================================================================
  var A = {
    home: function () { location.hash = ''; renderHome(); },
    start: function (id) { S = newState(id); saveState(); location.hash = 'wizard'; renderWizard(); },
    reload: function (h) { if (h.state) { S = h.state; S.step = 0; saveState(); location.hash = 'wizard'; renderWizard(); } },
    templates: function () { renderTemplates(); },
    import: function () { renderImport(); },
    analysis: function () { renderAnalysis(); },
    accounts: function () { renderAccounts(); },
    ai: function () { renderAI(); },
    // Section-by-section introspection for the AI chat (mirrors the wizard).
    introspect: function (ifaceId) {
      var def = B.IFACES[ifaceId];
      if (!def) return null;
      var t = T(ifaceId);
      function mapKeys(keys) {
        return keys.map(function (k) {
          return { key: k, label: labelFor(k), hint: B.HINT[k] || '', yn: (B.YN.indexOf(k) >= 0) };
        });
      }
      var sections = [];
      if (!xsltOnly(ifaceId)) {
        sections.push({
          id: 'bp', title: 'Business Process',
          intro: 'First we set up the Business Process.',
          fields: [
            { key: '__bpname__', label: 'Business Process name', hint: 'e.g. SCE_OB_850_SUPL_PO', yn: false },
            { key: '__description__', label: 'Description', hint: 'Short purpose of this BP', yn: false }
          ]
        });
      } else if ('ProcessName' in (newState(ifaceId).x)) {
        sections.push({
          id: 'bp', title: 'Process',
          intro: 'First the process name.',
          fields: [{ key: '__processname__', label: 'Process name', hint: '', yn: false }]
        });
      }
      xsltBlocks(ifaceId).forEach(function (b) {
        var keys = blockFieldKeys(b.tpl).filter(function (k) {
          return B.RESERVED.indexOf(k) < 0;
        });
        if (!keys.length) return;
        sections.push({
          id: b.key, title: b.label,
          intro: 'Configures the ' + b.label + ' block (' + b.file.replace(/^_/, '') + ').',
          fields: mapKeys(keys)
        });
      });
      return {
        id: ifaceId, title: def.title,
        category: def.category || '', sections: sections
      };
    },
    // Build the trading-partner ENVELOPE sections for the AI chat, reading the
    // ISA/GS/ST segments straight from the interface's envelope export XML.
    // Returns a Promise of [{id,title,intro,fields}] (empty if no envelopes).
    envelopePlan: function (ifaceId) {
      if (!ENV || !ENV.has(ifaceId)) return Promise.resolve([]);
      return ENV.fetchFor(ifaceId).then(function (data) {
        ENV._cache = ENV._cache || {};
        ENV._cache[ifaceId] = data;
        return (data.envelopes || []).map(function (env) {
          var fields = [];
          // Core trading-partner identity, including the envelope NAME so it can
          // be renamed for each partner/deployment.
          ['NAME', 'SENDER_ID', 'RECEIVER_ID', 'CONTROL_NUMBER'].forEach(function (c) {
            fields.push({
              key: 'env.' + env.index + '.' + c,
              label: labelFor(c),
              hint: env.core[c] ? ('current: ' + env.core[c]) : '',
              yn: false
            });
          });
          (env.parmKeys || []).forEach(function (p) {
            fields.push({
              key: 'env.' + env.index + '.' + p,
              label: labelFor(p),
              hint: env.parms[p] ? ('current: ' + env.parms[p]) : '',
              yn: ENV.YN.indexOf(p) >= 0
            });
          });
          return {
            id: 'env' + env.index,
            title: 'Envelope ' + env.segment + ' \u00b7 ' + (env.name || env.type),
            intro: 'Trading-partner ' + env.segment + ' envelope segment (from ' +
              (data.url || 'the EDI export XML') + '). Fill in the partner values.',
            fields: fields
          };
        });
      }, function () { return []; });
    },
    // Apply an AI recommendation into the wizard and jump to Review.
    applyAI: function (ifaceId, collected) {
      if (!B.IFACES[ifaceId]) { toast('Unknown interface: ' + ifaceId, 'e'); return; }
      S = newState(ifaceId);
      collected = collected || {};
      S.env = S.env || {};
      Object.keys(collected).forEach(function (k) {
        var v = collected[k];
        if (v == null || v === '') return;
        // Envelope value: key is "env.<index>.<field>".
        var em = /^env\.(\d+)\.(.+)$/.exec(k);
        if (em) {
          var idx = parseInt(em[1], 10), fld = em[2];
          S.env[idx] = S.env[idx] || {};
          // Normalise Yes/No -> YES/NO for envelope Y/N parms.
          if (/^(yes|no)$/i.test(v)) v = (/^yes$/i.test(v) ? 'YES' : 'NO');
          S.env[idx][fld] = v;
          return;
        }
        if (k === '__bpname__' || k === '__processname__') {
          S.bp.name = v;
          if (('ProcessName' in S.x)) S.x.ProcessName = v;
        } else if (k === '__description__') {
          S.bp.desc = v; S.bp.confDesc = v;
        } else if (k in S.x) {
          S.x[k] = v;
        } else {
          // Unknown key — stash on x so nothing is lost.
          S.x[k] = v;
        }
      });
      // Pre-fetch the envelope XML so the Review preview + zip include it.
      if (ENV && ENV.has(ifaceId)) {
        ENV._cache = ENV._cache || {};
        ENV.fetchFor(ifaceId).then(function (d) {
          ENV._cache[ifaceId] = d; renderWizard();
        }, function () {});
      }
      var steps = (B.IFACES[ifaceId].steps || []);
      S.step = Math.max(0, steps.length - 1); // Review
      saveState();
      location.hash = 'wizard';
      renderWizard();
      toast('Applied AI recommendation: ' + B.IFACES[ifaceId].title, 'g');
    },
    copy: function (text) {
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast('Copied', 'g'); }, function () { fallbackCopy(text); });
      else fallbackCopy(text);
    },
    save: function (name, text) {
      var blob = new Blob([text], { type: 'text/plain' });
      var a = el('a', { href: URL.createObjectURL(blob), download: name });
      document.body.appendChild(a); a.click(); a.remove();
      toast('Saved ' + name, 'g');
    },
    zip: function (builds) {
      if (typeof JSZip === 'undefined') { toast('JSZip not available offline — use Copy/Save', 'w'); return; }
      var z = new JSZip();
      builds.forEach(function (b) {
        if (!xsltOnly(S.iface)) {
          z.file(b.name + '.xml', b.imp);
          z.file(b.name + '.bpml', b.bp);
        }
        b.blocks.forEach(function (blk) { z.file(b.name + blk.file, blk.text); });
        if (hasMailbox(S.iface)) z.file(b.name + '_mailboxes.txt', b.name + ': ' + b.mailbox);
      });
      var envXml = envOutput();
      if (envXml) z.file(envFileName(builds[0].name), envXml);
      z.generateAsync({ type: 'blob' }).then(function (blob) {
        var a = el('a', { href: URL.createObjectURL(blob), download: (builds[0].name || 'package') + '.zip' });
        document.body.appendChild(a); a.click(); a.remove();
        toast('Package downloaded', 'g');
      });
    },
    finish: function () {
      var hist = lsGet(LS_HIST, []);
      var hname = (xsltOnly(S.iface) ? S.x.ProcessName : S.bp.name) || '(unnamed)';
      hist.unshift({ name: hname, iface: S.iface, when: new Date().toLocaleString(), state: JSON.parse(JSON.stringify(S)) });
      lsSet(LS_HIST, hist.slice(0, 40));
      toast('Saved to history', 'g'); A.home();
    },
    selftest: function () { runSelftest(); }
  };
  window.A = A;
  function fallbackCopy(text) {
    var ta = el('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Copied', 'g'); } catch (e) { toast('Copy failed', 'w'); }
    ta.remove();
  }

  // =====================================================================
  // SELF-TEST
  // =====================================================================
  function runSelftest() {
    var results = [];
    function ok(name, cond) { results.push({ name: name, pass: !!cond }); }

    ['MBFS'].forEach(function (id) {
      var t = T(id);
      ok('templates.' + id + '.xslt', !!t.xslt);
    });
    ok('xe escapes', xe('<a&b>') === '&lt;a&amp;b&gt;');
    ok('xa escapes quotes', xa('"x\'') === '&quot;x&apos;');
    ok('cm collapses --', cm('a---b') === 'a-b');
    ok('crlf newlines', crlf('a\nb') === 'a\r\nb');
    ok('b64 roundtrip', atob(b64('Hello')) === 'Hello');
    ok('tokensOf finds ProcessName', tokensOf(T('MBFS').xslt).indexOf('ProcessName') >= 0);
    ok('fieldKeys excludes reserved', fieldKeys('MBFS').indexOf('ProcessName') < 0);
    ok('fieldKeys has MessageNamePattern', fieldKeys('MBFS').indexOf('MessageNamePattern') >= 0);
    ok('render replaces token', render_('x{{A}}y', { A: 'Z' }, {}) === 'xZy');
    ok('render flag on', render_('a{{#F}}b{{/F}}c', {}, { F: true }) === 'abc');
    ok('render flag off', render_('a{{#F}}b{{/F}}c', {}, { F: false }) === 'ac');
    ok('render leaves unknown', render_('{{X}}', {}, {}) === '{{X}}');
    ok('unresolved detects', unresolved('{{X}}y').length === 1);

    var saved = S;

    // ---- MB -> FS (XSLT-only RULEID) ----
    S = JSON.parse(JSON.stringify(GOLDEN.state));
    ok('MBFS is xsltOnly', xsltOnly('MBFS') === true);
    var builds = buildAll();
    ok('buildAll one variant', builds.length === 1);
    var b = builds[0];
    ok('no bp generated', !b.bp);
    ok('no imp generated', !b.imp);
    ok('xslt is RULEID', b.xslt.indexOf('<RULEID name="-1c0be28b:1a1330000f6:-2c40">') >= 0);
    ok('xslt ProcessName', b.xslt.indexOf('<ProcessName>SCE_IB_DailyReports_From_EXL</ProcessName>') >= 0);
    ok('xslt MailboxPath static', b.xslt.indexOf('<MailboxPath>/EXL/Inbound</MailboxPath>') >= 0);
    ok('xslt PGPPackFlag Yes', b.xslt.indexOf('<PGPPackFlag>Yes</PGPPackFlag>') >= 0);
    ok('xslt public_user', b.xslt.indexOf('<public_user>0x02ECCE6B</public_user>') >= 0);
    ok('xslt TargetFolder', b.xslt.indexOf('<TargetFolder>/ISUTechDataQU/FI/EXL/In</TargetFolder>') >= 0);
    ok('xslt TargetFileExtn', b.xslt.indexOf('<TargetFileExtn>.csv.pgp</TargetFileExtn>') >= 0);
    ok('xslt MailName', b.xslt.indexOf('<MailName>SCE_IB_DailyReports_From_EXL</MailName>') >= 0);
    ok('xslt no unresolved', unresolved(b.xslt).length === 0);
    ok('xslt well-formed', wellFormed(b.xslt, 'xslt'));

    // ---- SFTP -> FS interface ----
    ok('SFTPFS templates present', ready('SFTPFS'));
    ok('SFTPFS has 3 blocks', xsltBlocks('SFTPFS').length === 3);
    ok('SFTPFS no mailbox', hasMailbox('SFTPFS') === false);
    var sf = newState('SFTPFS');
    sf.bp.name = 'SCE_SFTPGET_Dovetail_Case_Management_Master_Raw_Data_to_HRCM';
    sf.bp.desc = 'Pull Dovetail case management data and deliver to HRCM.';
    sf.x.ProfileId = '873135190f1c973bdnode1';
    sf.x.Directory = '/exports/dataextracts/case_management_master_raw_data';
    sf.x.RemoteFileName = 'sce_case_management_master_raw_data*.zip';
    sf.x.TargetFilePath = '/mft_HRCM/AnalyticsData';
    S = sf;
    var sb = buildAll()[0];
    ok('SFTP build 3 blocks', sb.blocks.length === 3);
    ok('SFTP bp has SystemName assign', sb.bp.indexOf('<assign name="Assign" to="SystemName">Dovetail_Case_Management_Master_Raw_Data_to_HRCM</assign>') >= 0);
    ok('SFTP bp generic SFTPGet', sb.bp.indexOf('<assign to="WFD_NAME">SCE_Generic_SFTPGet</assign>') >= 0);
    ok('SFTP bp no unresolved', unresolved(sb.bp).length === 0);
    var cfg = sb.blocks[0], errm = sb.blocks[1], eml = sb.blocks[2];
    ok('SFTP config is SYSTEM', cfg.text.indexOf('<SYSTEM name="Dovetail_Case_Management_Master_Raw_Data_to_HRCM">') >= 0);
    ok('SFTP config ProfileId', cfg.text.indexOf('<ProfileId>873135190f1c973bdnode1</ProfileId>') >= 0);
    ok('SFTP config no unresolved', unresolved(cfg.text).length === 0);
    ok('SFTP errormail ERRORMAIL', errm.text.indexOf('<ERRORMAIL name="' + sb.name + '">') >= 0);
    ok('SFTP errormail subject default', errm.text.indexOf('<mail-mime-subject>' + sb.name + ' - Failed</mail-mime-subject>') >= 0);
    ok('SFTP email PROCNAME', eml.text.indexOf('<PROCNAME name="' + sb.name + '">') >= 0);
    ok('SFTP email notif xslt', eml.text.indexOf('SCE_Generic_SFTPGet_SuccessEmailBodyWithArchiveInf') >= 0);
    ok('SFTP config well-formed', wellFormed(cfg.text, 'xslt'));
    ok('SFTP errormail well-formed', wellFormed(errm.text, 'xslt'));
    ok('SFTP email well-formed', wellFormed(eml.text, 'xslt'));
    ok('SFTP imp decodes to bp', new TextDecoder().decode(Uint8Array.from(atob(sb.b64), function (c) { return c.charCodeAt(0); })) === sb.bp);

    S = saved;

    // ---- account store ----
    ok('seeded admin exists', !!findUser('admin') && findUser('admin').role === 'admin');
    ok('admin password verifies', findUser('admin').pass === hash('admin'));
    ok('passwords are hashed not plain', findUser('admin').pass !== 'admin');
    ok('unknown user is null', findUser('nobody_' + Date.now()) === null);

    var pass = results.filter(function (r) { return r.pass; }).length;
    var total = results.length;
    showSelftest(results, pass, total);
    return { pass: pass, total: total, results: results };
  }

  function showSelftest(results, pass, total) {
    var body = el('div', { class: 'stack' }, [
      el('div', { class: 'al ' + (pass === total ? 'g' : 'e'), text: pass + '/' + total + ' ' + (pass === total ? 'PASS' : 'checks passed') }),
      el('div', { class: 'list' }, results.map(function (r) {
        return el('div', { class: 'listrow' }, [
          el('span', { class: 'badge ' + (r.pass ? 'ok' : 'todo'), text: r.pass ? 'PASS' : 'FAIL' }),
          el('span', { text: r.name })
        ]);
      }))
    ]);
    modal('Self-test \u2014 ' + pass + '/' + total, [body], [{ label: 'Close', cls: 'btn primary', fn: closeModal }]);
  }
  window.__selftest = runSelftest;

  // =====================================================================
  // BOOT
  // =====================================================================
  function renderAI() {
    setActive('nav-ai', 'AI Assistant', 'Describe your integration in plain English \u2014 the AI recommends an approved template and collects the details.');
    var v = view(); v.innerHTML = '';
    if (window.AIChat && typeof window.AIChat.mount === 'function') {
      window.AIChat.mount(v);
    } else {
      v.appendChild(el('div', { class: 'al e', text: 'AI assistant failed to load (js/ai.js).' }));
    }
  }

  function wireHeader() {
    var map = {
      'nav-home': A.home, 'nav-templates': A.templates, 'nav-import': A.import,
      'nav-analysis': A.analysis, 'nav-selftest': A.selftest, 'nav-accounts': A.accounts,
      'nav-ai': A.ai
    };
    Object.keys(map).forEach(function (id) {
      var e = document.getElementById(id); if (e) e.addEventListener('click', function (ev) { ev.preventDefault(); map[id](); });
    });
  }

  // ------------------------------------------------------------ auth / users
  var LS_AUTH = 'is.auth', LS_USERS = 'is.users';

  // Lightweight, non-cryptographic hash (this is a local-only internal tool,
  // not a security boundary — it just avoids storing plain-text passwords).
  function hash(str) {
    var h = 5381, s = String(str);
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return ('00000000' + h.toString(16)).slice(-8);
  }

  function getUsers() {
    var list = lsGet(LS_USERS, null);
    if (!list || !list.length) {
      // Seed a default administrator the first time.
      list = [{
        id: 'admin', name: 'Administrator', role: 'admin',
        pass: hash('admin'), created: new Date().toISOString()
      }];
      lsSet(LS_USERS, list);
    }
    return list;
  }
  function saveUsers(list) { lsSet(LS_USERS, list); }
  function findUser(id) {
    id = String(id || '').trim().toLowerCase();
    return getUsers().filter(function (u) { return u.id.toLowerCase() === id; })[0] || null;
  }
  function currentUser() { return lsGet(LS_AUTH, null); }
  function isAdmin() { var u = currentUser(); return !!(u && u.role === 'admin'); }

  function showApp(user) {
    var login = document.getElementById('login');
    var shell = document.getElementById('shell');
    if (login) login.style.display = 'none';
    if (shell) shell.style.display = 'flex';
    var label = (user && (user.name || user.id)) || 'User';
    var initials = label.trim().slice(0, 2).toUpperCase();
    var av = document.getElementById('user-avatar'); if (av) av.textContent = initials;
    var nm = document.getElementById('user-name'); if (nm) nm.textContent = label;
    var adminGroup = document.getElementById('navgroup-admin');
    if (adminGroup) adminGroup.style.display = (user && user.role === 'admin') ? 'flex' : 'none';
    startApp();
  }
  function showLogin() {
    var login = document.getElementById('login');
    var shell = document.getElementById('shell');
    if (shell) shell.style.display = 'none';
    if (login) login.style.display = 'grid';
  }

  function wireLogin() {
    var form = document.getElementById('login-form');
    if (form) form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var id = (document.getElementById('login-user').value || '').trim();
      var pass = (document.getElementById('login-pass').value || '');
      var err = document.getElementById('login-error');
      var fail = function (msg) { if (err) { err.textContent = msg; err.style.display = 'block'; } };
      if (!id || !pass) { fail('Please enter your User ID and password.'); return; }
      var u = findUser(id);
      if (!u || u.pass !== hash(pass)) { fail('Invalid User ID or password.'); return; }
      if (u.disabled) { fail('This account is disabled. Contact an administrator.'); return; }
      if (err) err.style.display = 'none';
      var profile = { id: u.id, name: u.name || u.id, role: u.role, when: new Date().toISOString() };
      if (document.getElementById('login-remember').checked) lsSet(LS_AUTH, profile);
      // clear password field
      document.getElementById('login-pass').value = '';
      showApp(profile);
      toast('Welcome, ' + profile.name, 'g');
    });

    var logout = document.getElementById('logout-btn');
    if (logout) logout.addEventListener('click', function () {
      try { localStorage.removeItem(LS_AUTH); } catch (e) { }
      showLogin();
      toast('Signed out', 'g');
    });
  }

  // ------------------------------------------------------------ accounts view
  function renderAccounts() {
    setActive('nav-accounts', 'Access accounts', 'Manage who can sign in to MFT Automation Studio.');
    var v = view(); v.innerHTML = '';

    if (!isAdmin()) {
      v.appendChild(el('div', { class: 'stack' }, [
        el('div', { class: 'al e', text: 'You need an administrator account to manage access.' })
      ]));
      return;
    }

    var users = getUsers();
    var me = currentUser();

    // --- Add user form ---
    var fId = input('', function () { }, { placeholder: 'e.g. jsmith' });
    var fName = input('', function () { }, { placeholder: 'Full name' });
    var fPass = input('', function () { }, { type: 'password', placeholder: 'Temporary password' });
    var fRole = el('select', { class: 'in' }, [
      el('option', { value: 'user', text: 'User' }),
      el('option', { value: 'admin', text: 'Administrator' })
    ]);

    var addCard = el('div', { class: 'card' }, [
      el('h3', { text: 'Add a new account' }),
      el('div', { class: 'formgrid' }, [
        field('User ID', fId, 'Used to sign in. Letters, numbers, dot, dash or underscore.'),
        field('Full name', fName),
        field('Password', fPass),
        field('Role', fRole, 'Administrators can manage accounts.')
      ]),
      el('div', { class: 'row' }, [
        el('button', {
          class: 'btn primary', onclick: function () {
            var id = (fId.value || '').trim();
            var name = (fName.value || '').trim();
            var pass = (fPass.value || '');
            if (!/^[A-Za-z][A-Za-z0-9_.-]*$/.test(id)) { toast('Invalid User ID format', 'w'); return; }
            if (findUser(id)) { toast('A user with that ID already exists', 'w'); return; }
            if (pass.length < 4) { toast('Password must be at least 4 characters', 'w'); return; }
            var list = getUsers();
            list.push({
              id: id, name: name || id, role: fRole.value,
              pass: hash(pass), created: new Date().toISOString()
            });
            saveUsers(list);
            toast('Account created: ' + id, 'g');
            renderAccounts();
          }
        }, ['Create account'])
      ])
    ]);

    // --- Existing users list ---
    var rows = users.map(function (u) {
      var isMe = me && me.id.toLowerCase() === u.id.toLowerCase();
      var actions = [];
      // Reset password
      actions.push(el('button', {
        class: 'btn', onclick: function () {
          var np = prompt('New password for ' + u.id + ':');
          if (np == null) return;
          if (np.length < 4) { toast('Password must be at least 4 characters', 'w'); return; }
          var list = getUsers();
          list.forEach(function (x) { if (x.id === u.id) x.pass = hash(np); });
          saveUsers(list); toast('Password reset for ' + u.id, 'g');
        }
      }, ['Reset password']));
      // Enable/disable (not for self)
      if (!isMe) {
        actions.push(el('button', {
          class: 'btn', onclick: function () {
            var list = getUsers();
            list.forEach(function (x) { if (x.id === u.id) x.disabled = !x.disabled; });
            saveUsers(list); renderAccounts();
            toast((u.disabled ? 'Enabled ' : 'Disabled ') + u.id, 'g');
          }
        }, [u.disabled ? 'Enable' : 'Disable']));
        // Delete (block deleting the last admin)
        actions.push(el('button', {
          class: 'btn', onclick: function () {
            var list = getUsers();
            var admins = list.filter(function (x) { return x.role === 'admin' && !x.disabled; });
            if (u.role === 'admin' && admins.length <= 1) { toast('Cannot delete the last administrator', 'w'); return; }
            if (!confirm('Delete account "' + u.id + '"?')) return;
            saveUsers(list.filter(function (x) { return x.id !== u.id; }));
            renderAccounts(); toast('Deleted ' + u.id, 'g');
          }
        }, ['Delete']));
      }

      return el('div', { class: 'listrow' }, [
        el('div', {}, [
          el('strong', { text: u.name || u.id }),
          el('div', { class: 'muted small', text: '@' + u.id + ' \u2022 ' + (u.role === 'admin' ? 'Administrator' : 'User') + (u.disabled ? ' \u2022 disabled' : '') + (isMe ? ' \u2022 you' : '') })
        ]),
        el('div', { class: 'row' }, actions)
      ]);
    });

    var listCard = el('div', { class: 'card' }, [
      el('h3', { text: 'Accounts (' + users.length + ')' }),
      el('div', { class: 'list' }, rows)
    ]);

    v.appendChild(el('div', { class: 'stack' }, [
      el('div', { class: 'hero small' }, [el('h2', { text: 'Access accounts' }), el('p', { class: 'muted', text: 'Create and manage sign-in accounts. Stored locally in this browser.' })]),
      addCard, listCard
    ]));
  }

  function startApp() {
    var qs = location.search || '';
    if (/[?&]selftest/.test(qs)) { renderHome(); runSelftest(); return; }
    if (location.hash === '#wizard' && S) renderWizard();
    else renderHome();
  }

  function boot() {
    wireHeader();
    wireLogin();
    getUsers(); // ensure default admin is seeded
    var qs = location.search || '';
    if (/[?&]selftest/.test(qs)) { showApp(currentUser() || { name: 'Tester', role: 'admin' }); runSelftest(); return; }
    var user = currentUser();
    if (user) showApp(user);
    else showLogin();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* MFT Automation Studio — AI Assistant (Copilot-style, vanilla JS, no modules).
 *
 * Powered by the LangGraph/LangChain backend:
 *   /api/agent   -> conversational intent router (chat / list / explain / build)
 *   /api/extract -> pulls approved field values from a free-text answer
 *
 * The assistant can:
 *   1. Answer general questions about the app + templates (grounded Q&A).
 *   2. List all available templates.
 *   3. Run a step-by-step guided build: Business Process first, then every
 *      config block / notification, asking for ALL fields in each section.
 *   4. Hand the finished collection to the approved wizard to generate artifacts.
 *
 * Exposed as window.AIChat.
 */
(function () {
  'use strict';

  var API_BASE = window.AI_API_BASE || 'http://127.0.0.1:8100';

  // ---- conversation state ------------------------------------------------
  var S = null;
  function freshState() {
    return {
      history: [],            // [{role, text}] sent to the router for context
      mode: 'chat',           // 'chat' | 'build'
      iface: null,            // interface id while building
      plan: null,             // introspected sections
      si: 0,                  // current section index
      collected: {},          // key -> value
      lastPrompt: null        // {sectionId, keys} we're waiting on
    };
  }

  // ---- tiny DOM helper ---------------------------------------------------
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
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

  // ---- safe markdown: **bold** *em* `code`, - bullets, newlines ----------
  function mdToHtml(s) {
    var esc = String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var lines = esc.split('\n'), out = [], inList = false;
    lines.forEach(function (ln) {
      var li = ln.match(/^\s*[-*]\s+(.*)$/);
      if (li) {
        if (!inList) { out.push('<ul>'); inList = true; }
        out.push('<li>' + inline(li[1]) + '</li>');
      } else {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push(ln.trim() === '' ? '<br/>' : inline(ln));
      }
    });
    if (inList) out.push('</ul>');
    return out.join('\n').replace(/\n(?!<)/g, '<br/>');
    function inline(x) {
      return x
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\u201c([^\u201d]+)\u201d/g, '\u201c<em>$1</em>\u201d');
    }
  }

  var ui = {};

  function scroll() { ui.log.scrollTop = ui.log.scrollHeight; }

  function bubble(role, html) {
    var avatar = h('div', { class: 'ai-avatar', text: role === 'user' ? 'You' : 'AI' });
    var body = h('div', { class: 'ai-bubble', html: mdToHtml(html) });
    var row = h('div', { class: 'ai-msg ' + role }, [avatar, body]);
    ui.log.appendChild(row);
    scroll();
    return row;
  }

  function status(text) {
    ui.log.appendChild(h('div', { class: 'ai-status', text: text }));
    scroll();
  }

  function chips(items) {
    if (!items || !items.length) return;
    var row = h('div', { class: 'ai-chips' }, items.map(function (it) {
      return h('button', { class: 'ai-chip', onclick: function () { send(it.send || it.label); } }, [it.label]);
    }));
    ui.log.appendChild(row);
    scroll();
  }

  function typing() {
    var row = h('div', { class: 'ai-msg bot' }, [
      h('div', { class: 'ai-avatar', text: 'AI' }),
      h('div', { class: 'ai-bubble' }, [
        h('div', { class: 'ai-typing' }, [h('span'), h('span'), h('span')])
      ])
    ]);
    ui.log.appendChild(row); scroll();
    return row;
  }

  // ---- network -----------------------------------------------------------
  function post(path, body) {
    return fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); });
  }

  // ---- build flow --------------------------------------------------------
  function beginBuild(ifaceId) {
    var plan = window.A.introspect(ifaceId);
    if (!plan) { bubble('bot', 'I could not load that template. Please pick one from the Home page.'); return; }
    S.mode = 'build';
    S.iface = ifaceId;
    S.plan = plan;
    S.si = 0;
    S.collected = {};
    renderSidebar();
    // EDI interfaces also carry trading-partner ENVELOPE segments (ISA/GS/ST).
    // Read them from the export XML and append one section per segment so the
    // assistant asks the developer for every value needed to deploy in Sterling.
    if (window.A.envelopePlan) {
      var t = typing();
      window.A.envelopePlan(ifaceId).then(function (envSecs) {
        t.remove();
        if (envSecs && envSecs.length) {
          plan.sections = plan.sections.concat(envSecs);
          status('Loaded ' + envSecs.length + ' trading-partner envelope segment(s) from the EDI export XML.');
        }
        renderSidebar();
        presentSection();
      }, function () {
        t.remove();
        renderSidebar();
        presentSection();
      });
    } else {
      presentSection();
    }
  }

  function sectionFieldList(sec) {
    return sec.fields.map(function (f) {
      var eg = f.hint ? ' _(' + f.hint + ')_' : '';
      var yn = f.yn ? ' _(yes/no)_' : '';
      return '- **' + f.label + '**' + eg + yn;
    }).join('\n');
  }

  function presentSection() {
    var plan = S.plan;
    if (S.si >= plan.sections.length) { finishBuild(); return; }
    var sec = plan.sections[S.si];
    S.lastPrompt = { sectionId: sec.id, keys: sec.fields.map(function (f) { return f.key; }) };
    var step = '**Section ' + (S.si + 1) + ' of ' + plan.sections.length + ' — ' + sec.title + '**';
    var msg = step + '\n\n' + (sec.intro || '') + '\n\nPlease provide these fields (one message is fine):\n\n' +
      sectionFieldList(sec) +
      '\n\nYou can answer in plain English, or type **skip** to use defaults for this section.';
    bubble('bot', msg);
    chips([{ label: 'Skip section', send: 'skip' }, { label: 'Cancel build', send: 'cancel build' }]);
    renderSidebar();
  }

  function collectSection(text) {
    var sec = S.plan.sections[S.si];
    if (/^\s*(skip)\s*$/i.test(text)) { advance(); return; }
    var fields = sec.fields.map(function (f) {
      return { key: f.key, label: f.label, example: f.hint || '', yn: !!f.yn };
    });
    var t = typing();
    post('/api/extract', { message: text, fields: fields, collected: S.collected })
      .then(function (data) {
        t.remove();
        var got = data.fields || {};
        Object.keys(got).forEach(function (k) { S.collected[k] = got[k]; });
        var n = Object.keys(got).length;
        if (n) status('Captured ' + n + ' field' + (n === 1 ? '' : 's') + ' in ' + (data.elapsed_ms || '?') + ' ms');
        // Which of this section's fields are still blank?
        var missing = sec.fields.filter(function (f) {
          var v = S.collected[f.key];
          return v == null || v === '';
        });
        if (missing.length && missing.length < sec.fields.length) {
          bubble('bot', 'Got it. I still need:\n\n' +
            missing.map(function (f) { return '- **' + f.label + '**' + (f.hint ? ' _(' + f.hint + ')_' : ''); }).join('\n') +
            '\n\nProvide those, or type **skip** to default them.');
          renderSidebar();
        } else if (missing.length === sec.fields.length) {
          bubble('bot', 'I could not read any values from that. Try again with concrete values, or type **skip**.');
        } else {
          advance();
        }
      })
      .catch(function (err) {
        t.remove();
        bubble('bot', 'Extraction error: ' + err.message + '. Type **skip** to move on.');
      });
  }

  function advance() {
    S.si += 1;
    if (S.si >= S.plan.sections.length) { finishBuild(); return; }
    presentSection();
  }

  function finishBuild() {
    S.lastPrompt = null;
    bubble('bot',
      '\u2705 All sections complete for **' + S.plan.title + '**. ' +
      'I\u2019ll open it in the wizard Review step so you can generate and download the ' +
      'Business Process, import XML, and configuration blocks.');
    chips([
      { label: 'Generate artifacts \u2192', send: '__generate__' },
      { label: 'Start another', send: 'start over' }
    ]);
    renderSidebar();
  }

  function doGenerate() {
    window.A.applyAI(S.iface, S.collected);
  }

  // ---- router turn (general chat) ---------------------------------------
  function routerTurn(text) {
    var t = typing();
    post('/api/agent', {
      message: text,
      interface_id: S.iface,
      history: S.history.slice(-6)
    }).then(function (data) {
      t.remove();
      bubble('bot', data.message || '(no response)');
      if (data.elapsed_ms != null) status('Answered in ' + data.elapsed_ms + ' ms');
      if (data.action === 'start_build' && data.interface_id) {
        beginBuild(data.interface_id);
      } else if (data.action === 'recommend' && data.interface_id) {
        var def = (window.__BUILTIN__.IFACES || {})[data.interface_id];
        chips([
          { label: 'Build ' + (def ? def.title : data.interface_id), send: 'build this' },
          { label: 'List all templates', send: 'list all templates' }
        ]);
      } else {
        chips([
          { label: 'List all templates', send: 'list all templates' },
          { label: 'What can you do?', send: 'what can you do?' }
        ]);
      }
    }).catch(function (err) {
      t.remove();
      bubble('bot', 'Could not reach the AI backend at ' + API_BASE +
        '. Make sure it is running. Error: ' + err.message);
    });
  }

  // ---- main send ---------------------------------------------------------
  function send(text) {
    if (!text || !text.trim()) return;
    text = text.trim();

    if (text === '__generate__') { doGenerate(); return; }

    bubble('user', text);
    S.history.push({ role: 'user', text: text });
    ui.input.value = '';

    // Global cancel / restart
    if (/^(cancel( build)?|start over|reset|restart)$/i.test(text)) {
      S = freshState();
      renderSidebar();
      bubble('bot', 'Okay, cleared. What would you like to do next?');
      chips([
        { label: 'List all templates', send: 'list all templates' },
        { label: 'Build an SFTP \u2192 File System transfer', send: 'build an SFTP to file system transfer' }
      ]);
      return;
    }

    if (S.mode === 'build' && S.lastPrompt) {
      collectSection(text);
      return;
    }
    routerTurn(text);
  }

  // ---- sidebar -----------------------------------------------------------
  function renderSidebar() {
    ui.side.innerHTML = '';
    ui.side.appendChild(h('h3', { text: 'Session' }));

    if (S.mode !== 'build' || !S.plan) {
      ui.side.appendChild(h('p', { class: 'muted small', text: 'Ask me anything, or say what you want to build to start a guided setup.' }));
      ui.side.appendChild(h('h3', { text: 'Try' }));
      ['List all templates', 'What can you do?', 'Explain EDI 810 outbound', 'Build an SFTP to file system transfer'].forEach(function (q) {
        ui.side.appendChild(h('button', { class: 'btn block ghost', onclick: function () { send(q); } }, [q]));
      });
      return;
    }

    // Build progress
    ui.side.appendChild(h('div', { class: 'ai-pill', text: S.plan.title }));
    ui.side.appendChild(h('h3', { text: 'Sections' }));
    var ol = h('div', { class: 'ai-steps' });
    S.plan.sections.forEach(function (sec, i) {
      var st = i < S.si ? 'done' : (i === S.si ? 'active' : 'todo');
      ol.appendChild(h('div', { class: 'ai-step ' + st }, [
        h('span', { class: 'ai-step-dot', text: i < S.si ? '\u2713' : String(i + 1) }),
        h('span', { text: sec.title })
      ]));
    });
    ui.side.appendChild(ol);

    var keys = Object.keys(S.collected);
    ui.side.appendChild(h('h3', { text: 'Collected (' + keys.length + ')' }));
    if (!keys.length) {
      ui.side.appendChild(h('p', { class: 'muted small', text: 'Nothing captured yet.' }));
    } else {
      var kv = h('div', { class: 'ai-kv' });
      keys.forEach(function (k) {
        kv.appendChild(h('div', { class: 'ai-kv-row' }, [
          h('code', { text: k === '__bpname__' ? 'BP name' : (k === '__processname__' ? 'Process' : (k === '__description__' ? 'Description' : k)) }),
          h('span', { text: String(S.collected[k]) })
        ]));
      });
      ui.side.appendChild(kv);
    }

    ui.side.appendChild(h('button', {
      class: 'btn primary block', onclick: doGenerate
    }, ['Open in wizard \u2192']));
    ui.side.appendChild(h('button', {
      class: 'btn block ghost', onclick: function () { send('start over'); }
    }, ['Start over']));
  }

  // ---- greeting ----------------------------------------------------------
  function greet() {
    bubble('bot',
      'Hi, I\u2019m your **MFT Automation Studio** assistant. I know every approved ' +
      'template and how this app works, and I can build integrations with you ' +
      'step by step.\n\nAsk me things like:\n' +
      '- *List all templates*\n' +
      '- *What does EDI 810 outbound need?*\n' +
      '- *Build an SFTP to file system transfer*');
    chips([
      { label: 'List all templates', send: 'list all templates' },
      { label: 'What can you do?', send: 'what can you do?' },
      { label: 'Build an SFTP \u2192 File System transfer', send: 'build an SFTP to file system transfer' }
    ]);
  }

  // ---- mount -------------------------------------------------------------
  function mount(container) {
    if (!S) S = freshState();
    container.innerHTML = '';
    var layout = h('div', { class: 'ai-layout' });

    var chat = h('div', { class: 'ai-chat card' });
    var head = h('div', { class: 'ai-head' }, [
      h('div', { class: 'ai-head-title' }, [
        h('span', { class: 'ai-spark', text: '\u2728' }),
        h('strong', { text: 'AI Assistant' })
      ]),
      h('span', { class: 'ai-head-sub muted small', text: 'LangGraph \u00b7 Azure OpenAI \u00b7 grounded on approved templates' })
    ]);
    ui.log = h('div', { class: 'ai-log' });
    ui.input = h('textarea', { class: 'in ai-input', rows: '2', placeholder: 'Ask a question or describe what to build\u2026' });
    ui.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(ui.input.value); }
    });
    var sendBtn = h('button', { class: 'btn primary', onclick: function () { send(ui.input.value); } }, ['Send']);
    chat.appendChild(head);
    chat.appendChild(ui.log);
    chat.appendChild(h('div', { class: 'ai-inputrow' }, [ui.input, sendBtn]));

    ui.side = h('div', { class: 'ai-side card' });

    layout.appendChild(chat);
    layout.appendChild(ui.side);
    container.appendChild(layout);

    renderSidebar();
    if (!ui.log.childNodes.length) greet();
  }

  window.AIChat = { mount: mount };
})();

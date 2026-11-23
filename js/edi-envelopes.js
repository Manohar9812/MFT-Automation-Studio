/* EDI trading-partner envelope support.
 *
 * Each EDI interface ships with an SI export XML that defines the trading
 * partner (TP) envelope segments — ISA/IEA (interchange), GS/GE (functional
 * group) and ST/SE (transaction set). This module reads that XML, surfaces the
 * developer-fillable values for every segment, and regenerates the XML with
 * the developer's values so it can be imported back into Sterling B2B
 * Integrator.
 *
 * Exposes window.__EDI_ENV__.
 */
(function () {
  'use strict';

  // ---- interface -> envelope export XML (served from the workspace root) ----
  var MAP = {
    EDI810OB: 'templates/810_OB/Export (2).xml',
    EDI814IB: 'templates/814_IB/Export.xml',
    EDI814OB: 'templates/814_OB/Export.xml',
    EDI820IB: 'templates/820_IB/Export.xml',
    EDI824IB: 'templates/824_IB/Export (1).xml',
    EDI824OB: 'templates/824_OB/Export.xml',
    EDI850OB: 'templates/850_OB/Envelops.xml',
    EDI852OB: 'templates/852_OB/Envelops combined.xml',
    EDI867:   'templates/867/envelops combined.xml'
  };

  // Developer-fillable ENVELOPE_PARM names, grouped by the leading segment of
  // the envelope TYPE (e.g. "ISA IEA" -> "ISA"). Only parms that actually occur
  // in a given envelope are shown.
  var FILLABLE = {
    ISA: [
      'InterchangeSenderIDQualifier',
      'InterchangeReceiverIDQualifier',
      'InterchangeControlStandardsIdentifier',
      'InterchangeControlVersionNumber',
      'InterchangeTestIndicator'
    ],
    GS: [
      'GroupFunctionalIDCode',
      'GroupVersionReleaseIDCode',
      'GroupResponsibleAgencyCode',
      'AcknowledgementFormat',
      'ExpectAcknowledgement'
    ],
    ST: [
      'TransactionSetIDCode',
      'MapName',
      'AccepterLookupAlias',
      'ValidateInput',
      'ValidateOutput'
    ]
  };

  // Top-level identity fields present on every ENVELOPE node.
  var CORE = ['NAME', 'SENDER_ID', 'RECEIVER_ID', 'CONTROL_NUMBER'];

  // Yes/No style parms (rendered as toggles in the UI).
  var YN = ['ExpectAcknowledgement', 'ValidateInput', 'ValidateOutput'];

  function seg(type) { return String(type || '').trim().split(/\s+/)[0] || ''; }

  function text(node, tag) {
    var kids = node.getElementsByTagName(tag);
    return kids.length ? (kids[0].textContent || '') : '';
  }

  // Parse the export XML string into a list of envelope descriptors.
  function parse(xmlStr) {
    var doc = new DOMParser().parseFromString(xmlStr, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) {
      throw new Error('Envelope XML is not well-formed.');
    }
    var nodes = doc.getElementsByTagName('ENVELOPE');
    var envelopes = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var type = text(n, 'TYPE');
      var s = seg(type);
      // Collect the parm values once so we can match the fillable whitelist.
      var parms = {};
      var parmNodes = n.getElementsByTagName('ENVELOPE_PARM');
      for (var j = 0; j < parmNodes.length; j++) {
        var pn = parmNodes[j];
        var nm = text(pn, 'NAME');
        if (nm) parms[nm] = text(pn, 'VALUE');
      }
      var wanted = (FILLABLE[s] || []).filter(function (p) { return p in parms; });
      envelopes.push({
        index: i,
        type: type,
        segment: s,
        name: text(n, 'NAME'),
        standard: text(n, 'STANDARD'),
        core: {
          NAME: text(n, 'NAME'),
          SENDER_ID: text(n, 'SENDER_ID'),
          RECEIVER_ID: text(n, 'RECEIVER_ID'),
          CONTROL_NUMBER: text(n, 'CONTROL_NUMBER')
        },
        parmKeys: wanted,
        parms: parms
      });
    }
    return envelopes;
  }

  // Apply developer overrides back onto the XML and return the new string.
  // overrides: { <envIndex>: { NAME, SENDER_ID, ..., <parmName>: value } }
  function generate(xmlStr, overrides) {
    overrides = overrides || {};
    var doc = new DOMParser().parseFromString(xmlStr, 'application/xml');
    var nodes = doc.getElementsByTagName('ENVELOPE');

    function setChildText(parent, tag, value) {
      var kids = parent.getElementsByTagName(tag);
      if (kids.length) kids[0].textContent = value;
    }

    for (var i = 0; i < nodes.length; i++) {
      var ov = overrides[i];
      if (!ov) continue;
      var n = nodes[i];
      CORE.forEach(function (c) {
        if (ov[c] != null) setChildText(n, c, ov[c]);
      });
      // Parm overrides: match ENVELOPE_PARM by its NAME, set its VALUE.
      var parmNodes = n.getElementsByTagName('ENVELOPE_PARM');
      for (var j = 0; j < parmNodes.length; j++) {
        var pn = parmNodes[j];
        var nm = (pn.getElementsByTagName('NAME')[0] || {}).textContent || '';
        if (nm && ov[nm] != null) {
          var valEl = pn.getElementsByTagName('VALUE')[0];
          if (valEl) valEl.textContent = ov[nm];
        }
      }
    }
    return new XMLSerializer().serializeToString(doc);
  }

  // Fetch + parse the envelope XML for an interface (cached per interface).
  var CACHE = {};
  function fetchFor(iface) {
    var url = MAP[iface];
    if (!url) return Promise.reject(new Error('No envelope XML mapped for ' + iface));
    if (CACHE[iface]) return Promise.resolve(CACHE[iface]);
    return fetch(encodeURI(url)).then(function (r) {
      if (!r.ok) throw new Error('Failed to load ' + url + ' (' + r.status + ')');
      return r.text();
    }).then(function (xml) {
      var data = { url: url, xml: xml, envelopes: parse(xml) };
      CACHE[iface] = data;
      return data;
    });
  }

  function has(iface) { return !!MAP[iface]; }

  window.__EDI_ENV__ = {
    MAP: MAP, FILLABLE: FILLABLE, CORE: CORE, YN: YN,
    parse: parse, generate: generate, fetchFor: fetchFor, has: has, segment: seg
  };
})();

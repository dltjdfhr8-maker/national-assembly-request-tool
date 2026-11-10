(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AllocationEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const scriptUrl = typeof document !== 'undefined' && document.currentScript
    ? document.currentScript.src : null;
  let activeClassify = null;

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') {
          field += '"';
          i++;
        } else if (char === '"') {
          quoted = false;
        } else {
          field += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\r' || char === '\n') {
        if (char === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        if (row.some(value => value !== '')) rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }
    if (quoted) throw new Error('CSV 따옴표가 닫히지 않았습니다.');
    if (field !== '' || row.length) {
      row.push(field);
      rows.push(row);
    }
    const headers = rows.shift();
    if (!headers) throw new Error('CSV가 비어 있습니다.');
    return rows.map((values, index) => {
      if (values.length !== headers.length) {
        throw new Error(`CSV ${index + 2}행의 열 수가 다릅니다.`);
      }
      return Object.fromEntries(headers.map((header, i) => [header, values[i]]));
    });
  }

  function createEngine(rulesCsv, orgCsv) {
    const allowed = new Set(parseCsv(orgCsv).map(row => row['과'].trim()));
    const rules = parseCsv(rulesCsv).map((row, index) => {
      const priority = Number(row['우선순위']);
      if (!row['과'] || !row['키워드'] || !Number.isFinite(priority)) {
        throw new Error(`배분기준표 ${index + 2}행의 필수 값이 잘못되었습니다.`);
      }
      return {
        과: row['과'].trim(),
        키워드: row['키워드'].trim(),
        제외어: (row['제외어'] || '').split('|').map(word => word.trim()).filter(Boolean),
        우선순위: priority,
      };
    });

    return function classify(요구내용) {
      if (typeof 요구내용 !== 'string') throw new TypeError('요구내용은 문자열이어야 합니다.');
      const text = 요구내용.toLocaleLowerCase('ko');
      const candidates = new Map();
      for (const rule of rules) {
        if (!allowed.has(rule.과)) continue;
        if (!text.includes(rule.키워드.toLocaleLowerCase('ko'))) continue;
        if (rule.제외어.some(word => text.includes(word.toLocaleLowerCase('ko')))) continue;
        const score = Math.round((rule.우선순위 + rule.키워드.length / 10) * 10) / 10;
        const previous = candidates.get(rule.과);
        if (!previous || score > previous.점수) {
          candidates.set(rule.과, { 과: rule.과, 점수: score, 근거키워드: rule.키워드 });
        }
      }
      return [...candidates.values()]
        .sort((a, b) => b.점수 - a.점수 || a.과.localeCompare(b.과, 'ko'))
        .slice(0, 3);
    };
  }

  async function load(options = {}) {
    let rulesCsv;
    let orgCsv;
    if (typeof module === 'object' && module.exports) {
      const fs = require('node:fs/promises');
      const path = require('node:path');
      const base = path.resolve(__dirname, '..', 'data');
      [rulesCsv, orgCsv] = await Promise.all([
        fs.readFile(options.rulesPath || path.join(base, '배분기준표_소관키워드_304건.csv'), 'utf8'),
        fs.readFile(options.orgPath || path.join(base, 'A부_조직도_26개과.csv'), 'utf8'),
      ]);
    } else {
      const base = scriptUrl ? new URL('../data/', scriptUrl) : new URL('../data/', location.href);
      const urls = [options.rulesUrl || new URL('배분기준표_소관키워드_304건.csv', base),
        options.orgUrl || new URL('A부_조직도_26개과.csv', base)];
      const responses = await Promise.all(urls.map(url => fetch(url)));
      for (const response of responses) {
        if (!response.ok) throw new Error(`CSV를 읽을 수 없습니다: ${response.url} (${response.status})`);
      }
      [rulesCsv, orgCsv] = await Promise.all(responses.map(response => response.text()));
    }
    activeClassify = createEngine(rulesCsv, orgCsv);
    return activeClassify;
  }

  function classify(요구내용) {
    if (!activeClassify) throw new Error('먼저 await AllocationEngine.load()를 실행하세요.');
    return activeClassify(요구내용);
  }

  return { load, classify, createEngine, parseCsv };
});

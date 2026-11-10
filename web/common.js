(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AppCommon = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const STORAGE_KEY = 'national-assembly-cases-v1';
  const COLUMNS = ['파일명', '위원회', '의원', '제출기한', '문항번호', '요구내용', '세부항목', '비고'];

  async function readText(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`자료를 읽지 못했습니다: ${url} (${response.status})`);
    return response.text();
  }

  async function loadData() {
    const [rules, org] = await Promise.all([
      readText('./data/rules_보강.csv'),
      readText('./data/A부_조직도_26개과.csv'),
    ]);
    const departments = AllocationEngine.parseCsv(org).map(row => row['과'].trim()).filter(Boolean);
    if (departments.length !== 26 || new Set(departments).size !== 26) {
      throw new Error('조직도 과 목록을 확인해 주세요.');
    }
    return { departments, classify: AllocationEngine.createEngine(rules, org) };
  }

  function loadCases() {
    const raw = root.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const cases = JSON.parse(raw);
    if (!Array.isArray(cases)) throw new Error('브라우저 저장 자료의 형식이 올바르지 않습니다.');
    return cases;
  }

  function saveCases(cases) {
    root.localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
    if (typeof root.dispatchEvent === 'function' && typeof root.Event === 'function') {
      root.dispatchEvent(new root.Event('cases-updated'));
    }
  }

  function resetCases() {
    root.localStorage.removeItem(STORAGE_KEY);
    if (typeof root.dispatchEvent === 'function' && typeof root.Event === 'function') {
      root.dispatchEvent(new root.Event('cases-updated'));
    }
  }

  function caseId(row) {
    return `${row.파일명}::${row.문항번호}`;
  }

  function register(rows, actor, classify) {
    if (!actor.trim()) throw new Error('담당자를 입력해 주세요.');
    const cases = loadCases();
    const known = new Set(cases.map(item => item.id));
    let added = 0;
    for (const row of rows) {
      if (COLUMNS.some(column => !(column in row))) throw new Error('문항목록의 열이 맞지 않습니다.');
      const id = caseId(row);
      if (known.has(id)) continue;
      const 후보 = classify(`${row.요구내용} ${row.세부항목} ${row.비고}`);
      const now = new Date().toISOString();
      cases.push({
        ...Object.fromEntries(COLUMNS.map(column => [column, row[column]])),
        id, 상태: '접수', 후보, 주관과: '', 협조과: [], 확정방법: '',
        갱신시각: now,
        log: [{ 시각: now, 담당자: actor.trim(), 작업: '접수', 사유: '요구서 문항 등록' }],
      });
      known.add(id);
      added++;
    }
    if (added) saveCases(cases);
    return { added, duplicates: rows.length - added };
  }

  function confirmMany(selections, actor, departments) {
    if (!actor.trim()) throw new Error('담당자를 입력해 주세요.');
    if (!selections.length) throw new Error('확정할 문항을 선택해 주세요.');
    const cases = loadCases();
    const byId = new Map(cases.map(item => [item.id, item]));
    const seen = new Set();
    const prepared = selections.map(({ id, primary, helpers, reason = '' }) => {
      if (seen.has(id)) throw new Error('같은 문항이 중복 선택되었습니다.');
      seen.add(id);
      const item = byId.get(id);
      if (!item) throw new Error('문항을 찾지 못했습니다.');
      if (!['접수', '배분확정'].includes(item.상태)) throw new Error('현재 상태에서는 배분을 확정할 수 없습니다.');
      if (!departments.includes(primary)) throw new Error(`${item.의원} ${item.문항번호}번: 조직도에 없는 주관 과입니다.`);
      const uniqueHelpers = [...new Set(helpers)].filter(dept => dept !== primary);
      if (uniqueHelpers.some(dept => !departments.includes(dept))) {
        throw new Error(`${item.의원} ${item.문항번호}번: 조직도에 없는 협조 과입니다.`);
      }
      const wasConfirmed = item.상태 === '배분확정';
      const changed = item.주관과 !== primary || JSON.stringify(item.협조과) !== JSON.stringify(uniqueHelpers);
      if (wasConfirmed && changed && !reason.trim()) {
        throw new Error(`${item.의원} ${item.문항번호}번: 재배분 사유를 입력해 주세요.`);
      }
      return { item, primary, helpers: uniqueHelpers, reason: reason.trim(), wasConfirmed, changed };
    });
    let changedCount = 0;
    for (const entry of prepared) {
      const { item, primary, helpers, reason, wasConfirmed, changed } = entry;
      if (wasConfirmed && !changed) continue;
      const method = primary === item.후보[0]?.과 && !wasConfirmed ? '규칙' : '수정';
      const now = new Date().toISOString();
      const previousPrimary = item.주관과;
      item.상태 = '배분확정';
      item.주관과 = primary;
      item.협조과 = helpers;
      item.확정방법 = method;
      item.갱신시각 = now;
      item.log.push({
        시각: now, 담당자: actor.trim(), 작업: wasConfirmed ? '재배분' : '배분확정',
        사유: reason || (method === '규칙' ? '규칙 1순위 후보 확인' : '담당자 판단'),
        이전주관과: wasConfirmed ? previousPrimary : '', 주관과: primary,
      });
      changedCount++;
    }
    if (changedCount) saveCases(cases);
    return { items: prepared.map(entry => entry.item), changedCount };
  }

  function confirm(id, primary, helpers, actor, reason, departments) {
    return confirmMany([{ id, primary, helpers, reason }], actor, departments).items[0];
  }

  function cancelAssignment(id, actor, reason) {
    if (!actor.trim()) throw new Error('담당자를 입력해 주세요.');
    if (!reason.trim()) throw new Error('배분 취소 사유를 입력해 주세요.');
    const cases = loadCases();
    const item = cases.find(row => row.id === id);
    if (!item) throw new Error('문항을 찾지 못했습니다.');
    if (item.상태 !== '배분확정') throw new Error('배분확정 상태의 문항만 취소할 수 있습니다.');
    const now = new Date().toISOString();
    item.log.push({
      시각: now, 담당자: actor.trim(), 작업: '배분취소', 사유: reason.trim(),
      이전주관과: item.주관과, 이전협조과: [...item.협조과], 이전확정방법: item.확정방법,
    });
    item.상태 = '접수';
    item.주관과 = '';
    item.협조과 = [];
    item.확정방법 = '';
    item.갱신시각 = now;
    saveCases(cases);
    return item;
  }

  function parseQuestionCsv(text) {
    const parsed = root.Papa
      ? root.Papa.parse(text, { header: true, skipEmptyLines: 'greedy', transformHeader: header => header.replace(/^\uFEFF/, '').trim() })
      : { data: AllocationEngine.parseCsv(text), errors: [] };
    if (parsed.errors.length) throw new Error(`CSV 형식을 확인해 주세요. ${parsed.errors[0].message}`);
    const rows = parsed.data;
    if (rows.length && COLUMNS.some(column => !(column in rows[0]))) {
      throw new Error('문항목록 CSV의 열이 맞지 않습니다.');
    }
    return rows.map(row => Object.fromEntries(COLUMNS.map(column => [column, row[column]])));
  }

  return { COLUMNS, loadData, loadCases, saveCases, resetCases, register, confirm, confirmMany, cancelAssignment, parseQuestionCsv };
});

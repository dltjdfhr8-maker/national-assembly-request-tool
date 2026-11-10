(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AppCommon = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const STORAGE_KEY = 'national-assembly-cases-v1';
  const COLUMNS = ['파일명', '위원회', '의원', '제출기한', '문항번호', '요구내용', '세부항목', '비고'];
  const flow = root.Flow || (typeof require === 'function' ? require('./flow.js') : null);
  const remote = Boolean(root.location?.hostname?.endsWith('.vercel.app'));

  function storageLabel() { return remote ? 'Vercel 공유 저장' : '이 브라우저에 저장'; }
  async function readText(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`자료를 읽지 못했습니다: ${url} (${response.status})`);
    return response.text();
  }
  function csvRows(text) {
    if (root.Papa) {
      const parsed = root.Papa.parse(text, { header: true, skipEmptyLines: 'greedy',
        transformHeader: header => header.replace(/^\uFEFF/, '').trim() });
      if (parsed.errors.length) throw new Error(`CSV 형식을 확인해 주세요. ${parsed.errors[0].message}`);
      return parsed.data;
    }
    return (root.AllocationEngine || require('./engine.js')).parseCsv(text);
  }
  async function loadData() {
    const [rules, org, history] = await Promise.all([
      readText('./data/rules_보강.csv'), readText('./data/A부_조직도_26개과.csv'), readText('./data/접수대장.csv'),
    ]);
    const engine = root.AllocationEngine || require('./engine.js');
    const departments = engine.parseCsv(org).map(row => row.과.trim()).filter(Boolean);
    if (departments.length !== 26 || new Set(departments).size !== 26) throw new Error('조직도 과 목록을 확인해 주세요.');
    const historyRows = csvRows(history);
    if (historyRows.length !== 520 || historyRows.some(row => !row.요구내용 || !row.배분과 || !row.접수일)) {
      throw new Error('과거 접수대장 520건의 형식을 확인해 주세요.');
    }
    return { departments, classify: engine.createEngine(rules, org), history: historyRows };
  }

  async function loadCases() {
    if (remote) {
      const response = await fetch('/api/app', { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `서버 기록을 읽지 못했습니다. (${response.status})`);
      if (!Array.isArray(body)) throw new Error('서버 기록의 형식이 올바르지 않습니다.');
      return body;
    }
    const raw = root.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const cases = JSON.parse(raw);
    if (!Array.isArray(cases)) throw new Error('브라우저 저장 자료의 형식이 올바르지 않습니다.');
    return cases;
  }
  function saveCases(cases) {
    if (remote) throw new Error('서버 기록은 상태 변경 요청으로만 저장할 수 있습니다.');
    root.localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
    if (typeof root.dispatchEvent === 'function' && typeof root.Event === 'function') {
      root.dispatchEvent(new root.Event('cases-updated'));
    }
  }
  function resetCases() {
    if (remote) throw new Error('공유 기록은 화면에서 초기화할 수 없습니다.');
    root.localStorage.removeItem(STORAGE_KEY);
    if (typeof root.dispatchEvent === 'function' && typeof root.Event === 'function') {
      root.dispatchEvent(new root.Event('cases-updated'));
    }
  }
  async function postAction(request, departments) {
    if (remote) {
      const response = await fetch('/api/app', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `서버 저장에 실패했습니다. (${response.status})`);
      return body;
    }
    const cases = structuredClone(await loadCases());
    const item = flow.apply(cases, request, departments);
    saveCases(cases);
    return { ok: true, id: item.id, 상태: item.상태 };
  }
  async function getUpdatedItem(id) {
    const item = (await loadCases()).find(row => row.id === id);
    if (!item) throw new Error('저장된 문항을 찾지 못했습니다. 새로고침해 주세요.');
    return item;
  }
  async function register(rows, actor, classify, departments) {
    const cases = structuredClone(await loadCases());
    const known = new Set(cases.map(item => item.id));
    let added = 0;
    for (const row of rows) {
      if (COLUMNS.some(column => !(column in row))) throw new Error('문항목록의 열이 맞지 않습니다.');
      const id = `${row.파일명}::${row.문항번호}`;
      if (known.has(id)) continue;
      const request = { 작업: '접수', 담당자: actor, 문항: row,
        후보: classify(`${row.요구내용} ${row.세부항목} ${row.비고}`) };
      if (remote) await postAction(request, departments);
      else flow.apply(cases, request, departments);
      known.add(id);
      added++;
    }
    if (added && !remote) saveCases(cases);
    return { added, duplicates: rows.length - added };
  }
  async function confirmMany(selections, actor, departments) {
    if (!selections.length) throw new Error('확정할 문항을 선택해 주세요.');
    const cases = structuredClone(await loadCases());
    const seen = new Set();
    const changes = [];
    for (const { id, primary, helpers, reason = '' } of selections) {
      if (seen.has(id)) throw new Error('같은 문항이 중복 선택되었습니다.');
      seen.add(id);
      const previous = cases.find(item => item.id === id);
      const before = JSON.stringify(previous);
      const method = previous?.상태 === '재배정요청' || previous?.상태 === '배분확정'
        || primary !== previous?.후보?.[0]?.과 ? '수정' : '규칙';
      const request = { 작업: '배분', id, 주관과: primary, 협조과: helpers,
        확정방법: method, 담당자: actor, 사유: reason };
      const item = flow.apply(cases, request, departments);
      if (JSON.stringify(item) !== before) changes.push(request);
    }
    if (remote) {
      for (const request of changes) await postAction(request, departments);
      const latest = await loadCases();
      return { items: selections.map(({ id }) => latest.find(item => item.id === id)), changedCount: changes.length };
    }
    if (changes.length) saveCases(cases);
    return { items: selections.map(({ id }) => cases.find(item => item.id === id)), changedCount: changes.length };
  }
  async function confirm(id, primary, helpers, actor, reason, departments) {
    return (await confirmMany([{ id, primary, helpers, reason }], actor, departments)).items[0];
  }
  async function cancelAssignment(id, actor, reason, departments) {
    await postAction({ 작업: '배분취소', id, 담당자: actor, 사유: reason }, departments);
    return getUpdatedItem(id);
  }
  async function reply(id, dept, actor, fileName, rows, memo, checks, departments) {
    await postAction({ 작업: '회신', id, 과: dept, 담당자: actor, 파일명: fileName,
      행: rows, 메모: memo, 확인필요: checks }, departments);
    return getUpdatedItem(id);
  }
  async function requestReassignment(id, dept, actor, reason, desired, departments) {
    await postAction({ 작업: '재배정요청', id, 과: dept, 담당자: actor,
      사유: reason, 희망과: desired }, departments);
    return getUpdatedItem(id);
  }
  async function requestSupplement(id, dept, actor, reason, departments) {
    await postAction({ 작업: '보완요청', id, 과: dept, 담당자: actor, 사유: reason }, departments);
    return getUpdatedItem(id);
  }
  async function confirmCase(id, actor, comment, departments) {
    await postAction({ 작업: '확정', id, 담당자: actor, 코멘트: comment }, departments);
    return getUpdatedItem(id);
  }
  function historyFor(item, rows) {
    const keyword = item?.후보?.[0]?.근거키워드?.trim() || '';
    if (!keyword) return { keyword: '', count: 0, commonDept: '', recent: [] };
    const matches = rows.filter(row => row.요구내용.toLocaleLowerCase('ko').includes(keyword.toLocaleLowerCase('ko')));
    const counts = new Map();
    for (const row of matches) counts.set(row.배분과, (counts.get(row.배분과) || 0) + 1);
    const commonDept = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))[0]?.[0] || '';
    const recent = [...matches].sort((a, b) => b.접수일.localeCompare(a.접수일) || b.접수번호.localeCompare(a.접수번호)).slice(0, 5);
    return { keyword, count: matches.length, commonDept, recent };
  }
  function historyNode(item, rows) {
    const history = historyFor(item, rows);
    const details = root.document.createElement('details');
    details.className = 'history';
    const summary = root.document.createElement('summary');
    summary.textContent = history.keyword
      ? `${history.count}건 · 주로 ${history.commonDept || '확인필요'}`
      : '근거 키워드 없음 · 이력 검색 불가';
    details.append(summary);
    if (history.keyword) {
      const note = root.document.createElement('small');
      note.textContent = `1순위 근거: ${history.keyword} · 최근 ${history.recent.length}건`;
      details.append(note);
      const list = root.document.createElement('ol');
      for (const row of history.recent) {
        const li = root.document.createElement('li');
        li.textContent = `${row.접수일} · ${row.배분과} · ${row.요구내용}`;
        list.append(li);
      }
      details.append(list);
    }
    return details;
  }
  function parseQuestionCsv(text) {
    const rows = csvRows(text);
    if (rows.length && COLUMNS.some(column => !(column in rows[0]))) throw new Error('문항목록 CSV의 열이 맞지 않습니다.');
    return rows.map(row => Object.fromEntries(COLUMNS.map(column => [column, row[column]])));
  }
  return { COLUMNS, isRemote: remote, storageLabel, loadData, loadCases, saveCases, resetCases,
    postAction, register, confirm, confirmMany, cancelAssignment, reply, requestReassignment,
    requestSupplement, confirmCase,
    historyFor, historyNode, parseQuestionCsv };
});

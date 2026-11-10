import Fuse from './lib/fuse.min.mjs';

const $ = selector => document.querySelector(selector);
let data = null;
let staged = [];
let checks = [];
const selectedIds = new Set();

function updateSelection() {
  const boxes = [...document.querySelectorAll('#assign-body .row-select')];
  const selected = boxes.filter(box => box.checked).length;
  $('#selected-count').textContent = `선택 ${selected}건`;
  $('#confirm-selected').disabled = selected === 0;
  $('#select-all').checked = boxes.length > 0 && selected === boxes.length;
  $('#select-all').indeterminate = selected > 0 && selected < boxes.length;
}

function message(selector, text, kind = '') {
  const node = $(selector);
  node.textContent = text;
  node.className = `message ${kind}`.trim();
}

function cell(row, text, className = '') {
  const td = row.insertCell();
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function addSmall(parent, text) {
  if (!text) return;
  const small = document.createElement('small');
  small.textContent = text;
  parent.append(small);
}

function checkRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.파일명)) groups.set(row.파일명, []);
    groups.get(row.파일명).push(row);
  }
  return [...groups].map(([fileName, group]) => {
    const expected = fileName.match(/_(\d+)문항\.pdf$/i);
    const continuous = group.every((row, index) => Number(row.문항번호) === index + 1);
    return {
      파일명: fileName, 파일명의문항수: expected ? Number(expected[1]) : null,
      뽑은문항수: group.length, 마지막번호: Number(group.at(-1)?.문항번호 || 0),
      번호연속: continuous, 일치: continuous && (!expected || Number(expected[1]) === group.length),
    };
  });
}

function renderPreview() {
  const tbody = $('#preview-body');
  const checksBody = $('#checks-body');
  tbody.replaceChildren();
  checksBody.replaceChildren();
  for (const check of checks) {
    const tr = checksBody.insertRow();
    cell(tr, check.파일명);
    cell(tr, check.파일명의문항수 ?? '—');
    cell(tr, check.뽑은문항수);
    cell(tr, check.마지막번호);
    cell(tr, check.번호연속 ? 'O' : 'X');
    cell(tr, check.일치 ? 'O' : 'X');
  }
  for (const item of staged) {
    const tr = tbody.insertRow();
    cell(tr, `${item.파일명} · ${item.문항번호}`);
    cell(tr, `${item.위원회} · ${item.의원}`);
    const content = cell(tr, item.요구내용, 'content');
    addSmall(content, item.세부항목);
    addSmall(content, item.비고);
    cell(tr, item.제출기한);
  }
  $('#checks-wrap').hidden = !checks.length;
  $('#preview-wrap').hidden = !staged.length;
  $('#register').disabled = !data || !staged.length || checks.some(check => !check.일치);
  $('#preview-count').textContent = staged.length ? `${staged.length}문항 미리보기` : '선택한 파일이 없습니다.';
  $('#stat-preview').textContent = staged.length;
}

async function readPdfs(files) {
  if (!files.length) return;
  message('#receive-message', `${files.length}개 PDF에서 글자를 읽는 중입니다.`);
  staged = [];
  checks = [];
  renderPreview();
  try {
    const pdfjs = await import('./lib/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('./lib/pdf.worker.min.mjs', import.meta.url).href;
    const allRows = [];
    const allChecks = [];
    for (const file of files) {
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const pages = [];
      try {
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          const page = await pdf.getPage(pageNumber);
          pages.push(RequestSplit.textFromItems((await page.getTextContent()).items));
        }
      } finally {
        await pdf.destroy();
      }
      const result = RequestSplit.splitText(pages.join('\n'), file.name);
      allRows.push(...result.rows);
      allChecks.push(result.check);
    }
    staged = allRows;
    checks = allChecks;
    renderPreview();
    const okay = checks.every(check => check.일치);
    message('#receive-message', okay
      ? `${files.length}개 PDF에서 ${staged.length}문항을 읽었습니다. 원문과 문항 수를 확인한 뒤 등록해 주세요.`
      : '문항 수 또는 번호가 맞지 않는 파일이 있습니다. 원문을 확인해 주세요.', okay ? 'success' : 'error');
  } catch (error) {
    staged = [];
    checks = [];
    renderPreview();
    message('#receive-message', error.message, 'error');
  }
}

async function readCsv(file) {
  if (!file) return;
  try {
    staged = AppCommon.parseQuestionCsv(await file.text());
    checks = checkRows(staged);
    renderPreview();
    const okay = checks.every(check => check.일치);
    message('#receive-message', okay
      ? `${staged.length}문항을 불러왔습니다. 내용을 확인한 뒤 등록해 주세요.`
      : 'CSV의 문항 수 또는 번호가 맞지 않습니다.', okay ? 'success' : 'error');
  } catch (error) {
    staged = [];
    checks = [];
    renderPreview();
    message('#receive-message', error.message, 'error');
  }
}

function renderCounts(cases) {
  $('#stat-all').textContent = cases.length;
  $('#stat-new').textContent = cases.filter(item => item.상태 === '접수').length;
  $('#stat-confirmed').textContent = cases.filter(item => item.상태 === '배분확정').length;
}

function makeSelect(item) {
  const select = document.createElement('select');
  select.setAttribute('aria-label', `${item.의원} ${item.문항번호}번 주관 과`);
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = '주관 과 선택';
  select.append(empty);
  for (const dept of data.departments) {
    const option = document.createElement('option');
    option.value = dept;
    option.textContent = dept;
    select.append(option);
  }
  select.value = item.주관과 || item.후보[0]?.과 || '';
  return select;
}

function renderAssign() {
  let cases;
  try { cases = AppCommon.loadCases(); }
  catch (error) { message('#assign-message', error.message, 'error'); return; }
  renderCounts(cases);
  const filter = $('#filter').value.trim();
  const visible = filter
    ? new Fuse(cases, { keys: ['파일명', '의원', '요구내용', '세부항목'], threshold: 0.35, ignoreLocation: true })
      .search(filter).map(result => result.item)
    : cases;
  $('#empty-state').hidden = cases.length > 0;
  const tbody = $('#assign-body');
  tbody.replaceChildren();
  for (const item of visible) {
    const tr = tbody.insertRow();
    tr.dataset.id = item.id;
    const selection = cell(tr, '');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'row-select';
    checkbox.checked = selectedIds.has(item.id);
    checkbox.setAttribute('aria-label', `${item.의원} ${item.문항번호}번 선택`);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selectedIds.add(item.id);
      else selectedIds.delete(item.id);
      updateSelection();
    });
    selection.append(checkbox);
    const status = cell(tr, '');
    const badge = document.createElement('span');
    badge.className = `badge ${item.상태 === '배분확정' ? 'done' : 'pending'}`;
    badge.textContent = item.상태;
    status.append(badge);
    const person = cell(tr, `${item.의원} · ${item.문항번호}번`, 'person');
    addSmall(person, item.위원회);
    const content = cell(tr, item.요구내용, 'content');
    addSmall(content, item.세부항목);
    addSmall(content, item.비고);
    const candidates = cell(tr, '');
    if (!item.후보.length) {
      const note = document.createElement('span');
      note.className = 'badge review';
      note.textContent = '확인필요 · 후보 없음';
      candidates.append(note);
    } else {
      item.후보.forEach((candidate, i) => {
        const line = document.createElement('span');
        line.className = 'candidate';
        const rank = document.createElement('b');
        rank.textContent = `${i + 1}순위 `;
        line.append(rank, document.createTextNode(`${candidate.과} · ${candidate.점수}점 `));
        const evidence = document.createElement('small');
        evidence.textContent = `(${candidate.근거키워드})`;
        line.append(evidence);
        candidates.append(line);
      });
      if (item.후보.length > 1 && item.후보[0].점수 === item.후보[1].점수) {
        const note = document.createElement('span');
        note.className = 'badge review';
        note.textContent = '동점 · 확인필요';
        candidates.append(note);
      }
    }
    const assignment = cell(tr, '', 'assign-cell');
    const primary = makeSelect(item);
    primary.classList.add('primary-select');
    assignment.append(primary);
    const helperDetails = document.createElement('details');
    helperDetails.className = 'helpers';
    const summary = document.createElement('summary');
    summary.textContent = `협조 과 선택${item.협조과.length ? ` · ${item.협조과.length}개` : ''}`;
    helperDetails.append(summary);
    const list = document.createElement('div');
    list.className = 'check-list helper-list';
    for (const dept of data.departments) {
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.value = dept;
      box.checked = item.협조과.includes(dept);
      box.disabled = dept === primary.value;
      box.addEventListener('change', () => {
        summary.textContent = `협조 과 선택 · ${list.querySelectorAll('input:checked').length}개`;
      });
      label.append(box, document.createTextNode(dept));
      list.append(label);
    }
    primary.addEventListener('change', () => {
      list.querySelectorAll('input').forEach(box => {
        if (box.value === primary.value) box.checked = false;
        box.disabled = box.value === primary.value;
      });
      summary.textContent = `협조 과 선택 · ${list.querySelectorAll('input:checked').length}개`;
    });
    helperDetails.append(list);
    assignment.append(helperDetails);
    const reason = document.createElement('input');
    reason.type = 'text';
    reason.className = 'reason-input';
    reason.placeholder = item.상태 === '배분확정' ? '변경 사유 (필수)' : '판단 사유 (선택)';
    reason.setAttribute('aria-label', `${item.의원} ${item.문항번호}번 배분 사유`);
    assignment.append(reason);
    const action = cell(tr, '');
    const actionButtons = document.createElement('div');
    actionButtons.className = 'row-actions';
    const button = document.createElement('button');
    button.className = 'button primary';
    button.textContent = item.상태 === '배분확정' ? '다시 확정' : '배분 확정';
    button.addEventListener('click', () => {
      try {
        const helpers = [...list.querySelectorAll('input:checked')].map(box => box.value);
        const result = AppCommon.confirm(item.id, primary.value, helpers, $('#actor').value, reason.value, data.departments);
        message('#assign-message', `${result.의원} ${result.문항번호}번: ${result.주관과} 배분을 확정했습니다. (${result.확정방법})`, 'success');
        selectedIds.clear();
        renderAssign();
      } catch (error) { message('#assign-message', error.message, 'error'); }
    });
    actionButtons.append(button);
    if (item.상태 === '배분확정') {
      const cancel = document.createElement('button');
      cancel.className = 'button danger';
      cancel.textContent = '배분 취소';
      cancel.addEventListener('click', () => {
        try {
          const result = AppCommon.cancelAssignment(item.id, $('#actor').value, reason.value);
          message('#assign-message', `${result.의원} ${result.문항번호}번 배분을 취소하고 접수 상태로 되돌렸습니다.`, 'success');
          selectedIds.clear();
          renderAssign();
        } catch (error) { message('#assign-message', error.message, 'error'); }
      });
      actionButtons.append(cancel);
    }
    addSmall(actionButtons, item.확정방법 ? `확정방법: ${item.확정방법}` : '');
    action.append(actionButtons);
  }
  if (!visible.length && cases.length) {
    const tr = tbody.insertRow();
    const td = tr.insertCell();
    td.colSpan = 7;
    td.className = 'empty';
    td.textContent = '검색 결과가 없습니다.';
  }
  updateSelection();
}

$('#pdf-files').addEventListener('change', event => readPdfs([...event.target.files]));
$('#csv-file').addEventListener('change', event => readCsv(event.target.files[0]));
$('#filter').addEventListener('input', () => { selectedIds.clear(); renderAssign(); });
$('#select-all').addEventListener('change', event => {
  document.querySelectorAll('#assign-body tr[data-id]').forEach(row => {
    const checked = event.target.checked;
    row.querySelector('.row-select').checked = checked;
    if (checked) selectedIds.add(row.dataset.id);
    else selectedIds.delete(row.dataset.id);
  });
  updateSelection();
});
$('#confirm-selected').addEventListener('click', () => {
  try {
    const selections = [...document.querySelectorAll('#assign-body tr[data-id]')]
      .filter(row => row.querySelector('.row-select').checked)
      .map(row => ({
        id: row.dataset.id,
        primary: row.querySelector('.primary-select').value,
        helpers: [...row.querySelectorAll('.helper-list input:checked')].map(box => box.value),
        reason: row.querySelector('.reason-input').value,
      }));
    const result = AppCommon.confirmMany(selections, $('#actor').value, data.departments);
    message('#assign-message', `${result.changedCount}문항의 배분을 확정했습니다.`, 'success');
    selectedIds.clear();
    renderAssign();
  } catch (error) { message('#assign-message', error.message, 'error'); }
});
$('#reset-cases').addEventListener('click', () => {
  try {
    const count = AppCommon.loadCases().length;
    if (!confirm(`이 브라우저에 저장된 문항 ${count}건과 배분 이력을 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    AppCommon.resetCases();
    selectedIds.clear();
    staged = [];
    checks = [];
    $('#pdf-files').value = '';
    $('#csv-file').value = '';
    renderPreview();
    renderAssign();
    message('#assign-message', '이 브라우저의 접수·배분 기록을 초기화했습니다.', 'success');
    message('#receive-message', '');
  } catch (error) { message('#assign-message', error.message, 'error'); }
});
$('#register').addEventListener('click', () => {
  try {
    if (checks.some(check => !check.일치)) throw new Error('문항 수 또는 번호를 먼저 확인해 주세요.');
    const result = AppCommon.register(staged, $('#actor').value, data.classify);
    message('#receive-message', `${result.added}문항을 등록했습니다. 중복 ${result.duplicates}문항은 건너뛰었습니다.`, 'success');
    staged = [];
    checks = [];
    renderPreview();
    renderAssign();
  } catch (error) { message('#receive-message', error.message, 'error'); }
});
addEventListener('storage', renderAssign);

try {
  data = await AppCommon.loadData();
  $('#data-status').textContent = '보강 기준표 · 26개 과 읽음';
  renderPreview();
  renderAssign();
} catch (error) {
  $('#data-status').textContent = '자료 읽기 실패';
  message('#receive-message', `${error.message} · http://localhost:8000에서 열어 주세요.`, 'error');
}

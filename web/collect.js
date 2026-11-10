(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const STATES = ['접수', '배분확정', '회신중', '재배정요청', '보완요청', '회신완료', '확정'];
  let data = null;
  let cases = [];
  let chart = null;
  let renderVersion = 0;

  function el(tag, text = '', className = '') {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function message(node, text, kind = '') {
    node.textContent = text;
    node.className = `message ${kind}`.trim();
  }
  function actor() {
    const value = $('#actor').value.trim();
    if (!value) throw new Error('총괄 담당자 표시를 입력해 주세요.');
    return value;
  }
  function assigned(item) { return [item.주관과, ...(item.협조과 || [])].filter(Boolean); }
  function currentReplies(item) {
    const latest = new Map();
    for (const reply of item.회신 || []) {
      if (reply.배분번호 === item.배분번호 && assigned(item).includes(reply.과)) latest.set(reply.과, reply);
    }
    return [...latest.values()];
  }
  function missing(item) {
    const replied = new Set(currentReplies(item).map(reply => reply.과));
    return assigned(item).filter(name => !replied.has(name));
  }
  function issueTexts(item) {
    return currentReplies(item).flatMap(reply => (reply.확인필요 || []).map(text => `${reply.과}: ${text}`));
  }
  function caseCard(item) {
    const card = el('article', '', 'collect-card');
    const heading = el('h3', `${item.의원} · ${item.문항번호}번`, 'dept-card-title');
    heading.append(el('span', item.상태, `badge ${item.상태 === '확정' ? 'done' : 'pending'}`));
    card.append(heading, el('p', item.요구내용, 'dept-request'));
    card.append(el('p', `주관 ${item.주관과 || '미배분'} · 협조 ${(item.협조과 || []).join(', ') || '없음'} · 회신 ${currentReplies(item).length}/${assigned(item).length}`, 'dept-meta'));
    const absent = missing(item);
    if (absent.length) card.append(el('p', `미회신 과: ${absent.join(', ')}`, 'reassign-note'));
    const issues = issueTexts(item);
    if (issues.length) {
      const list = el('ul', '', 'check-issues');
      for (const text of issues) list.append(el('li', text));
      card.append(el('p', `확인필요 ${issues.length}건`, 'review-title'), list);
    } else card.append(el('p', '현재 회신의 확인필요 항목이 없습니다.', 'help'));
    if (item.확정코멘트) card.append(el('p', `확정 코멘트: ${item.확정코멘트}`, 'reply-saved'));

    if (['회신중', '회신완료'].includes(item.상태) && currentReplies(item).length) {
      const form = el('div', '', 'collect-form');
      const selectLabel = el('label', '보완할 과', 'field');
      const select = document.createElement('select');
      for (const reply of currentReplies(item)) {
        const option = el('option', reply.과);
        option.value = reply.과;
        select.append(option);
      }
      selectLabel.append(select);
      const reasonLabel = el('label', '보완 사유', 'field');
      const reason = document.createElement('textarea');
      reason.rows = 2;
      reason.placeholder = '확인할 내용을 구체적으로 적어 주세요.';
      reasonLabel.append(reason);
      const button = el('button', '보완요청', 'button');
      button.type = 'button';
      const note = el('div', '', 'message');
      button.addEventListener('click', async () => {
        try {
          button.disabled = true;
          await AppCommon.requestSupplement(item.id, select.value, actor(), reason.value, data.departments);
          await render();
          message($('#collect-message'), `${item.의원} ${item.문항번호}번 ${select.value}에 보완을 요청했습니다.`, 'success');
        } catch (error) { message(note, error.message, 'error'); button.disabled = false; }
      });
      form.append(selectLabel, reasonLabel, button, note);
      card.append(form);
    }
    if (item.상태 === '보완요청' && item.보완?.length) {
      const last = item.보완.at(-1);
      card.append(el('p', `${last.과} 보완 대기 · ${last.사유}`, 'reassign-note'));
    }
    if (item.상태 === '회신완료') {
      const form = el('div', '', 'collect-form');
      const label = el('label', '확정 코멘트', 'field');
      const comment = document.createElement('textarea');
      comment.rows = 2;
      comment.placeholder = '확인필요 검토 결과와 확정 근거를 적어 주세요.';
      label.append(comment);
      const button = el('button', '확인 완료', 'button primary');
      button.type = 'button';
      const note = el('div', '', 'message');
      button.addEventListener('click', async () => {
        try {
          if (issues.length && !confirm(`확인필요 ${issues.length}건이 남아 있습니다. 코멘트로 검토 결과를 남기고 확정할까요?`)) return;
          button.disabled = true;
          await AppCommon.confirmCase(item.id, actor(), comment.value, data.departments);
          await render();
          message($('#collect-message'), `${item.의원} ${item.문항번호}번을 확정했습니다.`, 'success');
        } catch (error) { message(note, error.message, 'error'); button.disabled = false; }
      });
      form.append(label, button, note);
      card.append(form);
    }
    return card;
  }
  function mergedRows(items) {
    const rows = [];
    for (const item of items) {
      for (const reply of currentReplies(item)) {
        const dataRows = reply.행?.length ? reply.행 : [{}];
        dataRows.forEach((row, index) => rows.push({
          id: item.id, 의원: item.의원, 문항번호: item.문항번호, 요구내용: item.요구내용,
          회신과: reply.과, 연도: row.연도 || '', '예산(천원)': row['예산(천원)'] || '',
          '집행액(천원)': row['집행액(천원)'] || '', 비고: row.비고 || '',
          문항별: row.문항별 || {}, 확인필요: index === 0 ? (reply.확인필요 || []).join(' / ') : '',
        }));
      }
    }
    return rows;
  }
  function renderMerged() {
    const body = $('#merged-body');
    body.replaceChildren();
    for (const row of mergedRows(cases)) {
      const tr = document.createElement('tr');
      for (const value of [`${row.의원} · ${row.문항번호}번`, row.회신과, row.연도,
        row['예산(천원)'], row['집행액(천원)'], row.비고,
        Object.entries(row.문항별).map(([key, value]) => `${key}: ${value}`).join(' / '), row.확인필요]) {
        tr.append(el('td', String(value ?? '')));
      }
      body.append(tr);
    }
    if (!body.children.length) {
      const tr = document.createElement('tr');
      const cell = el('td', '아직 제출된 회신이 없습니다.', 'empty');
      cell.colSpan = 8;
      tr.append(cell);
      body.append(tr);
    }
  }
  function renderStatus() {
    const grid = $('#status-grid');
    grid.replaceChildren();
    for (const state of STATES) {
      const box = el('div', '', 'stat');
      box.append(el('small', state), el('strong', String(cases.filter(item => item.상태 === state).length)));
      grid.append(box);
    }
    const assignedCounts = data.departments.map(name => ({ name,
      count: cases.filter(item => assigned(item).includes(name)).length }))
      .filter(row => row.count).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko')).slice(0, 10);
    if (!chart) {
      chart = new Chart($('#department-chart'), { type: 'bar', data: { labels: [], datasets: [{ label: '배분 문항', data: [], backgroundColor: '#0d6d86' }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          animation: matchMedia('(prefers-reduced-motion: reduce)').matches ? false : undefined,
          scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } } });
    }
    chart.data.labels = assignedCounts.map(row => row.name);
    chart.data.datasets[0].data = assignedCounts.map(row => row.count);
    chart.update();
    const count = cases.filter(item => item.상태 === '확정').length;
    $('#export-note').textContent = `확정 ${count}문항만 제출본에 담습니다. 확인필요와 원본 자료는 자동 수정하지 않습니다.`;
    $('#export-xlsx').disabled = count === 0;
    $('#export-md').disabled = count === 0;
  }
  async function render() {
    if (!data) return;
    const version = ++renderVersion;
    try {
      const fresh = await AppCommon.loadCases();
      if (version !== renderVersion) return;
      cases = fresh;
      $('#case-reviews').replaceChildren(...(cases.length ? cases.map(caseCard)
        : [el('div', '접수된 문항이 없습니다.', 'empty')]));
      renderMerged();
      renderStatus();
    } catch (error) { message($('#collect-message'), error.message, 'error'); }
  }
  function parseRegister(text) {
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: 'greedy',
      transformHeader: header => header.replace(/^\uFEFF/, '').trim() });
    if (parsed.errors.length) throw new Error(`접수대장 CSV 형식: ${parsed.errors[0].message}`);
    if (!parsed.meta.fields.includes('접수번호') || !parsed.meta.fields.includes('배분과')) {
      throw new Error('접수대장 CSV의 머리글을 확인해 주세요.');
    }
    return parsed.data;
  }
  function showRegisterIssues(rows) {
    const issues = AppValidate.registry(rows, data.departments);
    const body = $('#register-issues');
    body.replaceChildren();
    for (const issue of issues) {
      const tr = document.createElement('tr');
      for (const value of [issue.행, issue.접수번호, issue.항목, issue.내용]) tr.append(el('td', String(value)));
      body.append(tr);
    }
    message($('#register-message'), `${rows.length}행 점검 · 확인필요 ${issues.length}건. 원본 값은 바꾸지 않았습니다.`, 'success');
  }
  function exportRows() {
    const confirmed = cases.filter(item => item.상태 === '확정');
    return {
      list: confirmed.map(item => ({ 의원: item.의원, 문항번호: item.문항번호, 위원회: item.위원회,
        요구내용: item.요구내용, 제출기한: item.제출기한, 주관과: item.주관과,
        협조과: (item.협조과 || []).join(', '), 확정코멘트: item.확정코멘트 || '' })),
      merged: mergedRows(confirmed).map(row => ({ 의원: row.의원, 문항번호: row.문항번호,
        회신과: row.회신과, 연도: row.연도, '예산(천원)': row['예산(천원)'],
        '집행액(천원)': row['집행액(천원)'], 비고: row.비고,
        ...row.문항별, 확인필요: row.확인필요 })),
    };
  }
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function markdownCell(value) { return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>'); }
  function markdownTable(rows) {
    if (!rows.length) return '_없음_';
    const keys = [...new Set(rows.flatMap(row => Object.keys(row)))];
    return `| ${keys.join(' | ')} |\n| ${keys.map(() => '---').join(' | ')} |\n${rows.map(row => `| ${keys.map(key => markdownCell(row[key])).join(' | ')} |`).join('\n')}`;
  }

  $('#storage-mode').textContent = AppCommon.storageLabel();
  $('#refresh').addEventListener('click', render);
  addEventListener('storage', render);
  addEventListener('cases-updated', render);
  $('#check-sample').addEventListener('click', async () => {
    try {
      const response = await fetch('./data/검증용_접수대장.csv');
      if (!response.ok) throw new Error('검증용 접수대장을 읽지 못했습니다.');
      const rows = parseRegister(await response.text());
      if (rows.length !== 120) throw new Error('검증용 접수대장이 120행이 아닙니다.');
      showRegisterIssues(rows);
    } catch (error) { message($('#register-message'), error.message, 'error'); }
  });
  $('#register-file').addEventListener('change', async event => {
    try { if (event.target.files[0]) showRegisterIssues(parseRegister(await event.target.files[0].text())); }
    catch (error) { message($('#register-message'), error.message, 'error'); }
  });
  $('#export-xlsx').addEventListener('click', () => {
    const rows = exportRows();
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows.list), '제출목록');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows.merged), '문항별 취합표');
    XLSX.writeFile(workbook, '국회요구자료_제출본.xlsx');
  });
  $('#export-md').addEventListener('click', () => {
    const rows = exportRows();
    const text = `# 국회 요구자료 제출본\n\n확정 문항 ${rows.list.length}건\n\n## 제출목록\n\n${markdownTable(rows.list)}\n\n## 문항별 취합표\n\n${markdownTable(rows.merged)}\n`;
    download('국회요구자료_제출본.md', text, 'text/markdown;charset=utf-8');
  });
  AppCommon.loadData().then(result => { data = result; render(); })
    .catch(error => message($('#collect-message'), error.message, 'error'));
})();

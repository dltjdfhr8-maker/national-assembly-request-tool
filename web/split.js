(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RequestSplit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function textFromItems(items) {
    return items.map(item => (item.str || '') + (item.hasEOL ? '\n' : '')).join('');
  }

  function splitText(text, fileName) {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.length) throw new Error(`${fileName}: 읽을 수 있는 글자가 없습니다.`);
    const title = lines[0].match(/^(.+?위원회)\s+(.+?)\s+의원실\s+자료요구서$/);
    if (!title) throw new Error(`${fileName}: 첫 줄에서 위원회·의원을 찾지 못했습니다.`);
    const deadlineLine = lines.find(line => line.startsWith('수신:')) || '';
    const date = deadlineLine.match(/제출기한:\s*(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
    if (!date) throw new Error(`${fileName}: 제출기한을 찾지 못했습니다.`);
    const deadline = `${date[1]}-${date[2].padStart(2, '0')}-${date[3].padStart(2, '0')}`;
    const rows = [];
    let current = null;
    let field = '요구내용';

    for (const source of lines.slice(1)) {
      if (source.startsWith('수신:') || source.startsWith('담당 보좌관:') || source.startsWith('끝.')) continue;
      const item = source.match(/^(\d+)\.\s*(.*)$/);
      if (item) {
        current = {
          파일명: fileName, 위원회: title[1], 의원: title[2], 제출기한: deadline,
          문항번호: item[1], 요구내용: item[2], 세부항목: '', 비고: '',
        };
        rows.push(current);
        field = '요구내용';
        continue;
      }
      if (!current) throw new Error(`${fileName}: 첫 문항 전 예상하지 못한 내용이 있습니다.`);
      let line = source;
      if (/^[가-하]\.\s*/.test(line)) field = '세부항목';
      else if (line.startsWith('※')) {
        field = '비고';
        line = line.slice(1).trim();
      }
      const separator = field === '세부항목' ? ' / ' : '\n';
      current[field] += (current[field] ? separator : '') + line;
    }

    const expectedMatch = fileName.match(/_(\d+)문항\.pdf$/i);
    const expected = expectedMatch ? Number(expectedMatch[1]) : null;
    const continuous = rows.every((row, index) => Number(row.문항번호) === index + 1);
    return {
      rows,
      check: {
        파일명: fileName, 파일명의문항수: expected, 뽑은문항수: rows.length,
        마지막번호: rows.length ? Number(rows.at(-1).문항번호) : 0,
        번호연속: continuous,
        일치: continuous && (expected === null || expected === rows.length),
      },
    };
  }

  return { textFromItems, splitText };
});

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AppValidate = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const COMMON = ['연도', '예산(천원)', '집행액(천원)', '비고'];
  const REQUIRED_REGISTER = ['접수번호', '접수일', '위원회', '요구의원', '문항번호', '요구내용', '제출기한', '배분과'];
  const FORBIDDEN = /이름|연락처|전화|휴대|이메일|주민등록|주소|보좌관|API[_ -]?KEY|TOKEN|SECRET|PASSWORD|비밀|암호/i;
  const string = value => String(value ?? '');
  const filled = value => string(value).trim() !== '';
  const number = value => {
    const text = string(value).replaceAll(',', '').trim();
    return text && /^-?\d+(?:\.\d+)?$/.test(text) ? Number(text) : null;
  };
  const total = row => string(row.연도).trim() === '합계' || string(row.연도).trim() === '총계';

  function replyRows(item, rows) {
    if (!Array.isArray(rows)) throw new Error('회신 행을 읽지 못했습니다.');
    const checks = [];
    const detail = rows.filter(row => !total(row));
    const match = string(item?.요구내용).match(/최근\s*(\d+)\s*년/);
    if (match) {
      const count = Number(match[1]);
      const year = Number(string(item?.제출기한).slice(0, 4)) || new Date().getFullYear();
      if (count > 0 && count <= 30 && year >= 1900 && year <= 2200) {
        const present = new Set(detail.map(row => number(row.연도)).filter(Number.isInteger));
        for (let expected = year - count + 1; expected <= year; expected++) {
          if (!present.has(expected)) checks.push(`최근 ${count}년 중 ${expected}년 자료가 없습니다.`);
        }
      }
    }
    rows.forEach((row, index) => {
      if (total(row)) return;
      const budget = number(row['예산(천원)']);
      const spent = number(row['집행액(천원)']);
      if (budget !== null && spent !== null && spent > budget && !filled(row.비고)) {
        checks.push(`${index + 3}행: 집행액이 예산보다 크고 비고가 없습니다.`);
      }
    });
    const totals = rows.filter(total);
    if (totals.length) {
      for (const column of ['예산(천원)', '집행액(천원)']) {
        const values = detail.map(row => number(row[column])).filter(value => value !== null);
        if (!values.length) continue;
        const expected = values.reduce((sum, value) => sum + value, 0);
        for (const row of totals) {
          const actual = number(row[column]);
          if (actual === null) checks.push(`합계 행: ${column} 값이 없습니다.`);
          else if (Math.abs(actual - expected) > 0.001) checks.push(`합계 행: ${column} ${actual} ≠ 세부행 합 ${expected}`);
        }
      }
    }
    return checks;
  }

  function parseReply(matrix, item) {
    if (!Array.isArray(matrix) || matrix.length < 2) throw new Error('1행 요구 표시와 2행 머리글을 확인해 주세요.');
    const requirement = string(matrix[0]?.[0]).trim();
    if (!requirement) throw new Error('1행 요구 표시가 없습니다.');
    const headers = (matrix[1] || []).map(value => string(value).trim());
    for (const key of COMMON) {
      if (!headers.includes(key)) throw new Error(`2행 머리글에 ${key} 열이 없습니다.`);
    }
    if (headers.filter(Boolean).length !== new Set(headers.filter(Boolean)).size) throw new Error('2행 머리글에 중복 열이 있습니다.');
    const common = new Set(COMMON);
    const rows = matrix.slice(2).filter(values => Array.isArray(values) && values.some(filled)).map(values => {
      const row = { 문항별: {} };
      headers.forEach((key, index) => {
        if (!key || FORBIDDEN.test(key)) return;
        const value = string(values[index]);
        if (common.has(key)) row[key] = value;
        else row.문항별[key] = value;
      });
      return row;
    });
    if (!rows.length) throw new Error('3행부터 회신 자료가 없습니다.');
    return { requirement, rows, checks: replyRows(item, rows) };
  }

  function validDate(value) {
    const match = string(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }
  function registry(rows, org) {
    if (!Array.isArray(rows) || !Array.isArray(org)) throw new Error('접수대장·조직도 형식을 확인해 주세요.');
    const allowed = new Set(org.map(row => typeof row === 'string' ? row : row.과));
    const seenReceipt = new Map();
    const seenQuestion = new Map();
    const issues = [];
    rows.forEach((row, index) => {
      const line = index + 2;
      const receipt = string(row.접수번호).trim();
      const add = (kind, detail) => issues.push({ 행: line, 접수번호: receipt, 항목: kind, 내용: detail });
      const dept = string(row.배분과).trim();
      if (dept && !allowed.has(dept)) add('조직도 밖 과', dept);
      const start = number(row.요구기간_시작), end = number(row.요구기간_끝);
      if (start !== null && end !== null && start > end) add('기간 역전', `${start} > ${end}`);
      if (!validDate(row.제출기한)) add('제출기한 형식', string(row.제출기한));
      if (validDate(row.접수일) && validDate(row.제출기한) && row.제출기한 < row.접수일) {
        add('제출기한 역전', `${row.접수일} > ${row.제출기한}`);
      }
      if (receipt) {
        if (seenReceipt.has(receipt)) add('중복 접수번호', `${seenReceipt.get(receipt)}행과 동일`);
        else seenReceipt.set(receipt, line);
      }
      const questionKey = [row.요구의원, row.위원회, row.문항번호, row.요구내용]
        .map(value => string(value).trim()).join('|');
      if (questionKey.replaceAll('|', '')) {
        if (seenQuestion.has(questionKey)) add('중복 문항 후보', `${seenQuestion.get(questionKey)}행과 동일`);
        else seenQuestion.set(questionKey, line);
      }
      for (const key of REQUIRED_REGISTER) {
        if (!filled(row[key])) add('필수값 공백', key);
      }
      for (const [key, value] of Object.entries(row)) {
        if (filled(value) && (string(value) !== string(value).trim() || /[ \t]{2,}/.test(string(value)))) {
          add('표기 공백', key);
        }
      }
    });
    return issues;
  }

  return { parseReply, replyRows, registry, validDate };
});

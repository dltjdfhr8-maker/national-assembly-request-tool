(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Flow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const QUESTION_FIELDS = ['파일명', '위원회', '의원', '제출기한', '문항번호', '요구내용', '세부항목', '비고'];
  const METHODS = new Set(['규칙', 'AI', '수정']);
  const REPLY_FIELDS = ['연도', '예산(천원)', '집행액(천원)', '비고'];
  const PERSONAL_FIELD = /이름|연락처|전화|휴대|이메일|주민등록|주소|보좌관|API[_ -]?KEY|TOKEN|SECRET|PASSWORD|비밀|암호/i;

  class FlowError extends Error {
    constructor(status, message) {
      super(message);
      this.name = 'FlowError';
      this.status = status;
    }
  }

  function fail(status, message) { throw new FlowError(status, message); }
  function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function required(value, label) {
    if (typeof value !== 'string' || !value.trim()) fail(400, `${label}을(를) 입력해 주세요.`);
    return value.trim();
  }
  function departments(org) {
    if (!Array.isArray(org)) fail(500, '조직도 형식이 올바르지 않습니다.');
    const names = org.map(row => typeof row === 'string' ? row : row?.과).filter(Boolean);
    if (!names.length || names.length !== new Set(names).size) fail(500, '조직도 과 목록을 확인해 주세요.');
    return new Set(names);
  }
  function department(value, names, label) {
    const name = required(value, label);
    if (!names.has(name)) fail(400, `조직도에 없는 ${label}입니다: ${name}`);
    return name;
  }
  function findCase(db, id) {
    const key = required(id, '문항 ID');
    const item = db.find(row => row.id === key);
    if (!item) fail(404, '문항을 찾지 못했습니다.');
    return item;
  }
  function allowedState(item, states) {
    if (!states.includes(item.상태)) fail(409, `${item.상태} 상태에서 처리할 수 없는 작업입니다.`);
  }
  function log(item, actor, action, reason, extra = {}) {
    item.log = Array.isArray(item.log) ? item.log : [];
    const time = new Date().toISOString();
    item.갱신시각 = time;
    item.log.push({ 시각: time, 담당자: actor, 작업: action, 사유: reason, 문항: item.id, ...extra });
  }
  function cleanCandidates(value, names) {
    if (value == null) return [];
    if (!Array.isArray(value)) fail(400, '후보는 배열이어야 합니다.');
    return value.slice(0, 3).map(entry => {
      const source = typeof entry === 'string' ? { 과: entry } : entry;
      if (!object(source)) fail(400, '후보 형식이 올바르지 않습니다.');
      const result = { 과: department(source.과, names, '후보 과') };
      if (Number.isFinite(source.점수)) result.점수 = source.점수;
      if (typeof source.근거키워드 === 'string') result.근거키워드 = source.근거키워드;
      if (typeof source.근거 === 'string') result.근거 = source.근거;
      return result;
    });
  }
  function cleanReplyRows(rows) {
    if (!Array.isArray(rows)) fail(400, '회신 행은 배열이어야 합니다.');
    return rows.map(row => {
      if (!object(row)) fail(400, '회신 행 형식이 올바르지 않습니다.');
      const clean = {};
      for (const key of REPLY_FIELDS) {
        if (row[key] !== undefined && ['string', 'number', 'boolean'].includes(typeof row[key])) clean[key] = row[key];
      }
      if (object(row.문항별)) {
        clean.문항별 = Object.fromEntries(Object.entries(row.문항별)
          .filter(([key, value]) => !PERSONAL_FIELD.test(key) && ['string', 'number', 'boolean'].includes(typeof value)));
      }
      return clean;
    });
  }
  function cleanChecks(checks) {
    if (checks == null) return [];
    if (!Array.isArray(checks) || checks.some(value => typeof value !== 'string')) {
      fail(400, '확인필요 목록의 형식이 올바르지 않습니다.');
    }
    return checks.map(value => value.trim()).filter(Boolean);
  }

  // db는 문항 배열이며, 검증을 통과한 뒤에만 제자리에서 바꾼다.
  function apply(db, request, org) {
    if (!Array.isArray(db)) fail(500, '저장 자료 형식이 올바르지 않습니다.');
    if (!object(request)) fail(400, '요청 형식이 올바르지 않습니다.');
    const names = departments(org);
    const action = required(request.작업, '작업');
    if (action === 'AI추천') fail(501, `${action}은 다음 단계에서 제공합니다.`);
    const actor = required(request.담당자, '담당자');

    if (action === '접수') {
      const source = object(request.문항) ? request.문항 : request;
      const row = Object.fromEntries(QUESTION_FIELDS.map(key => [key,
        typeof source[key] === 'string' || typeof source[key] === 'number' ? String(source[key]) : '']));
      required(row.파일명, '파일명');
      required(row.문항번호, '문항번호');
      required(row.요구내용, '요구내용');
      const id = typeof request.id === 'string' && request.id.trim()
        ? request.id.trim() : `${row.파일명}::${row.문항번호}`;
      if (db.some(item => item.id === id)) fail(409, '이미 접수된 문항입니다.');
      const candidates = cleanCandidates(request.후보, names);
      const item = { ...row, id, 상태: '접수', 후보: candidates, 주관과: '', 협조과: [],
        확정방법: '', 배분번호: 0, 회신: [], 갱신시각: '', log: [] };
      log(item, actor, '접수', '요구서 문항 등록');
      db.push(item);
      return item;
    }

    const item = findCase(db, request.id);
    if (action === '배분') {
      allowedState(item, ['접수', '재배정요청', '배분확정']);
      const primary = department(request.주관과, names, '주관 과');
      if (!Array.isArray(request.협조과)) fail(400, '협조 과는 배열이어야 합니다.');
      const helpers = [...new Set(request.협조과.map(name => department(name, names, '협조 과')))]
        .filter(name => name !== primary);
      const method = required(request.확정방법, '확정방법');
      if (!METHODS.has(method)) fail(400, '확정방법은 규칙·AI·수정 중 하나여야 합니다.');
      const changed = item.주관과 !== primary || JSON.stringify(item.협조과 || []) !== JSON.stringify(helpers);
      const reason = typeof request.사유 === 'string' ? request.사유.trim() : '';
      if (item.상태 === '배분확정' && changed && !reason) fail(400, '재배분 사유를 입력해 주세요.');
      if (item.상태 === '배분확정' && !changed) return item;
      const previous = item.주관과;
      if (changed) item.배분번호 = (item.배분번호 || 0) + 1;
      item.상태 = '배분확정';
      item.주관과 = primary;
      item.협조과 = helpers;
      item.확정방법 = method;
      item.회신 = Array.isArray(item.회신) ? item.회신 : [];
      log(item, actor, previous ? '재배분' : '배분확정', reason || '담당자 배분 확인',
        { 과: primary, 이전주관과: previous });
      return item;
    }

    if (action === '회신' || action === '재배정요청') {
      allowedState(item, ['배분확정', '회신중', '보완요청']);
      const dept = department(request.과, names, '회신 과');
      if (dept !== item.주관과 && !(item.협조과 || []).includes(dept)) fail(403, `${dept}는 이 문항의 담당 과가 아닙니다.`);
      if (item.상태 === '보완요청' && dept !== item.보완?.at(-1)?.과) {
        fail(403, '보완요청을 받은 과만 다시 회신할 수 있습니다.');
      }
      if (action === '재배정요청') {
        const reason = required(request.사유, '재배정 사유');
        const desired = request.희망과 ? department(request.희망과, names, '희망 과') : '';
        item.상태 = '재배정요청';
        item.재배정 = { 과: dept, 사유: reason, 희망과: desired };
        log(item, actor, action, reason, { 과: dept });
        return item;
      }
      const fileName = required(request.파일명, '회신 파일명');
      const rows = cleanReplyRows(request.행);
      const reply = { 과: dept, 파일명: fileName, 행: rows,
        메모: typeof request.메모 === 'string' ? request.메모 : '',
        확인필요: cleanChecks(request.확인필요), 배분번호: item.배분번호 || 1,
        담당자: actor, 시각: new Date().toISOString() };
      item.회신 = Array.isArray(item.회신) ? item.회신 : [];
      item.회신.push(reply);
      const assigned = [item.주관과, ...(item.협조과 || [])];
      const replied = new Set(item.회신.filter(entry => entry.배분번호 === reply.배분번호).map(entry => entry.과));
      item.상태 = assigned.every(name => replied.has(name)) ? '회신완료' : '회신중';
      log(item, actor, action, '담당 과 회신 등록', { 과: dept });
      return item;
    }

    if (action === '보완요청') {
      allowedState(item, ['회신중', '회신완료']);
      const dept = department(request.과, names, '보완 과');
      if (dept !== item.주관과 && !(item.협조과 || []).includes(dept)) fail(403, `${dept}는 이 문항의 담당 과가 아닙니다.`);
      if (!(item.회신 || []).some(reply => reply.과 === dept && reply.배분번호 === item.배분번호)) {
        fail(409, '회신하지 않은 과에는 보완을 요청할 수 없습니다.');
      }
      const reason = required(request.사유, '보완 사유');
      item.보완 = Array.isArray(item.보완) ? item.보완 : [];
      item.보완.push({ 과: dept, 사유: reason, 시각: new Date().toISOString() });
      item.상태 = '보완요청';
      log(item, actor, action, reason, { 과: dept });
      return item;
    }

    if (action === '확정') {
      allowedState(item, ['회신완료']);
      const comment = required(request.코멘트, '확정 코멘트');
      item.확정코멘트 = comment;
      item.상태 = '확정';
      log(item, actor, '확정', comment);
      return item;
    }

    // 기존 배분 화면의 취소 기능을 유지한다.
    if (action === '배분취소') {
      allowedState(item, ['배분확정']);
      const reason = required(request.사유, '배분 취소 사유');
      const previous = item.주관과;
      item.상태 = '접수';
      item.주관과 = '';
      item.협조과 = [];
      item.확정방법 = '';
      item.배분번호 = (item.배분번호 || 0) + 1;
      log(item, actor, action, reason, { 이전주관과: previous });
      return item;
    }
    fail(400, '알 수 없는 작업입니다.');
  }

  return { apply, FlowError, QUESTION_FIELDS };
});

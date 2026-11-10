const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('./web/lib/xlsx.full.min.js');
const Csv = require('./web/engine.js');
const Validate = require('./web/validate.js');

const item = { 요구내용: '최근 3년 예산 집행 내역', 제출기한: '2026-11-30' };
const matrix = [
  ['요구: 가상 문항'],
  ['연도', '예산(천원)', '집행액(천원)', '비고', '항목'],
  [2024, 100, 120, '', '가'],
  [2026, 200, 180, '', '나'],
  ['합계', 999, 300, '', ''],
];
const before = JSON.stringify(matrix);
const parsed = Validate.parseReply(matrix, item);
assert.equal(parsed.rows.length, 3);
assert(parsed.checks.some(text => text.includes('2025년')));
assert(parsed.checks.some(text => text.includes('집행액이 예산보다')));
assert(parsed.checks.some(text => text.includes('합계 행: 예산')));
assert.equal(JSON.stringify(matrix), before, '회신 원본을 바꾸면 안 됩니다.');
assert.throws(() => Validate.parseReply([[''], ['연도']], item), /1행 요구 표시/);
assert.throws(() => Validate.parseReply([['요구'], ['연도']], item), /2행 머리글/);
assert.deepEqual(Validate.replyRows(item, [
  { 연도: '2024', '예산(천원)': '100', '집행액(천원)': '120', 비고: '차액 사유' },
  { 연도: '2025', '예산(천원)': '100', '집행액(천원)': '90' },
  { 연도: '2026', '예산(천원)': '100', '집행액(천원)': '90' },
]), []);

const org = Csv.parseCsv(fs.readFileSync('data/A부_조직도_26개과.csv', 'utf8'));
const register = Csv.parseCsv(fs.readFileSync('data/검증용_접수대장_120건.csv', 'utf8'));
assert.equal(register.length, 120);
const registerBefore = JSON.stringify(register);
const issues = Validate.registry(register, org);
assert.equal(JSON.stringify(register), registerBefore, '접수대장 원본을 바꾸면 안 됩니다.');
for (const kind of ['조직도 밖 과', '기간 역전', '제출기한 형식', '제출기한 역전',
  '중복 접수번호', '필수값 공백', '표기 공백']) {
  assert(issues.some(issue => issue.항목 === kind), `${kind}을 놓쳤습니다.`);
}

const workbookIssues = [];
for (const name of fs.readdirSync('부서회신').filter(name => name.endsWith('.xlsx'))) {
  const workbook = XLSX.read(fs.readFileSync(path.join('부서회신', name)), { type: 'buffer' });
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],
    { header: 1, raw: false, defval: '', blankrows: false });
  const result = Validate.parseReply(matrix, { 요구내용: '최근 5년간 위원회 운영 현황', 제출기한: '2026-11-30' });
  workbookIssues.push({ file: name, issues: result.checks.length });
}
assert.equal(workbookIssues.length, 6);
console.log(`검증 통과: 접수대장 ${register.length}행, 확인필요 ${issues.length}건, 회신 엑셀 ${workbookIssues.length}개`);
console.log(`접수대장 항목별: ${JSON.stringify(Object.fromEntries([...new Set(issues.map(issue => issue.항목))]
  .map(kind => [kind, issues.filter(issue => issue.항목 === kind).length])))}`);
console.log(`회신 엑셀: ${JSON.stringify(workbookIssues)}`);

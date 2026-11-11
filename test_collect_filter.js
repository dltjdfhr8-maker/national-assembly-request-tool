const assert = require('node:assert/strict');
const { matchesFilter, missing, repliedDepartments } = require('./web/collect.js');

const a = '가상기획과';
const b = '가상협조과';
const base = { 상태: '회신중', 주관과: a, 협조과: [b], 배분번호: 1,
  회신: [{ 과: a, 배분번호: 1, 확인필요: [] }] };

assert.equal(matchesFilter(base, 'replied', ''), true);
assert.equal(matchesFilter(base, 'replied', a), true);
assert.equal(matchesFilter(base, 'replied', b), false);
assert.equal(matchesFilter(base, 'missing', ''), true);
assert.equal(matchesFilter(base, 'missing', b), true);
assert.equal(matchesFilter(base, 'missing', a), false);
assert.equal(matchesFilter(base, 'all', '조직도밖과'), false);
assert.equal(matchesFilter(base, 'actionable', ''), false);

const issue = { ...base, 회신: [{ 과: a, 배분번호: 1, 확인필요: ['금액 확인'] }] };
assert.equal(matchesFilter(issue, 'actionable', ''), true);
const complete = { ...base, 상태: '회신완료', 회신: [...base.회신,
  { 과: b, 배분번호: 1, 확인필요: [] }] };
assert.equal(matchesFilter(complete, 'actionable', ''), true);
assert.deepEqual(missing(complete), []);
const supplement = { ...complete, 상태: '보완요청', 보완: [{ 과: b, 사유: '재확인' }] };
assert.deepEqual(missing(supplement), [b]);
assert.equal(repliedDepartments(supplement).has(b), false);
assert.equal(matchesFilter(supplement, 'missing', b), true);
assert.equal(matchesFilter(supplement, 'replied', b), false);

const reassigned = { ...base, 배분번호: 2 };
assert.deepEqual(missing(reassigned), [a, b]);
const received = { 상태: '접수', 주관과: '', 협조과: [], 배분번호: 0, 회신: [] };
assert.equal(matchesFilter(received, 'all', ''), true);
assert.equal(matchesFilter(received, 'missing', ''), false);

console.log('취합 화면 회신·미회신·과별 필터 18개 확인 통과');

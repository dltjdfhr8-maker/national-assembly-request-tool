const assert = require('node:assert/strict');
const fs = require('node:fs');
const Flow = require('./web/flow.js');
const Engine = require('./web/engine.js');

class FakeStore {
  constructor() { this.cases = []; this.version = 0; this.writes = 0; this.conflict = false; this.transientConflicts = 0; this.reads = 0; }
  async read() { this.reads++; return { cases: structuredClone(this.cases), etag: this.version ? `v${this.version}` : null }; }
  async write(cases, etag) {
    const transient = this.transientConflicts > 0;
    if (transient) this.transientConflicts--;
    if (this.conflict || transient || etag !== (this.version ? `v${this.version}` : null)) {
      const error = new Error('version changed');
      error.name = 'BlobPreconditionFailedError';
      throw error;
    }
    this.cases = structuredClone(cases);
    this.version++;
    this.writes++;
  }
}

async function main() {
  const { createApp, GET } = await import('./api/app.js');
  const previousToken = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  const missingToken = await GET();
  assert.equal(missingToken.status, 503);
  if (previousToken !== undefined) process.env.BLOB_READ_WRITE_TOKEN = previousToken;
  const store = new FakeStore();
  const app = createApp(store);
  const org = JSON.parse(fs.readFileSync('api/org.json', 'utf8'));
  assert.deepEqual(org, JSON.parse(fs.readFileSync('org.json', 'utf8')));
  assert.equal(org.length, 26);
  assert.deepEqual(org.map(row => row.과),
    Engine.parseCsv(fs.readFileSync('data/A부_조직도_26개과.csv', 'utf8')).map(row => row.과));
  const primary = org[0].과;
  const helper = org[1].과;
  const outsider = org[2].과;
  const aiRequest = { 작업: 'AI추천', 요구내용: '가상 디지털 사업 소관 확인' };
  const aiPost = async (client, body = aiRequest) => {
    const response = await client.POST(new Request('http://local/api/app', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }));
    return { status: response.status, body: await response.json() };
  };
  let aiCalls = 0;
  const aiFetch = async (url, options) => {
    aiCalls++;
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    const sent = JSON.parse(options.body);
    assert.equal(sent.model, 'gpt-4o-mini');
    assert.equal(sent.temperature, 0);
    assert.deepEqual(sent.response_format, { type: 'json_object' });
    assert.equal(sent.messages[1].content, aiRequest.요구내용);
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    return Response.json({ choices: [{ message: { content: JSON.stringify({
      후보: [{ 과: primary, 근거: '가상 사업 소관입니다. 추가 문장입니다.' },
        { 과: '조직도밖과', 근거: '제거 대상입니다.' }, { 과: helper, 근거: '협조 업무입니다.' },
        { 과: primary, 근거: '중복입니다.' }], 해당없음: false,
    }) } }] });
  };
  const aiStoreReads = store.reads;
  const aiResult = await aiPost(createApp(store, { fetchImpl: aiFetch, apiKey: 'test-key' }));
  assert.equal(aiResult.status, 200);
  assert.deepEqual(aiResult.body, { 후보: [{ 과: primary, 근거: '가상 사업 소관입니다.' },
    { 과: helper, 근거: '협조 업무입니다.' }], 해당없음: false });
  assert.equal(aiCalls, 1);
  const noMatch = await aiPost(createApp(store, { fetchImpl: async () => Response.json({
    choices: [{ message: { content: JSON.stringify({ 후보: [], 해당없음: true }) } }],
  }), apiKey: 'test-key' }));
  assert.deepEqual(noMatch, { status: 200, body: { 후보: [], 해당없음: true } });
  const noKey = await aiPost(createApp(store, { fetchImpl: () => { throw new Error('호출되면 안 됨'); }, apiKey: '' }));
  assert.equal(noKey.status, 500);
  assert.match(noKey.body.error, /OPENAI_API_KEY/);
  assert.equal(store.reads, aiStoreReads);
  const post = async body => {
    const response = await app.POST(new Request('http://local/api/app', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }));
    return { status: response.status, body: await response.json() };
  };
  let checks = 1;
  checks += 3;
  async function expect(body, status, state) {
    const before = store.writes;
    const result = await post(body);
    assert.equal(result.status, status, `${body.작업}: ${JSON.stringify(result.body)}`);
    if (state) assert.equal(result.body.상태, state);
    assert.equal(store.writes, before + (status === 200 ? 1 : 0));
    checks++;
    return result;
  }
  const actor = '가상담당';
  const row = { 파일명: '가상요구서.pdf', 위원회: '가상위원회', 의원: '가상의원', 제출기한: '2026-11-30',
    문항번호: '1', 요구내용: '가상 문항', 세부항목: '', 비고: '', 이름: '저장금지', 연락처: '010-0000-0000' };
  const id = `${row.파일명}::${row.문항번호}`;

  await expect({ 작업: '접수', 담당자: actor, 문항: row, 후보: [{ 과: primary, 점수: 3, 이름: '저장금지' }],
    이름: '저장금지', API_KEY: '저장금지' }, 200, '접수');
  const read = await app.GET();
  assert.equal(read.status, 200);
  const cases = await read.json();
  assert.equal(cases.length, 1);
  assert.equal(cases[0].이름, undefined);
  assert.equal(cases[0].연락처, undefined);
  assert.equal(cases[0].API_KEY, undefined);
  assert.equal(cases[0].후보[0].이름, undefined);
  checks++;

  await expect({ 작업: '접수', 담당자: actor, 문항: row }, 409);
  await expect({ 작업: '회신', 담당자: actor, id, 과: primary, 파일명: '가상.xlsx', 행: [] }, 409);
  await expect({ 작업: '배분', 담당자: actor, id, 주관과: '조직도밖과', 협조과: [], 확정방법: '규칙' }, 400);
  await expect({ 작업: '배분', 담당자: actor, id, 주관과: primary, 협조과: [], 확정방법: '자동' }, 400);
  await expect({ 작업: '배분', 담당자: actor, id, 주관과: primary, 협조과: [helper], 확정방법: '규칙' }, 200, '배분확정');
  await expect({ 작업: '회신', 담당자: actor, id, 과: outsider, 파일명: '가상.xlsx', 행: [] }, 403);
  await expect({ 작업: '재배정요청', 담당자: actor, id, 과: helper, 사유: '' }, 400);
  await expect({ 작업: '회신', 담당자: actor, id, 과: primary, 파일명: '주관.xlsx',
    행: [{ 연도: '2025', '예산(천원)': 1000, 이름: '저장금지', 문항별: { 가: '가상', 연락처: '저장금지', API_KEY: '저장금지' } }],
    확인필요: ['3행 금액 대조'] }, 200, '회신중');
  assert.equal(store.cases[0].회신[0].행[0].이름, undefined);
  assert.equal(store.cases[0].회신[0].행[0].문항별.연락처, undefined);
  assert.equal(store.cases[0].회신[0].행[0].문항별.API_KEY, undefined);
  assert.deepEqual(store.cases[0].회신[0].확인필요, ['3행 금액 대조']);
  await expect({ 작업: '재배정요청', 담당자: actor, id, 과: outsider, 사유: '가상 이의' }, 403);
  await expect({ 작업: '회신', 담당자: actor, id, 과: helper, 파일명: '협조.xlsx', 행: [] }, 200, '회신완료');
  await expect({ 작업: '재배정요청', 담당자: actor, id, 과: helper, 사유: '기한 뒤 이의' }, 409);
  await expect({ 작업: '확정', 담당자: actor, id, 코멘트: '' }, 400);
  await expect({ 작업: '보완요청', 담당자: actor, id, 과: primary, 사유: '' }, 400);
  await expect({ 작업: '보완요청', 담당자: actor, id, 과: primary, 사유: '금액 재확인' }, 200, '보완요청');
  await expect({ 작업: '회신', 담당자: actor, id, 과: helper, 파일명: '협조_재회신.xlsx', 행: [] }, 403);
  await expect({ 작업: '회신', 담당자: actor, id, 과: primary, 파일명: '주관_보완.xlsx', 행: [] }, 200, '회신완료');
  assert.equal(store.cases[0].회신.length, 3);
  await expect({ 작업: '확정', 담당자: actor, id, 코멘트: '가상 검토 완료' }, 200, '확정');
  await expect({ 작업: '확정', 담당자: actor, id, 코멘트: '중복 확정' }, 409);

  const second = { ...row, 문항번호: '2' };
  const id2 = `${row.파일명}::2`;
  await expect({ 작업: '접수', 담당자: actor, 문항: second }, 200, '접수');
  await expect({ 작업: '배분', 담당자: actor, id: id2, 주관과: primary, 협조과: [helper], 확정방법: '수정' }, 200, '배분확정');
  await expect({ 작업: '재배정요청', 담당자: actor, id: id2, 과: helper, 사유: '소관 이의', 희망과: outsider }, 200, '재배정요청');
  await expect({ 작업: '배분', 담당자: actor, id: id2, 주관과: outsider, 협조과: [], 확정방법: '수정', 사유: '이의 검토' }, 200, '배분확정');
  assert.equal(store.cases[1].log.length, 4);
  await expect({ 작업: '배분취소', 담당자: actor, id: id2, 사유: '검토 재개' }, 200, '접수');

  store.conflict = true;
  await expect({ 작업: '배분', 담당자: actor, id: id2, 주관과: primary, 협조과: [], 확정방법: '수정' }, 409);
  store.conflict = false;
  const batch = Array.from({ length: 19 }, (_, index) => ({ 작업: '접수', 담당자: actor,
    문항: { ...row, 문항번호: String(index + 3) } }));
  store.transientConflicts = 1;
  const readsBeforeBatch = store.reads;
  const batchResult = await expect({ 작업: '접수일괄', 요청목록: batch }, 200);
  assert.equal(batchResult.body.added, 19);
  assert.equal(store.cases.length, 21);
  assert.equal(store.reads - readsBeforeBatch, 2);
  checks += 3;
  const aiId = `${row.파일명}::3`;
  await expect({ 작업: '배분', 담당자: actor, id: aiId, 주관과: primary, 협조과: [],
    확정방법: 'AI', 후보: [{ 과: primary, 근거: '가상 사업 소관입니다.', 출처: 'AI' }] }, 200, '배분확정');
  assert.equal(store.cases.find(item => item.id === aiId).후보[0].출처, 'AI');
  checks++;
  await expect({ 작업: '접수일괄', 요청목록: [{ 작업: '배분' }] }, 400);
  await expect({ 작업: '접수일괄', 요청목록: [batch[0], batch[0]] }, 409);
  const malformed = await app.POST(new Request('http://local/api/app', { method: 'POST', body: '{' }));
  assert.equal(malformed.status, 400);
  checks++;
  assert.throws(() => Flow.apply([], { 작업: '접수', 담당자: actor, 문항: { ...row, 요구내용: '' } }, org),
    error => error.status === 400);
  checks++;
  const priorLocation = global.location;
  const priorFetch = global.fetch;
  let postCount = 0;
  global.location = { hostname: 'example.vercel.app' };
  global.fetch = async (url, options) => {
    if (options?.method === 'POST') {
      postCount++;
      const body = JSON.parse(options.body);
      assert.equal(body.작업, '접수일괄');
      assert.equal(body.요청목록.length, 19);
      return Response.json({ ok: true, added: 19 });
    }
    assert.equal(url, '/api/app');
    return Response.json([]);
  };
  try {
    const common = require('./web/common.js');
    const registered = await common.register(batch.map(action => action.문항), actor, () => [], org);
    assert.deepEqual(registered, { added: 19, duplicates: 0 });
    assert.equal(postCount, 1);
    checks += 2;
    global.fetch = async (url, options) => {
      assert.equal(url, '/api/app');
      assert.deepEqual(JSON.parse(options.body), aiRequest);
      return Response.json({ 후보: [{ 과: primary, 근거: '가상 사업 소관입니다.' }], 해당없음: false });
    };
    const recommendation = await common.recommend(aiRequest.요구내용);
    assert.equal(recommendation.후보[0].과, primary);
    checks++;
    const remoteCases = [];
    const aiRow = { ...row, 문항번호: 'AI시험' };
    Flow.apply(remoteCases, { 작업: '접수', 담당자: actor, 문항: aiRow }, org);
    global.fetch = async (url, options) => {
      if (options?.method === 'POST') {
        const body = JSON.parse(options.body);
        assert.equal(body.확정방법, 'AI');
        const changed = Flow.apply(remoteCases, body, org);
        return Response.json({ ok: true, id: changed.id, 상태: changed.상태 });
      }
      return Response.json(remoteCases);
    };
    const confirmed = await common.confirm(`${aiRow.파일명}::${aiRow.문항번호}`, primary, [], actor,
      '', org, [{ 과: primary, 근거: '가상 사업 소관입니다.', 출처: 'AI' }]);
    assert.equal(confirmed.확정방법, 'AI');
    assert.equal(confirmed.후보[0].출처, 'AI');
    checks++;
  } finally {
    global.location = priorLocation;
    global.fetch = priorFetch;
  }
  console.log(`API·상태 규칙 ${checks}개 확인 통과 · 저장 ${store.writes}회 · 문항 ${store.cases.length}건`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });

import { readFileSync } from 'node:fs';
import Flow from '../web/flow.js';

const ORG = JSON.parse(readFileSync(new URL('./org.json', import.meta.url), 'utf8'));
const PATHNAME = 'cases.json';

function json(payload, status = 200) {
  return Response.json(payload, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

async function blobStore() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Flow.FlowError(503, 'Vercel Blob 토큰이 서버 환경변수에 설정되지 않았습니다.');
  }
  const { get, put } = await import('@vercel/blob');
  return {
    async read() {
      const result = await get(PATHNAME, { access: 'private', useCache: false });
      if (!result) return { cases: [], etag: null };
      if (result.statusCode !== 200) throw new Error('저장소를 읽지 못했습니다.');
      const cases = JSON.parse(await new Response(result.stream).text());
      if (!Array.isArray(cases)) throw new Error('cases.json 형식이 올바르지 않습니다.');
      return { cases, etag: result.blob.etag };
    },
    async write(cases, etag) {
      await put(PATHNAME, JSON.stringify(cases), {
        access: 'private', contentType: 'application/json',
        allowOverwrite: Boolean(etag), ...(etag ? { ifMatch: etag } : {}),
      });
    },
  };
}

function errorResponse(error) {
  if (error instanceof Flow.FlowError) return json({ error: error.message }, error.status);
  if (error?.name === 'BlobPreconditionFailedError' || error?.name === 'BlobAlreadyExistsError') {
    return json({ error: '다른 담당자가 먼저 저장했습니다. 새로고침 후 다시 시도해 주세요.' }, 409);
  }
  console.error('cases.json 처리 실패:', error);
  return json({ error: '저장소 처리 중 오류가 발생했습니다.' }, 500);
}

// store는 read()/write()만 구현하면 되므로 시험에서는 가짜 저장소를 넣는다.
export function createApp(store) {
  return {
    async GET() {
      try {
        const { cases } = await store.read();
        if (!Array.isArray(cases)) throw new Error('저장 자료 형식이 올바르지 않습니다.');
        return json(cases);
      } catch (error) { return errorResponse(error); }
    },
    async POST(request) {
      try {
        let body;
        try { body = await request.json(); }
        catch { return json({ error: 'JSON 요청을 확인해 주세요.' }, 400); }
        const snapshot = await store.read();
        if (!Array.isArray(snapshot.cases)) throw new Error('저장 자료 형식이 올바르지 않습니다.');
        const cases = structuredClone(snapshot.cases);
        const item = Flow.apply(cases, body, ORG);
        await store.write(cases, snapshot.etag);
        return json({ ok: true, id: item.id, 상태: item.상태 });
      } catch (error) { return errorResponse(error); }
    },
  };
}

export async function GET(request) {
  try { return (await createApp(await blobStore()).GET(request)); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request) {
  try { return (await createApp(await blobStore()).POST(request)); }
  catch (error) { return errorResponse(error); }
}

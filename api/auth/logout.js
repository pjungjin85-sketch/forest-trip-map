// 로그아웃. DB 에서 세션을 지우므로 쿠키가 남아 있어도 바로 무효가 된다.
import { destroySession, sameOrigin } from '../../lib/session.js';

export async function POST(req) {
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: { 'Set-Cookie': await destroySession(req) } });
}

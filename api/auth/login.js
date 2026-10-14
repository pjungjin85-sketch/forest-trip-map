// ① 로그인 시작. state 를 쿠키에 넣고 카카오 로그인 화면으로 보낸다.
import { randomBytes } from 'node:crypto';
import { cookie } from '../../lib/session.js';

export function GET(req) {
  const state = randomBytes(16).toString('base64url');
  const url = new URL('https://kauth.kakao.com/oauth/authorize');
  url.search = new URLSearchParams({
    client_id: process.env.KAKAO_REST_KEY,
    redirect_uri: new URL('/api/auth/callback', req.url).href,
    response_type: 'code',
    state,
  });
  return new Response(null, {
    status: 302,
    headers: { Location: url.href, 'Set-Cookie': cookie(req, 'oauth_state', state, 600) },
  });
}

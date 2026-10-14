// ② 카카오가 돌려보내는 곳. code 를 토큰으로 바꿔 누구인지 확인하고 세션을 만든다.
import { sql } from '../../lib/db.js';
import { cookie, createSession, readCookie } from '../../lib/session.js';

const back = (req, result, setCookies) => {
  const headers = new Headers({ Location: new URL(`/?login=${result}`, req.url).href });
  // 한 번 쓴 state 쿠키는 지운다.
  headers.append('Set-Cookie', cookie(req, 'oauth_state', '', 0));
  for (const c of setCookies || []) headers.append('Set-Cookie', c);
  return new Response(null, { status: 302, headers });
};

export async function GET(req) {
  const params = new URL(req.url).searchParams;
  // 카카오 동의 화면에서 취소하면 code 대신 error 가 온다.
  if (params.get('error')) return back(req, 'cancel');

  // 우리가 보낸 state 와 같아야 이 브라우저에서 시작한 로그인이다(로그인 CSRF 방지).
  const state = readCookie(req, 'oauth_state');
  if (!state || state !== params.get('state')) return back(req, 'fail');

  try {
    // code → 카카오 토큰. Client Secret 은 서버에만 있다. 이게 서버가 필요한 이유.
    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.KAKAO_REST_KEY,
        client_secret: process.env.KAKAO_CLIENT_SECRET,
        redirect_uri: new URL('/api/auth/callback', req.url).href,
        code: params.get('code'),
      }),
    });
    if (!tokenRes.ok) throw new Error(`token ${tokenRes.status} ${await tokenRes.text()}`);
    const { access_token } = await tokenRes.json();

    // 토큰으로 회원번호·닉네임만 받고, 토큰은 저장하지 않고 버린다.
    const meRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!meRes.ok) throw new Error(`me ${meRes.status} ${await meRes.text()}`);
    const me = await meRes.json();
    const nickname = me.kakao_account?.profile?.nickname ?? me.properties?.nickname ?? null;

    // 처음 온 사람이면 만들고, 이미 있으면 닉네임만 갱신(upsert).
    const [user] = await sql`
      insert into users (kakao_id, nickname) values (${me.id}, ${nickname})
      on conflict (kakao_id) do update set nickname = excluded.nickname
      returning id`;

    return back(req, 'ok', [await createSession(req, user.id)]);
  } catch (e) {
    console.error(e);
    return back(req, 'fail');
  }
}

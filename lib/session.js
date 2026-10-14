// 로그인 상태(세션) 다루기.
// 쿠키에는 임의의 토큰 원본을, DB 에는 그 해시만 둔다.
import { createHash, randomBytes } from 'node:crypto';
import { sql } from './db.js';

const COOKIE = 'sid';
const DAYS = 30;

const hash = (token) => createHash('sha256').update(token).digest('hex');

export function readCookie(req, name) {
  for (const part of (req.headers.get('cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

/** HttpOnly: JS 로 못 읽어 스크립트 주입에 털리지 않는다.
    SameSite=Lax: 다른 사이트에서 보낸 POST 에는 쿠키가 실리지 않는다.
    Secure 는 https 에서만 붙인다. 로컬(http://localhost)에서도 로그인해 보려고. */
export function cookie(req, name, value, maxAge) {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/** 새 세션을 만들고 심을 쿠키를 돌려준다. 이참에 그 사람의 만료된 세션도 지운다. */
export async function createSession(req, userId) {
  const token = randomBytes(32).toString('base64url');
  await sql`delete from sessions where user_id = ${userId} and expires_at < now()`;
  await sql`insert into sessions (token_hash, user_id, expires_at)
            values (${hash(token)}, ${userId}, now() + make_interval(days => ${DAYS}))`;
  return cookie(req, COOKIE, token, DAYS * 86400);
}

/** 쿠키로 로그인한 사람을 찾는다. 없거나 만료됐으면 null. */
export async function currentUser(req) {
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  const [user] = await sql`
    select u.id, u.nickname from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${hash(token)} and s.expires_at > now()`;
  return user || null;
}

/** 세션을 DB 에서 지우고, 쿠키를 지우는 헤더 값을 돌려준다. */
export async function destroySession(req) {
  const token = readCookie(req, COOKIE);
  if (token) await sql`delete from sessions where token_hash = ${hash(token)}`;
  return cookie(req, COOKIE, '', 0);
}

/** 쓰기 요청(POST·PUT·DELETE)이 우리 사이트에서 온 것인지. SameSite 에 더한 2중 방어. */
export function sameOrigin(req) {
  return req.headers.get('origin') === new URL(req.url).origin;
}

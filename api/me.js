// 지금 로그인한 사람. 로그인 안 했으면 401.
import { currentUser } from '../lib/session.js';
import { json } from '../lib/http.js';

export async function GET(req) {
  const user = await currentUser(req);
  if (!user) return json({ user: null }, { status: 401 });
  return json({ user: { nickname: user.nickname } });
}

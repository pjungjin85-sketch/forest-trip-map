// 지금 로그인한 사람. 로그인 안 했으면 401.
import { currentUser } from '../lib/session.js';

export async function GET(req) {
  const user = await currentUser(req);
  if (!user) return Response.json({ user: null }, { status: 401 });
  return Response.json({ user: { nickname: user.nickname } });
}

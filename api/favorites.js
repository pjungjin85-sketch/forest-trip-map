// 내 즐겨찾기 휴양림 id 목록. 최근에 넣은 것부터.
import { sql } from '../lib/db.js';
import { json } from '../lib/http.js';
import { currentUser } from '../lib/session.js';

export async function GET(req) {
  const user = await currentUser(req);
  if (!user) return json({ error: 'login' }, { status: 401 });
  const rows = await sql`
    select forest_id from favorites where user_id = ${user.id} order by created_at desc`;
  return json({ ids: rows.map((r) => r.forest_id) });
}

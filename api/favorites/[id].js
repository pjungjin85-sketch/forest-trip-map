// 즐겨찾기 넣기(PUT)·빼기(DELETE). 주소의 마지막 칸이 휴양림 id.
// 둘 다 여러 번 보내도 결과가 같다(멱등). 네트워크가 불안해 다시 보내도 안전하다.
import { sql } from '../../lib/db.js';
import { json } from '../../lib/http.js';
import { currentUser, sameOrigin } from '../../lib/session.js';

// forests.json 의 id 는 '0111' 이나 'ID02030100' 꼴이다.
const ID = /^[A-Za-z0-9]{1,20}$/;
// 한 사람이 넣을 수 있는 개수. 휴양림이 200곳 남짓이라 넉넉하다.
const MAX = 500;

async function guard(req) {
  if (!sameOrigin(req)) return { error: json({ error: 'origin' }, { status: 403 }) };
  const id = decodeURIComponent(new URL(req.url).pathname.split('/').pop());
  if (!ID.test(id)) return { error: json({ error: 'id' }, { status: 400 }) };
  const user = await currentUser(req);
  if (!user) return { error: json({ error: 'login' }, { status: 401 }) };
  return { id, user };
}

export async function PUT(req) {
  const { error, id, user } = await guard(req);
  if (error) return error;
  const [{ n }] = await sql`select count(*)::int as n from favorites where user_id = ${user.id}`;
  if (n >= MAX) return json({ error: 'full' }, { status: 409 });
  // 이미 있으면 아무 일도 하지 않는다. 기본키(user_id, forest_id)가 중복을 막는다.
  await sql`insert into favorites (user_id, forest_id) values (${user.id}, ${id})
            on conflict do nothing`;
  return new Response(null, { status: 204 });
}

export async function DELETE(req) {
  const { error, id, user } = await guard(req);
  if (error) return error;
  await sql`delete from favorites where user_id = ${user.id} and forest_id = ${id}`;
  return new Response(null, { status: 204 });
}

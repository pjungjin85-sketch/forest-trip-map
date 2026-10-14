// DB 연결 확인용. 배포 후 /api/health 를 열어 ok 가 나오면 연결된 것이다.
import { sql } from '../lib/db.js';

export async function GET() {
  try {
    const [row] = await sql`select now() as now, (select count(*) from users)::int as users`;
    return Response.json({ ok: true, ...row });
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false }, { status: 500 });
  }
}

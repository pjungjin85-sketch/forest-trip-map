// schema.sql 을 Neon 에 적용한다. 사용법: npm run migrate
// Neon 의 HTTP 연결은 한 번에 문장 하나만 받으므로 ; 로 나눠 차례로 보낸다.
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const text = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
  .replace(/--.*$/gm, '');

for (const stmt of text.split(';').map((s) => s.trim()).filter(Boolean)) {
  await sql.query(stmt);
  console.log('적용:', stmt.split('\n')[0]);
}
console.log('완료');

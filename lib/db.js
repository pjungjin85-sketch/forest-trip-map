import { neon } from '@neondatabase/serverless';

// HTTP 로 쿼리를 보내는 연결. 함수가 매번 새로 떠도 연결을 맺고 끊는 비용이 작다.
export const sql = neon(process.env.DATABASE_URL);

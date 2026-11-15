import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const convs = await sql`SELECT id, title, updated_at, msg_count, model_hint FROM conversations ORDER BY updated_at DESC LIMIT 5`.catch(()=>null);
const convs2 = convs ?? await sql`SELECT id, title, updated_at, msg_count FROM conversations ORDER BY updated_at DESC LIMIT 5`;
console.log(JSON.stringify(convs2, null, 1));

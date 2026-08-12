import { Client } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const res = await client.query(
  `select table_name from information_schema.tables where table_schema = 'public' order by table_name`
);
console.log(res.rows.map((r) => r.table_name).join("\n"));
await client.end();

// Set a user's plan tier. Usage:
//   node --env-file=.env scripts/set-plan.mjs <email> <free|pro>
// Plans are changed server-side only; nothing client-facing can set them.
const email = process.argv[2];
const plan = process.argv[3];

if (!email || !plan) {
  console.error("Usage: node --env-file=.env scripts/set-plan.mjs <email> <free|pro>");
  process.exit(1);
}
if (!["free", "pro"].includes(plan)) {
  console.error(`Invalid plan "${plan}" — expected "free" or "pro".`);
  process.exit(1);
}

const { neon } = await import("@neondatabase/serverless");
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required (run with --env-file=.env).");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const rows = await sql`
  UPDATE "user"
  SET plan = ${plan}, updated_at = now()
  WHERE lower(email) = ${email.toLowerCase()}
  RETURNING id, email, plan
`;

if (rows.length === 0) {
  console.error(`No user found with email ${email}`);
  process.exit(1);
}
console.log(`Updated: ${rows[0].email} → plan "${rows[0].plan}" (id ${rows[0].id})`);

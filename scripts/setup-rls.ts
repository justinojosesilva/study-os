import "dotenv/config";
import { sql } from "drizzle-orm";
import { adminDb } from "../src/infra/db/client";

/**
 * Sets up Row-Level Security: a restricted app role + per-tenant isolation
 * policies on every data table. Idempotent. Run as the DB owner/superuser
 * (uses DATABASE_URL). For Neon/prod, run once against the prod database.
 */

const TENANT_TABLES = [
  "goals",
  "topics",
  "study_sessions",
  "materials",
  "flashcards",
  "flashcard_reviews",
  "certifications",
  "resume_profiles",
  "resume_experiences",
  "resume_projects",
  "lessons",
  "notes",
  "reading_progress",
  "exams",
  "exam_questions",
  "tutor_answers",
  "ai_usage",
  "assignments",
];

// The restricted app role's password. In prod set APP_DB_PASSWORD; the app
// connects via APP_DATABASE_URL, which must match.
const APP_PASSWORD = process.env.APP_DB_PASSWORD || "studyos_app";

async function main() {
  console.log("Criando role restrito studyos_app…");
  await adminDb.execute(
    sql.raw(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'studyos_app') THEN
        CREATE ROLE studyos_app LOGIN PASSWORD '${APP_PASSWORD}';
      ELSE
        ALTER ROLE studyos_app LOGIN PASSWORD '${APP_PASSWORD}';
      END IF;
    END $$;
  `),
  );

  console.log("Concedendo privilégios…");
  await adminDb.execute(sql.raw(`GRANT USAGE ON SCHEMA public TO studyos_app;`));
  await adminDb.execute(
    sql.raw(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO studyos_app;`),
  );
  await adminDb.execute(
    sql.raw(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO studyos_app;`),
  );
  await adminDb.execute(
    sql.raw(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO studyos_app;`,
    ),
  );

  // O `nullif` na política não é enfeite: num backend que já teve o GUC
  // definido, resetá-lo deixa STRING VAZIA, não NULL — e `''::uuid` lança
  // exceção. Sem o nullif, uma consulta sem owner definido QUEBRA em vez de
  // devolver 0 linhas, que é a propriedade que a arquitetura promete. Falha
  // fechada nos dois casos, mas só uma delas é a documentada.
  console.log("Aplicando RLS por tabela…");
  for (const t of TENANT_TABLES) {
    await adminDb.execute(sql.raw(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`));
    await adminDb.execute(sql.raw(`DROP POLICY IF EXISTS owner_isolation ON ${t};`));
    await adminDb.execute(
      sql.raw(`
      CREATE POLICY owner_isolation ON ${t}
        USING (owner_id = nullif(current_setting('app.owner_id', true), '')::uuid)
        WITH CHECK (owner_id = nullif(current_setting('app.owner_id', true), '')::uuid);
    `),
    );
    console.log(`  ✓ ${t}`);
  }

  console.log("\nRLS pronto. O app deve conectar via APP_DATABASE_URL (studyos_app).");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

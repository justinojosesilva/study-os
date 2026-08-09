import "dotenv/config";
import postgres from "postgres";

/**
 * Aplica RLS a UMA tabela, nomeada no argumento.
 *
 * POR QUE NÃO USAR `db:rls`. Aquele script varre todas as tabelas e, de
 * quebra, executa `ALTER ROLE studyos_app PASSWORD …`. Rodá-lo em produção só
 * para ligar RLS numa tabela nova troca a senha do role da aplicação — um
 * estrago desproporcional ao objetivo. Toda tabela criada depois do setup
 * inicial deve passar por aqui.
 *
 *   npx tsx scripts/rls-table.ts ai_usage
 *
 * Lê DATABASE_URL do `.env` (o dono do banco), porque criar política exige ser
 * dono da tabela — `studyos_app` não é. Idempotente: pode rodar de novo.
 */

const TABELA = process.argv[2];

// Nome de tabela entra em SQL por interpolação (identificador não aceita
// parâmetro), então a validação é a defesa. Só o que o schema de fato usa.
if (!TABELA || !/^[a-z][a-z0-9_]*$/.test(TABELA)) {
  console.error("Uso: npx tsx scripts/rls-table.ts <nome_da_tabela>");
  process.exit(1);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL não está definida. Ela é lida do .env.");
    process.exit(1);
  }

  // O host é confirmado em voz alta: o mesmo comando serve para local e para
  // produção, e a diferença entre os dois é uma variável de ambiente.
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    // Sem interpolar o valor — foi exatamente assim que uma senha já vazou.
    console.error("DATABASE_URL não é uma URL de conexão válida.");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });

  const [existe] = await sql`
    select exists(
      select 1 from information_schema.tables
       where table_schema = 'public' and table_name = ${TABELA}
    ) as ok`;
  if (!existe.ok) {
    console.error(`Tabela "${TABELA}" não existe em ${host}. Rode a migração primeiro.`);
    await sql.end();
    process.exit(1);
  }

  console.log(`Aplicando RLS em ${TABELA} @ ${host}…`);

  await sql.unsafe(`ALTER TABLE ${TABELA} ENABLE ROW LEVEL SECURITY;`);
  await sql.unsafe(`DROP POLICY IF EXISTS owner_isolation ON ${TABELA};`);
  // O `nullif` não é enfeite: resetar o GUC deixa STRING VAZIA, não NULL, e
  // `''::uuid` lança exceção. Sem ele, consulta sem dono definido QUEBRA em vez
  // de devolver 0 linhas — falha fechada nos dois casos, mas só uma é a
  // documentada. Idêntico ao de `setup-rls.ts`; mudou lá, muda aqui.
  await sql.unsafe(`
    CREATE POLICY owner_isolation ON ${TABELA}
      USING (owner_id = nullif(current_setting('app.owner_id', true), '')::uuid)
      WITH CHECK (owner_id = nullif(current_setting('app.owner_id', true), '')::uuid);
  `);
  await sql.unsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${TABELA} TO studyos_app;`);

  const [linha] = await sql`
    select c.relrowsecurity as rls,
           (select count(*)::int from pg_policies
             where schemaname = 'public' and tablename = ${TABELA}) as politicas
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where c.relname = ${TABELA} and n.nspname = 'public'`;

  console.log(`  RLS ligado: ${linha.rls} · políticas: ${linha.politicas}`);
  if (!linha.rls || linha.politicas === 0) {
    console.error("  FALHOU: a tabela ficou sem proteção.");
    await sql.end();
    process.exit(1);
  }
  console.log("  ok");
  await sql.end();
  process.exit(0);
}

main().catch((e) => {
  console.error("erro:", e.message);
  process.exit(1);
});

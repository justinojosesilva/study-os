import "dotenv/config";
import postgres from "postgres";

/**
 * Prova, em vez de supor, que o isolamento por tenant está ATIVO.
 *
 * O `setup-rls.ts` cria papel e políticas; isto verifica que a aplicação de
 * fato passa por elas. São coisas diferentes: a infraestrutura pode estar
 * perfeita e o app conectar pelo papel dono, que tem BYPASSRLS — e aí nada do
 * que foi configurado vale. Foi exatamente essa a dúvida que o diagnóstico não
 * conseguiu responder de fora.
 *
 * Conecta pela MESMA variável que o app usa (APP_DATABASE_URL) e faz três
 * perguntas cuja resposta só pode vir do banco:
 *
 *   1. sem `app.owner_id` definido        → tem de ver 0 linhas
 *   2. com um `app.owner_id` de outra pessoa → tem de ver 0 linhas
 *   3. com o `app.owner_id` correto        → tem de ver as linhas
 *
 * Se o papel tiver BYPASSRLS, os três passos retornam tudo, e o script falha
 * dizendo isso. Nenhuma credencial é impressa.
 *
 *   npm run db:verify-rls
 */

const TABELA = "goals"; // qualquer tabela de tenant serve
const OUTRO_DONO = "00000000-0000-0000-0000-000000000000";

function encerrar(ok: boolean, msg: string): never {
  console.log(`\n${ok ? "✓" : "✗"} ${msg}`);
  process.exit(ok ? 0 : 1);
}

async function main() {
  const url = process.env.APP_DATABASE_URL;
  if (!url) {
    encerrar(false, "APP_DATABASE_URL não está definida. É ela que o app usa em runtime.");
  }
  if (url === process.env.DATABASE_URL) {
    encerrar(
      false,
      "APP_DATABASE_URL é IGUAL a DATABASE_URL — o app conecta como dono e o RLS não se aplica.",
    );
  }

  const sql = postgres(url, {
    ssl: url.includes("localhost") ? false : "require",
    max: 1,
    prepare: false,
  });

  try {
    const [{ current_user: papel }] = await sql<{ current_user: string }[]>`select current_user`;
    const [{ rolbypassrls: bypassa }] = await sql<{ rolbypassrls: boolean }[]>`
      select rolbypassrls from pg_roles where rolname = current_user`;

    console.log(`papel em uso: ${papel}`);
    console.log(`BYPASSRLS:    ${bypassa}`);

    if (bypassa) {
      encerrar(
        false,
        `O papel "${papel}" tem BYPASSRLS. As políticas existem mas NÃO são aplicadas — ` +
          `aponte APP_DATABASE_URL para o papel restrito (studyos_app).`,
      );
    }

    // 1 — sem owner definido
    const [semDono] = await sql<{ n: number }[]>`
      select count(*)::int as n from ${sql(TABELA)}`;

    // 2 e 3 — dentro de transação, que é onde o app define o GUC
    let outro = -1;
    let correto = -1;
    let donoReal: string | null = null;

    await sql.begin(async (tx) => {
      await tx`select set_config('app.owner_id', ${OUTRO_DONO}, true)`;
      [{ n: outro }] = await tx<{ n: number }[]>`select count(*)::int as n from ${tx(TABELA)}`;
    });

    // Descobre um owner real pelo papel dono, só para o passo 3 ter alvo.
    const admin = postgres(process.env.DATABASE_URL!, {
      ssl: process.env.DATABASE_URL!.includes("localhost") ? false : "require",
      max: 1,
      prepare: false,
    });
    try {
      const linhas = await admin<{ owner_id: string }[]>`
        select owner_id from ${admin(TABELA)} limit 1`;
      donoReal = linhas[0]?.owner_id ?? null;
    } finally {
      await admin.end({ timeout: 5 });
    }

    if (donoReal) {
      await sql.begin(async (tx) => {
        await tx`select set_config('app.owner_id', ${donoReal}, true)`;
        [{ n: correto }] = await tx<{ n: number }[]>`select count(*)::int as n from ${tx(TABELA)}`;
      });
    }

    console.log(`\ntabela testada: ${TABELA}`);
    console.log(`  sem app.owner_id definido     → ${semDono.n} linha(s)   (esperado 0)`);
    console.log(`  com app.owner_id de terceiro  → ${outro} linha(s)   (esperado 0)`);
    console.log(
      `  com app.owner_id correto      → ${correto} linha(s)   (esperado > 0)` +
        (donoReal ? "" : "   [pulado: tabela vazia]"),
    );

    const falhas: string[] = [];
    if (semDono.n !== 0) falhas.push("viu linhas sem owner definido");
    if (outro !== 0) falhas.push("viu linhas de outro dono");
    if (donoReal && correto === 0) falhas.push("NÃO viu as próprias linhas — política restritiva demais");

    if (falhas.length > 0) encerrar(false, `RLS NÃO está isolando: ${falhas.join("; ")}.`);
    encerrar(true, "RLS ativo e isolando corretamente.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error("falhou:", e instanceof Error ? e.message : e);
  process.exit(1);
});

import "dotenv/config";
import postgres from "postgres";

/**
 * Define o teto de IA de UMA pessoa, em dólares.
 *
 *   npx tsx scripts/set-ai-limit.ts alguem@exemplo.com 1 5
 *   npx tsx scripts/set-ai-limit.ts alguem@exemplo.com padrao
 *
 * O primeiro número é o teto diário, o segundo o mensal. `padrao` limpa os dois
 * e devolve a pessoa ao limite da instalação (as variáveis de ambiente).
 *
 * Existe como script e não como tela porque o app não tem área administrativa —
 * quem convida alguém é o dono, direto no banco. Se um dia houver mais de um
 * administrador, isto vira tela; até lá, tela seria enfeite.
 *
 * Lê DATABASE_URL do `.env`: alterar `users` exige o dono do banco, e o role da
 * aplicação não deveria poder mudar o próprio teto.
 */

const [emailArg, aArg, bArg] = process.argv.slice(2);

function uso(): never {
  console.error("Uso: npx tsx scripts/set-ai-limit.ts <email> <dolares/dia> <dolares/mes>");
  console.error("     npx tsx scripts/set-ai-limit.ts <email> padrao");
  process.exit(1);
}

if (!emailArg || !aArg) uso();

const limpar = aArg.toLowerCase() === "padrao";
let diaMicros: number | null = null;
let mesMicros: number | null = null;

if (!limpar) {
  if (!bArg) uso();
  const dia = Number(aArg);
  const mes = Number(bArg);
  if (!Number.isFinite(dia) || !Number.isFinite(mes) || dia < 0 || mes < 0) {
    console.error("Os tetos precisam ser numeros nao negativos, em dolares.");
    process.exit(1);
  }
  if (dia > mes) {
    // Nao e erro de banco, e erro de intencao: um teto diario maior que o
    // mensal nunca chega a valer, porque o mensal barra antes.
    console.error(`Teto diario (${dia}) maior que o mensal (${mes}) — o mensal barraria antes.`);
    process.exit(1);
  }
  diaMicros = Math.round(dia * 1_000_000);
  mesMicros = Math.round(mes * 1_000_000);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL nao esta definida. Ela e lida do .env.");
    process.exit(1);
  }
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    // Sem interpolar o valor — e assim que senha vaza para log.
    console.error("DATABASE_URL nao e uma URL de conexao valida.");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  const email = emailArg.trim().toLowerCase();

  const [antes] = await sql`
    select id, email, ai_daily_limit_micros as dia, ai_monthly_limit_micros as mes
      from users where lower(email) = ${email}`;
  if (!antes) {
    console.error(`Nenhum usuario com email ${email} em ${host}.`);
    await sql.end();
    process.exit(1);
  }

  const fmt = (v: number | null) => (v == null ? "padrao da instalacao" : `US$ ${(v / 1e6).toFixed(2)}`);
  console.log(`${antes.email} @ ${host}`);
  console.log(`  antes:  dia ${fmt(antes.dia)} . mes ${fmt(antes.mes)}`);

  await sql`
    update users
       set ai_daily_limit_micros = ${diaMicros}, ai_monthly_limit_micros = ${mesMicros}
     where id = ${antes.id}`;

  const [depois] = await sql`
    select ai_daily_limit_micros as dia, ai_monthly_limit_micros as mes
      from users where id = ${antes.id}`;
  console.log(`  depois: dia ${fmt(depois.dia)} . mes ${fmt(depois.mes)}`);
  console.log("  ok");

  await sql.end();
  process.exit(0);
}

main().catch((e) => {
  console.error("erro:", e.message);
  process.exit(1);
});

import NextAuth, { type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";
import { db } from "@/infra/db/client";
import { users } from "@/infra/db/schema";
import { TETO_NOVO_USUARIO } from "@/domain/ai/usage";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

/**
 * Quem tem permissão de entrar, por e-mail, vindo de `AUTH_ALLOWED_EMAILS`
 * (separados por vírgula).
 *
 * ISTO FECHA UMA PORTA QUE ESTAVA ABERTA. Antes, qualquer conta do GitHub que
 * fizesse login ganhava uma linha em `users` — e com ela acesso a 11 endpoints
 * de IA sem cota nenhuma, faturados na conta da Anthropic do dono. O app
 * responde publicamente; só não foi usado por ninguém porque a URL não é
 * conhecida. Segurança por obscuridade não é segurança.
 *
 * FALHA FECHADA de propósito: variável ausente ou vazia = ninguém entra. O
 * modo perigoso não pode ser o padrão de um esquecimento — prefiro que o app
 * fique inacessível a que ele fique aberto.
 */
function allowedEmails(): Set<string> {
  return new Set(
    (process.env.AUTH_ALLOWED_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [GitHub],
  callbacks: {
    /**
     * O portão. Roda ANTES do `jwt`, então uma conta negada nem chega a criar
     * linha em `users`.
     */
    signIn({ user }) {
      const email = user.email?.trim().toLowerCase();
      if (!email) return false; // GitHub sem e-mail público: não dá para autorizar
      const permitidos = allowedEmails();
      if (permitidos.size === 0) {
        console.error(
          "AUTH_ALLOWED_EMAILS não está definida — login negado. " +
            "Defina a variável com os e-mails autorizados, separados por vírgula.",
        );
        return false;
      }
      return permitidos.has(email);
    },
    /**
     * On sign-in, map the GitHub identity to our own users row (by email) and
     * stash OUR internal user id in the token. This is the whole bridge between
     * the auth provider and the domain — everything else keys off this id.
     * DB access here runs in the Node route handler, not the edge.
     */
    async jwt({ token, user }) {
      // Cinto e suspensório: o `signIn` já barrou quem não pode, mas a criação
      // da linha em `users` é o efeito irreversível — vale reconferir aqui.
      if (user?.email && allowedEmails().has(user.email.trim().toLowerCase())) {
        const [row] = await db
          .insert(users)
          .values({
            email: user.email,
            name: user.name ?? null,
            // O teto entra JUNTO com a linha. Antes ele só podia ser definido
            // depois do primeiro login, e nessa janela a pessoa nova usava o
            // padrão da instalação — o teto do dono, na fatura do dono.
            aiDailyLimitMicros: TETO_NOVO_USUARIO.dia,
            aiMonthlyLimitMicros: TETO_NOVO_USUARIO.mes,
          })
          .onConflictDoUpdate({
            target: users.email,
            // Só o nome. Os tetos ficam de fora de propósito: relogar não pode
            // desfazer um limite que o dono ajustou com `db:ai-limit`.
            set: { name: user.name ?? null },
          })
          .returning({ id: users.id });
        token.uid = row.id;
      }
      return token;
    },
    session({ session, token }) {
      const uid = token.uid as string | undefined;
      if (uid) session.user.id = uid;
      return session;
    },
  },
});

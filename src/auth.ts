import NextAuth, { type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";
import { db } from "@/infra/db/client";
import { users } from "@/infra/db/schema";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [GitHub],
  callbacks: {
    /**
     * On sign-in, map the GitHub identity to our own users row (by email) and
     * stash OUR internal user id in the token. This is the whole bridge between
     * the auth provider and the domain — everything else keys off this id.
     * DB access here runs in the Node route handler, not the edge.
     */
    async jwt({ token, user }) {
      if (user?.email) {
        const [row] = await db
          .insert(users)
          .values({ email: user.email, name: user.name ?? null })
          .onConflictDoUpdate({
            target: users.email,
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

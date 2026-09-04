import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import type { DefaultSession } from "next-auth";
import { isAuthorizedGithubId } from "./app/lib/github-admin";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      authorization: { params: { scope: "read:user" } },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  callbacks: {
    signIn({ account }) {
      return (
        account?.provider === "github" &&
        Boolean(account.providerAccountId) &&
        isAuthorizedGithubId(account.providerAccountId)
      );
    },
    jwt({ token, account }) {
      if (account?.provider === "github") {
        token.githubId = account.providerAccountId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.githubId = String(token.githubId ?? "");
      return session;
    },
  },
});

declare module "next-auth" {
  interface User {
    githubId?: string;
  }

  interface Session {
    user: {
      githubId: string;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    githubId?: string;
  }
}


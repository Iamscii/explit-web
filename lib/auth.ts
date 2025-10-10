import { PrismaAdapter } from "@auth/prisma-adapter"
import type { NextAuthOptions, Session } from "next-auth"
import { getServerSession } from "next-auth"
import GithubProvider from "next-auth/providers/github"
import GoogleProvider from "next-auth/providers/google"

import prisma from "@/lib/prisma"

const githubClientId = process.env.GITHUB_ID ?? ""
const githubClientSecret = process.env.GITHUB_SECRET ?? ""
const googleClientId = process.env.GOOGLE_CLIENT_ID ?? ""
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET ?? ""

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  providers: [
    GithubProvider({
      clientId: githubClientId,
      clientSecret: githubClientSecret,
    }),
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }

      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id
      }

      return token
    },
  },
}

export const getAuthSession = () => getServerSession(authOptions)

export type AppSession = Session

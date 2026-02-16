import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

/**
 * NextAuth v5 configuration with simple credentials login.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username as string;
        const password = credentials?.password as string;

        if (username === "admin" && password === "myfence26") {
          return {
            id: "1",
            name: "Admin",
            email: "admin@myfence.com",
          };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth: session }) {
      return !!session?.user;
    },
  },
});

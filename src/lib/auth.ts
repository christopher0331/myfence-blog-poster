import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * NextAuth v5 configuration with Google OAuth.
 * Only allows sign-in from authorized emails.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || "placeholder",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "placeholder",
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth: session }) {
      // Require authentication for all pages
      return !!session?.user;
    },
    async signIn({ user }) {
      // Optional: restrict to specific email addresses
      const allowedEmails = process.env.ALLOWED_EMAILS?.split(",").map((e) => e.trim());
      if (allowedEmails && allowedEmails.length > 0) {
        return allowedEmails.includes(user.email || "");
      }
      return true;
    },
  },
});

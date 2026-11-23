import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { env } from "./env";
import { authorizeCredentials, LoginRateLimitError } from "./login";
import { safeLocalRedirect } from "./security";

class LoginThrottled extends CredentialsSignin { code = "rate_limited"; }

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  secret: env.authSecret,
  trustHost: true,
  useSecureCookies: env.appUrl.startsWith("https://"),
  session: {
    strategy: "jwt",
    maxAge: env.sessionMaxAgeSeconds,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Work email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        try { return await authorizeCredentials(rawCredentials); }
        catch (error) {
          if (error instanceof LoginRateLimitError) throw new LoginThrottled();
          // Never put database errors, submitted credentials or secrets into Auth.js logs.
          console.error("[auth] Sign-in could not be completed.");
          return null;
        }
      },
    }),
  ],
  callbacks: {
    redirect({ url }) { return safeLocalRedirect(url, env.appUrl); },
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.platformAdmin = Boolean(
          (user as { isPlatformAdmin?: boolean }).isPlatformAdmin,
        );
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      session.user.isPlatformAdmin = Boolean(token.platformAdmin);
      return session;
    },
  },
}));

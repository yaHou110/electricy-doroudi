import type { NextAuthConfig } from "next-auth";

const authConfig = {
  providers: [],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname;
      const isPublicPage = pathname === "/login" || pathname.startsWith("/api/auth");
      const isApiRoute = pathname.startsWith("/api/");

      if (isPublicPage || isApiRoute) return true;
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;

export default authConfig;

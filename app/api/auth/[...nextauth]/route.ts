import NextAuth, { type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { linkParticipantByEmail, upsertCalendarConnection, upsertUser } from '@/lib/db';

const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly',
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    })
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user, account }) {
      console.log(`[Auth] Sign in attempt for ${user.email}`);
      if (!user.email) {
        console.log('[Auth] No email, rejecting sign in');
        return false;
      }
      
      const userId = await upsertUser(user.email, user.name);
      console.log(`[Auth] User ID: ${userId}`);
      
      await linkParticipantByEmail(user.email, userId);
      console.log(`[Auth] Linked participant by email`);
      
      if (account && account.provider === 'google' && account.access_token) {
        console.log(`[Auth] Saving calendar connection for ${user.email}, expires_at: ${account.expires_at}`);
        await upsertCalendarConnection(
          userId,
          account.provider,
          account.access_token,
          account.refresh_token ?? null,
          account.expires_at ?? null
        );
        console.log(`[Auth] Calendar connection saved`);
      } else {
        console.log(`[Auth] No access token to save. Account:`, account);
      }
      
      return true;
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.accessToken) {
        (session as any).accessToken = token.accessToken;
      }
      return session;
    }
  }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

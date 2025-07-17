import type { IronSessionOptions } from 'iron-session';
import type { JWT } from 'googleapis-common';

if (!process.env.AUTH_SECRET) {
  throw new Error('AUTH_SECRET environment variable is not set.');
}

export type SessionData = {
  google_tokens?: JWT['credentials'];
  github_token?: string;
  sheet_id?: string;
  redirectUrl?: string;
};

export const sessionOptions: IronSessionOptions = {
  password: process.env.AUTH_SECRET,
  cookieName: 'autotube-flow-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
};

declare module 'iron-session' {
  interface IronSessionData extends SessionData {}
}

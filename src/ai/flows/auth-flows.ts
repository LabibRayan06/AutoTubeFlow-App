'use server';

/**
 * @fileoverview Authentication flows for Google and GitHub.
 *
 * - getGoogleAuthUrl - Generates a URL for Google OAuth.
 * - connectGithub - Simulates a GitHub connection.
 * - forkRepo - Simulates forking a GitHub repo.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { google } from 'googleapis';
import { IronSession, getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { SessionData, sessionOptions } from '@/lib/session';


const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/youtube.upload'
];

function getGoogleOAuth2Client(redirectUri?: string) {
  if (!process.env.NEXT_PUBLIC_BASE_URL) {
    throw new Error('NEXT_PUBLIC_BASE_URL environment variable is not set.');
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID environment variable is not set.');
  }
  if (!process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_SECRET environment variable is not set.');
  }
  const defaultRedirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google/callback`;
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri || defaultRedirectUri
  );
}

const GetGoogleAuthUrlInputSchema = z.object({
  originalUrl: z.string().url(),
});

export const getGoogleAuthUrl = ai.defineFlow(
  {
    name: 'getGoogleAuthUrl',
    inputSchema: GetGoogleAuthUrlInputSchema,
    outputSchema: z.object({ url: z.string() }),
  },
  async ({ originalUrl }) => {
    const session: IronSession<SessionData> = await getIronSession(cookies(), sessionOptions);
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google/callback`;
    const oauth2Client = getGoogleOAuth2Client(redirectUri);

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_SCOPES,
      prompt: 'consent',
    });

    session.redirectUrl = originalUrl;
    await session.save();

    return { url };
  }
);


export const connectGithub = ai.defineFlow(
  {
    name: 'connectGithub',
    outputSchema: z.object({ success: z.boolean() }),
  },
  async () => {
    // In a real app, this would handle the OAuth flow with GitHub.
    // For now, we'll simulate a successful connection.
    return { success: true };
  }
);

export const forkRepo = ai.defineFlow(
  {
    name: 'forkRepo',
    outputSchema: z.object({ success: z.boolean() }),
  },
  async () => {
    // In a real app, this would use the GitHub API to fork a repository
    // and add secrets. For now, we'll simulate success.
    return { success: true };
  }
);

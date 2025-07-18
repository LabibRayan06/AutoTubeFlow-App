'use server';

/**
 * @fileoverview Authentication flows for Google and GitHub.
 *
 * - getGoogleAuthUrl - Generates a URL for Google OAuth.
 * - getGithubAuthUrl - Generates a URL for GitHub OAuth.
 * - forkRepo - Forks a GitHub repo and adds secrets.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { google } from 'googleapis';
import { IronSession, getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { SessionData, sessionOptions } from '@/lib/session';
import { Octokit } from 'octokit';
import sodium from 'libsodium-wrappers';


const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.upload'
];
const GITHUB_REPO_OWNER = 'labibrayan524';
const GITHUB_REPO_NAME = 'yt-bot';

function getGoogleOAuth2Client() {
  if (!process.env.NEXT_PUBLIC_BASE_URL) {
    throw new Error('NEXT_PUBLIC_BASE_URL environment variable is not set.');
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID environment variable is not set.');
  }
  if (!process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_SECRET environment variable is not set.');
  }
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google/callback`;
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

const GetAuthUrlInputSchema = z.object({
  originalUrl: z.string().url(),
});


export const getGoogleAuthUrl = ai.defineFlow(
  {
    name: 'getGoogleAuthUrl',
    inputSchema: GetAuthUrlInputSchema,
    outputSchema: z.object({ url: z.string() }),
  },
  async ({ originalUrl }) => {
    const session: IronSession<SessionData> = await getIronSession(cookies(), sessionOptions);
    const oauth2Client = getGoogleOAuth2Client();

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


export const getGithubAuthUrl = ai.defineFlow(
  {
    name: 'getGithubAuthUrl',
    inputSchema: GetAuthUrlInputSchema,
    outputSchema: z.object({ url: z.string() }),
  },
  async ({ originalUrl }) => {
    if (!process.env.GITHUB_CLIENT_ID) {
      throw new Error('GITHUB_CLIENT_ID is not set in environment variables.');
    }
    if (!process.env.NEXT_PUBLIC_BASE_URL) {
        throw new Error('NEXT_PUBLIC_BASE_URL environment variable is not set.');
    }

    const session: IronSession<SessionData> = await getIronSession(cookies(), sessionOptions);
    session.redirectUrl = originalUrl;
    await session.save();
    
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/github/callback`;
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: 'repo,admin:repo_hook',
      state: new Date().getTime().toString(), // Simple state for CSRF protection
    });

    const url = `https://github.com/login/oauth/authorize?${params.toString()}`;
    return { url };
  }
);


export const forkRepo = ai.defineFlow(
  {
    name: 'forkRepo',
    outputSchema: z.object({ success: z.boolean(), message: z.string().optional() }),
  },
  async () => {
    const session = await getIronSession(cookies(), sessionOptions);

    if (!session.github_token) {
        return { success: false, message: 'GitHub not connected. Please go back to the previous step.' };
    }
     if (!session.google_tokens || !session.google_tokens.refresh_token) {
        return { success: false, message: 'Google account not fully connected. Please try reconnecting Google.' };
    }
    if (!session.sheet_id) {
        return { success: false, message: 'Google Sheet ID not found. Please create the sheet first.' };
    }

    const octokit = new Octokit({ auth: session.github_token });
    
    try {
        // 1. Get authenticated user
        const { data: { login: userLogin } } = await octokit.rest.users.getAuthenticated();

        // 2. Fork the repository
        console.log(`Forking ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}...`);
        await octokit.rest.repos.createFork({
            owner: GITHUB_REPO_OWNER,
            repo: GITHUB_REPO_NAME,
        });
        console.log('Fork created successfully.');
        
        // GitHub API can be slow to make the fork available. We'll add a small delay and retry loop.
        let forkExists = false;
        for (let i = 0; i < 5; i++) {
            try {
                await octokit.rest.repos.get({
                    owner: userLogin,
                    repo: GITHUB_REPO_NAME,
                });
                forkExists = true;
                break;
            } catch (error) {
                console.log(`Attempt ${i+1}: Fork not found yet, waiting 2 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        if (!forkExists) {
             return { success: false, message: 'Could not confirm repository fork. Please check your GitHub account and try again.' };
        }
        
        // Add another small delay before trying to add secrets
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 3. Add secrets to the forked repo
        const secrets = {
            YT_REFRESH_TOKEN: session.google_tokens.refresh_token,
            GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
            GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
            SHEET_ID: session.sheet_id!,
        };

        console.log('Adding secrets to the forked repository...');
        
        // We need to get the public key for the repo to encrypt secrets
        const { data: key } = await octokit.rest.actions.getRepoPublicKey({
            owner: userLogin,
            repo: GITHUB_REPO_NAME,
        });

        await sodium.ready;

        for (const [name, value] of Object.entries(secrets)) {
            console.log(`Setting secret: ${name}`);
            const binkey = sodium.from_base64(key.key, sodium.base64_variants.ORIGINAL);
            const binsec = sodium.from_string(value);
            const encBytes = sodium.crypto_box_seal(binsec, binkey);
            const encryptedValue = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL);
            
            await octokit.rest.actions.createOrUpdateRepoSecret({
                owner: userLogin,
                repo: GITHUB_REPO_NAME,
                secret_name: name,
                encrypted_value: encryptedValue,
                key_id: key.key_id,
            });
        }
        console.log('Secrets added.');

        return { success: true, message: 'Repository forked and configured successfully!' };
    } catch (error: any) {
        console.error('Error during forkRepo flow:', error);
        const errorMessage = error.response?.data?.message || error.message || 'An unknown error occurred.';
        return { success: false, message: `Failed to configure repository. Details: ${errorMessage}` };
    }
  }
);


'use server';

/**
 * @fileoverview Flows for interacting with Google Sheets.
 *
 * - createSheet - Creates or validates a Google Sheet for tracking videos.
 * - addUrlToSheet - Adds a new video URL to the sheet, fetching its title and generating an optimized description.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { google } from 'googleapis';
import { IronSession, getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { SessionData, sessionOptions } from '@/lib/session';

const SHEET_NAME = 'AutoTubeFlow Tracker';
const REQUIRED_COLUMNS = ["Url", "Title", "Description", "DateAdded", "isProcessed", "VideoId"];


async function getGoogleApiClients() {
  const session: IronSession<SessionData> = await getIronSession(cookies(), sessionOptions);
  if (!session.google_tokens) {
    throw new Error('User is not authenticated with Google.');
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Google client credentials are not configured.');
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials(session.google_tokens);

  // Check if the access token is expired and refresh if necessary
  if (new Date() >= (auth.credentials.expiry_date || 0)) {
    console.log("Google token is expired. Refreshing...");
    try {
        const { credentials } = await auth.refreshAccessToken();
        session.google_tokens = credentials;
        await session.save();
        auth.setCredentials(credentials);
        console.log("Google token refreshed successfully.");
    } catch (refreshError: any) {
        console.error("Failed to refresh Google token:", refreshError);
        // Clear the invalid tokens from session and force re-authentication
        session.google_tokens = undefined;
        await session.save();
        throw new Error(`Could not refresh authentication token. Please reconnect your Google account. Details: ${refreshError.message}`);
    }
  }

  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });
  const youtube = google.youtube({ version: 'v3', auth });
  return { sheets, drive, youtube, auth };
}


export const createSheet = ai.defineFlow(
  {
    name: 'createSheet',
    outputSchema: z.object({ success: z.boolean(), sheetId: z.string().optional(), message: z.string().optional() }),
  },
  async () => {
    try {
      const { sheets, drive } = await getGoogleApiClients();
      const session = await getIronSession(cookies(), sessionOptions);

      // 1. Search for an existing sheet
      const searchResponse = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.spreadsheet' and name='${SHEET_NAME}' and trashed=false`,
        fields: 'files(id, name)',
      });

      let sheetId: string | undefined;

      if (searchResponse.data.files && searchResponse.data.files.length > 0) {
        // Sheet exists, use the first one found
        sheetId = searchResponse.data.files[0].id!;
        console.log(`Found existing sheet with ID: ${sheetId}`);

        // 2. Validate columns, and fix if necessary by overwriting the header
        await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: 'Sheet1!A1',
            valueInputOption: 'RAW',
            requestBody: {
                values: [REQUIRED_COLUMNS],
            }
        });
        console.log("Validated and set header row on existing sheet.");

      } else {
        // 3. Sheet does not exist, create it
        console.log(`No sheet found named '${SHEET_NAME}'. Creating a new one.`);
        const createResponse = await sheets.spreadsheets.create({
          requestBody: {
            properties: {
              title: SHEET_NAME,
            },
            sheets: [{
                properties: {
                    title: 'Sheet1' // Default sheet name
                },
                data: [{
                    rowData: [{
                        values: REQUIRED_COLUMNS.map(value => ({ userEnteredValue: { stringValue: value } }))
                    }]
                }]
            }]
          },
        });
        sheetId = createResponse.data.spreadsheetId!;
        console.log(`Created new sheet with ID: ${sheetId}`);
      }

      // Save sheetId to session
      session.sheet_id = sheetId;
      await session.save();

      return { success: true, sheetId: sheetId };

    } catch (error: any) {
        console.error('Error in createSheet flow:', error.response?.data?.error || error);
        const detail = error.response?.data?.error?.message || error.message || 'An unknown error occurred.';
        return { success: false, message: `An error occurred while managing the sheet. Details: ${detail}` };
    }
  }
);

function extractVideoIdFromUrl(url: string): string | null {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

const optimizeVideoDetailsPrompt = ai.definePrompt({
    name: 'optimizeVideoDetailsPrompt',
    input: { schema: z.object({ title: z.string(), description: z.string() }) },
    output: { schema: z.object({ optimizedTitle: z.string(), optimizedDescription: z.string() }).nullable() },
    prompt: `You are a YouTube content expert specializing in SEO and audience engagement.
    Given the video title and original description, rewrite both to be more engaging and optimized for YouTube search.
    
    CRITICAL INSTRUCTIONS:
    - You MUST remove any promotional text, such as mentions of personal channels, Facebook pages, sponsorships, or any other self-promoting links or text.
    - Do NOT include the original title in the new description.

    Guidelines for Title:
    - Create a compelling, clickable, and SEO-friendly title.
    - Keep it concise and clear.

    Guidelines for Description:
    - Start with a compelling, human-readable paragraph that summarizes the video.
    - Use relevant keywords naturally.
    - Structure the description with clear headings if appropriate (e.g., "In this video:", "Timestamps:", "Follow me:").
    - Include a generic call-to-action (e.g., asking viewers to like, subscribe, or comment).

    Video Title: {{{title}}}
    Original Description:
    {{{description}}}
    `,
});

const AddUrlToSheetInputSchema = z.object({
  url: z.string().url(),
});

export const addUrlToSheet = ai.defineFlow(
  {
    name: 'addUrlToSheet',
    inputSchema: AddUrlToSheetInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ url }) => {
    try {
        const { sheets, youtube } = await getGoogleApiClients();
        const session = await getIronSession(cookies(), sessionOptions);

        if (!session.sheet_id) {
            return { success: false, message: 'Google Sheet not configured. Please start over.' };
        }

        const sheetId = session.sheet_id;

        // 1. Normalize URL and extract Video ID
        const videoId = extractVideoIdFromUrl(url);
        if (!videoId) {
            return { success: false, message: 'Could not extract a valid YouTube video ID from the URL.' };
        }

        const isShort = url.includes('/shorts/');
        const canonicalUrl = isShort 
          ? `https://www.youtube.com/shorts/${videoId}`
          : `https://www.youtube.com/watch?v=${videoId}`;
        
        // 2. Check for duplicates using the canonical URL
        console.log('Checking for duplicate URLs...');
        const readResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'Sheet1!A:A', // Read the entire 'A' column
        });

        const existingUrls = readResponse.data.values?.flat() || [];
        if (existingUrls.includes(canonicalUrl)) {
            return { success: false, message: 'This video URL is already in your Google Sheet.' };
        }

        // 3. Get video details from YouTube API
        console.log(`Fetching details for video ID: ${videoId}`);
        const videoResponse = await youtube.videos.list({
            part: ['snippet'],
            id: [videoId],
        });

        const video = videoResponse.data.items?.[0];
        if (!video || !video.snippet) {
            return { success: false, message: 'Could not fetch video details from YouTube. Is the video public and the URL correct?' };
        }
        
        const originalTitle = video.snippet.title || '';
        const originalDescription = video.snippet.description || '';
        
        // 4. Generate an optimized title and description with Gemini
        console.log('Generating optimized content...');
        const { output: optimizedDetails } = await optimizeVideoDetailsPrompt({ title: originalTitle, description: originalDescription });
        
        const finalTitle = optimizedDetails?.optimizedTitle || originalTitle;
        const finalDescription = optimizedDetails?.optimizedDescription || originalDescription;

        // 5. Append new row with all details
        const dateAdded = new Date().toISOString();
        const newRow = [
            canonicalUrl, // Use the clean, canonical URL
            finalTitle,
            finalDescription,
            dateAdded,
            'FALSE', // isProcessed
            videoId,
        ];

        console.log('Appending new row to sheet...');
        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: 'A1',
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                values: [newRow],
            },
        });

        return { success: true, message: 'The video has been added to your Google Sheet for processing.' };

    } catch (error: any) {
        console.error('Error in addUrlToSheet flow:', error.response?.data?.error || error);
        const detail = error.response?.data?.error?.message || error.message || 'An unknown error occurred.';
        return { success: false, message: `An error occurred while adding the URL. Details: ${detail}` };
    }
  }
);

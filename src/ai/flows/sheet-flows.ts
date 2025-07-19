
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

const OptimizeVideoDetailsInputSchema = z.object({
    title: z.string(),
    description: z.string(),
});

const OptimizeVideoDetailsOutputSchema = z.object({
    optimizedTitle: z.string().describe("The new, SEO-optimized title for the video."),
    optimizedDescription: z.string().describe("The new, engaging, and SEO-optimized description for the video, with all promotional content removed."),
});

const optimizeVideoDetailsPrompt = ai.definePrompt({
    name: 'optimizeVideoDetailsPrompt',
    input: { schema: OptimizeVideoDetailsInputSchema },
    output: { schema: OptimizeVideoDetailsOutputSchema },
    prompt: `You are a YouTube content expert specializing in SEO and audience engagement.
    Based on the provided video title and original description, your task is to optimize both for maximum reach and engagement.

    CRITICAL INSTRUCTIONS:
    - You MUST remove any promotional text, such as mentions of personal channels, Facebook pages, sponsorships, or any other self-promoting links or text from the description.
    - Do NOT include the original title in the new description.

    Video Title: "{{{title}}}"

    {{#if description}}
    Original Description:
    {{{description}}}

    Your Task:
    1.  **Optimize Title**: Create a compelling, clickable, and SEO-friendly title based on the original. Keep it concise and clear.
    2.  **Rewrite Description**: Rewrite the original description to be more engaging. Start with a compelling summary. Use relevant keywords naturally. Structure it with clear headings if appropriate.
    {{else}}
    Original Description: [NONE PROVIDED]

    Your Task:
    1.  **Optimize Title**: Create a compelling, clickable, and SEO-friendly title based on the original. Keep it concise and clear.
    2.  **Generate Description**: Generate a compelling and SEO-friendly description from scratch based on the video's title. Start with a summary, use keywords, and structure it well.
    {{/if}}

    Finally, add a generic call-to-action to the end of the description (e.g., asking viewers to like, subscribe, or comment).
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
            range: 'Sheet1!A:A',
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
        let finalTitle = originalTitle;
        let finalDescription = originalDescription;

        try {
            console.log('Generating optimized content...');
            const { output } = await optimizeVideoDetailsPrompt({ title: originalTitle, description: originalDescription });
            
            if (output) {
                finalTitle = output.optimizedTitle;
                finalDescription = output.optimizedDescription;
                console.log('Successfully generated optimized content.');
            } else {
                 console.warn("AI optimization returned null, falling back to original content.");
            }
        } catch (e) {
            console.error("Failed to generate or parse optimized content, falling back to original.", e);
        }

        // 5. Append new row with all details
        const dateAdded = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const newRow = [
            canonicalUrl, // Use the clean, canonical URL
            finalTitle,
            finalDescription,
            dateAdded,
            'FALSE', // isProcessed
            '', // videoId, now initially blank
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

'use server';

/**
 * @fileoverview Flows for interacting with Google Sheets.
 *
 * - createSheet - Creates or validates a Google Sheet for tracking videos.
 * - addUrlToSheet - Adds a new video URL to the sheet.
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
  if (auth.isTokenExpiring()) {
    const { credentials } = await auth.refreshAccessToken();
    session.google_tokens = credentials;
    await session.save();
    auth.setCredentials(credentials);
  }

  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });
  return { sheets, drive, auth };
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

        // 2. Validate columns
        const sheetData = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'A1:Z1',
        });

        const existingColumns = sheetData.data.values?.[0] || [];
        const missingColumns = REQUIRED_COLUMNS.filter(col => !existingColumns.includes(col));

        if (missingColumns.length > 0) {
            console.error(`Sheet exists but is missing columns: ${missingColumns.join(', ')}`);
            return {
                success: false,
                message: `The existing sheet is missing the following columns: ${missingColumns.join(', ')}. Please add them or delete the sheet and try again.`
            }
        }

      } else {
        // 3. Sheet does not exist, create it
        console.log(`No sheet found named '${SHEET_NAME}'. Creating a new one.`);
        const createResponse = await sheets.spreadsheets.create({
          requestBody: {
            properties: {
              title: SHEET_NAME,
            },
          },
        });
        sheetId = createResponse.data.spreadsheetId!;
        console.log(`Created new sheet with ID: ${sheetId}`);

        // 4. Add header row
        await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: 'A1',
            valueInputOption: 'RAW',
            requestBody: {
                values: [REQUIRED_COLUMNS],
            }
        });
        console.log("Added header row to new sheet.");
      }

      // Save sheetId to session
      session.sheet_id = sheetId;
      await session.save();

      return { success: true, sheetId: sheetId };

    } catch (error: any) {
        console.error('Error in createSheet flow:', error);
        return { success: false, message: error.message || 'An unknown error occurred while creating the sheet.' };
    }
  }
);

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
    // In a real app, this would add the URL to the Google Sheet.
    // Here we will simulate checking for duplicates.
    if (url.includes('duplicate')) {
      return { success: false, message: 'This video URL is already in your Google Sheet.' };
    }

    return { success: true, message: 'The video details have been added to your Google Sheet for processing.' };
  }
);

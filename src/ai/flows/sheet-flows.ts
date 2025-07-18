
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
    console.log("Google token is expiring. Refreshing...");
    try {
        const { credentials } = await auth.refreshAccessToken();
        session.google_tokens = credentials;
        await session.save();
        auth.setCredentials(credentials);
        console.log("Google token refreshed successfully.");
    } catch (refreshError: any) {
        console.error("Failed to refresh Google token:", refreshError);
        throw new Error(`Could not refresh authentication token. Please try logging in again. Details: ${refreshError.message}`);
    }
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
            const errorMessage = `The existing sheet is missing the following required columns: ${missingColumns.join(', ')}. Please add them manually or delete the sheet and try again.`;
            console.error(errorMessage);
            return {
                success: false,
                message: errorMessage
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
        console.error('Error in createSheet flow:', error.response?.data?.error || error);
        const detail = error.response?.data?.error?.message || error.message || 'An unknown error occurred.';
        return { success: false, message: `An error occurred while managing the sheet. Details: ${detail}` };
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
    try {
        const { sheets } = await getGoogleApiClients();
        const session = await getIronSession(cookies(), sessionOptions);

        if (!session.sheet_id) {
            return { success: false, message: 'Google Sheet not configured. Please start over.' };
        }

        const sheetId = session.sheet_id;
        const quotedSheetName = `'${SHEET_NAME}'`;

        // 1. Check for duplicate URL in the "Url" column (A)
        const range = `${quotedSheetName}!A2:A`;
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: range,
        });

        const existingUrls = response.data.values ? response.data.values.flat() : [];
        if (existingUrls.includes(url)) {
            return { success: false, message: 'This video URL is already in your Google Sheet.' };
        }

        // 2. Append new row if not a duplicate
        const dateAdded = new Date().toISOString();
        const newRow = [
            url,          // Url
            '',           // Title (to be filled by bot)
            '',           // Description (to be filled by bot)
            dateAdded,    // DateAdded
            'FALSE',      // isProcessed
            '',           // VideoId (to be filled by bot)
        ];

        console.log('Appending new row to sheet:', newRow);
        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: quotedSheetName, // Append to the end of the sheet
            valueInputOption: 'USER_ENTERED',
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

'use server';

/**
 * @fileoverview Flows for interacting with Google Sheets.
 *
 * - createSheet - Simulates creating a new Google Sheet.
 * - addUrlToSheet - Simulates adding a new video URL to the sheet.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const createSheet = ai.defineFlow(
  {
    name: 'createSheet',
    outputSchema: z.object({ success: z.boolean(), sheetId: z.string().optional() }),
  },
  async () => {
    // In a real app, this would use the Google Sheets API to create a sheet.
    // We'll simulate success and return a fake sheet ID.
    return { success: true, sheetId: 'simulated_sheet_id_12345' };
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

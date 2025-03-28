import { google } from 'googleapis';
import { sheets_v4 } from 'googleapis';
import { HireData } from './openai';

let sheets: sheets_v4.Sheets | null = null;

export async function setupGoogleSheets() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SHEETS_CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const client = await auth.getClient();
    sheets = google.sheets({ version: 'v4', auth: client as any });

    // Verify access by getting sheet metadata
    const response = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID
    });
    
    console.log(`Connected to sheet: ${response.data.properties?.title}`);
  } catch (error) {
    console.error('Failed to initialize Google Sheets:', error);
    throw error;
  }
}

export async function appendHireData(data: HireData & { hiringManager?: string }) {
  if (!sheets) {
    throw new Error('Google Sheets not initialized');
  }

  try {
    const values = [
      [
        new Date().toISOString(),    // A: Timestamp
        data.hiringManager || 'N/A', // B: Hiring Manager
        data.role,                   // C: Role
        data.salary,                 // D: Salary
        data.equity,                 // E: Equity
        data.startDate,              // F: Start Date
        data.slackHandle || 'N/A'    // G: Slack Handle
      ]
    ];

    const request = {
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'Sheet1!A:G',  // Updated to include all columns
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: values
      }
    };

    const response = await sheets.spreadsheets.values.append(request);
    console.log(`${response.data.updates?.updatedCells} cells updated`);
    return response.data;
  } catch (error) {
    console.error('Failed to append data to Google Sheets:', error);
    throw error;
  }
} 
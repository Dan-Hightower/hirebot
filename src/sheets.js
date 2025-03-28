const { google } = require('googleapis');

let sheets = null;

async function setupGoogleSheets() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SHEETS_CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const client = await auth.getClient();
    sheets = google.sheets({ version: 'v4', auth: client });

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

async function appendHireData(initialData) {
  // Store the initial hire data but don't write to sheets yet
  return initialData;
}

async function createHireRecord(initialData, supplementalData) {
  if (!sheets) {
    throw new Error('Google Sheets not initialized');
  }

  try {
    const values = [
      [
        new Date().toISOString(),           // A: Timestamp
        initialData.hiringManager || 'N/A',  // B: Hiring Manager
        initialData.role,                    // C: Role
        initialData.salary,                  // D: Salary
        initialData.equity,                  // E: Equity
        initialData.startDate,               // F: Start Date
        initialData.slackHandle || 'N/A',    // G: Slack Handle
        supplementalData.fullName || '',     // H: Full Legal Name
        supplementalData.address || '',      // I: Address
        supplementalData.personalEmail || '', // J: Personal Email
        supplementalData.phoneNumber || '',   // K: Phone Number
        supplementalData.currentTitle || ''   // L: Current Job Title
      ]
    ];

    const request = {
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'Sheet1!A:L',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: values
      }
    };

    const response = await sheets.spreadsheets.values.append(request);
    console.log(`Created new hire record with ${response.data.updates?.updatedCells} cells`);
    return response.data;
  } catch (error) {
    console.error('Failed to create hire record in Google Sheets:', error);
    throw error;
  }
}

// Export the new interface
module.exports = {
  setupGoogleSheets,
  appendHireData,
  createHireRecord
}; 
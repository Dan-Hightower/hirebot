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

async function appendHireData(data) {
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
        data.slackHandle || 'N/A',   // G: Slack Handle
        data.fullName || '',         // H: Full Legal Name
        data.address || '',          // I: Address
        data.personalEmail || '',    // J: Personal Email
        data.phoneNumber || '',      // K: Phone Number
        data.currentTitle || ''      // L: Current Job Title
      ]
    ];

    const request = {
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'Sheet1!A:L',  // Updated to include all new columns
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

async function updateHireData(slackHandle, additionalData) {
  if (!sheets) {
    throw new Error('Google Sheets not initialized');
  }

  try {
    // First find the row with matching slack handle
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'Sheet1!A:L'
    });

    const rows = response.data.values;
    if (!rows) {
      throw new Error('No data found in sheet');
    }

    // Find the row index with matching slack handle (column G)
    const rowIndex = rows.findIndex(row => row[6] === slackHandle);
    if (rowIndex === -1) {
      throw new Error('Could not find hire record for ' + slackHandle);
    }

    // Update only the additional data columns (H-L)
    const range = `Sheet1!H${rowIndex + 1}:L${rowIndex + 1}`;
    const updateResponse = await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          additionalData.fullName || '',
          additionalData.address || '',
          additionalData.personalEmail || '',
          additionalData.phoneNumber || '',
          additionalData.currentTitle || ''
        ]]
      }
    });

    console.log(`Updated ${updateResponse.data.updatedCells} cells for ${slackHandle}`);
    return updateResponse.data;
  } catch (error) {
    console.error('Failed to update hire data in Google Sheets:', error);
    throw error;
  }
}

module.exports = {
  setupGoogleSheets,
  appendHireData,
  updateHireData
}; 
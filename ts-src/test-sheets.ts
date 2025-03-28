import dotenv from 'dotenv';
import { setupGoogleSheets, appendHireData } from './sheets';

// Load environment variables
dotenv.config();

async function testGoogleSheets() {
  try {
    console.log('🔄 Setting up Google Sheets connection...');
    await setupGoogleSheets();
    console.log('✅ Google Sheets setup successful!');

    console.log('🔄 Testing data append...');
    const testData = {
      hiringManager: '@testmanager',
      role: 'Test Engineer',
      salary: '$100,000',
      equity: '0.1%',
      startDate: '2024-04-01',
      slackHandle: '@testuser'
    };

    await appendHireData(testData);
    console.log('✅ Successfully added test data to sheet!');
    console.log('🎉 All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testGoogleSheets(); 
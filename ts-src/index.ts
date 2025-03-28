import { App } from '@slack/bolt';
import dotenv from 'dotenv';
import { handleHireMessage, handleConfirmHire, handleRejectHire } from './slack';
import { setupGoogleSheets } from './sheets';

// Load environment variables
dotenv.config();

// Initialize the Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

// Initialize Google Sheets
setupGoogleSheets();

// Listen for the hire command
app.message(/^\/hire/, handleHireMessage);

// Handle button actions
app.action('confirm_hire', handleConfirmHire);
app.action('reject_hire', handleRejectHire);

// Start the app
(async () => {
  await app.start();
  console.log('⚡️ Bolt app is running!');
})(); 
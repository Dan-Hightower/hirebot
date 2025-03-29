// Load environment variables first
const dotenv = require('dotenv');
dotenv.config();

// Verify environment variables are loaded
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);

const { App, ExpressReceiver } = require('@slack/bolt');
const { handleHireMessage, handleConfirmHire, handleRejectHire, handleSubmitHireInfo } = require('./slack');
const { setupGoogleSheets } = require('./sheets');
const { parseHireMessage } = require('./openai');

// Verify required environment variables
const requiredEnvVars = [
  'SLACK_BOT_TOKEN',
  'SLACK_SIGNING_SECRET',
  'GOOGLE_SHEETS_ID'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Initialize the receiver
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  processBeforeResponse: true
});

// Initialize the Slack app with HTTP mode
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver
});

// Initialize Google Sheets
let sheetsInitialized = false;
async function initializeGoogleSheets() {
  if (!sheetsInitialized) {
    try {
      await setupGoogleSheets();
      sheetsInitialized = true;
      console.log('Google Sheets initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Google Sheets:', error);
      throw error;
    }
  }
}

// Add root endpoint with status page
receiver.router.get('/', async (req, res) => {
  try {
    // Check Slack connection
    const authTest = await app.client.auth.test();
    // Check Google Sheets connection
    await initializeGoogleSheets();
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>HireBot Status</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 2rem;
              line-height: 1.5;
            }
            .status {
              padding: 1rem;
              border-radius: 8px;
              margin: 1rem 0;
              background-color: #e6ffe6;
              border: 1px solid #00cc00;
            }
            .status-header {
              display: flex;
              align-items: center;
              gap: 0.5rem;
            }
            .status-icon {
              font-size: 1.5rem;
            }
            h1 {
              color: #1a1a1a;
              margin-bottom: 2rem;
            }
            .details {
              margin-top: 1rem;
              padding: 1rem;
              background-color: #f5f5f5;
              border-radius: 8px;
            }
          </style>
        </head>
        <body>
          <h1>🤖 HireBot Status</h1>
          <div class="status">
            <div class="status-header">
              <span class="status-icon">✅</span>
              <h2>Bot is running properly!</h2>
            </div>
          </div>
          <div class="details">
            <p><strong>Connected to Slack as:</strong> ${authTest.user}</p>
            <p><strong>Team:</strong> ${authTest.team}</p>
            <p><strong>Environment:</strong> Google App Engine</p>
            <p><strong>Services Status:</strong></p>
            <ul>
              <li>✅ Slack Connection</li>
              <li>✅ Google Sheets Integration</li>
              <li>✅ OpenAI Integration</li>
            </ul>
          </div>
        </body>
      </html>
    `;
    res.send(html);
  } catch (error) {
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>HireBot Status - Error</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 2rem;
              line-height: 1.5;
            }
            .status {
              padding: 1rem;
              border-radius: 8px;
              margin: 1rem 0;
              background-color: #ffe6e6;
              border: 1px solid #cc0000;
            }
            .status-header {
              display: flex;
              align-items: center;
              gap: 0.5rem;
            }
            .status-icon {
              font-size: 1.5rem;
            }
            h1 {
              color: #1a1a1a;
              margin-bottom: 2rem;
            }
            .error-details {
              margin-top: 1rem;
              padding: 1rem;
              background-color: #f5f5f5;
              border-radius: 8px;
              font-family: monospace;
              white-space: pre-wrap;
            }
          </style>
        </head>
        <body>
          <h1>🤖 HireBot Status</h1>
          <div class="status">
            <div class="status-header">
              <span class="status-icon">❌</span>
              <h2>Bot is not running properly</h2>
            </div>
          </div>
          <div class="error-details">
            <p><strong>Error:</strong> ${error.message}</p>
            <p><strong>Stack:</strong>\n${error.stack}</p>
          </div>
        </body>
      </html>
    `;
    res.status(500).send(errorHtml);
  }
});

// Add health check endpoint for automated health checks
receiver.router.get('/health', (req, res) => {
  res.send('OK');
});

// Verify bot permissions
app.client.auth.test()
  .then(response => {
    console.log('Bot info:', {
      botId: response.bot_id,
      userId: response.user_id,
      teamId: response.team_id,
      botScopes: response.scopes || []
    });
  })
  .catch(error => {
    console.error('Error checking bot permissions:', error);
  });

// Handle /hire slash command
app.command('/hire', async ({ command, ack, respond }) => {
  // Acknowledge the command immediately
  await ack();
  console.log('Received hire command:', command);
  
  // Send initial response to user
  await respond({
    text: "Processing your request...",
    response_type: 'ephemeral'
  });
  
  // Process the request asynchronously
  try {
    await handleHireMessage({ 
      text: command.text, 
      user: command.user_id, 
      channel: command.channel_id,
      response_url: command.response_url // Pass response_url for later updates
    }, app.client);
  } catch (error) {
    console.error('Error handling hire command:', error);
    // Use response_url to update the message
    try {
      await app.client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: 'Sorry, something went wrong. Please try again or contact support.'
      });
    } catch (postError) {
      console.error('Error posting error message:', postError);
    }
  }
});

// Handle button actions
app.action('confirm_hire', async ({ body, ack }) => {
  await ack();
  await initializeGoogleSheets();
  await handleConfirmHire({ body, client: app.client });
});

app.action('reject_hire', async ({ body, ack }) => {
  await ack();
  await handleRejectHire({ body, client: app.client });
});

app.action('submit_hire_info', async ({ body, ack, client }) => {
  console.log('Submit hire info button clicked:', body);
  await ack();
  await initializeGoogleSheets();
  await handleSubmitHireInfo({ body, client });
});

// Handle modal submission
app.view('submit_hire_info', async ({ ack, body, view, client }) => {
  await ack();
  
  try {
    const metadata = JSON.parse(view.private_metadata);
    const values = view.state.values;
    
    // Create the submission data
    const submissionData = {
      fullName: values.full_name.full_name_input.value,
      address: values.address.address_input.value,
      personalEmail: values.personal_email.personal_email_input.value,
      phoneNumber: values.phone_number.phone_number_input.value,
      currentTitle: values.current_title?.current_title_input?.value || '',
      ...metadata
    };
    
    // Process the submission
    await handleSubmitHireInfo({
      body: {
        actions: [{
          value: JSON.stringify(metadata)
        }],
        state: {
          values: view.state.values
        },
        user: body.user,
        team: body.team,
        channel: body.channel
      },
      client
    });
    
    // Send a DM to confirm submission
    await client.chat.postMessage({
      channel: body.user.id,
      text: "Thanks for submitting your information! I'll process it right away."
    });
  } catch (error) {
    console.error('Error handling view submission:', error);
    await client.chat.postMessage({
      channel: body.user.id,
      text: `Sorry, there was an error processing your submission: ${error.message}`
    });
  }
});

// Error handling
app.error(async (error) => {
  console.error('An error occurred:', error);
});

// Start the app
(async () => {
  const port = process.env.PORT || 3000;
  await app.start(port);
  console.log(`⚡️ Slack bot is running on port ${port}!`);
})(); 
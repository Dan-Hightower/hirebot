// Load environment variables first
const dotenv = require('dotenv');
dotenv.config();

// Verify environment variables are loaded
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);

const { App } = require('@slack/bolt');
const { handleHireMessage, handleConfirmHire, handleRejectHire, handleSubmitHireInfo } = require('./slack');
const { setupGoogleSheets } = require('./sheets');
const { parseHireMessage } = require('./openai');
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

// Set up logging to file
const logStream = fs.createWriteStream('logs/app.log', { flags: 'a' });
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = function() {
  const timestamp = new Date().toISOString();
  const args = Array.from(arguments);
  const message = `[${timestamp}] ${args.join(' ')}\n`;
  logStream.write(message);
  originalConsoleLog.apply(console, args);
};

console.error = function() {
  const timestamp = new Date().toISOString();
  const args = Array.from(arguments);
  const message = `[${timestamp}] ERROR: ${args.join(' ')}\n`;
  logStream.write(message);
  originalConsoleError.apply(console, args);
};

// Verify required environment variables
const requiredEnvVars = [
  'SLACK_BOT_TOKEN',
  'SLACK_SIGNING_SECRET',
  'SLACK_APP_TOKEN',
  'GOOGLE_SHEETS_ID'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Initialize the Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  customRoutes: [
    {
      path: '/health',
      method: ['GET'],
      handler: (req, res) => {
        res.writeHead(200);
        res.end('Health check passed');
      },
    },
  ]
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

// Initialize Google Sheets
setupGoogleSheets().catch(error => {
  console.error('Failed to initialize Google Sheets:', error);
  process.exit(1);
});

// Handle /hire slash command
app.command('/hire', async ({ command, ack, respond }) => {
  await ack();
  console.log('Received hire command:', command);
  
  try {
    // Parse the message using OpenAI
    const parsedData = await parseHireMessage(command.text || '');
    const hiringManager = `<@${command.user_id}>`;
    const hireData = { ...parsedData, hiringManager };

    // Create confirmation message with more details
    const confirmationBlocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🎉 New Hire Details',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Hey ${hiringManager}! I've parsed your hiring request. Here's what I understood:`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Role:*\n${parsedData.role}`
          },
          {
            type: 'mrkdwn',
            text: `*Salary:*\n${parsedData.salary}`
          },
          {
            type: 'mrkdwn',
            text: `*Equity:*\n${parsedData.equity}\n(${parsedData.shares})`
          },
          {
            type: 'mrkdwn',
            text: `*Start Date:*\n${parsedData.startDate}`
          }
        ]
      }
    ];

    // Add Slack handle if present
    if (parsedData.slackHandle) {
      confirmationBlocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*New Hire:* ${parsedData.slackHandle}`
        }
      });
    }

    // Add confirmation message
    confirmationBlocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'If everything looks correct, click *Confirm* to:\n• Log the hire in our tracking sheet\n• Send a welcome message to the new hire'
      }
    });

    // Add confirmation buttons
    confirmationBlocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '✅ Confirm',
            emoji: true
          },
          style: 'primary',
          action_id: 'confirm_hire',
          value: JSON.stringify(hireData)
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '❌ Cancel',
            emoji: true
          },
          style: 'danger',
          action_id: 'reject_hire'
        }
      ]
    });

    await respond({
      blocks: confirmationBlocks,
      text: 'Please confirm the hire details',
      response_type: 'in_channel'
    });
  } catch (error) {
    console.error('Error handling hire command:', error);
    await respond({
      text: "Sorry, I encountered an error processing your request. Please try again.",
      response_type: 'ephemeral'
    });
  }
});

// Handle button actions
app.action('confirm_hire', async ({ ack, body, client }) => {
  await ack();
  console.log('Confirm button clicked:', body);
  
  try {
    await handleConfirmHire({ body, client });
  } catch (error) {
    console.error('Error in confirm action:', error);
    await client.chat.postMessage({
      channel: body.container.channel_id,
      text: "❌ Sorry, something went wrong while processing the hire. Please try again."
    });
  }
});

app.action('reject_hire', async ({ ack, body, client }) => {
  await ack();
  console.log('Reject button clicked:', body);
  
  try {
    await handleRejectHire({ body, client });
  } catch (error) {
    console.error('Error in reject action:', error);
    await client.chat.postMessage({
      channel: body.container.channel_id,
      text: "❌ Sorry, something went wrong while cancelling the hire. Please try again."
    });
  }
});

app.action('submit_hire_info', async ({ ack, body, client }) => {
  await ack();
  console.log('Submit hire info button clicked:', body);
  
  try {
    await handleSubmitHireInfo({ body, ack, client });
  } catch (error) {
    console.error('Error in submit hire info action:', error);
    await client.chat.postMessage({
      channel: body.container.channel_id,
      text: "❌ Sorry, something went wrong while saving your information. Please try again."
    });
  }
});

// Error handling
app.error(async (error) => {
  console.error('An error occurred:', error);
});

// Socket mode connection handling
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

app.client.on('disconnect', async () => {
  console.log('Socket Mode disconnected');
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    console.log(`Attempting to reconnect (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
    try {
      await app.start();
      console.log('Successfully reconnected!');
      reconnectAttempts = 0;
    } catch (error) {
      console.error('Failed to reconnect:', error);
    }
  } else {
    console.error('Max reconnection attempts reached. Please restart the application.');
    process.exit(1);
  }
});

// Start the app
(async () => {
  try {
    await app.start();
    console.log('⚡️ Hiring Bot is running!');
  } catch (error) {
    console.error('Failed to start app:', error);
    process.exit(1);
  }
})(); 
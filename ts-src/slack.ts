import { App, SlackEventMiddlewareArgs, SlackActionMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { parseHireMessage, HireData } from './openai';
import { appendHireData } from './sheets';
import { SlackBlock } from './types/slack';

export async function handleHireMessage(args: SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs) {
  const { message, say, client } = args;
  try {
    // Parse the message using OpenAI
    const parsedData = await parseHireMessage(message.text || '');

    // Add hiring manager info
    const hiringManager = `<@${message.user}>`;
    const hireData = { ...parsedData, hiringManager };

    // Format the salary and equity for display
    const salary = parsedData.salary.startsWith('$') ? parsedData.salary : `$${parsedData.salary}`;
    const equity = parsedData.equity.endsWith('%') ? parsedData.equity : `${parsedData.equity}%`;

    // Create confirmation message with more details
    const confirmationBlocks: SlackBlock[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*New Hire Details*'
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
            text: `*Salary:*\n${salary}`
          },
          {
            type: 'mrkdwn',
            text: `*Equity:*\n${equity}`
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
          text: `*Slack Handle:* ${parsedData.slackHandle}`
        }
      });
    }

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

    // Send the message
    await say({
      blocks: confirmationBlocks,
      text: 'Please confirm the hire details' // Fallback text
    });
  } catch (error) {
    console.error('Error handling hire message:', error);
    await say({
      text: 'Sorry, I had trouble understanding that. Could you rephrase it? Format: `/hire @username as role for salary with equity starting date`',
      thread_ts: message.ts
    });
  }
}

export async function handleConfirmHire(args: SlackActionMiddlewareArgs<'block_actions'> & AllMiddlewareArgs) {
  const { ack, body, client } = args;
  await ack();
  const hireData = JSON.parse(body.actions[0].value) as HireData & { hiringManager: string };

  try {
    // Log to Google Sheets
    await appendHireData(hireData);

    // Send confirmation message
    await client.chat.postMessage({
      channel: body.channel?.id,
      thread_ts: body.message?.ts,
      text: `✅ Great! I've logged the hire details to the tracking sheet.`
    });

    // Send DM to new hire if Slack handle is present
    if (hireData.slackHandle) {
      try {
        const userId = hireData.slackHandle.replace(/[<@>]/g, '');
        await client.chat.postMessage({
          channel: userId,
          text: `:wave: Hi! You've been added to the hiring tracker by <@${body.user.id}>. More details will be coming soon! :tada:`
        });
      } catch (dmError) {
        console.error('Error sending DM:', dmError);
        // Don't fail the whole process if DM fails
      }
    }
  } catch (error) {
    console.error('Error confirming hire:', error);
    await client.chat.postMessage({
      channel: body.channel?.id,
      thread_ts: body.message?.ts,
      text: `❌ Sorry, there was an error processing this hire. Please try again.`
    });
  }
}

export async function handleRejectHire(args: SlackActionMiddlewareArgs<'block_actions'> & AllMiddlewareArgs) {
  const { ack, body, client } = args;
  await ack();
  await client.chat.postMessage({
    channel: body.channel?.id,
    thread_ts: body.message?.ts,
    text: `Okay, please try submitting the hire details again with any corrections. Format: \`/hire @username as role for salary with equity starting date\``
  });
} 
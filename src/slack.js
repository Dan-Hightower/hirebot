const { parseHireMessage } = require('./openai');
const { appendHireData, updateHireData } = require('./sheets');
const axios = require('axios');

async function handleHireMessage(message, client) {
  try {
    // Parse the message using OpenAI
    const parsedData = await parseHireMessage(message.text || '');

    // Add hiring manager info
    const hiringManager = `<@${message.user}>`;
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

    // Send the message
    await client.chat.postMessage({
      channel: message.channel,
      blocks: confirmationBlocks,
      text: 'Please confirm the hire details' // Fallback text
    });
  } catch (error) {
    console.error('Error handling hire message:', error);
    await client.chat.postMessage({
      channel: message.channel,
      text: 'Sorry, I had trouble understanding that. Could you rephrase it? Format: `/hire @username as role for salary with equity starting date`'
    });
  }
}

async function handleConfirmHire({ body, client }) {
  console.log('Handling confirm hire:', body);
  
  try {
    const hireData = JSON.parse(body.actions[0].value);
    console.log('Parsed hire data:', hireData);
    console.log('Slack handle before processing:', hireData.slackHandle);

    // Log to Google Sheets
    await appendHireData(hireData);

    // Get the thread_ts from the original message
    const thread_ts = body.message?.thread_ts || body.message?.ts;

    // Send confirmation via response_url
    await axios.post(body.response_url, {
      text: `✅ Hire logged successfully! I've recorded the following details:\n• Role: ${hireData.role}\n• Salary: ${hireData.salary}\n• Equity: ${hireData.equity}\n• Start Date: ${hireData.startDate}`,
      response_type: 'in_channel',
      replace_original: true,
      thread_ts: thread_ts
    });

    // If Slack handle provided, send welcome message
    if (hireData.slackHandle) {
      try {
        const welcomeBlocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Hey ${hireData.slackHandle}! Welcome to the team! 🎉\n\nI'm excited to let you know that ${hireData.hiringManager} has confirmed your hire:\n• Role: ${hireData.role}\n• Start Date: ${hireData.startDate}\n\nTo complete your onboarding, please fill out the following information:`
            }
          },
          {
            type: 'input',
            block_id: 'full_name',
            label: {
              type: 'plain_text',
              text: 'Full Legal Name',
              emoji: true
            },
            element: {
              type: 'plain_text_input',
              action_id: 'full_name_input',
              placeholder: {
                type: 'plain_text',
                text: 'Enter your full legal name'
              }
            }
          },
          {
            type: 'input',
            block_id: 'address',
            label: {
              type: 'plain_text',
              text: 'Address',
              emoji: true
            },
            element: {
              type: 'plain_text_input',
              action_id: 'address_input',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Enter your full address'
              }
            }
          },
          {
            type: 'input',
            block_id: 'personal_email',
            label: {
              type: 'plain_text',
              text: 'Personal Email',
              emoji: true
            },
            element: {
              type: 'plain_text_input',
              action_id: 'personal_email_input',
              placeholder: {
                type: 'plain_text',
                text: 'Enter your personal email address'
              }
            }
          },
          {
            type: 'input',
            block_id: 'phone_number',
            label: {
              type: 'plain_text',
              text: 'Phone Number',
              emoji: true
            },
            element: {
              type: 'plain_text_input',
              action_id: 'phone_number_input',
              placeholder: {
                type: 'plain_text',
                text: 'Enter your phone number'
              }
            }
          },
          {
            type: 'input',
            block_id: 'current_title',
            optional: true,
            label: {
              type: 'plain_text',
              text: 'Current Job Title (if any)',
              emoji: true
            },
            element: {
              type: 'plain_text_input',
              action_id: 'current_title_input',
              placeholder: {
                type: 'plain_text',
                text: 'Enter your current job title'
              }
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Submit Information',
                  emoji: true
                },
                style: 'primary',
                action_id: 'submit_hire_info',
                value: JSON.stringify({
                  slackHandle: hireData.slackHandle,
                  role: hireData.role,
                  startDate: hireData.startDate
                })
              }
            ]
          }
        ];

        // Extract username from slack handle (handles both <@U123> and @username formats)
        let userId = hireData.slackHandle.match(/<@(U[A-Z0-9]+)>/)?.[1];
        if (!userId) {
          // If we don't have a user ID, try to look it up by username
          const username = hireData.slackHandle.replace(/[<@>]/g, '');
          console.log('Looking up user by username:', username);
          
          try {
            // Try to find user by username
            const userList = await client.users.list();
            const user = userList.members.find(u => u.name === username || u.id === username);
            
            if (user) {
              userId = user.id;
              console.log('Found user ID:', userId);
            } else {
              throw new Error(`Could not find user with username: ${username}`);
            }
          } catch (error) {
            console.error('Error looking up user:', error);
            throw new Error(`Could not find user with username: ${username}`);
          }
        }

        console.log('Attempting to send DM to user ID:', userId);

        try {
          // First verify the user exists and get their info
          const userInfo = await client.users.info({ user: userId });
          if (!userInfo.ok) {
            throw new Error(`User lookup failed: ${userInfo.error}`);
          }

          console.log('User info retrieved:', userInfo.user.name);

          // Open DM channel with notification preference override
          const conversationResponse = await client.conversations.open({
            users: userId
          });

          if (!conversationResponse.ok) {
            throw new Error(`Failed to open DM channel: ${conversationResponse.error}`);
          }

          const channelId = conversationResponse.channel.id;
          console.log('DM channel opened:', channelId);

          // Send welcome message to DM channel
          const dmResult = await client.chat.postMessage({
            channel: channelId,
            blocks: welcomeBlocks,
            text: `Welcome to the team! 🎉`
          });

          if (!dmResult.ok) {
            throw new Error(`Failed to send DM: ${dmResult.error}`);
          }

          // Notify about successful DM in the original channel
          await axios.post(body.response_url, {
            text: `✅ Hire logged successfully and I've sent a welcome message to ${hireData.slackHandle}! 📬`,
            response_type: 'in_channel',
            replace_original: true
          });

        } catch (messageError) {
          console.error('Error sending welcome message:', messageError);
          
          let errorMessage = '✅ Hire logged successfully, but ';
          if (messageError.message.includes('not_in_channel') || messageError.message.includes('cannot_dm_bot')) {
            errorMessage += `I couldn't send a DM to ${hireData.slackHandle}. Please make sure they are in the workspace and can receive DMs from apps.`;
          } else {
            errorMessage += `I couldn't send the welcome message. Error: ${messageError.message}`;
          }
          
          // Notify about message failure but confirm hire was logged
          await axios.post(body.response_url, {
            text: errorMessage,
            response_type: 'in_channel',
            replace_original: true
          });
        }
      } catch (error) {
        console.error('Error sending welcome message:', error);
        
        let errorMessage = '✅ Hire logged successfully, but ';
        if (error.message.includes('notification preference')) {
          errorMessage += `I couldn't send a DM to ${hireData.slackHandle} because their notification preferences are blocking messages. Please ask them to enable DMs from apps in their Slack preferences.`;
        } else if (error.message.includes('not_in_channel') || error.message.includes('cannot_dm_bot')) {
          errorMessage += `I couldn't send a DM to ${hireData.slackHandle}. Please make sure they are in the workspace and can receive DMs from apps.`;
        } else {
          errorMessage += `I couldn't send the welcome message. Error: ${error.message}`;
        }
        
        // Notify about message failure but confirm hire was logged
        await axios.post(body.response_url, {
          text: errorMessage,
          response_type: 'in_channel',
          replace_original: true
        });
      }
    }
  } catch (error) {
    console.error('Error in handleConfirmHire:', error);
    
    const thread_ts = body.message?.thread_ts || body.message?.ts;
    await client.chat.postMessage({
      channel: body.container.channel_id,
      thread_ts: thread_ts,
      text: '❌ Sorry, something went wrong while processing the hire. Please try again.'
    });
  }
}

async function handleRejectHire({ body, client }) {
  try {
    const thread_ts = body.message?.thread_ts || body.message?.ts;
    await client.chat.postMessage({
      channel: body.container.channel_id,
      thread_ts: thread_ts,
      text: '❌ Hire cancelled. Please submit a new `/hire` command with the correct details.'
    });
  } catch (error) {
    console.error('Error in handleRejectHire:', error);
    
    const thread_ts = body.message?.thread_ts || body.message?.ts;
    await client.chat.postMessage({
      channel: body.container.channel_id,
      thread_ts: thread_ts,
      text: '❌ Sorry, something went wrong while cancelling the hire. Please try again.'
    });
  }
}

async function handleSubmitHireInfo({ body, ack, client }) {
  await ack();
  
  try {
    const { slackHandle } = JSON.parse(body.actions[0].value);
    
    // Get values from the form
    const additionalData = {
      fullName: body.state.values.full_name.full_name_input.value,
      address: body.state.values.address.address_input.value,
      personalEmail: body.state.values.personal_email.personal_email_input.value,
      phoneNumber: body.state.values.phone_number.phone_number_input.value,
      currentTitle: body.state.values.current_title.current_title_input.value || ''
    };

    // Update Google Sheets with the additional information
    await updateHireData(slackHandle, additionalData);

    // Send confirmation message
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Thanks for submitting your information! 🎉\n\nI've recorded your details and someone from the team will be in touch with next steps. We're looking forward to working with you! 🚀`
          }
        }
      ],
      text: 'Information submitted successfully'
    });

  } catch (error) {
    console.error('Error handling hire info submission:', error);
    
    // Send error message
    await client.chat.postMessage({
      channel: body.channel.id,
      thread_ts: body.message.ts,
      text: 'Sorry, there was an error saving your information. Please try again or contact HR for assistance.'
    });
  }
}

module.exports = {
  handleHireMessage,
  handleConfirmHire,
  handleRejectHire,
  handleSubmitHireInfo
}; 
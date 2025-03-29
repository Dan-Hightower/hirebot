const { parseHireMessage } = require('./openai');
const { appendHireData, createHireRecord, findLastRowBySlackHandle, updateHireRecord } = require('./sheets');
const axios = require('axios');
const DeelAPI = require('./deel');

async function handleHireMessage(message, client) {
  try {
    console.log('Starting handleHireMessage with:', JSON.stringify(message, null, 2));

    // Parse the message using OpenAI
    const parsedData = await parseHireMessage(message.text || '');
    console.log('Data from OpenAI:', JSON.stringify(parsedData, null, 2));

    // Add hiring manager info
    const hiringManager = `<@${message.user}>`;
    const initialData = { ...parsedData, hiringManager };
    console.log('Initial data before button:', JSON.stringify(initialData, null, 2));

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

    // Create button value with explicit fields
    const buttonValue = {
      role: parsedData.role,
      salary: parsedData.salary,
      equity: parsedData.equity,
      startDate: parsedData.startDate,
      slackHandle: parsedData.slackHandle,
      hiringManager
    };

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
          value: JSON.stringify(buttonValue)
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

    // If we have a response_url, use it to update the "Processing..." message
    if (message.response_url) {
      await axios.post(message.response_url, {
        blocks: confirmationBlocks,
        text: 'Please confirm the hire details', // Fallback text
        replace_original: true
      });
    } else {
      // Otherwise send as a new message
      await client.chat.postMessage({
        channel: message.channel,
        blocks: confirmationBlocks,
        text: 'Please confirm the hire details' // Fallback text
      });
    }
  } catch (error) {
    console.error('Error handling hire message:', error);
    
    const errorMessage = 'Sorry, I had trouble understanding that. Could you rephrase it? Format: `/hire @username as role for salary with equity starting date`';
    
    // If we have a response_url, use it to update the "Processing..." message
    if (message.response_url) {
      try {
        await axios.post(message.response_url, {
          text: errorMessage,
          replace_original: true
        });
      } catch (postError) {
        console.error('Error posting to response_url:', postError);
        // Fallback to regular message
        await client.chat.postMessage({
          channel: message.channel,
          text: errorMessage
        });
      }
    } else {
      await client.chat.postMessage({
        channel: message.channel,
        text: errorMessage
      });
    }
  }
}

async function handleConfirmHire({ body, client }) {
  console.log('Handling confirm hire:', JSON.stringify(body, null, 2));
  
  try {
    const buttonValue = body.actions[0].value;
    console.log('Raw button value:', buttonValue);
    
    const hireData = JSON.parse(buttonValue);
    console.log('Parsed hire data from button:', JSON.stringify(hireData, null, 2));

    // DEBUG: Log specific fields
    console.log('DEBUG - Checking specific fields:');
    console.log('salary:', hireData.salary);
    console.log('equity:', hireData.equity);
    console.log('role:', hireData.role);
    console.log('startDate:', hireData.startDate);

    // Verify salary and equity are present
    if (!hireData.salary || !hireData.equity) {
      console.error('Missing salary or equity in hire data:', hireData);
      throw new Error('Missing required salary or equity data');
    }

    // Log to Google Sheets
    console.log('About to call appendHireData with:', JSON.stringify(hireData, null, 2));
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
        console.log('DEBUG - Attempting to send DM to:', hireData.slackHandle);
        
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
        let userId;
        const userIdMatch = hireData.slackHandle.match(/<@(U[A-Z0-9]+)>/);
        
        if (userIdMatch) {
          userId = userIdMatch[1];
          console.log('DEBUG - Extracted user ID from handle:', userId);
        } else {
          // If we don't have a user ID, try to look it up by username
          // Remove any @ symbol and angle brackets
          const username = hireData.slackHandle.replace(/^@/, '').replace(/[<>]/g, '');
          console.log('DEBUG - Looking up user by username:', username);
          
          try {
            // Try to find user by username
            const userList = await client.users.list();
            console.log('DEBUG - Got user list, searching for:', username);
            
            // Try different ways to match the user
            const user = userList.members.find(u => {
              const matchesUsername = u.name?.toLowerCase() === username.toLowerCase();
              const matchesRealName = u.real_name?.toLowerCase() === username.toLowerCase();
              const matchesDisplayName = u.profile?.display_name?.toLowerCase() === username.toLowerCase();
              const matchesEmail = u.profile?.email?.toLowerCase() === username.toLowerCase();
              
              if (matchesUsername || matchesRealName || matchesDisplayName || matchesEmail) {
                console.log('DEBUG - Found user match:', {
                  id: u.id,
                  name: u.name,
                  real_name: u.real_name,
                  display_name: u.profile?.display_name,
                  matched_on: matchesUsername ? 'username' : 
                             matchesRealName ? 'real_name' : 
                             matchesDisplayName ? 'display_name' : 'email'
                });
                return true;
              }
              return false;
            });
            
            if (user) {
              userId = user.id;
              console.log('DEBUG - Found user ID:', userId);
            } else {
              console.log('DEBUG - Available users:', userList.members.map(u => ({
                id: u.id,
                name: u.name,
                real_name: u.real_name,
                display_name: u.profile?.display_name
              })));
              throw new Error(`Could not find user with username: ${username}`);
            }
          } catch (error) {
            console.error('Error looking up user:', error);
            throw new Error(`Could not find user with username: ${username}`);
          }
        }

        console.log('DEBUG - Final user ID for DM:', userId);

        try {
          // First verify the user exists and get their info
          const userInfo = await client.users.info({ user: userId });
          if (!userInfo.ok) {
            throw new Error(`User lookup failed: ${userInfo.error}`);
          }

          console.log('DEBUG - User info retrieved:', {
            id: userInfo.user.id,
            name: userInfo.user.name,
            real_name: userInfo.user.real_name,
            is_bot: userInfo.user.is_bot,
            deleted: userInfo.user.deleted
          });

          // Open DM channel with notification preference override
          const conversationResponse = await client.conversations.open({
            users: userId
          });

          if (!conversationResponse.ok) {
            throw new Error(`Failed to open DM channel: ${conversationResponse.error}`);
          }

          const channelId = conversationResponse.channel.id;
          console.log('DEBUG - DM channel opened:', channelId);

          // Send welcome message to DM channel
          const dmResult = await client.chat.postMessage({
            channel: channelId,
            blocks: welcomeBlocks,
            text: `Welcome to the team! 🎉`
          });

          if (!dmResult.ok) {
            throw new Error(`Failed to send DM: ${dmResult.error}`);
          }

          console.log('DEBUG - DM sent successfully');

          // Notify about successful DM in the original channel
          await axios.post(body.response_url, {
            text: `✅ Hire logged successfully and I've sent a welcome message to ${hireData.slackHandle}! 📬`,
            response_type: 'in_channel',
            replace_original: true
          });

        } catch (messageError) {
          console.error('DEBUG - Error sending welcome message:', messageError);
          
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
        console.error('DEBUG - Error in DM flow:', error);
        
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
    
    // Use the channel ID from the container for error messages
    const channelId = body.container.channel_id;
    const thread_ts = body.message?.thread_ts || body.message?.ts;
    
    await client.chat.postMessage({
      channel: channelId,
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

async function handleSubmitHireInfo({ body, client }) {
  try {
    console.log('Processing form submission:', JSON.stringify(body.state.values, null, 2));
    
    // Parse the initial hire data
    const initialData = JSON.parse(body.actions[0].value);
    
    // Get values from the form
    const supplementalData = {
      fullName: body.state.values.full_name.full_name_input.value,
      address: body.state.values.address.address_input.value,
      personalEmail: body.state.values.personal_email.personal_email_input.value,
      phoneNumber: body.state.values.phone_number.phone_number_input.value,
      currentTitle: body.state.values.current_title?.current_title_input?.value || ''
    };

    console.log('Form data:', supplementalData);
    console.log('Initial hire data:', initialData);

    // Split full name into first and last name for Deel
    const [firstName, ...lastNameParts] = supplementalData.fullName.trim().split(' ');
    const lastName = lastNameParts.join(' ');

    if (!firstName || !lastName) {
      throw new Error('Please provide both first and last name');
    }

    let deelCandidateId = null;
    let deelError = null;

    // Try to create Deel candidate
    try {
      console.log('Creating Deel candidate...');
      const deel = new DeelAPI(
        process.env.DEEL_CLIENT_ID,
        process.env.DEEL_CLIENT_SECRET
      );
      const deelResult = await deel.createCandidate({
        firstName,
        lastName,
        email: supplementalData.personalEmail,
        role: initialData.role,
        startDate: initialData.startDate,
        country: 'US'
      });

      console.log('Deel API response:', deelResult);

      if (deelResult.success) {
        deelCandidateId = deelResult.candidateId;
      } else {
        deelError = deelResult.error;
      }
    } catch (deelErr) {
      console.error('Error creating Deel candidate:', deelErr);
      deelError = deelErr.message;
    }

    // Find and update the existing hire record in Google Sheets
    console.log('Finding existing hire record...');
    const rowNumber = await findLastRowBySlackHandle(initialData.slackHandle);
    
    if (!rowNumber) {
      throw new Error('Could not find existing hire record to update');
    }

    console.log('Updating hire record in Google Sheets...');
    await updateHireRecord(rowNumber, initialData, {
      ...supplementalData,
      deelCandidateId
    });

    console.log('Google Sheets record updated successfully');

    // Prepare success message
    let successMessage = `Thanks for submitting your information! 🎉\n\nI've recorded your details and someone from the team will be in touch with next steps. We're looking forward to working with you! 🚀`;
    
    // Add Deel status to the message
    if (deelCandidateId) {
      successMessage += `\n\n*Deel Profile ID:* \`${deelCandidateId}\``;
    } else {
      successMessage += `\n\n⚠️ Note: There was an issue creating your Deel profile (${deelError}). HR has been notified and will help set this up manually.`;
    }

    // Send confirmation message
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: successMessage
          }
        }
      ],
      text: 'Information submitted successfully'
    });

    // Notify in the original hiring thread if we have it
    if (body.container?.thread_ts) {
      let threadMessage = `✅ ${initialData.slackHandle} has submitted their information`;
      if (deelCandidateId) {
        threadMessage += ` and their Deel profile has been created (ID: ${deelCandidateId})`;
      } else {
        threadMessage += `. Note: Deel profile creation failed (${deelError}) and will need manual setup.`;
      }
      
      await client.chat.postMessage({
        channel: body.channel.id,
        thread_ts: body.container.thread_ts,
        text: threadMessage
      });
    }

  } catch (error) {
    console.error('Error handling hire info submission:', error);
    
    // Send error message
    await client.chat.postMessage({
      channel: body.channel.id,
      thread_ts: body.message.ts,
      text: `Sorry, there was an error processing your information: ${error.message}. Please try again or contact HR for assistance.`
    });
  }
}

module.exports = {
  handleHireMessage,
  handleConfirmHire,
  handleRejectHire,
  handleSubmitHireInfo
}; 
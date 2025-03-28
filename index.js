require('dotenv').config();
const { App } = require('@slack/bolt');
const { handleHireMessage, handleConfirmHire, handleRejectHire, handleSubmitHireInfo } = require('./slack');
const DeelAPI = require('./deel');

// Initialize clients
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

// Store pending hires until we get their personal info
const pendingHires = new Map();

// Handle hire messages
app.message(/^\/hire/, async ({ message, client }) => {
  await handleHireMessage(message, client);
});

// Handle hire confirmation from manager
app.action('confirm_hire', async ({ body, ack, client }) => {
  await ack();
  
  try {
    const hireData = JSON.parse(body.actions[0].value);
    console.log('Processing hire confirmation for:', hireData);

    // First, update the original message to show confirmation
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `✅ Hire confirmed!\n\n*Role:* ${hireData.role}\n*Salary:* ${hireData.salary}\n*Equity:* ${hireData.equity}\n*Start Date:* ${hireData.startDate}`
          }
        }
      ],
      text: "Hire confirmed"
    });

    // Extract username from slack handle
    const userId = hireData.slackHandle.match(/<@([^>]+)>/)[1];
    console.log('Sending DM to user:', userId);

    // Open DM channel
    const conversationResponse = await client.conversations.open({
      users: userId
    });

    if (!conversationResponse.ok) {
      throw new Error(`Failed to open DM channel: ${conversationResponse.error}`);
    }

    // Send the welcome form
    await client.chat.postMessage({
      channel: conversationResponse.channel.id,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Hey ${hireData.slackHandle}! Welcome to the team! 🎉\n\nI'm excited to let you know that ${hireData.hiringManager} has confirmed your hire:\n• Role: ${hireData.role}\n• Start Date: ${hireData.startDate}\n\nTo complete your onboarding, please fill out the following information:`
          }
        },
        {
          type: "input",
          block_id: "full_name",
          label: {
            type: "plain_text",
            text: "Full Legal Name",
            emoji: true
          },
          element: {
            type: "plain_text_input",
            action_id: "full_name_input",
            placeholder: {
              type: "plain_text",
              text: "Enter your full legal name"
            }
          }
        },
        {
          type: "input",
          block_id: "address",
          label: {
            type: "plain_text",
            text: "Address",
            emoji: true
          },
          element: {
            type: "plain_text_input",
            action_id: "address_input",
            multiline: true,
            placeholder: {
              type: "plain_text",
              text: "Enter your full address"
            }
          }
        },
        {
          type: "input",
          block_id: "personal_email",
          label: {
            type: "plain_text",
            text: "Personal Email",
            emoji: true
          },
          element: {
            type: "plain_text_input",
            action_id: "personal_email_input",
            placeholder: {
              type: "plain_text",
              text: "Enter your personal email address"
            }
          }
        },
        {
          type: "input",
          block_id: "phone_number",
          label: {
            type: "plain_text",
            text: "Phone Number",
            emoji: true
          },
          element: {
            type: "plain_text_input",
            action_id: "phone_number_input",
            placeholder: {
              type: "plain_text",
              text: "Enter your phone number"
            }
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Submit Information",
                emoji: true
              },
              style: "primary",
              action_id: "submit_hire_info",
              value: JSON.stringify({
                role: hireData.role,
                startDate: hireData.startDate,
                slackHandle: hireData.slackHandle
              })
            }
          ]
        }
      ],
      text: "Welcome to the team! Please fill out your onboarding information."
    });

    // Notify the hiring manager
    await client.chat.postMessage({
      channel: body.channel.id,
      thread_ts: body.message.ts,
      text: `✅ I've sent the onboarding form to ${hireData.slackHandle}. I'll create their Deel profile once they submit their information.`
    });

  } catch (error) {
    console.error('Error in confirm_hire:', error);
    await client.chat.postMessage({
      channel: body.channel.id,
      thread_ts: body.message.ts,
      text: `❌ Error: ${error.message}`
    });
  }
});

// Handle hire info submission from new hire
app.action('submit_hire_info', async ({ body, ack, client }) => {
  await ack();
  
  try {
    console.log('Received form submission:', JSON.stringify(body.state.values, null, 2));
    
    // Get values from the form
    const formData = {
      fullName: body.state.values.full_name.full_name_input.value,
      address: body.state.values.address.address_input.value,
      personalEmail: body.state.values.personal_email.personal_email_input.value,
      phoneNumber: body.state.values.phone_number.phone_number_input.value,
      currentTitle: body.state.values.current_title?.current_title_input?.value
    };

    console.log('Parsed form data:', formData);

    // Split full name into first and last name
    const [firstName, ...lastNameParts] = formData.fullName.trim().split(' ');
    const lastName = lastNameParts.join(' ');

    if (!firstName || !lastName) {
      throw new Error('Please provide both first and last name');
    }

    console.log('Split name:', { firstName, lastName });

    // Get the hire data from the button value
    const { role, startDate, slackHandle } = JSON.parse(body.actions[0].value);
    console.log('Retrieved hire data:', { role, startDate, slackHandle });

    // Verify we have a Deel API token
    if (!process.env.DEEL_API_TOKEN) {
      throw new Error('DEEL_API_TOKEN is not set in environment variables');
    }

    // Create candidate in Deel with the provided information
    console.log('Creating Deel candidate...');
    const deel = new DeelAPI(process.env.DEEL_API_TOKEN);
    
    // Log the API token (first few characters)
    const tokenPreview = `${process.env.DEEL_API_TOKEN.substring(0, 5)}...`;
    console.log('Using Deel API token:', tokenPreview);

    const deelResult = await deel.createCandidate({
      firstName,
      lastName,
      email: formData.personalEmail,
      role,
      startDate,
      country: 'US'
    });

    console.log('Deel API response:', JSON.stringify(deelResult, null, 2));

    if (!deelResult.success) {
      throw new Error(`Error creating Deel profile: ${deelResult.error}`);
    }

    // Update Google Sheets with the submitted information
    console.log('Updating Google Sheets...');
    const { updateHireData } = require('./sheets');
    await updateHireData(slackHandle, {
      fullName: formData.fullName,
      address: formData.address,
      personalEmail: formData.personalEmail,
      phoneNumber: formData.phoneNumber,
      deelCandidateId: deelResult.candidateId
    });

    console.log('Google Sheets updated successfully');

    // Update the form message to show confirmation
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Thanks for submitting your information! 🎉\n\nI've created your Deel profile and recorded your details. Someone from the team will be in touch with next steps. We're looking forward to working with you! 🚀\n\n*Deel Profile ID:* \`${deelResult.candidateId}\``
          }
        }
      ],
      text: "Information submitted successfully"
    });

    // Notify in the original hiring thread
    if (body.container?.thread_ts) {
      await client.chat.postMessage({
        channel: body.channel.id,
        thread_ts: body.container.thread_ts,
        text: `✅ ${slackHandle} has submitted their information and their Deel profile has been created (ID: ${deelResult.candidateId})`
      });
    }

  } catch (error) {
    console.error('Error processing hire info submission:', error);
    
    // Send error message
    await client.chat.postMessage({
      channel: body.channel.id,
      thread_ts: body.message.ts,
      text: `Sorry, there was an error processing your information: ${error.message}. Please contact HR for assistance.`
    });
  }
});

app.action('reject_hire', async ({ body, ack, client }) => {
  await ack();
  await client.chat.update({
    channel: body.channel.id,
    ts: body.message.ts,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "❌ Hire cancelled. Please submit a new `/hire` command with the correct details."
        }
      }
    ],
    text: "Hire cancelled"
  });
});

// Error handling for global app errors
app.error(async (error) => {
  console.error('Global app error:', error);
});

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Bolt app is running!');
})(); 
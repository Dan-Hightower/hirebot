# Slack Hiring Assistant Bot

A Slack bot that helps streamline the process of kicking off new employee hires by parsing unstructured hiring messages, confirming details, and initiating downstream automations in payroll and cap table systems. 

This repo assumes Deel is the HRIS/Payroll system and you want a Google Sheets backup of all hires, but you should hit your HRIS/payroll API and cap table platform directly if possible.

## How it works
1. use /hire command in Slack, tag the new hire (so you'll have added them to Slack already), give title, salary, equity, and start date. Example: "/hire @dan as Software Engineer III, salary of $130k, equity of 0.45%, starting May 1."
3. the bot does the rest.

![image](https://github.com/user-attachments/assets/17e79c81-988c-455b-b7dd-833beff85da3)
![image](https://github.com/user-attachments/assets/5a4fc119-d2c4-4f74-86c7-0188c178d809)

## Features

- Parse hiring messages using OpenAI
- Extract structured data (role, salary, equity, start date)
- Confirm details with interactive buttons
- Log confirmed hires to Google Sheets
- Optional: DM new hires when confirmed

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with required credentials:
   ```
   SLACK_BOT_TOKEN=your_slack_bot_token
   SLACK_SIGNING_SECRET=your_slack_signing_secret
   OPENAI_API_KEY=your_openai_api_key
   DEEL_API_TOKEN=your_deel_token
   DEEL_CLIENT_ID=your_deel_client_id
   GOOGLE_SHEETS_CREDENTIALS_PATH=./credentials/google-creds.json
   GOOGLE_SHEETS_ID=your_sheet_id
   ```
4. Set up Google Sheets:
   - Create a service account and download credentials
   - Place credentials in `./credentials/google-creds.json`
   - Create a sheet and share it with the service account email
   - Add the sheet ID to `.env`

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm start
```

## Usage

In Slack, use the `/hire` command with natural language:

```
/hire Let's hire @dan as a backend engineer for $130k, 0.3% equity, starting May 1st
```

The bot will:
1. Parse the message
2. Show a confirmation with the extracted details
3. DM the new hire for additional details
4. Once all detailed collected, post it to Deel API
5. Log the details to Google Sheets 

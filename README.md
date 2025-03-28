# Slack Hiring Assistant Bot

A Slack bot that helps streamline the process of kicking off new hires by parsing unstructured hiring messages, confirming details, and initiating downstream automations. 

For this repo, I've simply config'd it to drop the new hire data into Google Sheets, but you should hit your HRIS/payroll API and cap table platform directly if possible.

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
3. On confirmation, log to Google Sheets
4. Optionally send a DM to the new hire 

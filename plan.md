# Hackathon Implementation Plan - Slack Hiring Assistant Bot

## 1. MVP Features
- Parse hiring message with OpenAI
- Show confirmation message in Slack
- Store confirmed hires in Google Sheet

## 2. Project Setup (30 mins)
```bash
npm init -y
npm install @slack/bolt openai @google-cloud/sheets dotenv
```

## 3. Implementation Plan (4-6 hours total)

### Phase 1: Basic Bot (1 hour)
1. Set up `.env` with required tokens
2. Create basic Slack bot with Bolt
3. Test message receiving

### Phase 2: OpenAI Integration (2 hours)
1. Simple OpenAI prompt to parse hire message
2. Extract: role, salary, equity, start date, Slack handle
3. Basic error handling (ask user to rephrase if parsing fails)

### Phase 3: Slack UI (1-2 hours)
1. Show parsed data in formatted message
2. Add confirm/reject buttons
3. Basic DM to new hire

### Phase 4: Google Sheets (1 hour)
1. Set up Google Sheets connection
2. Append confirmed hires to sheet
3. Basic error handling

## 4. Project Structure
```
/
├── .env                    # API keys & tokens
├── index.js               # Main bot code
├── openai.js             # GPT message parsing
├── sheets.js             # Google Sheets logic
└── package.json
```

## 5. Core Functions

### index.js
```javascript
app.message(/^\/hire/, handleHireMessage);
app.action('confirm_hire', handleConfirmation);
app.action('reject_hire', handleRejection);
```

### openai.js
```javascript
async function parseHireMessage(message) {
  // Send to GPT-4 and get structured data
}
```

### sheets.js
```javascript
async function appendHireData(data) {
  // Add row to Google Sheet
}
```

## 6. Post-MVP Features (If Time Permits)
1. Better error handling
2. Duplicate prevention
3. Data validation
4. Basic logging

## 7. Required Credentials
- Slack Bot Token
- Slack Signing Secret
- OpenAI API Key
- Google Sheets Service Account JSON

## 8. Testing Strategy
- Manual testing of happy path
- Basic error cases
- Test with various message formats

## 9. Timeline

Total Time: 4-6 hours
- Setup: 30 mins
- Core Features: 3-4 hours
- Testing & Fixes: 30-90 mins 
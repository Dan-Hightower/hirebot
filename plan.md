# Hackathon Implementation Plan - Slack Hiring Assistant Bot with Deel Integration

## 1. MVP Features
- Parse hiring message with OpenAI
- Show confirmation message in Slack
- Collect new hire information via Slack form
- Create new hire profile in Deel
- Store confirmed hires in Google Sheet

## 2. Project Setup (30 mins)
```bash
npm init -y
npm install @slack/bolt openai @google-cloud/sheets dotenv axios
```

## 3. Implementation Plan (4-6 hours total)

### Phase 1: Basic Bot (1 hour)
1. Set up `.env` with required tokens
2. Create basic Slack bot with Bolt
3. Test message receiving
4. Implement `/hire` command parsing

### Phase 2: OpenAI Integration (2 hours)
1. Simple OpenAI prompt to parse hire message
2. Extract: role, salary, equity, start date, Slack handle
3. Basic error handling (ask user to rephrase if parsing fails)
4. Show confirmation message with parsed data

### Phase 3: New Hire Onboarding Form (1-2 hours)
1. Create interactive form for new hire data collection
2. Fields: Full Name, Address, Personal Email, Phone Number
3. Handle form submission and data validation
4. Send welcome message with form to new hire

### Phase 4: Deel Integration (1 hour)
1. Set up Deel API client
2. Create candidate profile with collected information
3. Handle API errors and responses
4. Notify hiring manager of Deel profile creation

### Phase 5: Google Sheets Integration (1 hour)
1. Set up Google Sheets connection
2. Append confirmed hires to sheet
3. Track Deel profile creation status
4. Basic error handling

## 4. Project Structure
```
/
├── .env                    # API keys & tokens
├── index.js               # Main bot code
├── slack.js              # Slack message handlers
├── deel.js               # Deel API integration
├── sheets.js             # Google Sheets logic
├── openai.js             # GPT message parsing
└── package.json
```

## 5. Core Functions

### index.js
```javascript
app.message(/^\/hire/, handleHireMessage);
app.action('confirm_hire', handleConfirmHire);
app.action('submit_hire_info', handleSubmitHireInfo);
```

### slack.js
```javascript
async function handleHireMessage(message, client) {
  // Parse message and show confirmation
}

async function handleConfirmHire(body, client) {
  // Send onboarding form to new hire
}

async function handleSubmitHireInfo(body, client) {
  // Process form submission and create Deel profile
}
```

### deel.js
```javascript
async function createCandidate(hireData) {
  // Create candidate in Deel
  // Return candidate ID
}
```

## 6. Required Credentials
- Slack Bot Token
- Slack Signing Secret
- OpenAI API Key
- Google Sheets Service Account JSON
- Deel API Token

## 7. Testing Strategy
- Test `/hire` command with various formats
- Verify form submission and validation
- Test Deel API integration
- Verify Google Sheets logging
- Test error handling scenarios

## 8. Timeline

Total Time: 5-7 hours
- Setup: 30 mins
- Core Features: 4-5 hours
- Testing & Fixes: 30-90 mins 
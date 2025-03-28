# Slack Hiring Assistant Bot — Specification

## 📌 Purpose

This bot streamlines the process of kicking off a new hire in Slack. It accepts an unstructured command from a manager or recruiter, extracts structured compensation and role details, confirms accuracy with the user, messages the new hire (if Slack handle is provided), and logs the data into a Google Sheet.

---

## 🎯 User Flow

### Scenario: Hiring via Slack

1. **Trigger Command**:  
   A user sends a message like:
   > "/hire Let's hire @dan as a backend engineer for $130k, 0.3% equity, starting May 1st"

2. **Bot Parses the Message**:  
   The bot uses OpenAI to structure the following details:
   - Role: Backend Engineer
   - Salary: $130,000
   - Equity: 0.3%
   - Start Date: May 1st
   - Slack handle (if present): `@username`

3. **Bot Responds in Thread**:  
   "Just to confirm, you're hiring a *Backend Engineer* starting *May 1st* with *$130,000 USD salary* and *0.3% equity*. Should I proceed?"

   Two buttons:
   - ✅ Yes, looks good
   - ❌ No, edit details

4. **On Confirmation**:
   - (Optional) Sends a DM to `@username`:
     > "Hi! You're being onboarded. More details coming soon 🎉"
   - Appends a new row to the "Hiring Tracker" Google Sheet

---

## ⚙️ Architecture

### Slack
- **Bot Framework**: Bolt for JavaScript (Node.js)
- **Triggers**:
  - Free-text messages in designated channel
  - Slash command `/hire` (optional fallback)
- **Interactions**:
  - Confirmation via Block Kit buttons
  - DM new hire (if handle present)

### NLP / Parsing
- **Service**: OpenAI API (gpt-4 or gpt-3.5-turbo)
- **Prompt**: Designed to extract role, salary, equity, start date, Slack handle
- **Fallback**: If parsing fails, ask user for missing info

### Google Sheets
- **Sheet Name**: `Hiring Tracker`
- **Columns**:
  - Timestamp
  - Hiring Manager (Slack ID)
  - Role
  - Salary
  - Equity
  - Start Date
  - Slack Handle (if any)
- **Auth**: Google Service Account JSON credentials

### Secrets Management
- `.env` file with:
  - `SLACK_BOT_TOKEN`
  - `SLACK_SIGNING_SECRET`
  - `OPENAI_API_KEY`
  - `GOOGLE_SHEETS_CREDENTIALS` (or path to credentials JSON)
  - `DEEL_API_TOKEN`

---

## 🔐 Permissions / OAuth Scopes

Slack Bot requires:
- `app_mentions:read`
- `chat:write`
- `chat:write.public`
- `commands`
- `users:read`
- `channels:history` (if listening outside DMs)

Google Sheets:
- Google Sheets API enabled
- Service account with write access to sheet

---

## 📁 Project Structure (Node.js)
/ ├── spec.md ├── .env ├── index.js # Entry point for Bolt app ├── openai.js # GPT integration logic ├── sheets.js # Google Sheets integration ├── slack.js # Slack helpers (DMs, messages) ├── /utils │ └── parseGPTResponse.js # Parse structured values from GPT ├── credentials/ │ └── google-creds.json # (gitignored) Service account credentials └── package.json


---

## 🚦 Edge Cases & Considerations

- If GPT can't parse input confidently, ask user to clarify.
- If confirmation is rejected, allow user to rephrase or provide corrected info.
- Slack handle may be missing — fallback to message without tagging.
- Prevent duplicate entries in Google Sheet by checking for recent identical submissions.




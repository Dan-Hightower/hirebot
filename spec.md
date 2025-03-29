# Slack Hiring Assistant Bot with Deel Integration — Specification

## 📌 Purpose

This bot streamlines the process of kicking off a new hire in Slack. It accepts an unstructured command from a manager or recruiter, extracts structured compensation and role details, confirms accuracy with the user, collects necessary information from the new hire via a form, creates their Deel profile, and logs the data into a Google Sheet.

---

## 🎯 User Flow

### Scenario 1: Manager Initiates Hire

1. **Trigger Command**:  
   A manager sends a message like:
   > "/hire Let's hire @dan as a backend engineer for $130k, 0.3% equity, starting May 1st"

2. **Bot Parses the Message**:  
   The bot uses OpenAI to structure the following details:
   - Role: Backend Engineer
   - Salary: $130,000
   - Equity: 0.3%
   - Start Date: May 1st
   - Slack handle: `@username`

3. **Bot Responds in Thread**:  
   Shows a formatted message with parsed details and confirmation button:
   ```
   Just to confirm, you're hiring:
   • Role: Backend Engineer
   • Salary: $130,000
   • Equity: 0.3%
   • Start Date: May 1st
   • Slack: @dan
   ```
   [Confirm Hire] button included

### Scenario 2: New Hire Onboarding

1. **After Confirmation**:
   Bot sends a DM to the new hire with:
   - Welcome message
   - Role and start date confirmation
   - Interactive form requesting:
     - Full Legal Name
     - Address
     - Personal Email
     - Phone Number

2. **Form Submission**:
   - New hire fills out the form
   - Bot validates the information
   - Creates Deel profile with provided information
   - Notifies hiring manager of completion

3. **Data Logging**:
   - Logs hire details to Google Sheet
   - Tracks Deel profile creation status

---

## ⚙️ Architecture

### Slack Integration
- **Framework**: Bolt for JavaScript (Node.js)
- **Triggers**: `/hire` command in messages
- **Interactions**:
  - Confirmation button
  - Interactive form for new hire
  - DM communications
  - Thread updates

### NLP / Parsing
- **Service**: OpenAI API
- **Purpose**: Extract structured hire data from free-text
- **Fields**: role, salary, equity, start date, Slack handle
- **Error Handling**: Request clarification if parsing fails

### Deel Integration
- **API**: Deel REST API
- **Actions**:
  - Create candidate profile
  - Set compensation details
  - Track profile creation status
- **Error Handling**: Notify manager of any issues

### Google Sheets
- **Purpose**: Data logging and tracking
- **Columns**:
  - Timestamp
  - Hiring Manager
  - Role
  - Salary
  - Equity
  - Start Date
  - Slack Handle
  - Deel Profile Status
  - New Hire Details (Name, Email, etc.)

---

## 🔐 Required Permissions

### Slack Scopes
- `app_mentions:read`
- `chat:write`
- `chat:write.public`
- `im:write`
- `users:read`
- `channels:history`

### Deel API
- API Token with candidate creation permissions

### Google Sheets
- Service account with write access

---

## 📁 Project Structure
```
/
├── .env                    # Environment variables
├── index.js               # Main application & Bolt setup
├── slack.js              # Message handlers & UI logic
├── deel.js               # Deel API integration
├── sheets.js             # Google Sheets logging
├── openai.js             # Message parsing logic
└── package.json          # Dependencies
```

---

## 🚦 Error Handling

1. **Message Parsing**
   - Request clarification if OpenAI can't parse confidently
   - Allow manual correction of parsed fields

2. **Form Validation**
   - Validate all required fields
   - Ensure email format is correct
   - Verify phone number format

3. **API Integration**
   - Handle Deel API errors gracefully
   - Retry failed Google Sheets updates
   - Log all errors for debugging

4. **User Communication**
   - Clear error messages to users
   - Status updates in threads
   - Confirmation of successful actions




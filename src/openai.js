const OpenAI = require('openai');

// Debug environment variable
console.log('Initializing OpenAI client, API key exists:', !!process.env.OPENAI_API_KEY);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function parseHireMessage(message) {
  const currentYear = new Date().getFullYear();
  
  const prompt = `Parse the following hiring message and extract structured information. 
Format the salary as a full number with commas and dollar sign (e.g., "$130,000" not "$130k").
Format equity in two ways:
1. As a percentage with EXACT decimal places from input - DO NOT ROUND (e.g., if input is "0.66%", return "0.66%" NOT "0.7%")
2. Calculate the number of shares based on a total of 10,000,000 shares (e.g., for 0.66%, return "66,000 shares")
Format the date in full using the current year ${currentYear} (e.g., if input is "May 1", return "May 1, ${currentYear}").
If a different year is specified in the input, ignore it and use ${currentYear}.

IMPORTANT PARSING RULES:
1. For Slack handles:
   - If input is a user ID like "@U1234" or "<@U1234>", keep that exact format
   - If input is a username like "@username" or "<@username>", keep that exact format
   - Always include the @ symbol
   - If angle brackets are present in input, keep them
   - If no Slack handle is found, set it to null
2. The role is what comes AFTER "as a" or "as" - it is the job title, NOT the person's name
3. NEVER round the equity percentage - keep exact decimal places from input
4. Be flexible with input formats - look for salary/compensation and equity percentages regardless of exact phrasing
5. Remove any commas within the role title

Example formats that should all parse correctly:
"/hire @dan as a software engineer at $130k, 0.66% equity, starting May 1"
"/hire <@U1234> as Software Engineer, salary of $130k, equity of 0.66%, starting May 1"
"/hire @dan.smith as a Software Engineer for $130,000 with 0.66% equity starting May 1"

Should parse as (maintaining the exact handle format from input):
{
  "role": "Software Engineer",
  "slackHandle": "@dan" or "<@U1234>" or "@dan.smith" (exactly as input),
  "salary": "$130,000",
  "equity": "0.66%",
  "shares": "66,000",
  "startDate": "May 1, ${currentYear}"
}

Message: "${message}"

Return only a JSON object with these exact keys:
{
  "role": "job title (what comes after 'as a' or 'as')",
  "salary": "formatted salary with $ and commas",
  "equity": "formatted equity percentage - EXACT, no rounding",
  "shares": "calculated number of shares with commas",
  "startDate": "formatted full date with current year",
  "slackHandle": "slack handle maintaining exact input format, or null if not present"
}`;

  console.log('Sending prompt to OpenAI:', prompt);

  const completion = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-3.5-turbo",
    temperature: 0,
    response_format: { type: "json_object" }
  });

  const response = JSON.parse(completion.choices[0].message.content);
  console.log('Parsed response from OpenAI:', JSON.stringify(response, null, 2));
  return response;
}

module.exports = {
  parseHireMessage
}; 
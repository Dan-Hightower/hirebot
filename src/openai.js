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
1. As a percentage with one decimal place (e.g., "0.3%")
2. Calculate the number of shares based on a total of 10,000,000 shares (e.g., "30,000 shares")
Format the date in full using the current year ${currentYear} (e.g., if input is "May 1", return "May 1, ${currentYear}").
If a different year is specified in the input, ignore it and use ${currentYear}.

IMPORTANT PARSING RULES:
1. The Slack handle MUST be in the format <@username> - always include the angle brackets
2. The role is what comes AFTER "as a" or "as" - it is the job title, NOT the person's name
3. If no Slack handle is found, set it to null

Example:
Input: "/hire @dan as a software engineer at $130k, 0.5% equity, starting May 1"
Should parse as:
{
  "role": "Software Engineer",
  "slackHandle": "<@dan>",
  "salary": "$130,000",
  "equity": "0.5%",
  "shares": "50,000",
  "startDate": "May 1, ${currentYear}"
}

Message: "${message}"

Return only a JSON object with these exact keys:
{
  "role": "job title (what comes after 'as a' or 'as')",
  "salary": "formatted salary with $ and commas",
  "equity": "formatted equity percentage",
  "shares": "calculated number of shares with commas",
  "startDate": "formatted full date with current year",
  "slackHandle": "slack handle in <@username> format, or null if not present"
}`;

  const completion = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-3.5-turbo",
    temperature: 0,
    response_format: { type: "json_object" }
  });

  return JSON.parse(completion.choices[0].message.content);
}

module.exports = {
  parseHireMessage
}; 
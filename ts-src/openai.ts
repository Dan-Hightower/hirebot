import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface HireData {
  role: string;
  salary: string;
  equity: string;
  startDate: string;
  slackHandle?: string;
}

export async function parseHireMessage(message: string): Promise<HireData> {
  const prompt = `
    Parse the following hiring message and extract these fields:
    - role (job title)
    - salary (in USD, should start with $)
    - equity (as percentage, should end with %)
    - startDate (in YYYY-MM-DD format if possible)
    - slackHandle (if present, should start with @)

    Message: ${message}

    Return ONLY valid JSON with these exact fields. Format dates as YYYY-MM-DD where possible.
    Example response:
    {
      "role": "Senior Engineer",
      "salary": "$150,000",
      "equity": "0.5%",
      "startDate": "2024-04-01",
      "slackHandle": "@johndoe"
    }
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that parses hiring messages into structured data. Only respond with valid JSON matching the specified format."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1, // Lower temperature for more consistent formatting
    });

    const response = completion.choices[0].message.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(response) as HireData;
    
    // Validate required fields
    if (!parsed.role || !parsed.salary || !parsed.equity || !parsed.startDate) {
      throw new Error('Missing required fields in parsed data');
    }

    // Format salary
    if (!parsed.salary.startsWith('$')) {
      parsed.salary = `$${parsed.salary}`;
    }

    // Format equity
    if (!parsed.equity.endsWith('%')) {
      parsed.equity = `${parsed.equity}%`;
    }

    return parsed;
  } catch (error) {
    console.error('Failed to parse hiring message:', error);
    throw new Error('Could not parse hiring message. Please ensure it includes role, salary, equity, and start date.');
  }
} 
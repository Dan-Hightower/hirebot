const axios = require('axios');

const DEEL_API_BASE = 'https://api.letsdeel.com/rest/v2';
const DEEL_AUTH_BASE = 'https://app.deel.com/oauth2';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

class DeelAPI {
  constructor(clientId, clientSecret) {
    if (!clientId || !clientSecret) {
      throw new Error('Deel client ID and secret are required');
    }
    console.log('Initializing Deel API client with base URL:', DEEL_API_BASE);
    
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = null;
    this.tokenExpiry = null;

    this.client = axios.create({
      baseURL: DEEL_API_BASE,
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': clientId
      }
    });

    // Initialize authentication
    this.initializeAuth();
  }

  async initializeAuth() {
    try {
      await this.getAccessToken();
      console.log('Deel API authentication initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Deel API authentication:', error);
      throw error;
    }
  }

  async getAccessToken() {
    try {
      // Check if we have a valid token
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      // Base64 encode client credentials
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await axios.post(`${DEEL_AUTH_BASE}/tokens`, 
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry to slightly before the actual expiry time
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // Subtract 1 minute for safety

      // Update client headers
      this.client.defaults.headers['Authorization'] = `Bearer ${this.accessToken}`;

      return this.accessToken;
    } catch (error) {
      console.error('Error getting Deel access token:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Deel API');
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async retryOperation(operation, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
      try {
        // Ensure we have a valid token before each operation
        await this.getAccessToken();
        return await operation();
      } catch (error) {
        if (i === retries - 1) throw error;
        
        // If rate limited, wait longer
        const delay = error.response?.status === 429 
          ? (parseInt(error.response?.headers['retry-after'] || '5') * 1000)
          : RETRY_DELAY * Math.pow(2, i);
        
        console.log(`Retry ${i + 1}/${retries} after ${delay}ms`);
        await this.sleep(delay);
      }
    }
  }

  formatDate(dateString) {
    try {
      // Handle various date formats and convert to YYYY-MM-DD
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date');
      }
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error formatting date:', dateString);
      throw new Error(`Invalid date format: ${dateString}`);
    }
  }

  async createCandidate({ 
    firstName, 
    lastName, 
    email, 
    role,
    startDate,
    country = 'US',
    state = null
  }) {
    console.log('Creating Deel candidate with data:', {
      firstName,
      lastName,
      email,
      role,
      startDate,
      country,
      state
    });

    const createOperation = async () => {
      try {
        // Format the data according to Deel's API requirements
        const formattedDate = this.formatDate(startDate);
        const candidateId = `hire_${Date.now()}`;
        
        const candidateData = {
          id: candidateId,           // Required: Unique ID in our system
          first_name: firstName,     // Required
          last_name: lastName,       // Required
          status: 'offer-accepted',  // Required: One of [offer-accepted, offer-sent, offer-declined, offer-deleted]
          email: email,              // Optional but recommended
          job_title: role,          // Optional but recommended
          start_date: formattedDate, // Required: YYYY-MM-DD format
          country: country,          // Optional
          state: state,              // Optional
          link: `https://hirebot.internal/candidates/${candidateId}` // Required: Link to candidate profile
        };

        console.log('Sending request to Deel API:', {
          url: `${DEEL_API_BASE}/candidates`,
          data: candidateData
        });

        const response = await this.client.post('/candidates', candidateData);
        console.log('Deel API raw response:', JSON.stringify(response.data, null, 2));

        if (!response.data || response.data.message !== "Ok") {
          console.error('Invalid response from Deel API:', response.data);
          throw new Error('Invalid response from Deel API');
        }

        const result = {
          success: true,
          candidateId: candidateId,
          status: 'offer-accepted'
        };
        console.log('Candidate created successfully:', result);
        return result;

      } catch (error) {
        // Handle specific API errors
        if (error.response) {
          const { status, data } = error.response;
          console.error('Deel API error response:', {
            status,
            data,
            url: error.config?.url,
            method: error.config?.method,
            requestData: error.config?.data
          });

          switch (status) {
            case 400:
              throw new Error(`Invalid request: ${JSON.stringify(data)}`);
            case 401:
              throw new Error('Invalid API credentials');
            case 403:
              throw new Error('Insufficient permissions');
            case 429:
              throw new Error('Rate limit exceeded');
            default:
              throw new Error(`Deel API error: ${JSON.stringify(data)}`);
          }
        }
        console.error('Unexpected error:', error);
        throw error;
      }
    };

    try {
      return await this.retryOperation(createOperation);
    } catch (error) {
      console.error('Error creating Deel candidate:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getCandidateStatus(candidateId) {
    const getStatusOperation = async () => {
      try {
        const response = await this.client.get(`/candidates/${candidateId}`);
        
        if (!response.data) {
          throw new Error('Invalid response from Deel API');
        }

        return {
          success: true,
          status: response.data.status
        };
      } catch (error) {
        if (error.response?.status === 404) {
          return {
            success: false,
            error: 'Candidate not found'
          };
        }
        throw error;
      }
    };

    try {
      return await this.retryOperation(getStatusOperation);
    } catch (error) {
      console.error('Error getting candidate status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = DeelAPI; 
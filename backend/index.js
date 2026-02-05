/**
 * Google Cloud Function to proxy Gemini API requests
 * This keeps the API key secure on the server side
 */

const functions = require('@google-cloud/functions-framework');

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // In production, replace with your domain
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '3600'
};

/**
 * Main API proxy function
 * Handles both text/vision analysis and image generation requests
 */
functions.http('apiProxy', async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.set(corsHeaders);
    res.status(204).send('');
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.set(corsHeaders);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Get API key from environment variable (set during deployment)
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error('GEMINI_API_KEY environment variable not set');
      res.set(corsHeaders);
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    // Get the endpoint type from request body
    const { endpoint, model, requestBody } = req.body;

    if (!endpoint || !model || !requestBody) {
      res.set(corsHeaders);
      res.status(400).json({ error: 'Missing required fields: endpoint, model, requestBody' });
      return;
    }

    // Validate endpoint type
    const validEndpoints = ['generateContent'];
    if (!validEndpoints.includes(endpoint)) {
      res.set(corsHeaders);
      res.status(400).json({ error: 'Invalid endpoint' });
      return;
    }

    // Construct the Gemini API URL
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${endpoint}?key=${apiKey}`;

    console.log(`Proxying request to Gemini API: ${model}:${endpoint}`);

    // Forward the request to Gemini API
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // Get response data
    const responseData = await geminiResponse.text();
    
    // Set CORS headers
    res.set(corsHeaders);

    // Forward the status code and response
    res.status(geminiResponse.status);
    
    // Try to parse as JSON, otherwise send as text
    try {
      const jsonData = JSON.parse(responseData);
      res.json(jsonData);
    } catch (e) {
      res.send(responseData);
    }

  } catch (error) {
    console.error('Error proxying request:', error);
    res.set(corsHeaders);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

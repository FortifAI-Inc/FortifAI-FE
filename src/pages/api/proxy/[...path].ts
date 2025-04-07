import { NextApiRequest, NextApiResponse } from 'next';
import https from 'https';
import http from 'http';
import fetch from 'node-fetch';
import { config, API_VERSION } from '../../../config';

// Create an HTTPS agent that ignores self-signed certificate errors
const agent = new https.Agent({
  rejectUnauthorized: false,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;
  if (!path || !Array.isArray(path)) {
    return res.status(400).json({ error: 'Invalid path parameter' });
  }
  
  const apiPath = path.join('/');

  // Special handling for token requests
  if (apiPath === 'token') {
    try {
      const formData = new URLSearchParams();
      formData.append('username', 'development');
      formData.append('password', 'development');

      const response = await fetch(`${config.apiGatewayUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
        agent, // Use the agent that ignores SSL certificate validation
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error('Error in token proxy:', error);
      res.status(500).json({ error: 'Failed to authenticate' });
    }
    return;
  }

  // Handle all other API requests
  try {
    // Extract the service name and path from the API path
    const pathParts = apiPath.split('/');
    const serviceName = pathParts[0];
    const servicePath = pathParts.slice(1).join('/');

    // Construct the target URL
    const targetUrl = `${config.apiGatewayUrl}/api/${API_VERSION}/${serviceName}/${servicePath}`;

    console.error('Target URL:', targetUrl);
    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Host': new URL(config.apiGatewayUrl).host,
    };

    // Add authorization header if present
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }

    // Forward the request to the API gateway
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
      agent, // Use the agent that ignores SSL certificate validation
    });

    // Forward the response
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Error in API proxy:', error);
    res.status(500).json({ error: 'Failed to proxy request' });
  }
} 
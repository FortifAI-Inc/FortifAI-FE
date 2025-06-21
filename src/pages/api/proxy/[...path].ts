import { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';
import https from 'https';
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
    // Short-circuit: return a static development token
    return res.status(200).json({
      access_token: 'development_token',
      token_type: 'bearer'
    });
  }

  // Handle all other API requests
  try {
    let targetUrl: string;
    
    // Special handling for direct endpoints that don't follow service/path pattern
    if (apiPath === 'agents') {
      targetUrl = `${config.apiGatewayUrl}/api/v1/agents`;
    } else {
      // For service-based endpoints like 'events-logger/events/search'
      targetUrl = `${config.apiGatewayUrl}/api/v1/${apiPath}`;
    }
    
    // Add query parameters if present
    const url = new URL(targetUrl);
    Object.keys(req.query).forEach(key => {
      if (key !== 'path') {
        const value = req.query[key];
        if (Array.isArray(value)) {
          value.forEach(v => url.searchParams.append(key, v));
        } else if (value) {
          url.searchParams.append(key, value);
        }
      }
    });
    
    console.log(`Target URL: ${url.toString()}`);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept-Encoding': 'identity', // Disable compression to avoid gzip issues
    };

    // Forward authorization header if present
    if (req.headers.authorization) {
      headers.Authorization = req.headers.authorization;
    }

    const requestOptions: any = {
      method: req.method,
      headers,
      agent, // Use the agent that ignores SSL certificate validation
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      requestOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(url.toString(), requestOptions);
    
    if (!response.ok) {
      console.error(`API request failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`Error response: ${errorText}`);
      return res.status(response.status).json({ 
        error: `API request failed: ${response.status} ${response.statusText}`,
        details: errorText
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to proxy request',
      details: error.message 
    });
  }
} 
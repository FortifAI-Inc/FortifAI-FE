import { NextApiRequest, NextApiResponse } from 'next';
import https from 'https';
import http from 'http';
import fetch from 'node-fetch';

const agent = new https.Agent({
  rejectUnauthorized: false,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;
  const apiUrl = process.env.NEXT_PUBLIC_API_GATEWAY_URL;
  
  if (!apiUrl) {
    console.error('API URL not configured');
    return res.status(500).json({ error: 'API URL not configured' });
  }

  // Remove the /api/proxy prefix from the path
  const cleanPath = Array.isArray(path) ? path.join('/') : path;
  const targetUrl = `${apiUrl}/${cleanPath}`;
  
  console.log('Proxying request to:', targetUrl);
  
  try {
    // Create headers object
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Host': new URL(apiUrl).host,
    };

    // Add authorization header if present
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }

    // For form-urlencoded requests (like token), use the original content type
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    // Handle request body
    let body: string | undefined;
    if (req.method !== 'GET' && req.body) {
      if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
        // Convert body to URLSearchParams for form-urlencoded
        const params = new URLSearchParams();
        Object.entries(req.body).forEach(([key, value]) => {
          params.append(key, String(value));
        });
        body = params.toString();
      } else {
        // For JSON requests, stringify the body
        body = JSON.stringify(req.body);
      }
    }

    console.log('Request body:', body);

    // Forward the request
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      agent,
      // @ts-ignore - This is a valid option
      rejectUnauthorized: false,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('Proxy error response:', {
        status: response.status,
        statusText: response.statusText,
        data: errorData
      });
      return res.status(response.status).json(errorData || { error: response.statusText });
    }

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to proxy request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 
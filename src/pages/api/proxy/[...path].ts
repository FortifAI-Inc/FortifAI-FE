import { NextApiRequest, NextApiResponse } from 'next';
import https from 'https';
import http from 'http';
import fetch from 'node-fetch';

const agent = new https.Agent({
  rejectUnauthorized: false,
});

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://a12c65672e20e491e83c7a13c5662714-1758004955.eu-north-1.elb.amazonaws.com';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const path = req.query.path as string[];
    const cleanPath = path.join('/');
    
    // Special handling for token endpoint
    const targetUrl = cleanPath === 'token' 
      ? `${apiUrl}/token`
      : `${apiUrl}/api/${cleanPath}`;

    console.log(`Proxying request to: ${targetUrl}`);
    console.log(`Request body: ${req.body ? JSON.stringify(req.body) : 'undefined'}`);

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        ...(req.method !== 'GET' && req.method !== 'HEAD' ? { 'Content-Type': req.headers['content-type'] || 'application/json' } : {}),
        ...(req.headers.authorization ? { 'Authorization': req.headers.authorization } : {}),
      },
      ...(req.method !== 'GET' && req.method !== 'HEAD' && req.body ? { body: JSON.stringify(req.body) } : {}),
      agent: targetUrl.startsWith('https') ? agent : undefined,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      console.error(`Proxy error response:`, { 
        status: response.status, 
        statusText: response.statusText, 
        data 
      });
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
} 
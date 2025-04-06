import { NextApiRequest, NextApiResponse } from 'next';
import https from 'https';
import http from 'http';
import fetch from 'node-fetch';

const agent = new https.Agent({
  rejectUnauthorized: false,
});

const apiUrl = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://a12c65672e20e491e83c7a13c5662714-1758004955.eu-north-1.elb.amazonaws.com';
//const aiDetectorUrl = process.env.NEXT_PUBLIC_AI_DETECTOR_URL || 'http://ai-detector.microservices:8000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const path = req.query.path as string[];
    const cleanPath = path.join('/');
    
    console.error(`Received request for path: ${cleanPath}`);
    
    // Special handling for token endpoint
    let targetUrl;
    if (cleanPath === 'token') {
      targetUrl = `${apiUrl}/token`;
    } else if (cleanPath.startsWith('api/sandbox-enforcer/')) {
      // Handle sandbox-enforcer requests with /api prefix
      targetUrl = `${apiUrl}/${cleanPath}`;
      console.error(`Routing sandbox-enforcer request to: ${targetUrl}`);
      console.error(`Request body:`, req.body);
      
      // Ensure the request body is properly formatted and add required headers
      if (req.method === 'POST') {
        req.headers['content-type'] = 'application/json';
        req.headers['authorization'] = `Bearer ${process.env.AUTH_TOKEN || 'development_token'}`;
      }
    } else if (cleanPath.startsWith('api/')) {
      // For all other API requests, just forward to the API gateway
      targetUrl = `${apiUrl}/${cleanPath}`;
      console.error(`Routing API request to: ${targetUrl}`);
    } else if (cleanPath.startsWith('proxy/')) {
      // Remove the proxy prefix and forward to API gateway with /api prefix
      const actualPath = cleanPath.substring('proxy/'.length);
      targetUrl = `${apiUrl}/api/${actualPath}`;
      console.error(`Removing proxy prefix, routing to: ${targetUrl}`);
    } else {
      targetUrl = `${apiUrl}/${cleanPath}`;
    }

    console.error(`Proxying request to: ${targetUrl}`);
    console.error(`Request method: ${req.method}`);
    console.error(`Request headers: ${JSON.stringify(req.headers)}`);
    console.error(`Request body: ${req.body ? JSON.stringify(req.body) : 'undefined'}`);

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        ...(req.method !== 'GET' && req.method !== 'HEAD' ? { 'Content-Type': req.headers['content-type'] || 'application/json' } : {}),
        ...(req.headers.authorization ? { 'Authorization': req.headers.authorization } : {}),
      },
      ...(req.method !== 'GET' && req.method !== 'HEAD' ? { body: JSON.stringify(req.body) } : {}),
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
export const config = {
  apiGatewayUrl: process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:80',
  endpoints: {
    graph: '/api/graph',
    graphRefresh: '/api/graph/refresh',
    graphNodes: '/api/graph/nodes',
    graphLinks: '/api/graph/links',
    graphNode: (nodeId: string) => `/api/graph/nodes/${nodeId}`,
    graphLink: (linkId: string) => `/api/graph/links/${linkId}`,
  },
}; 
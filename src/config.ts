export const API_VERSION = "v1";

export const config = {
  apiGatewayUrl: process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://0FE4F18C3274EE0C7CD1E80E1C7315B4.gr7.eu-north-1.eks.amazonaws.com',
  endpoints: {
    graph: `/api/${API_VERSION}/graph`,
    graphRefresh: `/api/${API_VERSION}/graph/refresh`,
    graphNodes: `/api/${API_VERSION}/graph/nodes`,
    graphLinks: `/api/${API_VERSION}/graph/links`,
    graphNode: (nodeId: string) => `/api/${API_VERSION}/graph/nodes/${nodeId}`,
    graphLink: (linkId: string) => `/api/${API_VERSION}/graph/links/${linkId}`,
  },
}; 
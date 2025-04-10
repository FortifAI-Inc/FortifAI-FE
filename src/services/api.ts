import { config, API_VERSION } from '../config';
import { AssetData, GraphData, NodeType, Link } from '../types';

interface AuthResponse {
  access_token: string;
  token_type: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiService {
  private token: string | null = null;
  private isAuthenticating: boolean = false;

  private async authenticate() {
    if (this.isAuthenticating) return;
    
    try {
      this.isAuthenticating = true;
      const formData = new URLSearchParams();
      formData.append('username', 'development');
      formData.append('password', 'development');
      
      const response = await fetch('/api/proxy/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      const data = await response.json();
      this.token = data.access_token;
      this.isAuthenticating = false;
    } catch (error) {
      this.isAuthenticating = false;
      throw error;
    }
  }

  private async fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.token) {
      await this.authenticate();
    }

    // Construct the URL based on whether the endpoint starts with /api/
    let url;
    if (endpoint.startsWith('/api/')) {
      // For all endpoints starting with /api/, add /proxy after /api
      url = `/api/proxy${endpoint.substring(4)}`;
    } else {
      // For other endpoints, remove any leading slash and add /api/proxy/
      url = `/api/proxy/${endpoint.replace(/^\//, '')}`;
    }
    
    console.log(`Fetching with auth: ${url}`, options);

    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeout = endpoint.includes('/ai-detector/detect') ? 600000 : 30000; // 10 minutes for AI detection, 30 seconds for others
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          ...(options.method && options.method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers,
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log(`Response status: ${response.status}`, response.statusText);

      if (response.status === 401) {
        // Token expired, try to re-authenticate
        this.token = null;
        await this.authenticate();
        return this.fetchWithAuth(endpoint, options);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details available');
        console.error(`API request failed: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`API request failed: ${response.statusText}`);
      }

      return response.json();
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeout/1000} seconds. The AI detection process may still be running in the background. Please check the status later.`);
      }
      throw error;
    }
  }

  private async fetchAssets(assetType: string): Promise<AssetData[]> {
    try {
      const data = await this.fetchWithAuth(`/api/data-access/assets/type/${assetType}`);
      if (!Array.isArray(data)) {
        console.error(`[API] Invalid response format for ${assetType}:`, data);
        return [];
      }
      return data;
    } catch (error) {
      console.error(`[API] Error fetching ${assetType} assets:`, error);
      return [];
    }
  }

  private getNodeType(assetType: string): NodeType {
    const typeMapping: { [key: string]: NodeType } = {
      'ec2': 'EC2',
      'vpc': 'VPC',
      'subnet': 'Subnet',
      'sg': 'SG',
      's3': 'S3',
      'iam_role': 'IAMRole',
      'iam_policy': 'IAMPolicy',
      'user': 'IAMUser',
      'igw': 'IGW',
      'k8s_pod': 'K8sPod',
      'k8s_deployment': 'K8sDeployment',
      'k8s_service': 'K8sService',
      'k8s_node': 'K8sNode'
    };
    return typeMapping[assetType] || assetType.toUpperCase() as NodeType;
  }

  private getAssetGroup(assetType: string): string {
    const groupMapping: { [key: string]: string } = {
      'ec2': 'Compute',
      'vpc': 'Networking',
      'subnet': 'Networking',
      'sg': 'Networking',
      's3': 'Storage',
      'iam_role': 'Administrative',
      'iam_policy': 'Administrative',
      'user': 'Administrative',
      'igw': 'Networking',
      'k8s_pod': 'Kubernetes',
      'k8s_deployment': 'Kubernetes',
      'k8s_service': 'Kubernetes',
      'k8s_node': 'Kubernetes'
    };
    return groupMapping[assetType] || 'Other';
  }

  private createLinks(assets: AssetData[]): Link[] {
    const links: Link[] = [];
    // Add link creation logic here if needed
    return links;
  }

  async getGraphData(): Promise<GraphData> {
    try {
      // Fetch all asset types
      const assetTypes = ['vpc', 'subnet', 'ec2', 'sg', 's3', 'iam_role', 'iam_policy', 'user', 'igw'];
      const assets: AssetData[] = [];
      
      for (const assetType of assetTypes) {
        const data = await this.fetchAssets(assetType);
        
        // Process each asset
        data.forEach(asset => {
          if (assetType === 'ec2') {
          }
          
          const processedAsset: AssetData = {
            ...asset,
            metadata: {
              ...asset.metadata,
              asset_type: assetType,
              // Normalize VPC ID to underscore case
              vpc_id: assetType === 'vpc' 
                ? asset.metadata?.unique_id || asset.metadata?.vpc_id  // For VPCs, use unique_id or vpc_id
                : assetType === 'igw'
                  ? asset.metadata?.vpc_id || asset.metadata?.VpcId  // For IGWs, use vpc_id or VpcId
                  : asset.metadata?.vpc_id || asset.metadata?.VpcId,    // For other assets, use vpc_id or VpcId
              unique_id: asset.metadata?.unique_id || asset.metadata?.unique_id,
              // Normalize other fields to underscore case
              instance_id: asset.metadata?.instance_id || asset.metadata?.instance_id,
              instance_type: asset.metadata?.instance_type || asset.metadata?.instance_type,
              private_ip_address: asset.metadata?.private_ip_address || asset.metadata?.private_ip_address,
              public_ip_address: asset.metadata?.public_ip_address || asset.metadata?.public_ip_address,
              launch_time: asset.metadata?.launch_time || asset.metadata?.launch_time,
              network_interfaces: asset.metadata?.network_interfaces || asset.metadata?.network_interfaces,
              // For subnets, ensure subnet_id is set correctly
              subnet_id: assetType === 'subnet' 
                ? asset.metadata?.subnet_id || asset.metadata?.unique_id || asset.id  // For subnets, use subnet_id, unique_id, or id
                : asset.metadata?.subnet_id,  // For other assets, use subnet_id as is
              bucket_name: asset.metadata?.bucket_name || asset.metadata?.bucket_name,
              creation_date: asset.metadata?.creation_date || asset.metadata?.creation_date,
              internet_gateway_id: asset.metadata?.internet_gateway_id || asset.metadata?.internet_gateway_id,
              group_id: asset.metadata?.group_id || asset.metadata?.group_id,
              network_interface_id: asset.metadata?.network_interface_id || asset.metadata?.network_interface_id,
              availability_zone: asset.metadata?.availability_zone || asset.metadata?.availability_zone,
              attachment_id: asset.metadata?.attachment_id || asset.metadata?.attachment_id,
              role_id: asset.metadata?.role_id || asset.metadata?.role_id,
              role_name: asset.metadata?.role_name || asset.metadata?.role_name,
              assume_role_policy_document: asset.metadata?.assume_role_policy_document || asset.metadata?.assume_role_policy_document,
              policy_id: asset.metadata?.policy_id || asset.metadata?.policy_id,
              policy_name: asset.metadata?.policy_name || asset.metadata?.policy_name,
              attachment_count: asset.metadata?.attachment_count || asset.metadata?.attachment_count,
              permissions_boundary_usage_count: asset.metadata?.permissions_boundary_usage_count || asset.metadata?.permissions_boundary_usage_count,
              user_id: asset.metadata?.user_id || asset.metadata?.user_id,
              user_name: asset.metadata?.user_name || asset.metadata?.user_name,
              access_key_ids: asset.metadata?.access_key_ids || asset.metadata?.access_key_ids,
              attached_policy_names: asset.metadata?.attached_policy_names || asset.metadata?.attached_policy_names,
              inline_policy_names: asset.metadata?.inline_policy_names || asset.metadata?.inline_policy_names,
              is_ai: asset.metadata?.is_ai || asset.metadata?.is_ai,
              ai_detection_details: asset.metadata?.ai_detection_details || asset.metadata?.ai_detection_details,
              is_ignored: asset.metadata?.is_ignored || asset.metadata?.is_ignored,
              is_sandbox: asset.metadata?.is_sandbox || asset.metadata?.is_sandbox,
              tags: asset.metadata?.tags
            }
          };
          
          if (assetType === 'ec2') {
            console.error('[API Debug] Processed EC2 asset:', {
              id: processedAsset.id,
              name: processedAsset.name,
              metadata: processedAsset.metadata,
              vpcId: processedAsset.metadata.vpc_id,
              subnetId: processedAsset.metadata.subnet_id
            });
          }
          
          assets.push(processedAsset);
        });
      }
      
      // Create nodes and links
      const nodes = assets.map(asset => ({
        id: asset.id,
        name: asset.name,
        type: this.getNodeType(asset.metadata.asset_type),
        group: this.getAssetGroup(asset.metadata.asset_type),
        val: 1,
        metadata: asset.metadata
      }));
      
      const links = this.createLinks(assets);
      
      // Log final asset distribution
      console.error('[API Debug] Final asset distribution:', {
        total: nodes.length,
        byType: nodes.reduce((acc, node) => {
          acc[node.type] = (acc[node.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });
      
      return {
        nodes,
        links,
        metadata: {
          totalNodes: nodes.length,
          assetTypes: Object.keys(assets.reduce((acc, asset) => {
            acc[asset.metadata.asset_type] = (acc[asset.metadata.asset_type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)),
          vpcCount: assets.filter(asset => asset.metadata.asset_type === 'vpc').length,
          lastUpdate: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error fetching graph data:', error);
      throw error;
    }
  }

  async refreshGraphData(): Promise<GraphData> {
    try {
      await this.fetchWithAuth(`/api/${API_VERSION}/data-access/assets/refresh`, {
        method: 'POST',
      });
      return this.getGraphData();
    } catch (error) {
      console.error('Failed to refresh graph data:', error);
      throw error;
    }
  }

  async updateAsset(assetId: string, updates: Partial<AssetData>): Promise<AssetData> {
    try {
      return await this.fetchWithAuth(`/api/${API_VERSION}/data-access/assets/${assetId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    } catch (error) {
      console.error('Failed to update asset:', error);
      throw error;
    }
  }

  async fortifaiAction(instanceId: string): Promise<any> {
    try {
      return await this.fetchWithAuth(`/api/${API_VERSION}/sandbox-enforcer/fortifai`, {
        method: 'POST',
        body: JSON.stringify({ instanceId }),
      });
    } catch (error) {
      console.error('Failed to process FortifAI action:', error);
      throw error;
    }
  }

  async post(endpoint: string, data?: any): Promise<any> {
    try {
      console.log(`Making POST request to ${endpoint}`, data);
      return await this.fetchWithAuth(endpoint, {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      });
    } catch (error) {
      console.error(`Failed to make POST request to ${endpoint}:`, error);
      throw error;
    }
  }
}

export const api = new ApiService();
export type { AssetData, GraphData, NodeType, Link };
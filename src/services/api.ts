import { config } from '../config';

export type NodeType = "VPC" | "Subnet" | "EC2" | "S3" | "IAMRole" | "IAMPolicy" | "IAMUser" | "NI" | "SG" | "IGW";

interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface AssetData {
  id: string;
  name: string;
  type: NodeType;
  group: string;
  val: number;
  metadata: {
    assetType: string;
    // EC2 fields
    instanceId?: string;
    instanceType?: string;
    state?: string;
    privateIpAddress?: string;
    publicIpAddress?: string;
    launchTime?: string;
    networkInterfaces?: string[];
    architecture?: string;
    platformDetails?: string;
    // VPC fields
    VpcId?: string;
    vpc_id?: string;
    cidrBlock?: string;
    uniqueId?: string;
    // Subnet fields
    subnetId?: string;
    // S3 fields
    bucketName?: string;
    creationDate?: string;
    // IGW fields
    internetGatewayId?: string;
    // SG fields
    groupId?: string;
    // NI fields
    networkInterfaceId?: string;
    availabilityZone?: string;
    description?: string;
    attachmentId?: string;
    // IAM fields
    roleId?: string;
    roleName?: string;
    assumeRolePolicyDocument?: string;
    policyId?: string;
    policyName?: string;
    attachmentCount?: number;
    permissionsBoundaryUsageCount?: number;
    document?: string;
    userId?: string;
    userName?: string;
    accessKeyIds?: string[];
    attachedPolicyNames?: string[];
    inlinePolicyNames?: string[];
    IsAI?: boolean;
    AIDetectionDetails?: string;
    IsIgnored?: boolean;
    IsSandbox?: boolean;
    tags?: { Key: string; Value: string }[];
  };
}

export interface Link {
  source: string;
  target: string;
  value: number;
}

export interface GraphData {
  nodes: AssetData[];
  links: Link[];
  metadata: {
    totalNodes: number;
    assetTypes: string[];
    vpcCount: number;
    lastUpdate: string;
  };
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

class ApiService {
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

    const response = await fetch(`/api/proxy${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      }
    });

    if (response.status === 401) {
      // Token expired, try to re-authenticate
      this.token = null;
      await this.authenticate();
      return this.fetchWithAuth(endpoint, options);
    }

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  private async fetchAssets(assetType: string): Promise<AssetData[]> {
    try {
      const data = await this.fetchWithAuth(`/data-access/assets/type/${assetType}`);
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
      'iam_user': 'IAMUser',
      'igw': 'IGW'
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
      'iam_user': 'Administrative',
      'igw': 'Networking'
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
      console.error('[API] Starting to fetch graph data...');
      
      // Fetch all asset types
      const assetTypes = ['vpc', 'subnet', 'ec2', 'sg', 's3', 'iam_role', 'iam_policy', 'iam_user', 'igw'];
      const assets: AssetData[] = [];
      
      for (const assetType of assetTypes) {
        console.error(`[API] Fetching ${assetType} assets...`);
        const data = await this.fetchAssets(assetType);
        console.error(`[API] Raw ${assetType} data from backend:`, JSON.stringify(data, null, 2));
        
        // Process each asset
        data.forEach(asset => {
          if (assetType === 'igw') {
            console.error('[API] Processing IGW asset:', {
              assetId: asset.id,
              assetName: asset.name,
              rawMetadata: asset.metadata,
              vpcId: asset.metadata?.vpc_id,
              VpcId: asset.metadata?.VpcId
            });
          }
          
          const processedAsset: AssetData = {
            ...asset,
            metadata: {
              ...asset.metadata,
              assetType: assetType,
              VpcId: assetType === 'vpc' 
                ? asset.metadata?.uniqueId  // For VPCs, use uniqueId as VpcId
                : assetType === 'igw'
                  ? asset.metadata?.VpcId || asset.metadata?.vpc_id  // For IGWs, use VpcId or vpc_id
                  : asset.metadata?.VpcId,    // For other assets, use VpcId
              uniqueId: asset.metadata?.uniqueId
            }
          };
          
          if (assetType === 'igw') {
            console.error('[API] Processed IGW asset:', {
              assetId: processedAsset.id,
              assetName: processedAsset.name,
              processedMetadata: processedAsset.metadata,
              finalVpcId: processedAsset.metadata.VpcId
            });
          }
          
          assets.push(processedAsset);
        });
      }
      
      // Log final asset distribution
      const assetDistribution = assets.reduce((acc, asset) => {
        acc[asset.metadata.assetType] = (acc[asset.metadata.assetType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.error('[API] Final asset distribution:', assetDistribution);
      
      // Create nodes and links
      const nodes = assets.map(asset => ({
        id: asset.id,
        name: asset.name,
        type: this.getNodeType(asset.metadata.assetType),
        group: this.getAssetGroup(asset.metadata.assetType),
        val: 1,
        metadata: asset.metadata
      }));
      
      // Log IGW nodes specifically
      const igwNodes = nodes.filter(node => node.type === 'IGW');
      console.error('[API] IGW nodes:', igwNodes.map(node => ({
        id: node.id,
        name: node.name,
        metadata: node.metadata
      })));
      
      const links = this.createLinks(assets);
      
      return {
        nodes,
        links,
        metadata: {
          totalNodes: nodes.length,
          assetTypes: Object.keys(assetDistribution),
          vpcCount: assetDistribution.vpc || 0,
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
      await this.fetchWithAuth('/data-access/assets/refresh', {
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
      return await this.fetchWithAuth(`/data-access/assets/${assetId}`, {
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
      return await this.fetchWithAuth('/fortifai', {
        method: 'POST',
        body: JSON.stringify({ instanceId }),
      });
    } catch (error) {
      console.error('Failed to process FortifAI action:', error);
      throw error;
    }
  }
}

export const api = new ApiService();
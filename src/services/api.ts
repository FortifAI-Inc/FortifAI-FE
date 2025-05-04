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

      const data = await response.json();
      
      // Ensure the response has the correct structure
      if (Array.isArray(data)) {
        return data.map(item => ({
          ...item,
          tags: item.tags || {},
          metadata: {
            ...item.metadata,
            tags: item.metadata?.tags || {}
          }
        }));
      }
      
      return data;
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
      
      // Ensure each asset has the correct structure
      return data.map(asset => ({
        ...asset,
        tags: asset.tags || {},
        metadata: {
          ...asset.metadata,
          tags: asset.metadata?.tags || {}
        }
      }));
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
      // Fetch all asset types including Kubernetes resources
      const assetTypes = [
        'vpc', 'subnet', 'ec2', 'sg', 's3', 'iam_role', 'iam_policy', 'user', 'igw',
        'k8s_pod', 'k8s_node', 'k8s_deployment', 'k8s_service'
      ];
      const assets: AssetData[] = [];
      
      for (const assetType of assetTypes) {
        const data = await this.fetchAssets(assetType);
        
        // Process each asset
        data.forEach(asset => {
          // Add debug logging for EC2 instances
          if (assetType === 'ec2') {
            console.log('Processing EC2 asset:', {
              id: asset.id,
              name: asset.name,
              metadata: {
                instance_id: asset.metadata?.instance_id,
                unique_id: asset.metadata?.unique_id,
                has_flow_logs: asset.metadata?.has_flow_logs
              },
              raw_metadata: asset.metadata
            });
          }
          
          const processedAsset: AssetData = {
            ...asset,
            is_stale: asset.is_stale,
            metadata: {
              ...asset.metadata,
              asset_type: asset.metadata?.asset_type || assetType,
              vpc_id: asset.metadata?.vpc_id || asset.metadata?.vpc_id,
              unique_id: asset.metadata?.unique_id || asset.metadata?.unique_id,
              instance_id: asset.metadata?.instance_id || asset.metadata?.instance_id,
              instance_type: asset.metadata?.instance_type || asset.metadata?.instance_type,
              private_ip_address: asset.metadata?.private_ip_address || asset.metadata?.private_ip_address,
              public_ip_address: asset.metadata?.public_ip_address || asset.metadata?.public_ip_address,
              launch_time: asset.metadata?.launch_time || asset.metadata?.launch_time,
              network_interfaces: asset.metadata?.network_interfaces || asset.metadata?.network_interfaces,
              subnet_id: asset.metadata?.subnet_id || asset.metadata?.subnet_id,
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
              tags: asset.tags,
              is_sandbox: asset.metadata?.is_sandbox || asset.metadata?.is_sandbox,
              has_flow_logs: asset.metadata?.has_flow_logs || false
            }
          };
          
          assets.push(processedAsset);
        });
      }
      
      // Create nodes and links
      const nodes = assets.map(asset => {
        // Add debug logging for EC2 nodes
        if (asset.metadata.asset_type === 'ec2') {
          console.log('Creating EC2 node:', {
            id: asset.id,
            name: asset.name,
            metadata: {
              instance_id: asset.metadata.instance_id,
              unique_id: asset.metadata.unique_id,
              has_flow_logs: asset.metadata.has_flow_logs
            },
            raw_metadata: asset.metadata
          });
        }

        return {
          id: asset.id,
          name: asset.name,
          type: this.getNodeType(asset.metadata.asset_type),
          group: this.getAssetGroup(asset.metadata.asset_type),
          val: 1,
          metadata: {
            ...asset.metadata,
            // Ensure EC2-specific fields are properly set
            ...(asset.metadata.asset_type === 'ec2' ? {
              instance_id: asset.metadata.instance_id,
              instance_type: asset.metadata.instance_type,
              state: asset.metadata.state,
              private_ip_address: asset.metadata.private_ip_address,
              public_ip_address: asset.metadata.public_ip_address,
              launch_time: asset.metadata.launch_time,
              network_interfaces: asset.metadata.network_interfaces || [],
              architecture: asset.metadata.architecture,
              platform_details: asset.metadata.platform_details,
              vpc_id: asset.metadata.vpc_id,
              subnet_id: asset.metadata.subnet_id,
              has_flow_logs: asset.metadata.has_flow_logs || false,
              is_ai: asset.metadata.is_ai || false,
              ai_detection_details: asset.metadata.ai_detection_details || '',
              ai_detection_confidence: asset.metadata.ai_detection_confidence || 0
            } : {})
          }
        };
      });
      
      const links = this.createLinks(assets);
      
      // Match EC2 instances with Kubernetes nodes
      const ec2Instances = nodes.filter(node => node.type === 'EC2' && node.metadata.is_kubernetes_node);
      const k8sNodes = nodes.filter(node => node.type === 'K8sNode');
      //console.error('k8sNodes', k8sNodes);
      ec2Instances.forEach(ec2 => {
        // Extract instance ID from the EC2 node ID
        const instanceId = ec2.id.split('_').pop();
        
        // Find matching Kubernetes node by instance ID in tags
        const matchingK8sNode = k8sNodes.find(k8sNode => {
          const nodeTags = k8sNode.metadata.tags || {};
          const nodeInstanceId = nodeTags['alpha.eksctl.io/instance-id'];
          return nodeInstanceId === instanceId;
        });
        
        if (matchingK8sNode) {
          // Add the Kubernetes node name to the EC2's metadata
          ec2.metadata.k8s_node_name = matchingK8sNode.name;
          
          console.log('Matched EC2 with K8s node:', {
            ec2Name: ec2.name,
            ec2Id: ec2.id,
            k8sNodeName: matchingK8sNode.name,
            instanceId
          });
        }
      });
      
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

  async getPodsForNode(nodeName: string): Promise<AssetData[]> {
    return this.fetchWithAuth(`/api/kubernetes/nodes/${nodeName}/pods`);
  }

  async getKubernetesPods(instanceId: string): Promise<{ pods: any[] }> {
    return this.fetchWithAuth(`/api/kubernetes/nodes/${instanceId}/pods`);
  }

  async refreshGraphData(): Promise<GraphData> {
    try {
      await this.fetchWithAuth('/api/data-access/assets/refresh', {
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

  async activateFlowLogs(instanceId: string): Promise<any> {
    console.log('Calling activateFlowLogs API for instance:', instanceId);
    const response = await this.post('/api/assets-monitor/api/v1/activate_flowlog_ec2', { instance_id: instanceId });
    console.log('activateFlowLogs API response:', response);
    return response;
  }

  async deactivateFlowLogs(instanceId: string): Promise<any> {
    console.log('Calling deactivateFlowLogs API for instance:', instanceId);
    const response = await this.post('/api/assets-monitor/api/v1/deactivate_flowlog_ec2', { instance_id: instanceId });
    console.log('deactivateFlowLogs API response:', response);
    return response;
  }
}

export const api = new ApiService();
export type { AssetData, GraphData, NodeType, Link };
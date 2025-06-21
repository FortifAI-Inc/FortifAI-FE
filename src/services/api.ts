import { config, API_VERSION } from '../config';
import { AssetData, GraphData, NodeType, Link, CloudTrailCollection, AnalyticsResult } from '../types';

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
  private graphDataCache: GraphData | null = null;
  private lastFetchTime: number = 0;
  private fetchInProgress: boolean = false;
  private fetchPromise: Promise<GraphData> | null = null;

  private async authenticate() {
    try {
      const response = await fetch('/api/proxy/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username: 'development',
          password: 'development'
        }).toString()
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const data = await response.json();
      this.token = data.access_token;
      return this.token;
    } catch (error) {
      console.error('[API] Authentication error:', error);
      throw error;
    }
  }

  private async fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<any> {
    // Ensure we have a valid token
    if (!this.token) {
      await this.authenticate();
    }

    // Always construct the URL with /api/proxy prefix
    const url = `/api/proxy/${endpoint.replace(/^\/api\//, '')}`;
    
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
          ...(options.method && options.method == 'POST' ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers,
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 401 || response.status === 403) {
        // Token expired or invalid, try to re-authenticate
        this.token = null;
        await this.authenticate();
        // Retry the request with the new token
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
    // If there's a fetch in progress, return the existing promise
    if (this.fetchInProgress && this.fetchPromise) {
      return this.fetchPromise;
    }

    // If we have cached data that's less than 5 minutes old, return it
    const now = Date.now();
    if (this.graphDataCache && (now - this.lastFetchTime) < 5 * 60 * 1000) {
      return this.graphDataCache;
    }

    // Start a new fetch
    this.fetchInProgress = true;
    this.fetchPromise = this.fetchGraphData();
    
    try {
      const result = await this.fetchPromise;
      this.graphDataCache = result;
      this.lastFetchTime = now;
      return result;
    } finally {
      this.fetchInProgress = false;
      this.fetchPromise = null;
    }
  }

  private async fetchGraphData(): Promise<GraphData> {
    try {
      // Ensure we have a valid token before starting
      if (!this.token) {
        await this.authenticate();
      }

      // Fetch all asset types including Kubernetes resources
      const assetTypes = [
        'vpc', 'subnet', 'ec2', 'sg', 's3', 'iam_role', 'iam_policy', 'user', 'igw',
        'k8s_pod', 'k8s_node', 'k8s_deployment', 'k8s_service'
      ];
      const assets: AssetData[] = [];
      const failedAssetTypes: string[] = [];
      
      // Process assets sequentially to avoid rate limiting
      for (const assetType of assetTypes) {
        try {
          console.log(`[API] Fetching ${assetType} assets...`);
          const data = await this.fetchAssets(assetType);
          
          if (!Array.isArray(data)) {
            console.error(`[API] Invalid response format for ${assetType}:`, data);
            failedAssetTypes.push(assetType);
            continue;
          }
          
          data.forEach(asset => {
            const processedAsset: AssetData = {
              ...asset,
              is_stale: asset.is_stale || false,
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
          
          console.log(`[API] Successfully fetched ${data.length} ${assetType} assets`);
          
          // Add a small delay between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`[API] Error fetching ${assetType} assets:`, error);
          failedAssetTypes.push(assetType);
        }
      }
      
      if (failedAssetTypes.length > 0) {
        console.warn(`[API] Failed to fetch the following asset types: ${failedAssetTypes.join(', ')}`);
      }
      
      // Create nodes and links
      const nodes = assets.map(asset => {
        return {
          id: asset.unique_id,
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
          },
          is_stale: asset.is_stale
        };
      });
      
      const links = this.createLinks(assets);
      
      // Match EC2 instances with Kubernetes nodes
      const ec2Instances = nodes.filter(node => node.type === 'EC2' && node.metadata.is_kubernetes_node);
      const k8sNodes = nodes.filter(node => node.type === 'K8sNode');
      
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
        }
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
          lastUpdate: new Date().toISOString(),
          failedAssetTypes
        }
      };
    } catch (error) {
      console.error('[API] Error fetching graph data:', error);
      throw error;
    }
  }

  async getPodsForNode(nodeName: string): Promise<AssetData[]> {
    const response = await this.fetchWithAuth(`/api/kubernetes/nodes/${nodeName}/pods`);
    console.log('Raw pod response:', response);
    
    // Ensure each pod has the correct structure and preserve is_stale flag
    return response.map((pod: AssetData) => ({
      ...pod,
      is_stale: pod.is_stale || false,
      tags: pod.tags || {},
      metadata: {
        ...pod.metadata,
        tags: pod.metadata?.tags || {},
        is_stale: pod.is_stale || false
      }
    }));
  }

  async getKubernetesPods(instanceId: string): Promise<{ pods: any[] }> {
    return this.fetchWithAuth(`/api/kubernetes/nodes/${instanceId}/pods`);
  }

  async refreshGraphData(): Promise<GraphData> {
    try {
      await this.fetchWithAuth('/api/v1/sync', {
        method: 'POST'
      });
      return this.getGraphData();
    } catch (error) {
      console.error('[API] Error refreshing graph data:', error);
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

  async startLogCollection(collectionConfig: {
    startTime: string;
    endTime: string;
    continuePrevious: boolean;
    seriesId?: string;
  }): Promise<any> {
    try {
      // The endpoint path needs to be correctly formatted for the proxy.
      // If the actual backend endpoint is /api/v1/logs-collector/collect,
      // and the proxy takes /api/proxy/[service]/[path],
      // then the path here should be logs-collector/collect
      const endpoint = 'logs-collector/collect';
      console.log(`Starting log collection with config:`, collectionConfig);
      return await this.fetchWithAuth(endpoint, {
        method: 'POST',
        body: JSON.stringify(collectionConfig),
      });
    } catch (error) {
      console.error('Failed to start log collection:', error);
      throw error;
    }
  }

  async getCloudTrailCollections(): Promise<CloudTrailCollection[]> {
    const endpoint = 'logs-collector/collect/list';
    try {
      const data = await this.fetchWithAuth(endpoint, { method: 'GET' });
      if (!data || !Array.isArray(data.collections)) {
        console.error('[API] Invalid response format for CloudTrail collections:', data);
        return []; 
      }
      // Log the raw data received from logs-collector
      console.log('api.ts: Raw data from logs-collector:', JSON.stringify(data, null, 2));

      return data.collections.map((item: any) => {
        // ADDED LOGS START
        console.log(`api.ts item mapping for seriesId: ${item.seriesId}`);
        console.log(`api.ts item.creationDate: ${item.creationDate}, type: ${typeof item.creationDate}`);
        console.log(`api.ts item.firstEventTime: ${item.firstEventTime}, type: ${typeof item.firstEventTime}`);
        console.log(`api.ts item.lastEventTime: ${item.lastEventTime}, type: ${typeof item.lastEventTime}`);
        console.log(`api.ts item.startTime: ${item.startTime}, type: ${typeof item.startTime}`);
        console.log(`api.ts item.endTime: ${item.endTime}, type: ${typeof item.endTime}`);
        // ADDED LOGS END

        return {
          seriesId: item.seriesId,
          creationDate: item.creationDate || item.startTime || new Date().toISOString(),
          lastUpdate: item.lastUpdate || new Date().toISOString(),
          eventCount: item.eventCount || 0,
          firstEventTime: item.firstEventTime || item.startTime || new Date().toISOString(),
          lastEventTime: item.lastEventTime || item.endTime || new Date().toISOString(),
          status: item.status || 'Unknown',
          filter: item.filter || "N/A",
        };
      });
    } catch (error) {
      console.error('[API] Error fetching CloudTrail collections:', error);
      throw error;
    }
  }

  async runComputeEventsAnalysis(payload: {
    seriesId: string;
    startTime: string;
    endTime: string;
  }): Promise<any> {
    const endpoint = 'logs-collector/analyze/compute-events';
    try {
      console.log(`[API] Running compute events analysis with payload:`, payload);
      return await this.fetchWithAuth(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('[API] Error running compute events analysis:', error);
      throw error;
    }
  }

  async getAnalytics(seriesId?: string): Promise<AnalyticsResult[]> {
    try {
      const endpoint = seriesId 
        ? `logs-collector/analytics/list?seriesId=${seriesId}`
        : 'logs-collector/analytics/list';
      const response = await this.fetchWithAuth(endpoint);
      return response;
    } catch (error) {
      console.error('Error fetching analytics:', error);
      throw error;
    }
  }

  async getAnalyticsById(seriesId: string, analysisId: string): Promise<any> {
    try {
      const endpoint = `logs-collector/cloudtrail/analytics/${seriesId}/${analysisId}`;
      const response = await this.fetchWithAuth(endpoint);
      return response;
    } catch (error) {
      console.error('Error fetching analytics by ID:', error);
      throw error;
    }
  }

  async deleteAnalyticsById(seriesId: string, analysisId: string): Promise<any> {
    try {
      const endpoint = `logs-collector/cloudtrail/analytics/${seriesId}/${analysisId}`;
      const response = await this.fetchWithAuth(endpoint, {
        method: 'DELETE'
      });
      return response;
    } catch (error) {
      console.error('Error deleting analytics by ID:', error);
      throw error;
    }
  }

  // Glassbox Activity Log APIs
  async getAgents(): Promise<any[]> {
    try {
      console.log('Fetching agents...');
      const endpoint = 'agents';  // This will route to data-access-service via API gateway
      const response = await this.fetchWithAuth(endpoint);
      console.log('Raw agents response:', response);
      
      if (!response) {
        console.error('No response received from agents endpoint');
        return [];
      }
      
      if (response.agents && Array.isArray(response.agents)) {
        console.log('Successfully parsed agents:', response.agents);
        return response.agents;
      }
      
      if (Array.isArray(response)) {
        console.log('Response is array, returning directly:', response);
        return response;
      }
      
      console.error('Unexpected response format for agents:', response);
      return [];
    } catch (error) {
      console.error('Error fetching agents:', error);
      throw error;
    }
  }

  async getEvents(params: {
    agent_id?: string;
    start_time?: string;
    end_time?: string;
    event_type?: string;
    limit?: number;
    offset?: number;
  }): Promise<any> {
    try {
      const queryParams = new URLSearchParams();
      if (params.agent_id) queryParams.append('agent_id', params.agent_id);
      if (params.start_time) queryParams.append('start_time', params.start_time);
      if (params.end_time) queryParams.append('end_time', params.end_time);
      if (params.event_type) queryParams.append('event_type', params.event_type);
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.offset) queryParams.append('offset', params.offset.toString());
      
      const endpoint = `events-logger/events/search?${queryParams.toString()}`;
      const response = await this.fetchWithAuth(endpoint);
      return response;
    } catch (error) {
      console.error('Error fetching events:', error);
      throw error;
    }
  }

  async getEventById(eventId: string): Promise<any> {
    try {
      const endpoint = `events-logger/events/${eventId}`;
      const response = await this.fetchWithAuth(endpoint);
      return response;
    } catch (error) {
      console.error('Error fetching event by ID:', error);
      throw error;
    }
  }

  async getEventStats(agentId?: string, timeRange?: string): Promise<any> {
    try {
      const queryParams = new URLSearchParams();
      if (agentId) queryParams.append('agent_id', agentId);
      if (timeRange) queryParams.append('time_range', timeRange);
      
      const endpoint = `events-logger/stats?${queryParams.toString()}`;
      const response = await this.fetchWithAuth(endpoint);
      return response;
    } catch (error) {
      console.error('Error fetching event stats:', error);
      throw error;
    }
  }
}

export const api = new ApiService();
export type { GraphData, NodeType, Link, CloudTrailCollection };
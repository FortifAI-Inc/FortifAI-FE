export type NodeType = 
  | 'EC2' 
  | 'VPC' 
  | 'Subnet' 
  | 'S3' 
  | 'IGW' 
  | 'SG' 
  | 'NI' 
  | 'IAMRole' 
  | 'IAMPolicy' 
  | 'User'
  | 'IAMUser'
  | 'K8sPod'
  | 'K8sNode'
  | 'K8sDeployment'
  | 'K8sService';

export interface Link {
  source: string;
  target: string;
  value: number;
}

export interface AssetData {
  id: string;
  name: string;
  type: NodeType;
  group: string;
  val: number;
  metadata: AssetMetadata;
  is_stale?: boolean;
  tags?: { [key: string]: string };
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

export interface AssetMetadata {
  asset_type: string;
  vpc_id?: string;
  unique_id?: string;
  instance_id?: string;
  instance_type?: string;
  private_ip_address?: string;
  public_ip_address?: string;
  launch_time?: string;
  network_interfaces?: string[];
  subnet_id?: string;
  bucket_name?: string;
  creation_date?: string;
  internet_gateway_id?: string;
  group_id?: string;
  network_interface_id?: string;
  availability_zone?: string;
  attachment_id?: string;
  role_id?: string;
  role_name?: string;
  assume_role_policy_document?: string;
  policy_id?: string;
  policy_name?: string;
  attachment_count?: number;
  permissions_boundary_usage_count?: number;
  user_id?: string;
  user_name?: string;
  access_key_ids?: string[];
  attached_policy_names?: string[];
  inline_policy_names?: string[];
  is_ai?: boolean;
  ai_detection_details?: string;
  ai_detection_confidence?: number;
  is_ignored?: boolean;
  tags?: { [key: string]: string };
  is_sandbox?: boolean;
  has_flow_logs?: boolean;
  state?: string;
  architecture?: string;
  platform_details?: string;
  ai_detected_processes?: string[];
} 
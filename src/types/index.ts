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
  metadata: any;
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
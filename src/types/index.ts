export type NodeType = "VPC" | "Subnet" | "EC2" | "S3" | "IAMRole" | "IAMPolicy" | "IAMUser" | "NI" | "SG" | "IGW";

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
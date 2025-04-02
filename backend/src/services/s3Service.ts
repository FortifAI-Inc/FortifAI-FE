import { S3Client, GetObjectCommand, S3ServiceException } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as parquet from 'parquetjs';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface AssetDirectory {
  AssetType: string;
  AssetTable: string;
}

interface AssetData {
  id: string;
  name: string;
  type: string;
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
    cidrBlock?: string;
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
    tags?: string[];
  };
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private assetDirectoryPath: string;
  private cache: Map<string, CacheEntry<any>>;
  private readonly CACHE_TTL = 10 * 1000; // 10 seconds in milliseconds
  private readonly TMP_DIR = os.tmpdir();

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    this.bucketName = 'fortifaidatalake';
    this.assetDirectoryPath = 'Assets/AssetDirectory.parquet';
    this.cache = new Map();
  }

  private isCacheValid<T>(entry: CacheEntry<T> | undefined): boolean {
    if (!entry) return false;
    return Date.now() - entry.timestamp < this.CACHE_TTL;
  }

  private async readParquetFile(key: string): Promise<any[]> {
    try {
      // Check cache first
      const cachedEntry = this.cache.get(key);
      if (cachedEntry && this.isCacheValid(cachedEntry)) {
        return cachedEntry.data;
      }

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
      const response = await fetch(signedUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const fileBuffer = Buffer.from(buffer);

      // Create a temporary file path
      const fileName = key.split('/').pop() || 'temp.parquet';
      const tempPath = path.join(this.TMP_DIR, fileName);

      // Write the buffer to a temporary file
      fs.writeFileSync(tempPath, fileBuffer);

      try {
        // Read the Parquet file
        const reader = await parquet.ParquetReader.openFile(tempPath);
        const cursor = reader.getCursor();
        const records = [];

        let record = null;
        while (record = await cursor.next()) {
          records.push(record);
        }

        await reader.close();

        // Update cache
        this.cache.set(key, {
          data: records,
          timestamp: Date.now(),
        });

        return records;
      } finally {
        // Clean up the temporary file
        try {
          fs.unlinkSync(tempPath);
        } catch (error) {
          console.warn(`Failed to delete temporary file ${tempPath}:`, error);
        }
      }
    } catch (error) {
      if (error instanceof S3ServiceException) {
        switch (error.name) {
          case 'NoSuchKey':
            throw new Error(`File not found: ${key}`);
          case 'AccessDenied':
            throw new Error(`Access denied to file: ${key}`);
          case 'InvalidBucketName':
            throw new Error(`Invalid bucket name: ${this.bucketName}`);
          default:
            throw new Error(`S3 error: ${error.message}`);
        }
      }
      throw error;
    }
  }

  private async getAssetDirectory(): Promise<AssetDirectory[]> {
    try {
      const records = await this.readParquetFile(this.assetDirectoryPath);
      return records.map(record => ({
        AssetType: record.AssetType,
        AssetTable: record.AssetTable,
      }));
    } catch (error) {
      console.error('Error reading asset directory:', error);
      throw new Error('Failed to read asset directory');
    }
  }

  private transformAssetData(assetType: string, data: any[]): AssetData[] {
    return data.map(record => {
      // Get the ID based on the asset type
      const id = record[`${assetType.toLowerCase()}_id`] || record[`${assetType.toLowerCase()}Id`] || record.id;

      const name = this.getNameFromRecord(record, assetType);

      // Create metadata object dynamically based on asset type
      const metadata: any = {
        assetType,
      };

      // Add fields based on asset type
      switch (assetType) {
        case 'EC2':
          metadata.instanceId = record.InstanceId;
          metadata.instanceType = record.InstanceType;
          metadata.state = record.State;
          metadata.privateIpAddress = record.PrivateIpAddress;
          metadata.publicIpAddress = record.PublicIpAddress;
          metadata.launchTime = record.LaunchTime;
          metadata.networkInterfaces = record.NetworkInterfaces;
          metadata.architecture = record.Architecture;
          metadata.platformDetails = record.PlatformDetails;
          metadata.VpcId = record.VpcId;
          metadata.subnetId = record.SubnetId;
          metadata.IsAI = record.IsAI;
          metadata.AIDetectionDetails = record.AIDetectionDetails;
          metadata.tags = record.Tags;
          break;
        case 'VPC':
          metadata.VpcId = record.VpcId;
          metadata.cidrBlock = record.CidrBlock;
          metadata.tags = record.Tags;
          break;
        case 'Subnet':
          metadata.subnetId = record.SubnetId;
          metadata.subnetArn = record.SubnetArn;
          metadata.VpcId = record.VpcId;
          metadata.cidrBlock = record.CidrBlock;
          metadata.availabilityZone = record.AvailabilityZone;
          metadata.state = record.State;
          metadata.ownerId = record.OwnerId;
          metadata.ipv6CidrBlockAssociationSet = record.Ipv6CidrBlockAssociationSet;
          metadata.tags = record.Tags;
          break;
        case 'S3':
          metadata.bucketName = record.Name;
          metadata.creationDate = record.CreationDate;
          metadata.tags = record.Tags;
          break;
        case 'IGW':
          metadata.internetGatewayId = record.InternetGatewayId;
          metadata.VpcId = record.VpcId;
          metadata.tags = record.Tags;
          break;
        case 'SG':
          metadata.groupId = record.GroupId;
          metadata.VpcId = record.VpcId;
          metadata.description = record.Description;
          metadata.tags = record.Tags;
          break;
        case 'NI':
          metadata.networkInterfaceId = record.NetworkInterfaceId;
          metadata.availabilityZone = record.AvailabilityZone;
          metadata.privateIpAddress = record.PrivateIpAddress;
          metadata.publicIp = record.PublicIp;
          metadata.description = record.Description;
          metadata.attachmentId = record.AttachmentId;
          metadata.instanceId = record.InstanceId;
          metadata.VpcId = record.VpcId;
          metadata.subnetId = record.SubnetId;
          metadata.groupId = record.GroupId;
          metadata.tags = record.Tags;
          break;
        case 'IAMRole':
          metadata.roleId = record.RoleId;
          metadata.roleName = record.RoleName;
          metadata.assumeRolePolicyDocument = record.AssumeRolePolicyDocument;
          metadata.attachedPolicyNames = record.AttachedPolicyNames;
          metadata.inlinePolicyNames = record.InlinePolicyNames;
          metadata.tags = record.Tags;
          break;
        case 'IAMPolicy':
          metadata.policyId = record.PolicyId;
          metadata.policyName = record.PolicyName;
          metadata.document = record.Document;
          metadata.attachmentCount = record.AttachmentCount;
          metadata.permissionsBoundaryUsageCount = record.PermissionsBoundaryUsageCount;
          metadata.tags = record.Tags;
          break;
        case 'User':
          metadata.userId = record.UserId;
          metadata.userName = record.UserName;
          metadata.accessKeyIds = record.AccessKeyIds;
          metadata.attachedPolicyNames = record.AttachedPolicyNames;
          metadata.inlinePolicyNames = record.InlinePolicyNames;
          metadata.tags = record.Tags;
          break;
        default:
          console.log('Unknown asset type:', assetType);
          console.log('Record:', record);
          break;
      }

      return {
        id,
        name,
        type: assetType,
        group: this.getAssetGroup(assetType),
        val: 1,
        metadata
      };
    });
  }

  private getAssetGroup(assetType: string): string {
    switch (assetType) {
      case 'EC2':
        return 'Compute';
      case 'VPC':
      case 'Subnet':
      case 'IGW':
      case 'SG':
      case 'NI':
        return 'Networking';
      case 'S3':
        return 'Storage';
      case 'IAMRole':
      case 'IAMPolicy':
      case 'IAMUser':
        return 'Administrative';
      default:
        return assetType;
    }
  }

  private getNameFromRecord(record: any, assetType: string): string {
    switch (assetType) {
      case 'EC2':
        return record.InstanceId;
      case 'VPC':
        return record.VpcId;
      case 'Subnet':
        return record.SubnetId;
      case 'S3':
        return record.Name;
      case 'IGW':
        return record.InternetGatewayId;
      case 'SG':
        return record.GroupId;
      case 'NI':
        return record.NetworkInterfaceId;
      case 'IAMRole':
        return record.RoleName;
      case 'IAMPolicy':
        return record.PolicyName;
      case 'IAMUser':
        return record.UserName;
      default:
        return record.UniqueId || 'Unknown';
    }
  }

  private createLinks(nodes: AssetData[]): { source: string; target: string; value: number }[] {
    const links: { source: string; target: string; value: number }[] = [];
    const vpcNodes = nodes.filter(node => node.type === 'VPC');
    const subnetNodes = nodes.filter(node => node.type === 'Subnet');
    const sgNodes = nodes.filter(node => node.type === 'SG');
    const networkInterfaceNodes = nodes.filter(node => node.type === 'NetworkInterface');
    const ec2Nodes = nodes.filter(node => node.type === 'EC2');

    // Create VPC frame nodes
    const vpcFrames = vpcNodes.map(vpc => ({
      id: `frame-${vpc.id}`,
      name: `VPC: ${vpc.name}`,
      type: 'VPC_FRAME',
      group: 'FRAME',
      val: 2,
      metadata: {
        ...vpc.metadata,
        assetType: 'VPC_FRAME',
      },
    }));

    // Create Administrative frame node
    const adminFrame = {
      id: 'frame-administrative',
      name: 'Administrative',
      type: 'ADMIN_FRAME',
      group: 'FRAME',
      val: 2,
      metadata: {
        assetType: 'ADMIN_FRAME',
      },
    };

    // Create Storage frame node
    const storageFrame = {
      id: 'frame-storage',
      name: 'Storage',
      type: 'STORAGE_FRAME',
      group: 'FRAME',
      val: 2,
      metadata: {
        assetType: 'STORAGE_FRAME',
      },
    };

    // Add frame nodes to the nodes array
    nodes.push(...vpcFrames, adminFrame, storageFrame);

    // Create links between VPCs and their resources
    vpcNodes.forEach(vpc => {
      const vpcFrameId = `frame-${vpc.id}`;

      // Link VPC to its frame
      links.push({
        source: vpc.id,
        target: vpcFrameId,
        value: 2,
      });

      // Link subnets to VPC frame - using the correct VpcId field
      subnetNodes
        .filter(subnet => subnet.metadata?.VpcId === vpc.metadata?.VpcId)
        .forEach(subnet => {
          links.push({
            source: subnet.id,
            target: vpcFrameId,
            value: 1,
          });
        });

      // Link security groups to VPC frame
      sgNodes
        .filter(sg => sg.metadata?.VpcId === vpc.metadata?.VpcId)
        .forEach(sg => {
          links.push({
            source: sg.id,
            target: vpcFrameId,
            value: 1,
          });
        });

      // Link network interfaces to VPC frame
      networkInterfaceNodes
        .filter(ni => ni.metadata?.VpcId === vpc.metadata?.VpcId)
        .forEach(ni => {
          links.push({
            source: ni.id,
            target: vpcFrameId,
            value: 1,
          });
        });

      // Link EC2 instances to VPC frame
      ec2Nodes
        .filter(ec2 => ec2.metadata?.VpcId === vpc.metadata?.VpcId)
        .forEach(ec2 => {
          links.push({
            source: ec2.id,
            target: vpcFrameId,
            value: 1,
          });
        });
    });

    // Create links for administrative resources
    nodes
      .filter(node => ['IAMRole', 'IAMPolicy', 'IAMUser'].includes(node.type))
      .forEach(node => {
        links.push({
          source: node.id,
          target: adminFrame.id,
          value: 1,
        });
      });

    // Create links for storage resources
    nodes
      .filter(node => node.type === 'S3')
      .forEach(node => {
        links.push({
          source: node.id,
          target: storageFrame.id,
          value: 1,
        });
      });

    // Create cross-VPC links for resources that can belong to multiple VPCs
    networkInterfaceNodes.forEach(ni => {
      const vpcId = ni.metadata?.VpcId;
      if (vpcId) {
        const vpcFrameId = `frame-${vpcId}`;
        links.push({
          source: ni.id,
          target: vpcFrameId,
          value: 1,
        });
      }
    });

    return links;
  }

  async getGraphData(): Promise<{ nodes: AssetData[]; links: { source: string; target: string; value: number }[]; metadata: any }> {
    try {
      // Read asset directory
      const assetDirectory = await this.getAssetDirectory();

      // Process each asset type
      const allNodes: AssetData[] = [];
      const allLinks: { source: string; target: string; value: number }[] = [];

      for (const asset of assetDirectory) {
        try {
          const records = await this.readParquetFile(asset.AssetTable);
          const nodes = this.transformAssetData(asset.AssetType, records);
          allNodes.push(...nodes);
        } catch (error) {
          console.error(`Error processing asset type ${asset.AssetType}:`, error);
        }
      }

      // Create links between nodes
      const links = this.createLinks(allNodes);
      allLinks.push(...links);

      // Add metadata about the graph structure
      const metadata = {
        totalNodes: allNodes.length,
        totalLinks: allLinks.length,
        assetTypes: [...new Set(allNodes.map(node => node.type))],
        vpcCount: allNodes.filter(node => node.type === 'VPC').length,
        lastUpdate: new Date().toISOString(),
        frameTypes: ['ADMIN_FRAME', 'STORAGE_FRAME', 'VPC_FRAME'],
      };

      return {
        nodes: allNodes,
        links: allLinks,
        metadata,
      };
    } catch (error) {
      console.error('Error getting graph data:', error);
      throw error;
    }
  }

  // Method to clear cache
  clearCache() {
    this.cache.clear();
  }
} 
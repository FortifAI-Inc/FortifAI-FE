const AWS = require('aws-sdk');
const parquet = require('parquetjs-lite');
const fs = require('fs');
const path = require('path');
const os = require('os');

class S3Service {
  constructor() {
    this.s3Client = new AWS.S3({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    this.bucketName = 'fortifaidatalake';
    this.assetDirectoryPath = 'Assets/AssetDirectory.parquet';
    this.cache = new Map();
    this.CACHE_TTL = 10 * 1000; // 10 seconds in milliseconds
    this.TMP_DIR = os.tmpdir();
  }

  isCacheValid(entry) {
    if (!entry) return false;
    return Date.now() - entry.timestamp < this.CACHE_TTL;
  }

  async readParquetFile(key) {
    try {
      // Check cache first
      const cachedEntry = this.cache.get(key);
      if (cachedEntry && this.isCacheValid(cachedEntry)) {
        return cachedEntry.data;
      }

      const command = {
        Bucket: this.bucketName,
        Key: key,
      };

      const { Body } = await this.s3Client.getObject(command).promise();
      const fileBuffer = Buffer.from(Body);

      // Create a temporary file path
      const fileName = path.basename(key);
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
      if (error.code === 'NoSuchKey') {
        throw new Error(`File not found: ${key}`);
      } else if (error.code === 'AccessDenied') {
        throw new Error(`Access denied to file: ${key}`);
      } else if (error.code === 'InvalidBucketName') {
        throw new Error(`Invalid bucket name: ${this.bucketName}`);
      } else {
        throw new Error(`S3 error: ${error.message}`);
      }
    }
  }

  async getAssetDirectory() {
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

  getAssetGroup(assetType) {
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

  getNameFromRecord(record, assetType) {
    let id;
    switch (assetType) {
      case 'EC2':
        id = record.InstanceId;
        break;
      case 'VPC':
        id = record.VpcId;
        break;
      case 'Subnet':
        id = record.SubnetId;
        break;
      case 'S3':
        id = record.Name;
        break;
      case 'IGW':
        id = record.InternetGatewayId;
        break;
      case 'SG':
        id = record.GroupId;
        break;
      case 'NI':
        id = record.NetworkInterfaceId;
        break;
      case 'IAMRole':
        id = record.RoleName;
        break;
      case 'IAMPolicy':
        id = record.PolicyName;
        break;
      case 'IAMUser':
        id = record.UserName;
        break;
      default:
        id = record.UniqueId || 'Unknown';
    }

    if (record.tags && Array.isArray(record.tags)) {
      const nameTag = record.tags.find(tag => tag.Key.toLowerCase() === 'name');
      if (nameTag) {
        return `${nameTag.Value} - (${id})`;
      }
    }

    return id;
  }

  transformAssetData(assetType, data) {
    return data.map(record => {
      // Get the ID based on the asset type
      const id = record[`${assetType.toLowerCase()}_id`] || record[`${assetType.toLowerCase()}Id`] || record.id;
      const name = this.getNameFromRecord(record, assetType);

      // Create metadata object dynamically based on asset type
      const metadata = {
        assetType,
      };

      // Add fields based on asset type
      switch (assetType) {
        case 'EC2':
          Object.assign(metadata, {
            instanceId: record.InstanceId,
            instanceType: record.InstanceType,
            state: record.InstanceState,
            privateIpAddress: record.PrivateIpAddress,
            publicIpAddress: record.PublicIpAddress,
            launchTime: record.LaunchTime,
            networkInterfaces: record.NetworkInterfaces,
            architecture: record.Architecture,
            platformDetails: record.PlatformDetails,
            VpcId: record.VpcId,
            subnetId: record.SubnetId,
            IsAI: record.IsAI,
            AIDetectionDetails: record.AIDetectionDetails,
            tags: record.Tags,
          });
          break;
        case 'VPC':
          Object.assign(metadata, {
            VpcId: record.VpcId,
            cidrBlock: record.CidrBlock,
            tags: record.Tags,
          });
          break;
        case 'Subnet':
          Object.assign(metadata, {
            subnetId: record.SubnetId,
            subnetArn: record.SubnetArn,
            VpcId: record.VpcId,
            cidrBlock: record.CidrBlock,
            availabilityZone: record.AvailabilityZone,
            state: record.State,
            ownerId: record.OwnerId,
            ipv6CidrBlockAssociationSet: record.Ipv6CidrBlockAssociationSet,
            tags: record.Tags,
          });
          break;
        case 'S3':
          Object.assign(metadata, {
            bucketName: record.Name,
            creationDate: record.CreationDate,
            tags: record.Tags,
          });
          break;
        case 'IGW':
          Object.assign(metadata, {
            internetGatewayId: record.InternetGatewayId,
            VpcId: record.VpcId,
            tags: record.Tags,
          });
          break;
        case 'SG':
          Object.assign(metadata, {
            groupId: record.GroupId,
            VpcId: record.VpcId,
            description: record.Description,
            tags: record.Tags,
          });
          break;
        case 'NI':
          Object.assign(metadata, {
            networkInterfaceId: record.NetworkInterfaceId,
            availabilityZone: record.AvailabilityZone,
            privateIpAddress: record.PrivateIpAddress,
            publicIp: record.PublicIp,
            description: record.Description,
            attachmentId: record.AttachmentId,
            instanceId: record.InstanceId,
            VpcId: record.VpcId,
            subnetId: record.SubnetId,
            groupId: record.GroupId,
            tags: record.Tags,
          });
          break;
        case 'IAMRole':
          Object.assign(metadata, {
            roleId: record.RoleId,
            roleName: record.RoleName,
            assumeRolePolicyDocument: record.AssumeRolePolicyDocument,
            attachedPolicyNames: record.AttachedPolicyNames,
            inlinePolicyNames: record.InlinePolicyNames,
            tags: record.Tags,
          });
          break;
        case 'IAMPolicy':
          Object.assign(metadata, {
            policyId: record.PolicyId,
            policyName: record.PolicyName,
            document: record.Document,
            attachmentCount: record.AttachmentCount,
            permissionsBoundaryUsageCount: record.PermissionsBoundaryUsageCount,
            tags: record.Tags,
          });
          break;
        case 'User':
          Object.assign(metadata, {
            userId: record.UserId,
            userName: record.UserName,
            accessKeyIds: record.AccessKeyIds,
            attachedPolicyNames: record.AttachedPolicyNames,
            inlinePolicyNames: record.InlinePolicyNames,
            tags: record.Tags,
          });
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

  createLinks(nodes) {
    const links = [];
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

      // Link subnets to VPC frame
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

  async getGraphData() {
    try {
      // Read asset directory
      const assetDirectory = await this.getAssetDirectory();

      // Process each asset type
      const allNodes = [];
      const allLinks = [];

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

  clearCache() {
    this.cache.clear();
  }
}

module.exports = {
  S3Service
}; 
import React, { useEffect, useState, useRef } from 'react';
import { Box, Typography, Paper, CircularProgress, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Button, List, ListItem, ListItemText, Divider, Grid, Card, CardContent, IconButton, Tooltip, Chip, Menu, MenuItem } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import InfoIcon from '@mui/icons-material/Info';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import StorageIcon from '@mui/icons-material/Storage';
import SecurityIcon from '@mui/icons-material/Security';
import ComputerIcon from '@mui/icons-material/Computer';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import PanToolIcon from '@mui/icons-material/PanTool';
import {
  S3Icon,
  VPCIcon,
  SubnetIcon,
  EC2Icon,
  SecurityGroupIcon,
  NetworkInterfaceIcon,
  InternetGatewayIcon,
  IAMRoleIcon,
  IAMPolicyIcon,
  IAMUserIcon
} from 'react-aws-icons';
import ReactDOM from 'react-dom';

const BackEndUrl = 'http://13.53.201.102:3001';

interface BaseMetadata {
  X?: number;
  Y?: number;
  Width?: number;
  Height?: number;
  assetType: string;
  tags?: { Key: string; Value: string }[];
  IsSandbox?: boolean;
}

interface Node {
  id: string;
  name: string;
  type: 'VPC' | 'Subnet' | 'EC2' | 'S3' | 'IAMRole' | 'IAMPolicy' | 'IAMUser' | 'NI' | 'SG' | 'IGW';
  group: string;
  val: number;
  metadata: BaseMetadata;
}

interface VPCMetadata extends BaseMetadata {
  VpcId: string;
  cidrBlock: string;
  IsSandbox?: boolean;
}

interface SubnetMetadata extends BaseMetadata {
  subnetId: string;
  VpcId: string;
  cidrBlock: string;
  availabilityZone: string;
}

interface NetworkInterfaceMetadata extends BaseMetadata {
  networkInterfaceId: string;
  availabilityZone: string;
  description?: string;
  attachmentId?: string;
  instanceId?: string;
  privateIpAddress: string;
  publicIp?: string;
  groupId?: string;
  interfaceType?: string;
  macAddress?: string;
  ownerId?: string;
  requesterId?: string;
  requesterManaged?: boolean;
  sourceDestCheck?: boolean;
  status?: string;
  VpcId: string;
  subnetId: string;
}

interface VPCNode extends Node {
  type: 'VPC';
  metadata: VPCMetadata;
}

interface SubnetNode extends Node {
  type: 'Subnet';
  metadata: SubnetMetadata;
}

interface NetworkInterfaceNode extends Node {
  type: 'NI';
  metadata: NetworkInterfaceMetadata;
}

interface GraphData {
  nodes: Node[];
  links: { source: Node; target: Node; value: number }[];
  metadata: {
    totalNodes: number;
    totalLinks: number;
    assetTypes: string[];
    vpcCount: number;
    lastUpdate: string;
    frameTypes: string[];
  };
}

interface IGWNode extends Node {
  type: 'IGW';
  metadata: BaseMetadata & {
    internetGatewayId: string;
    VpcId: string;
  };
}

interface EC2Node extends Node {
  type: 'EC2';
  metadata: BaseMetadata & {
    instanceId: string;
    instanceType: string;
    state: string;
    privateIpAddress: string;
    publicIpAddress?: string;
    launchTime: string;
    networkInterfaces: string[];
    architecture: string;
    platformDetails: string;
    VpcId: string;
    subnetId: string;
    IsAI?: boolean;
    AIDetectionDetails?: string;
    IsIgnored?: boolean;
  };
}

interface S3Node extends Node {
  type: 'S3';
  metadata: BaseMetadata & {
    bucketName: string;
    creationDate: string;
  };
}

interface SGNode extends Node {
  type: 'SG';
  metadata: BaseMetadata & {
    groupId: string;
    VpcId: string;
    description?: string;
  };
}

interface IAMRoleNode extends Node {
  type: 'IAMRole';
  metadata: BaseMetadata & {
    roleId: string;
    roleName: string;
    assumeRolePolicyDocument: string;
  };
}

interface IAMPolicyNode extends Node {
  type: 'IAMPolicy';
  metadata: BaseMetadata & {
    policyId: string;
    policyName: string;
    attachmentCount: number;
    permissionsBoundaryUsageCount: number;
    document: string;
  };
}

interface IAMUserNode extends Node {
  type: 'IAMUser';
  metadata: BaseMetadata & {
    userId: string;
    userName: string;
    accessKeyIds: string[];
    attachedPolicyNames: string[];
    inlinePolicyNames: string[];
  };
}

const sandPatternImage = new Image();
sandPatternImage.src = '/images/sand-texture.jpeg';

// Add global state for sandbox VPC
let sandboxVpcId: string | null = null;

const AI_SPM: React.FC = () => {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    node: Node | null;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();
  let subnetFrameWidth = 0;

  // Add new state for AI details dialog
  const [aiDetailsDialog, setAiDetailsDialog] = useState<{
    open: boolean;
    details: string;
  }>({
    open: false,
    details: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Fetching data from:', `${BackEndUrl}/api/graph`);
        const response = await fetch(`${BackEndUrl}/api/graph`);
        if (!response.ok) {
          throw new Error(`Failed to fetch graph data: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        console.log('Received data:', {
          totalNodes: data.nodes?.length,
          nodeTypes: data.nodes?.map((n: Node) => n.type),
          vpcNodes: data.nodes?.filter((n: Node) => n.type === 'VPC').map((n: Node) => ({
            name: n.name,
            type: n.type,
            metadata: n.metadata
          })),
          igwNodes: data.nodes?.filter((n: Node) => n.type === 'IGW').map((n: Node) => ({
            name: n.name,
            type: n.type,
            metadata: n.metadata
          }))
        });
        setGraphData(data);
      } catch (err) {
        console.error('Error fetching graph data:', err);
        setError(err instanceof Error ? err.message : 'An error occurred while fetching data');
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchData();

    // Set up polling interval
    const interval = setInterval(() => {
      console.log('Polling for fresh data...');
      fetchData();
    }, 10000); // Poll every 10 seconds

    // Clean up interval on unmount
    return () => clearInterval(interval);
  }, []);

  // Add resize handler
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth - 480;
        canvasRef.current.height = window.innerHeight - 200;
        drawCanvas();
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial size setup

    return () => window.removeEventListener('resize', handleResize);
  }, []);  // Empty dependency array since we want this only on mount/unmount

  useEffect(() => {
    drawCanvas();
  }, [graphData, theme]); // Added theme as it's used in drawing

  const getGroupIcon = (group: string) => {
    switch (group) {
      case 'Compute':
        return <ComputerIcon />;
      case 'Networking':
        return <AccountTreeIcon />;
      case 'Storage':
        return <StorageIcon />;
      case 'Administrative':
        return <SecurityIcon />;
      default:
        return <InfoIcon />;
    }
  };

  const renderNodePopup = () => {
    if (!selectedNode) return null;

    const renderMetadataList = () => {
      const entries = Object.entries(selectedNode.metadata)
        .filter(([key, value]) => value !== undefined && key !== 'assetType' && key !== 'type' /*&& key !== 'tags'*/);

      return (
        <List dense>
          {entries.map(([key, value]) => (
            <React.Fragment key={key}>
              <ListItem>
                <ListItemText
                  primary={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  secondary={Array.isArray(value) ? value.join(', ') : String(value)}
                />
              </ListItem>
              <Divider />
            </React.Fragment>
          ))}
          {selectedNode.metadata.tags && selectedNode.metadata.tags.length > 0 && (
            <>
              <ListItem>
                <ListItemText
                  primary="Tags"
                  secondary={
                    <Box sx={{ mt: 1 }}>
                      {selectedNode.metadata.tags.map((tag, index) => (
                        <Chip
                          key={index}
                          label={`${tag.Key}: ${tag.Value}`}
                          size="small"
                          sx={{ mr: 1, mb: 1 }}
                        />
                      ))}
                    </Box>
                  }
                />
              </ListItem>
              <Divider />
            </>
          )}
        </List>
      );
    };

    return (
      <Dialog
        open={!!selectedNode}
        onClose={() => setSelectedNode(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedNode.type} - {selectedNode.name}
        </DialogTitle>
        <DialogContent>
          <Typography variant="subtitle1" gutterBottom>
            Group: {selectedNode.group}
          </Typography>
          <Typography variant="body2" component="div">
            <div>Asset Type: {selectedNode.metadata.assetType}</div>
          </Typography>
          <Divider sx={{ my: 2 }} />
          {renderMetadataList()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedNode(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  };

  const renderVPCSection = (vpc: Node) => {
    const subnets = graphData?.nodes.filter(node =>
      node.type === 'Subnet' &&
      (node as SubnetNode).metadata.VpcId === (vpc as VPCNode).metadata.VpcId
    ) || [];

    const ec2Instances = graphData?.nodes.filter(node =>
      node.type === 'EC2' &&
      (node as EC2Node).metadata.VpcId === (vpc as VPCNode).metadata.VpcId
    ) || [];

    const securityGroups = graphData?.nodes.filter(node =>
      node.type === 'SG' &&
      (node as SGNode).metadata.VpcId === (vpc as VPCNode).metadata.VpcId
    ) || [];

    return (
      <Card key={vpc.id} sx={{ mb: 2, border: `1px solid ${theme.palette.primary.main}` }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <AccountTreeIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
            <Typography variant="h6">{vpc.name}</Typography>
            {'cidrBlock' in vpc.metadata && (
              <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                ({String(vpc.metadata.cidrBlock)})
              </Typography>
            )}
            <Tooltip title="View Details">
              <IconButton size="small" onClick={() => setSelectedNode(vpc)}>
                <InfoIcon />
              </IconButton>
            </Tooltip>
          </Box>

          <Grid container spacing={2}>
            {/* Subnets */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Subnets
              </Typography>
              <Grid container spacing={1}>
                {subnets.map(subnet => (
                  <Grid item xs={12} sm={6} md={4} key={subnet.id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box display="flex" alignItems="center">
                          <Typography variant="body1">{subnet.name}</Typography>
                          {'availabilityZone' in subnet.metadata && (
                            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                              ({String(subnet.metadata.availabilityZone)})
                            </Typography>
                          )}
                          <Tooltip title="View Details">
                            <IconButton size="small" onClick={() => setSelectedNode(subnet)}>
                              <InfoIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Grid>

            {/* EC2 Instances */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                EC2 Instances
              </Typography>
              <Grid container spacing={1}>
                {ec2Instances.map(instance => (
                  <Grid item xs={12} sm={6} md={4} key={instance.id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box display="flex" alignItems="center">
                          <ComputerIcon sx={{ mr: 1 }} />
                          <Typography variant="body1">{instance.name}</Typography>
                          {'instanceType' in instance.metadata && (
                            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                              ({String(instance.metadata.instanceType)})
                            </Typography>
                          )}
                          <Tooltip title="View Details">
                            <IconButton size="small" onClick={() => setSelectedNode(instance)}>
                              <InfoIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Grid>

            {/* Security Groups */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Security Groups
              </Typography>
              <Grid container spacing={1}>
                {securityGroups.map(sg => (
                  <Grid item xs={12} sm={6} md={4} key={sg.id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box display="flex" alignItems="center">
                          <SecurityIcon sx={{ mr: 1 }} />
                          <Typography variant="body1">{sg.name}</Typography>
                          <Tooltip title="View Details">
                            <IconButton size="small" onClick={() => setSelectedNode(sg)}>
                              <InfoIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  };

  const drawFrame = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, title: string, color: string) => {
    // If this is a sandbox VPC, draw sandy background first
    if (title.includes('Sandbox')) {
      // Draw a light sand color as fallback
      ctx.fillStyle = '#F5DEB3';
      ctx.fillRect(x, y, width, height);
      
      // Draw sandy pattern if image is loaded
      if (sandPatternImage.complete) {
        const pattern = ctx.createPattern(sandPatternImage, 'repeat');
        if (pattern) {
          ctx.fillStyle = pattern;
          ctx.fillRect(x, y, width, height);
        }
      }
    }

    // Draw frame border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // Draw title background
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, 30);

    // Draw title text
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    // For VPC frames, use the node's name instead of the title parameter
    const displayTitle = title.startsWith('VPC: ') ? title.substring(5) : title;
    ctx.fillText(displayTitle, x + 10, y + 20);

    // Add debug logging
    console.log(`Drawing frame: ${displayTitle} at (${x}, ${y}) with width ${width} and height ${height}`);
  };

  const drawNode = (ctx: CanvasRenderingContext2D, x: number, y: number, node: Node) => {
    console.debug(`Drawing node: ${node.name} (${node.type}) at position x:${x}, y:${y}`);

    const size = 40;

    // Get the appropriate AWS icon URL based on node type
    let iconUrl = '';
    switch (node.type) {
      case 'S3':
        iconUrl = '/aws-icons/Amazon-S3-Storage_light-bg.svg';
        break;
      case 'VPC':
        iconUrl = '/aws-icons/Amazon-VPC_light-bg.svg';
        break;
      case 'Subnet':
        iconUrl = '/aws-icons/Amazon-VPC_Subnet_light-bg.svg';
        break;
      case 'EC2':
        iconUrl = '/aws-icons/Amazon-EC2_light-bg.svg';
        break;
      case 'SG':
        iconUrl = '/aws-icons/Amazon-VPC_Security-Group_light-bg.svg';
        break;
      case 'NI':
        iconUrl = '/aws-icons/Amazon-VPC_Network-Interface_light-bg.svg';
        break;
      case 'IGW':
        iconUrl = '/aws-icons/Amazon-VPC_Internet-Gateway_light-bg.svg';
        break;
      case 'IAMRole':
        iconUrl = '/aws-icons/AWS-IAM_IAM-Role_light-bg.svg';
        break;
      case 'IAMPolicy':
        iconUrl = '/aws-icons/AWS-IAM_IAM-Policy_light-bg.svg';
        break;
      case 'IAMUser':
        iconUrl = '/aws-icons/AWS-IAM_IAM-User_light-bg.svg';
        break;
      default:
        iconUrl = '/aws-icons/General_light-bg.svg';
    }
    console.log(`Using icon URL: ${iconUrl}`);

    // Load the icon image
    const img = new Image();
    img.onload = () => {
      console.log(`Icon loaded successfully for ${node.name}`);
      // Draw the icon onto the main canvas
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(0.8, 0.8);  // Scale down to fit in the node
      ctx.drawImage(img, -24, -24, 48, 48);
      ctx.restore();
    };
    img.onerror = () => {
      console.error(`Failed to load icon for ${node.name} at URL: ${iconUrl}`);
    };
    img.src = iconUrl;

    // Draw node name and additional info
    ctx.fillStyle = node.type === 'IGW' ? '#000000' : theme.palette.text.primary;
    ctx.font = 'bold 12px Arial';  // Make text bold for better visibility
    ctx.textAlign = 'center';
    ctx.fillText(node.name, x, y + size + 15);
    console.log(`Drawing node name: ${node.name}`);

    // Draw VPC ID if available
    switch (node.type) {
      case 'VPC': {
        const metadata = (node as VPCNode).metadata;
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`VPC: ${metadata.VpcId}`, x, y + 40);
        break;
      }
      case 'Subnet': {
        const metadata = (node as SubnetNode).metadata;
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`VPC: ${metadata.VpcId}`, x, y + 40);
        break;
      }
      case 'NI': {
        const metadata = (node as NetworkInterfaceNode).metadata;
        break;
      }
    }

    // Draw additional info based on type
    ctx.font = '10px Arial';
    switch (node.type) {
      case 'EC2':
        if ('instanceType' in node.metadata && 'state' in node.metadata) {
          const instanceType = String(node.metadata.instanceType || '');
          const state = String(node.metadata.state || '');
          const displayType = state.toLowerCase() !== 'running' ? `${instanceType} (off)` : instanceType;
          ctx.fillText(displayType, x, y + size + 30);
          console.log(`Drawing EC2 instance type: ${displayType}`);
        }
        if ('state' in node.metadata) {
          ctx.fillText(String(node.metadata.state || ''), x, y + size + 45);
          console.log(`Drawing EC2 state: ${node.metadata.state}`);
        }
        if ('IsAI' in node.metadata && node.metadata.IsAI) {
          // Draw flashing border around icon
          const currentTime = Date.now();
          const alpha = Math.abs(Math.sin(currentTime / 500)); // Flash every 500ms
          // Use green for sandbox VPC instances, red for others
          const borderColor = (node as EC2Node).metadata.VpcId === sandboxVpcId 
            ? `rgba(0, 255, 0, ${alpha})`  // Green for sandbox
            : `rgba(255, 0, 0, ${alpha})`; // Red for others
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 3;  // Increased from 2 to 3 for thicker border
          ctx.strokeRect(x - 24, y - 24, 48, 48);

          // Draw AI Instance text with matching color
          ctx.fillStyle = borderColor.replace('rgba', 'rgb').replace(/[^,]+\)$/, '1)');
          ctx.fillText('AI Instance', x, y + size + 60);
          console.log(`Drawing AI instance indicator for: ${node.name}`);
        } else if ('state' in node.metadata && typeof node.metadata.state === 'string' && node.metadata.state.toLowerCase() !== 'running') {
          // Draw gray border for non-running instances
          ctx.strokeStyle = '#808080';
          ctx.lineWidth = 3;
          ctx.strokeRect(x - 24, y - 24, 48, 48);
          console.log(`Drawing gray border for non-running instance: ${node.name}`);
        }
        break;
      case 'VPC':
        if ('cidrBlock' in node.metadata) {
          ctx.fillText(String(node.metadata.cidrBlock || ''), x, y + size + 30);
          console.log(`Drawing VPC CIDR block: ${node.metadata.cidrBlock}`);
        }
        break;
      case 'Subnet':
        if ('availabilityZone' in node.metadata) {
          ctx.fillText(String(node.metadata.availabilityZone || ''), x, y + size + 30);
          console.log(`Drawing Subnet AZ: ${node.metadata.availabilityZone}`);
        }
        break;
      case 'S3':
        if ('creationDate' in node.metadata) {
          const date = new Date(String(node.metadata.creationDate || '')).toLocaleDateString();
          ctx.fillText('Created: ' + date, x, y + size + 30);
          console.log(`Drawing S3 creation date: ${date}`);
        }
        break;
      case 'SG':
        if ('groupId' in node.metadata) {
          ctx.fillText(String(node.metadata.groupId || ''), x, y + size + 30);
          console.log(`Drawing SG ID: ${node.metadata.groupId}`);
        }
        break;
      case 'IGW':
        if ('internetGatewayId' in node.metadata) {
          ctx.fillStyle = '#000000';
          ctx.fillText(String(node.metadata.internetGatewayId || ''), x, y + size - 10);
          console.log(`Drawing IGW ID: ${node.metadata.internetGatewayId}`);
        }
        break;
    }
    console.log(`Finished drawing node: ${node.name}`);
  };

  const drawTooltip = (ctx: CanvasRenderingContext2D, x: number, y: number, text: string) => {
    // Set maximum width for the tooltip
    const maxWidth = 300;
    const padding = 10;
    const lineHeight = 20;

    // Set font for measuring text
    ctx.font = '12px Arial';

    // Split text into words and create lines
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const width = ctx.measureText(currentLine + ' ' + words[i]).width;
      if (width < maxWidth) {
        currentLine += ' ' + words[i];
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    lines.push(currentLine);

    // Calculate tooltip dimensions
    const tooltipWidth = Math.min(maxWidth, Math.max(...lines.map(line => ctx.measureText(line).width))) + (padding * 2);
    const tooltipHeight = (lines.length * lineHeight) + (padding * 2);

    // Ensure tooltip stays within canvas bounds
    const canvas = ctx.canvas;
    const tooltipX = Math.min(Math.max(x - tooltipWidth / 2, padding), canvas.width - tooltipWidth - padding);
    const tooltipY = Math.min(y - tooltipHeight - 10, canvas.height - tooltipHeight - padding);

    // Draw tooltip background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

    // Draw tooltip text
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    lines.forEach((line, index) => {
      ctx.fillText(line, tooltipX + padding, tooltipY + padding + (index * lineHeight) + 12);
    });

    // Draw small triangle pointer
    ctx.beginPath();
    ctx.moveTo(x - 5, tooltipY + tooltipHeight);
    ctx.lineTo(x + 5, tooltipY + tooltipHeight);
    ctx.lineTo(x, tooltipY + tooltipHeight + 5);
    ctx.closePath();
    ctx.fill();
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !graphData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw main container
    const mainFrameX = 0;
    const mainFrameY = 0;
    const mainFrameWidth = canvas.width - 40;
    const mainFrameHeight = canvas.height - 40;
    drawFrame(ctx, mainFrameX, mainFrameY, mainFrameWidth, mainFrameHeight, 'Cloud Assets', theme.palette.primary.main);

    // Draw fixed sections at the top
    const fixedSectionHeight = 150;
    const fixedSectionCount = 2;
    const fixedSectionSpacing = 20;
    const totalFixedWidth = mainFrameWidth - (fixedSectionCount + 1) * fixedSectionSpacing;
    const fixedSectionWidth = totalFixedWidth / fixedSectionCount;

    // Draw storage section
    drawFrame(ctx, mainFrameX + fixedSectionSpacing, mainFrameY + 30, fixedSectionWidth, fixedSectionHeight, 'Storage', theme.palette.info.main);
    const s3Buckets = graphData.nodes.filter(node => node.type === 'S3');
    s3Buckets.forEach((bucket, index) => {
      drawNode(ctx, mainFrameX + fixedSectionSpacing + (fixedSectionWidth / 2) - ((s3Buckets.length - 1) * 30) + (index * 60), mainFrameY + 80, bucket);
    });

    // Draw administrative section
    drawFrame(ctx, mainFrameX + fixedSectionWidth + 2 * fixedSectionSpacing, mainFrameY + 30, fixedSectionWidth, fixedSectionHeight, 'Administrative', theme.palette.grey[700]);
    const iamResources = graphData.nodes.filter(node =>
      ['IAMRole', 'IAMPolicy', 'IAMUser'].includes(node.type)
    );

    // Calculate spacing for even distribution
    const totalWidth = fixedSectionWidth - 40; // Leave 20px padding on each side
    const spacing = totalWidth / (iamResources.length + 1); // +1 to account for edges
    const startX = mainFrameX + fixedSectionWidth + 2 * fixedSectionSpacing + 20; // Start from left edge + padding

    iamResources.forEach((resource, index) => {
      const x = startX + (spacing * (index + 1));
      const y = mainFrameY + 80;
      console.log(`Drawing IAM resource ${resource.name} at (${x}, ${y})`);
      drawNode(ctx, x, y, resource);
    });

    // Draw VPCs
    console.log('All nodes:', graphData.nodes);
    const vpcs = graphData.nodes.filter(isVPCNode);
    console.log('Filtered VPCs:', vpcs);
    console.log(`Found ${vpcs.length} VPCs to draw`);
    vpcs.forEach((vpc, vpcIndex) => {
      const vpcX = mainFrameX + fixedSectionSpacing + (vpcIndex * ((mainFrameWidth - 2 * fixedSectionSpacing) / vpcs.length));
      const vpcY = mainFrameY + 30 + fixedSectionHeight + fixedSectionSpacing;

      console.debug(`Drawing VPC ${vpc.name} at (${vpcX}, ${vpcY})`);
      let nameTag = "";

      if (vpc.metadata.tags) {
        if (typeof vpc.metadata.tags === 'object' && vpc.metadata.tags !== null) {
          if (Object.entries(vpc.metadata.tags)[0][1] == "Name") {
            nameTag = Object.entries(vpc.metadata.tags)[1][1];
          }
          if (nameTag) {
            if (nameTag === "Sandbox") {
              // Mark this special vpc as Sandbox
              vpc.metadata.IsSandbox = true;
              sandboxVpcId = vpc.metadata.VpcId;
            }
          }
        }
      }
    
      vpc.metadata.Width = (mainFrameWidth - 2 * fixedSectionSpacing - (vpcs.length - 1) * 20) / vpcs.length;
      vpc.metadata.Height = mainFrameHeight - fixedSectionHeight - fixedSectionSpacing - 60;
      vpc.metadata.X = vpcX;
      vpc.metadata.Y = vpcY;

      // Check if this VPC has any AI instances
      const hasAIInstance = graphData.nodes.some(node => 
        node.type === 'EC2' && 
        'IsAI' in node.metadata && 
        node.metadata.IsAI && 
        (node as EC2Node).metadata.VpcId === vpc.metadata.VpcId
      );
      console.error(`VPC ${vpc.name} has AI instances: ${hasAIInstance}`);
      console.error(`VPC ${vpc.name} has sandbox: ${vpc.metadata.IsSandbox}`);

      // Use green color for sandbox VPC with AI instances, otherwise use warning color
      const frameColor = vpc.metadata.IsSandbox && hasAIInstance 
        ? theme.palette.success.main 
        : theme.palette.warning.main;

      if (nameTag) {
        drawFrame(ctx, vpcX, vpcY, vpc.metadata.Width, vpc.metadata.Height, nameTag+" - "+vpc.name, frameColor);
      } else {
        drawFrame(ctx, vpcX, vpcY, vpc.metadata.Width, vpc.metadata.Height, vpc.name, frameColor);
      }

      // Draw VPC contents
      const subnets = graphData.nodes.filter(isSubnetNode);
      console.log(`Found ${subnets.length} subnets for VPC ${vpc.name}:`, subnets);

      // Calculate subnet frame dimensions TODO: incorrect
      let numSubnets = 0;
      subnets.forEach((subnet, subnetIndex) => {
        if ((subnet as SubnetNode).metadata.VpcId === vpc.metadata.VpcId) {
          numSubnets++;
        }
      });
      // Calculate optimal layout for subnets
      const maxSubnetsPerRow = 3; // Maximum subnets we want in a single row
      const numRows = Math.ceil(numSubnets / maxSubnetsPerRow);
      const numCols = Math.min(numSubnets, maxSubnetsPerRow);

      // Calculate subnet dimensions based on VPC frame size and number of subnets
      const totalPadding = 80; // Total padding to reserve (40px on each side)
      const vpcWidth = vpc.metadata.Width;
      const vpcHeight = vpc.metadata.Height;

      // Calculate subnet frame dimensions
      subnetFrameWidth = (vpcWidth - totalPadding - (numCols - 1) * 20) / numCols;
      const subnetFrameHeight = (vpcHeight - 100 - (numRows - 1) * 20) / numRows;

      //subnetFrameWidth = (mainFrameWidth - 2 * fixedSectionSpacing - 100) / subnets.length; // 100 for padding
      //const subnetFrameHeight = 200; // Height for subnet frame

      // Draw IGW for this VPC
      const igws = graphData.nodes.filter(isIGWNode).filter(igw => {
        return igw.metadata.VpcId === vpc.metadata.VpcId;
      });
      console.debug(`Found ${igws.length} IGWs for VPC ${vpc.name}`, {
        vpcId: vpc.metadata.VpcId,
        matchingIGWs: igws.map(i => ({
          name: i.name,
          vpcId: i.metadata.VpcId
        }))
      });

      igws.forEach((igw, igwIndex) => {
        igw.metadata.X = vpcX + (vpc.metadata.Width || 0) / 2;
        igw.metadata.Y = vpcY + 15; // Position in the middle of the header band (30px height)
        console.debug(`Drawing IGW ${igw.name} at (${igw.metadata.X}, ${igw.metadata.Y})`);
        drawNode(ctx, igw.metadata.X, igw.metadata.Y, igw);
      });
      let index = -1;
      subnets.forEach((subnet, subnetIndex) => {
        if ((subnet as SubnetNode).metadata.VpcId === vpc.metadata.VpcId) {
          index++;
          const subnetX = vpcX + totalPadding / 2 + (index * (subnetFrameWidth + 20));
          const subnetY = vpcY + 50;
          subnet.metadata.X = subnetX;
          subnet.metadata.Y = subnetY;
          subnet.metadata.Width = subnetFrameWidth;
          subnet.metadata.Height = subnetFrameHeight;
          // Draw subnet frame
          const subnetTitle = `${subnet.name}\n${(subnet as SubnetNode).metadata.cidrBlock || 'No CIDR'}`;
          drawFrame(ctx, subnetX, subnetY, subnetFrameWidth, subnetFrameHeight, subnetTitle, theme.palette.info.main);

          // Draw EC2 instances in this subnet
          const ec2Instances = graphData.nodes.filter(isEC2Node).filter(instance =>
            instance.metadata.subnetId === (subnet as SubnetNode).metadata.subnetId
          );
          console.log(`Found ${ec2Instances.length} EC2 instances for subnet ${subnet.name}`, {
            subnetId: (subnet as SubnetNode).metadata.subnetId,
            matchingInstances: ec2Instances.map(i => ({
              name: i.name,
              subnetId: i.metadata.subnetId
            }))
          });

          // Calculate the total width needed for all EC2 instances
          const totalEC2Width = ec2Instances.length * 40; // 40 is the width per instance
          const startX = subnetX + (subnetFrameWidth - totalEC2Width) / 2; // Center the group of instances

          // Draw EC2 instances
          ec2Instances.forEach((instance, instanceIndex) => {
            instance.metadata.X = startX + (instanceIndex * 40);
            instance.metadata.Y = subnetY + 70;
            console.debug(`Drawing EC2 ${instance.name} at (${instance.metadata.X}, ${instance.metadata.Y})`);
            drawNode(ctx, instance.metadata.X, instance.metadata.Y, instance);
          });
        }
      });
    });

    // Draw tooltip for hovered node if it's an AI instance
    if (hoveredNode && hoveredNode.type === 'EC2' && 'IsAI' in hoveredNode.metadata && hoveredNode.metadata.IsAI) {
      const nodeX = getNodeX(hoveredNode);
      const nodeY = getNodeY(hoveredNode) + 600; // Position tooltip above node
      const tooltipText = (hoveredNode as EC2Node).metadata.AIDetectionDetails || 'AI Instance';
      ctx.save(); // Save current drawing state
      ctx.globalCompositeOperation = 'source-over'; // Ensure tooltip draws on top
      drawTooltip(ctx, nodeX, nodeY, tooltipText);
      ctx.restore(); // Restore previous drawing state
    }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !graphData) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Check if click is on a node
    const clickedNode = graphData.nodes.find(node => {
      const nodeX = getNodeX(node);
      const nodeY = getNodeY(node);
      const distance = Math.sqrt(Math.pow(x - nodeX, 2) + Math.pow(y - nodeY, 2));
      return distance < 40; // Node radius
    });

    if (clickedNode) {
      setSelectedNode(clickedNode);
    }
  };

  const handleCanvasHover = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !graphData) return;

    // Get the canvas's position relative to the viewport
    const rect = canvas.getBoundingClientRect();

    // Calculate the mouse position relative to the canvas, accounting for any scaling
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    console.log('Mouse position:', {
      clientX: event.clientX,
      clientY: event.clientY,
      canvasLeft: rect.left,
      canvasTop: rect.top,
      scaleX,
      scaleY,
      relativeX: x,
      relativeY: y
    });

    // Check if hover is on a node
    const hoveredNode = graphData.nodes.find(node => {
      const nodeX = getNodeX(node);
      const nodeY = getNodeY(node);
      const distance = Math.sqrt(Math.pow(x - nodeX, 2) + Math.pow(y - nodeY, 2));

      console.log(`Checking hover for node ${node.name}:`, {
        nodeX,
        nodeY,
        mouseX: x,
        mouseY: y,
        distance,
        threshold: 40
      });

      return distance < 40; // Node radius
    });

    setHoveredNode(hoveredNode || null);
    canvas.style.cursor = hoveredNode ? 'pointer' : 'default';
  };

  const getNodeX = (node: Node): number => {
    if (!graphData) return 0;
    return node.metadata.X || 0;
  };

  const getNodeY = (node: Node): number => {
    if (!graphData) return 0;
    return node.metadata.Y || 0;
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'S3':
        return <S3Icon width={24} height={24} />;
      case 'VPC':
        return <VPCIcon width={24} height={24} />;
      case 'Subnet':
        return <SubnetIcon width={24} height={24} />;
      case 'EC2':
        return <EC2Icon width={24} height={24} />;
      case 'SG':
        return <SecurityGroupIcon width={24} height={24} />;
      case 'NI':
        return <NetworkInterfaceIcon width={24} height={24} />;
      case 'IGW':
        return <InternetGatewayIcon width={24} height={24} />;
      case 'IAMRole':
        return <IAMRoleIcon width={24} height={24} />;
      case 'IAMPolicy':
        return <IAMPolicyIcon width={24} height={24} />;
      case 'IAMUser':
        return <IAMUserIcon width={24} height={24} />;
      case 'VPC_FRAME':
        return <VPCIcon width={24} height={24} />;
      case 'ADMIN_FRAME':
        return <SecurityIcon sx={{ fontSize: 24 }} />;
      case 'STORAGE_FRAME':
        return <StorageIcon sx={{ fontSize: 24 }} />;
      default:
        return <InfoIcon sx={{ fontSize: 24 }} />;
    }
  };

  const isVPCNode = (node: Node): node is Node & { type: 'VPC'; metadata: { VpcId: string } } => {
    const isVPC = node.type === 'VPC';
    return isVPC;
  };

  const isSubnetNode = (node: Node): node is Node & { type: 'Subnet' } => {
    /*console.log('Checking subnet node:', {
      name: node.name,
      type: node.type,
      metadata: node.metadata,
      isSubnet: node.type === 'Subnet'
    });*/
    return node.type === 'Subnet';
  };

  const isEC2Node = (node: Node): node is EC2Node => {
    return node.type === 'EC2' && 'subnetId' in node.metadata;
  };

  const isIGWNode = (node: Node): node is IGWNode => {
    /*console.log('Checking IGW node:', {
      name: node.name,
      type: node.type,
      metadata: node.metadata,
      isIGW: node.type === 'IGW',
      hasVpcId: 'VpcId' in node.metadata
    });*/
    return node.type === 'IGW' && 'VpcId' in node.metadata;
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !graphData) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Check if click is on a node
    const clickedNode = graphData.nodes.find(node => {
      const nodeX = getNodeX(node);
      const nodeY = getNodeY(node);
      const distance = Math.sqrt(Math.pow(x - nodeX, 2) + Math.pow(y - nodeY, 2));
      return distance < 40; // Node radius
    });

    if (clickedNode && clickedNode.type === 'EC2') {
      setContextMenu({
        mouseX: event.clientX,
        mouseY: event.clientY,
        node: clickedNode
      });
    }
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const handleAIDetails = () => {
    if (!contextMenu?.node) return;
    const instance = contextMenu.node as EC2Node;
    if (instance.metadata.AIDetectionDetails) {
      setAiDetailsDialog({
        open: true,
        details: instance.metadata.AIDetectionDetails
      });
    }
    handleContextMenuClose();
  };

  const handleAiDetailsDialogClose = () => {
    setAiDetailsDialog({ open: false, details: '' });
  };

  const handleIgnoreToggle = async () => {
    if (!contextMenu?.node) return;
    const instance = contextMenu.node as EC2Node;
    try {
      const response = await fetch(`${BackEndUrl}/api/fortifai/ignore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          instanceId: instance.metadata.instanceId,
          ignore: !instance.metadata.IsIgnored 
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to toggle ignore status: ${response.status} ${response.statusText}`);
      }

      // Update the instance's ignore status in the graph data
      if (graphData) {
        const updatedNodes = graphData.nodes.map(node => {
          if (node.id === instance.id) {
            return {
              ...node,
              metadata: {
                ...node.metadata,
                IsIgnored: !instance.metadata.IsIgnored
              }
            };
          }
          return node;
        });
        setGraphData({ ...graphData, nodes: updatedNodes });
      }
    } catch (err) {
      console.error('Error toggling ignore status:', err);
    }
    handleContextMenuClose();
  };

  const handleFortifAIAction = async () => {
    if (!contextMenu?.node) return;

    const instanceId = (contextMenu.node as EC2Node).metadata.instanceId;
    try {
      const response = await fetch(`${BackEndUrl}/api/fortifai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ instanceId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to process FortifAI action: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('FortifAI action result:', result);
    } catch (err) {
      console.error('Error processing FortifAI action:', err);
    } finally {
      handleContextMenuClose();
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!graphData) {
    return null;
  }

  const vpcs = graphData.nodes.filter(isVPCNode);
  const s3Buckets = graphData.nodes.filter(node => node.type === 'S3');
  const iamResources = graphData.nodes.filter(node =>
    ['IAMRole', 'IAMPolicy', 'IAMUser'].includes(node.type)
  );

  return (
    <Box sx={{ height: '100%', display: 'flex' }}>
      {/* Left Navigation Bar */}
      <Box sx={{ width: 240, bgcolor: 'background.paper', borderRight: 1, borderColor: 'divider', p: 2 }}>
        <Typography variant="h6" gutterBottom>Asset Groups</Typography>
        <List>
          <ListItem>
            <ListItemText
              primary="Compute"
              secondary={`${graphData.nodes.filter(n => n.group === 'Compute').length} assets`}
              primaryTypographyProps={{ sx: { display: 'flex', alignItems: 'center' } }}
            />
            <ComputerIcon sx={{ ml: 1, color: theme.palette.success.main }} />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="Networking"
              secondary={`${graphData.nodes.filter(n => n.group === 'Networking').length} assets`}
              primaryTypographyProps={{ sx: { display: 'flex', alignItems: 'center' } }}
            />
            <AccountTreeIcon sx={{ ml: 1, color: theme.palette.warning.main }} />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="Storage"
              secondary={`${graphData.nodes.filter(n => n.group === 'Storage').length} assets`}
              primaryTypographyProps={{ sx: { display: 'flex', alignItems: 'center' } }}
            />
            <StorageIcon sx={{ ml: 1, color: theme.palette.info.main }} />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="Administrative"
              secondary={`${graphData.nodes.filter(n => n.group === 'Administrative').length} assets`}
              primaryTypographyProps={{ sx: { display: 'flex', alignItems: 'center' } }}
            />
            <SecurityIcon sx={{ ml: 1, color: theme.palette.grey[700] }} />
          </ListItem>
        </List>
        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" gutterBottom>Statistics</Typography>
        <List dense>
          <ListItem>
            <ListItemText
              primary="Total Assets"
              secondary={graphData.metadata.totalNodes}
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="Total Connections"
              secondary={graphData.metadata.totalLinks}
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="Last Updated"
              secondary={new Date(graphData.metadata.lastUpdate).toLocaleString()}
            />
          </ListItem>
        </List>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h5">Cloud Assets</Typography>
        </Box>

        {/* Canvas Container */}
        <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden', p: 2 }}>
          <canvas
            ref={canvasRef}
            width={window.innerWidth - 480}
            height={window.innerHeight - 200}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasHover}
            onContextMenu={handleContextMenu}
            style={{ cursor: 'default' }}
          />
        </Box>
      </Box>

      {/* Node Popup */}
      {renderNodePopup()}

      {/* AI Details Dialog */}
      <Dialog
        open={aiDetailsDialog.open}
        onClose={handleAiDetailsDialogClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>AI Detection Details</DialogTitle>
        <DialogContent>
          <Typography variant="body1" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
            {aiDetailsDialog.details}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAiDetailsDialogClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        {contextMenu?.node && 'IsAI' in contextMenu.node.metadata && (contextMenu.node as EC2Node).metadata.IsAI && (
          <MenuItem onClick={handleAIDetails}>AI Details</MenuItem>
        )}
        <MenuItem onClick={handleIgnoreToggle}>
          {contextMenu?.node && 'IsIgnored' in contextMenu.node.metadata && contextMenu.node.metadata.IsIgnored ? '✓ ' : ''}Ignore
        </MenuItem>
        <MenuItem onClick={handleFortifAIAction}>
          <Typography component="span" sx={{ fontWeight: 'bold', color: 'success.main' }}>
            FortifAI!
          </Typography>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default AI_SPM; 
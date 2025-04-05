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
import SyncIcon from '@mui/icons-material/Sync';
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
import { api, AssetData, GraphData, Link, NodeType } from '../services/api';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';

interface Tag {
  Key: string;
  Value: string;
}

interface BaseMetadata {
  asset_type: string;
  vpc_id?: string;
  is_ai?: boolean;
  ai_detection_details?: string;
  is_ignored?: boolean;
  is_sandbox?: boolean;
  tags?: Tag[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface VpcMetadata extends BaseMetadata {
  vpc_id: string;
}

interface Ec2Metadata extends BaseMetadata {
  instance_id: string;
  instance_type: string;
  state: string;
  private_ip_address: string;
  public_ip_address: string;
  launch_time: string;
  network_interfaces: string[];
  architecture: string;
  platform_details: string;
  vpc_id: string;
  subnet_id: string;
  is_ai: boolean;
  ai_detection_details: string;
  ai_detection_confidence: number;
  ai_detected_processes: string[];
}

interface SubnetMetadata extends BaseMetadata {
  subnet_id: string;
  cidr_block: string;
  availability_zone: string;
  vpc_id: string;
  unique_id: string;
}

interface S3Metadata extends BaseMetadata {
  bucket_name: string;
  creation_date: string;
}

interface IAMMetadata extends BaseMetadata {
  role_id?: string;
  role_name?: string;
  assume_role_policy_document?: string;
  policy_id?: string;
  policy_name?: string;
  attachment_count?: number;
  permissions_boundary_usage_count?: number;
  document?: string;
  user_id?: string;
  user_name?: string;
  access_key_ids?: string[];
  attached_policy_names?: string[];
  inline_policy_names?: string[];
}

interface AssetWithMetadata extends AssetData {
  metadata: BaseMetadata | VpcMetadata | Ec2Metadata | SubnetMetadata | S3Metadata | IAMMetadata;
}

interface Node {
  id: string;
  name: string;
  type: NodeType;
  group: string;
  val: number;
  metadata: BaseMetadata;
}

interface VPCNode extends Node {
  type: 'VPC';
  metadata: VpcMetadata;
}

interface SubnetNode extends Node {
  type: 'Subnet';
  metadata: SubnetMetadata;
}

interface NetworkInterfaceNode extends Node {
  type: 'NI';
  metadata: BaseMetadata;
}

interface IGWNode extends Node {
  type: 'IGW';
  metadata: BaseMetadata & {
    internet_gateway_id: string;
    vpc_id: string;
  };
}

interface EC2Node extends Node {
  type: 'EC2';
  metadata: Ec2Metadata;
}

interface S3Node extends Node {
  type: 'S3';
  metadata: S3Metadata;
}

interface SGNode extends Node {
  type: 'SG';
  metadata: BaseMetadata & {
    group_id: string;
    vpc_id: string;
    description?: string;
  };
}

interface IAMRoleNode extends Node {
  type: 'IAMRole';
  metadata: IAMMetadata;
}

interface IAMPolicyNode extends Node {
  type: 'IAMPolicy';
  metadata: IAMMetadata;
}

interface IAMUserNode extends Node {
  type: 'IAMUser';
  metadata: IAMMetadata;
}

const AI_SPM: React.FC = () => {
  const [sandboxVpcId, setSandboxVpcId] = useState<string | null>(null);
  const [sandPatternImage, setSandPatternImage] = useState<HTMLImageElement | null>(null);
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

  const graphRef = useRef<HTMLDivElement>(null);
  const graph = useRef<typeof ForceGraph3D | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Add new state for AI detection
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = '/images/sand-texture.jpeg';
    setSandPatternImage(img);

    return () => {
      img.src = '';
    };
  }, []); // Empty dependency array means this runs once on mount

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await api.getGraphData();
        setGraphData(data);
        setError(null);
      } catch (err) {
        setError('Failed to fetch graph data');
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      const data = await api.refreshGraphData();
      setGraphData(data);
      setError(null);
    } catch (err) {
      setError('Failed to refresh graph data');
      console.error('Error refreshing data:', err);
    } finally {
      setLoading(false);
    }
  };

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
        .filter(([key, value]) => value !== undefined && key !== 'asset_type' && key !== 'type' /*&& key !== 'tags'*/);

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
            <div>Asset Type: {selectedNode.metadata.asset_type}</div>
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
      (node as SubnetNode).metadata.vpc_id === (vpc as VPCNode).metadata.vpc_id
    ) || [];

    const ec2Instances = graphData?.nodes.filter(node =>
      node.type === 'EC2' &&
      (node as EC2Node).metadata.vpc_id === (vpc as VPCNode).metadata.vpc_id
    ) || [];

    const securityGroups = graphData?.nodes.filter(node =>
      node.type === 'SG' &&
      (node as SGNode).metadata.vpc_id === (vpc as VPCNode).metadata.vpc_id
    ) || [];

    return (
      <Card key={vpc.id} sx={{ mb: 2, border: `1px solid ${theme.palette.primary.main}` }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <AccountTreeIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
            <Typography variant="h6">{vpc.name}</Typography>
            {'cidr_block' in vpc.metadata && (
              <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                ({String(vpc.metadata.cidr_block)})
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
                          {'availability_zone' in subnet.metadata && (
                            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                              ({String(subnet.metadata.availability_zone)})
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
                          {'instance_type' in instance.metadata && (
                            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                              ({String(instance.metadata.instance_type)})
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

  const drawSandboxBackground = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) => {
    if (!sandPatternImage) return;

    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(x, y, width, height);

    // Draw sand pattern
    ctx.globalAlpha = 0.1;
    ctx.drawImage(sandPatternImage, x, y, width, height);
    ctx.globalAlpha = 1.0;
  };

  const drawFrame = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, title: string, color: string) => {
    // If this is a sandbox VPC, draw sandy background first
    if (title.includes('Sandbox')) {
      drawSandboxBackground(ctx, x, y, width, height);
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
    
    // Adjust vertical position of instance name based on whether it's an AI instance
    const isAI = node.type === 'EC2' && 
                 'is_ai' in node.metadata && 
                 node.metadata.is_ai && 
                 'ai_detection_confidence' in node.metadata && 
                 (node.metadata as Ec2Metadata).ai_detection_confidence > 0.8;
    
    // Move instance name higher if it's an AI instance to make room for the "AI Instance" text
    const nameYPosition = isAI ? y + size + 10 : y + size + 15;
    ctx.fillText(node.name, x, nameYPosition);

    // Draw VPC ID if available
    switch (node.type) {
      case 'VPC': {
        const metadata = (node as VPCNode).metadata;
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`VPC: ${metadata.vpc_id}`, x, y + 40);
        break;
      }
      case 'Subnet': {
        const metadata = (node as SubnetNode).metadata;
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`VPC: ${metadata.vpc_id}`, x, y + 40);
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
        if ('instance_type' in node.metadata && 'state' in node.metadata) {
          const instanceType = String(node.metadata.instance_type || '');
          const state = String(node.metadata.state || '');
          const displayType = state.toLowerCase() !== 'running' ? `${instanceType} (off)` : instanceType;
          
          // Adjust vertical position of instance type based on whether it's an AI instance
          const typeYPosition = isAI ? y + size + 25 : y + size + 30;
          ctx.fillText(displayType, x, typeYPosition);
        }
        if ('state' in node.metadata) {
          // Adjust vertical position of state based on whether it's an AI instance
          const stateYPosition = isAI ? y + size + 40 : y + size + 45;
          ctx.fillText(String(node.metadata.state || ''), x, stateYPosition);
        }
        
        // Draw gray border for non-running instances
        if (node.type === 'EC2' && 'state' in node.metadata && (node.metadata as Ec2Metadata).state.toLowerCase() !== 'running') {
          ctx.strokeStyle = '#808080'; // Light gray
          ctx.lineWidth = 3;
          ctx.strokeRect(x - 24, y - 24, 48, 48);
          console.log(`Drawing gray border for non-running instance: ${node.name}`);
        }
        break;
      case 'VPC':
        if ('cidr_block' in node.metadata) {
          ctx.fillText(String(node.metadata.cidr_block || ''), x, y + size + 30);
          console.log(`Drawing VPC CIDR block: ${node.metadata.cidr_block}`);
        }
        break;
      case 'Subnet':
        if ('availability_zone' in node.metadata) {
          ctx.fillText(String(node.metadata.availability_zone || ''), x, y + size + 30);
          console.log(`Drawing Subnet AZ: ${node.metadata.availability_zone}`);
        }
        break;
      case 'S3':
        if ('creation_date' in node.metadata) {
          const date = new Date(String(node.metadata.creation_date || '')).toLocaleDateString();
          ctx.fillText('Created: ' + date, x, y + size + 30);
          console.log(`Drawing S3 creation date: ${date}`);
        }
        break;
      case 'SG':
        if ('group_id' in node.metadata) {
          ctx.fillText(String(node.metadata.group_id || ''), x, y + size + 30);
          console.log(`Drawing SG ID: ${node.metadata.group_id}`);
        }
        break;
      case 'IGW':
        if ('internet_gateway_id' in node.metadata) {
          ctx.fillStyle = '#000000';
          ctx.fillText(String(node.metadata.internet_gateway_id || ''), x, y + size - 10);
          console.log(`Drawing IGW ID: ${node.metadata.internet_gateway_id}`);
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
      drawNode(ctx, mainFrameX + fixedSectionSpacing + (fixedSectionWidth / 2) - ((s3Buckets.length - 1) * 60) + (index * 120), mainFrameY + 80, bucket);
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
      drawNode(ctx, x, y, resource);
    });

    // Draw VPCs
    const vpcs = graphData.nodes.filter(isVPCNode);
    
    // Log EC2 instances
    const ec2Instances = graphData.nodes.filter(isEC2Node);

    vpcs.forEach((vpc, vpcIndex) => {
      const vpcX = mainFrameX + fixedSectionSpacing + (vpcIndex * ((mainFrameWidth - 2 * fixedSectionSpacing) / vpcs.length));
      const vpcY = mainFrameY + 30 + fixedSectionHeight + fixedSectionSpacing;

      let nameTag = "";

      if (vpc.metadata.tags) {
        const nameTag = vpc.metadata.tags.find(tag => tag.Key === 'Name');
        if (nameTag) {
          const nameTagValue = nameTag.Value;
          if (nameTagValue === 'Sandbox') {
            vpc.metadata.is_sandbox = true;
            if (vpc.metadata.vpc_id) {
              setSandboxVpcId(vpc.metadata.vpc_id);
            }
          }
        }
      }

      vpc.metadata.width = (mainFrameWidth - 2 * fixedSectionSpacing - (vpcs.length - 1) * 20) / vpcs.length;
      vpc.metadata.height = mainFrameHeight - fixedSectionHeight - fixedSectionSpacing - 60;
      vpc.metadata.x = vpcX;
      vpc.metadata.y = vpcY;

      // Check if this VPC has any AI instances
      const hasAIInstance = graphData.nodes.some(node =>
        node.type === 'EC2' &&
        'is_ai' in node.metadata &&
        node.metadata.is_ai &&
        (node as EC2Node).metadata.vpc_id === vpc.metadata.vpc_id
      );

      // Use green color for sandbox VPC with AI instances, otherwise use warning color
      const frameColor = vpc.metadata.is_sandbox && hasAIInstance
        ? theme.palette.success.main
        : theme.palette.warning.main;

      if (nameTag) {
        drawFrame(ctx, vpcX, vpcY, vpc.metadata.width, vpc.metadata.height, nameTag + " - " + vpc.name, frameColor);
      } else {
        drawFrame(ctx, vpcX, vpcY, vpc.metadata.width, vpc.metadata.height, vpc.name, frameColor);
      }

      // Draw VPC contents
      const subnets = graphData.nodes.filter(isSubnetNode);

      // Filter subnets for this VPC only
      const vpcSubnets = subnets.filter(subnet => {
        const subnetVpcId = subnet.metadata.vpc_id;
        const vpcId = vpc.metadata.vpc_id;
        return subnetVpcId && vpcId && subnetVpcId === vpcId;
      });

      // Calculate subnet frame dimensions
      let numSubnets = vpcSubnets.length;
      // Calculate optimal layout for subnets
      const maxSubnetsPerRow = 3; // Maximum subnets we want in a single row
      const numRows = Math.ceil(numSubnets / maxSubnetsPerRow);
      const numCols = Math.min(numSubnets, maxSubnetsPerRow);

      // Calculate subnet dimensions based on VPC frame size and number of subnets
      const totalPadding = 80; // Total padding to reserve (40px on each side)
      const vpcWidth = vpc.metadata.width;
      const vpcHeight = vpc.metadata.height;

      // Calculate subnet frame dimensions
      subnetFrameWidth = (vpcWidth - totalPadding - (numCols - 1) * 20) / numCols;
      const subnetFrameHeight = (vpcHeight - 100 - (numRows - 1) * 20) / numRows;

      // Draw IGW for this VPC
      const igws = graphData.nodes.filter(isIGWNode);

      const matchingIGWs = igws.filter(igw => {
        const matches = igw.metadata.vpc_id === vpc.metadata.vpc_id;
        return matches;
      });

      matchingIGWs.forEach((igw, igwIndex) => {
        igw.metadata.x = vpcX + (vpc.metadata.width || 0) / 2;
        igw.metadata.y = vpcY + 15; // Position in the middle of the header band (30px height)
        drawNode(ctx, igw.metadata.x, igw.metadata.y, igw);
      });

      // Draw subnets for this VPC only
      vpcSubnets.forEach((subnet, subnetIndex) => {
        const row = Math.floor(subnetIndex / maxSubnetsPerRow);
        const col = subnetIndex % maxSubnetsPerRow;

        const subnetX = vpcX + totalPadding / 2 + (col * (subnetFrameWidth + 20));
        const subnetY = vpcY + 50 + (row * (subnetFrameHeight + 20));

        subnet.metadata.x = subnetX;
        subnet.metadata.y = subnetY;
        subnet.metadata.width = subnetFrameWidth;
        subnet.metadata.height = subnetFrameHeight;

        // Draw subnet frame
        const subnetTitle = `${subnet.name}\n${(subnet as SubnetNode).metadata.cidr_block || 'No CIDR'}`;
        drawFrame(ctx, subnetX, subnetY, subnetFrameWidth, subnetFrameHeight, subnetTitle, theme.palette.info.main);

        // Draw EC2 instances in the subnet
        const ec2Instances = graphData.nodes.filter(isEC2Node).filter(instance => {
          const subnetMetadata = (subnet as SubnetNode).metadata;
          const subnetId = subnetMetadata.subnet_id;
          const instanceSubnetId = instance.metadata.subnet_id;
          return subnetId === instanceSubnetId;
        });


        if (ec2Instances.length > 0) {
          const instanceWidth = 40;  // Width of each EC2 instance
          const instanceHeight = 70;  // Height of each EC2 instance
          const padding = 20;         // Padding between instances
          const framePadding = 20;    // Padding from frame edges
          
          // Calculate how many instances can fit in a row based on subnet width
          const availableWidth = subnetFrameWidth - (2 * framePadding);
          const maxInstancesPerRow = Math.max(1, Math.floor(availableWidth / (instanceWidth + padding)));
          
          // Calculate number of rows needed
          const numRows = Math.ceil(ec2Instances.length / maxInstancesPerRow);
          
          // Calculate total height needed for all rows
          const totalHeight = (numRows * instanceHeight) + ((numRows - 1) * padding);
          
          // Calculate starting Y position to center vertically
          const startY = subnetY + framePadding + 50;//Math.max(0, (subnetFrameHeight - totalHeight) / 2);
          
          // Calculate starting X position to center horizontally
          const rowWidth = Math.min(ec2Instances.length, maxInstancesPerRow) * (instanceWidth + padding) - padding;
          const startX = subnetX + framePadding + Math.max(0, (subnetFrameWidth - rowWidth) / 2);
          
          
          // Draw instances in a grid layout
          ec2Instances.forEach((instance, index) => {
            const row = Math.floor(index / maxInstancesPerRow);
            const col = index % maxInstancesPerRow;
            
            const x = startX + (col * (instanceWidth + padding));
            const y = startY + (row * (instanceHeight + padding));
            
            instance.metadata.x = x;
            instance.metadata.y = y;
            
            console.debug(`Drawing EC2 ${instance.name} at (${x}, ${y})`);
            drawNode(ctx, x, y, instance);
          });
        }
      });
    });

    // Draw tooltip for hovered node if it's an AI instance
    if (hoveredNode && hoveredNode.type === 'EC2' && 'is_ai' in hoveredNode.metadata && hoveredNode.metadata.is_ai) {
      const nodeX = getNodeX(hoveredNode);
      const nodeY = getNodeY(hoveredNode) + 600; // Position tooltip above node
      const tooltipText = (hoveredNode as EC2Node).metadata.ai_detection_details || 'AI Instance';
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

    // Check if hover is on a node
    const hoveredNode = graphData.nodes.find(node => {
      const nodeX = getNodeX(node);
      const nodeY = getNodeY(node);
      const distance = Math.sqrt(Math.pow(x - nodeX, 2) + Math.pow(y - nodeY, 2));
      return distance < 40; // Node radius
    });

    setHoveredNode(hoveredNode || null);
    canvas.style.cursor = hoveredNode ? 'pointer' : 'default';
  };

  const getNodeX = (node: Node): number => {
    if (!graphData) return 0;
    return node.metadata.x || 0;
  };

  const getNodeY = (node: Node): number => {
    if (!graphData) return 0;
    return node.metadata.y || 0;
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

  const isVPCNode = (node: Node): node is Node & { type: 'VPC'; metadata: { vpc_id: string } } => {
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
    return node.type === 'EC2' && 'subnet_id' in node.metadata;
  };

  const isIGWNode = (node: Node): node is IGWNode => {
    /*console.log('Checking IGW node:', {
      name: node.name,
      type: node.type,
      metadata: node.metadata,
      isIGW: node.type === 'IGW',
      hasVpcId: 'vpc_id' in node.metadata
    });*/
    return node.type === 'IGW' && 'vpc_id' in node.metadata;
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
    if (instance.metadata.ai_detection_details) {
      // Create a formatted details string that includes the confidence value and final verdict
      let detailsText = '';
      
      // Add confidence information if available
      if ('ai_detection_confidence' in instance.metadata && 
          typeof instance.metadata.ai_detection_confidence === 'number') {
        const confidencePercent = (instance.metadata.ai_detection_confidence * 100).toFixed(1);
        const isAI = instance.metadata.is_ai && instance.metadata.ai_detection_confidence > 0.8;
        detailsText = `Confidence: ${confidencePercent}%\n`;
        detailsText += `Final Verdict: ${isAI ? 'AI Instance' : 'Not an AI Instance'}\n\n`;
      }
      
      // Add detection details
      detailsText += instance.metadata.ai_detection_details;
      
      setAiDetailsDialog({
        open: true,
        details: detailsText
      });
    }
    handleContextMenuClose();
  };

  const handleAiDetailsDialogClose = () => {
    setAiDetailsDialog({ open: false, details: '' });
  };

  const handleIgnoreToggle = async (node: Node) => {
    try {
      // Create update payload for data layer using batch format
      const updatePayload = {
        assets: [{
          asset_type: node.type.toLowerCase(),
          unique_id: node.id.replace(`AssetType.${node.type.toLowerCase()}_`, ''), // Remove the prefix to get the actual ID
          name: node.name,
          description: (node as any).description || '',
          metadata: {
            ...node.metadata,
            is_ignored: !(node.metadata as BaseMetadata).is_ignored
          },
          tags: (node as any).tags || {},
          is_stale: (node as any).is_stale || false
        }]
      };

      console.log('Sending ignore toggle request with payload:', JSON.stringify(updatePayload, null, 2));
      console.log('Current node metadata:', JSON.stringify(node.metadata, null, 2));
      console.log('Current is_ignored value:', (node.metadata as BaseMetadata).is_ignored);
      console.log('New is_ignored value:', !(node.metadata as BaseMetadata).is_ignored);
      
      // Update the asset in the backend using batch endpoint
      const response = await api.post(`/data-access/assets/${node.type.toLowerCase()}/batch`, updatePayload);
      console.log('Ignore toggle response:', response);

      // Update the node in the graph
      setGraphData(prevData => {
        if (!prevData) return null;
        return {
          ...prevData,
          nodes: prevData.nodes.map(n =>
            n.id === node.id ? {
              ...n,
              metadata: {
                ...n.metadata,
                is_ignored: !(n.metadata as BaseMetadata).is_ignored
              }
            } : n
          ),
          links: prevData.links // Preserve existing links
        };
      });

      // Show success message
      alert(`Asset ${!(node.metadata as BaseMetadata).is_ignored ? 'ignored' : 'unignored'} successfully`);
    } catch (error) {
      console.error('Error toggling ignore status:', error);
      alert('Failed to update asset status');
    }
  };

  const handleFortifAIAction = async () => {
    if (!contextMenu?.node) return;

    const instanceId = (contextMenu.node as EC2Node).metadata.instance_id;
    try {
      const response = await api.fortifaiAction(instanceId);
      console.log('FortifAI action result:', response);
    } catch (err) {
      console.error('Error processing FortifAI action:', err);
    } finally {
      handleContextMenuClose();
    }
  };

  // Update the useEffect that processes VPCs
  useEffect(() => {
    if (graphData) {
      graphData.nodes.forEach(vpc => {
        if (vpc.type === 'VPC') {
          
          // Initialize tags array if it doesn't exist
          if (!vpc.metadata.tags) {
            vpc.metadata.tags = [];
          }
          
          
          // Check for both Name and Environment tags
          const nameTag = vpc.metadata.tags?.find(tag => tag.Key === 'Name');
          const envTag = vpc.metadata.tags?.find(tag => tag.Key === 'Environment');
          
          // Check if the VPC name itself contains "Sandbox" as a fallback
          const nameContainsSandbox = vpc.name.includes('Sandbox');
          
          if (nameTag && nameTag.Value === 'Sandbox') {
            vpc.metadata.is_sandbox = true;
            if (vpc.metadata.vpc_id) {
              setSandboxVpcId(vpc.metadata.vpc_id);
            }
          } else if (envTag && envTag.Value === 'Sandbox') {
            vpc.metadata.is_sandbox = true;
            if (vpc.metadata.vpc_id) {
              setSandboxVpcId(vpc.metadata.vpc_id);
            }
          } else if (nameContainsSandbox) {
            vpc.metadata.is_sandbox = true;
            if (vpc.metadata.vpc_id) {
              setSandboxVpcId(vpc.metadata.vpc_id);
            }
          }
        }
      });
    }
  }, [graphData]);

  // Add a new useEffect for drawing borders after sandbox identification
  useEffect(() => {
    if (graphData && sandboxVpcId !== null && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      graphData.nodes.forEach(node => {
        if (node.type === 'EC2') {
          const isInSandboxVPC = (node as EC2Node).metadata.vpc_id === sandboxVpcId;
          const isAI = 'is_ai' in node.metadata && 
                      node.metadata.is_ai && 
                      'ai_detection_confidence' in node.metadata && 
                      (node.metadata as Ec2Metadata).ai_detection_confidence > 0.8;
          const isIgnored = (node.metadata as BaseMetadata).is_ignored === true;
          
          if (isAI) {
            let borderColor;
            
            if (isInSandboxVPC) {
              borderColor = 'rgb(0, 128, 0)'; // Grass green
            } else if (isIgnored) {
              borderColor = 'rgb(255, 192, 203)'; // Pink
            } else {
              borderColor = 'rgb(255, 0, 0)'; // Red
            }
            
            // Draw border around icon
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 3;  // Thick border
            const x = (node.metadata as any).x;
            const y = (node.metadata as any).y;
            if (typeof x === 'number' && typeof y === 'number') {
              ctx.strokeRect(x - 24, y - 24, 48, 48);

              // Draw AI Instance text with matching color
              ctx.fillStyle = borderColor;
              ctx.textAlign = 'center';  // Center the text
              ctx.fillText('AI Instance', x, y + 65);  // Moved up slightly from 60 to 55
            }
          }
        }
      });
    }
  }, [graphData, sandboxVpcId]);

  // Update the findSandboxVPC function to use the same logic
  const findSandboxVPC = (nodes: AssetWithMetadata[]): AssetWithMetadata | undefined => {
    return nodes.find(node =>
      node.type === 'VPC' && (
        (node.metadata.tags?.some((tag: Tag) => tag.Key === 'Name' && tag.Value === 'Sandbox')) ||
        (node.metadata.tags?.some((tag: Tag) => tag.Key === 'Environment' && tag.Value === 'Sandbox')) ||
        node.name.includes('Sandbox')
      )
    );
  };

  const handleSyncAssets = async () => {
    try {
      setIsSyncing(true);
      setSyncError(null);
      await api.post('/api/assets-monitor/sync');
    } catch (err) {
      setSyncError('Failed to sync assets');
      console.error('Error syncing assets:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Add new handler for AI detection
  const handleDetectAI = async () => {
    try {
      console.log('Starting AI detection...');
      setIsDetecting(true);
      setDetectionError(null);
      const result = await api.post('/api/ai-detector/detect');
      console.log('AI detection result:', result);
    } catch (err) {
      console.error('Error detecting AI:', err);
      setDetectionError('Failed to detect AI instances');
    } finally {
      setIsDetecting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
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
              primary="Asset Types"
              secondary={graphData.metadata.assetTypes.join(', ')}
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="VPC Count"
              secondary={graphData.metadata.vpcCount}
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
        <Box sx={{ 
          p: 2, 
          pr: 6,
          borderBottom: 1, 
          borderColor: 'divider', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between' 
        }}>
          <Typography variant="h5">Cloud Assets</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<SyncIcon />}
              onClick={handleDetectAI}
              disabled={isDetecting}
              sx={{ minWidth: '140px' }}
            >
              {isDetecting ? 'Detecting...' : 'Detect AI'}
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<SyncIcon />}
              onClick={handleSyncAssets}
              disabled={isSyncing}
              sx={{ minWidth: '140px' }}
            >
              {isSyncing ? 'Syncing...' : 'Sync Assets'}
            </Button>
          </Box>
        </Box>

        {/* Show sync and detection errors if any */}
        {(syncError || detectionError) && (
          <Box sx={{ p: 2 }}>
            {syncError && (
              <Alert severity="error" onClose={() => setSyncError(null)} sx={{ mb: 1 }}>
                {syncError}
              </Alert>
            )}
            {detectionError && (
              <Alert severity="error" onClose={() => setDetectionError(null)}>
                {detectionError}
              </Alert>
            )}
          </Box>
        )}

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
        {contextMenu?.node && (
          <>
            <MenuItem onClick={() => handleAIDetails()}>
              View AI Details
            </MenuItem>
            <MenuItem 
              onClick={() => contextMenu?.node && handleIgnoreToggle(contextMenu.node)}
              disabled={(contextMenu.node as EC2Node).metadata.vpc_id === sandboxVpcId}
              sx={{ 
                color: (contextMenu.node as EC2Node).metadata.vpc_id === sandboxVpcId ? 'text.disabled' : 'inherit',
                fontStyle: (contextMenu.node as EC2Node).metadata.vpc_id === sandboxVpcId ? 'italic' : 'normal'
              }}
            >
              {(contextMenu.node.metadata as BaseMetadata).is_ignored ? 'Unignore' : 'Ignore'} Instance
              {(contextMenu.node as EC2Node).metadata.vpc_id === sandboxVpcId && ' (Disabled for Sandbox)'}
            </MenuItem>
            <MenuItem 
              onClick={() => handleFortifAIAction()}
              disabled={(contextMenu.node as EC2Node).metadata.vpc_id === sandboxVpcId}
              sx={{ 
                color: (contextMenu.node as EC2Node).metadata.vpc_id === sandboxVpcId ? 'text.disabled' : 'inherit',
                fontStyle: (contextMenu.node as EC2Node).metadata.vpc_id === sandboxVpcId ? 'italic' : 'normal'
              }}
            >
              <Typography component="span" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                FortifAI 
              </Typography>
              {(contextMenu.node as EC2Node).metadata.vpc_id === sandboxVpcId && ' (Disabled for Sandbox)'}
            </MenuItem>
          </>
        )}
      </Menu>
    </Box>
  );
};

export default AI_SPM; 
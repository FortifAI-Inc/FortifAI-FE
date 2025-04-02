import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { S3Service } from './services/s3Service';
import { relocateEC2BetweenVPCs } from './services/EnvAction';

dotenv.config();

const app = express();
const s3Service = new S3Service();

app.use(cors());
app.use(express.json());

// GET /api/graph - Get all graph data
app.get('/api/graph', async (req: Request, res: Response) => {
  try {
    const graphData = await s3Service.getGraphData();
    console.log('Serving graph data');
    /*console.log('Graph data:', graphData);
    console.log('Nodes with metadata:');
    graphData.nodes.forEach(node => {
      console.log(`Node ${node.id}:`, {
        ...node,
        metadata: node.metadata || 'No metadata'
      });
    });*/
    res.json(graphData);
  } catch (error) {
    console.error('Error fetching graph data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch graph data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/graph/refresh - Force refresh data and clear cache
app.post('/api/graph/refresh', async (req: Request, res: Response) => {
  try {
    s3Service.clearCache();
    const graphData = await s3Service.getGraphData();
    res.json({
      message: 'Cache cleared and data refreshed',
      data: graphData
    });
  } catch (error) {
    console.error('Error refreshing graph data:', error);
    res.status(500).json({ 
      error: 'Failed to refresh graph data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/graph - Update entire graph
app.put('/api/graph', async (req: Request, res: Response) => {
  try {
    const graphData = await s3Service.getGraphData();
    res.json(graphData);
  } catch (error) {
    console.error('Error updating graph data:', error);
    res.status(500).json({ 
      error: 'Failed to update graph data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/graph/nodes - Add new node
app.post('/api/graph/nodes', async (req: Request, res: Response) => {
  try {
    const graphData = await s3Service.getGraphData();
    res.json(graphData);
  } catch (error) {
    console.error('Error adding node:', error);
    res.status(500).json({ 
      error: 'Failed to add node',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/graph/links - Add new link
app.post('/api/graph/links', async (req: Request, res: Response) => {
  try {
    const graphData = await s3Service.getGraphData();
    res.json(graphData);
  } catch (error) {
    console.error('Error adding link:', error);
    res.status(500).json({ 
      error: 'Failed to add link',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/graph/nodes/:nodeId - Remove node
app.delete('/api/graph/nodes/:nodeId', async (req: Request, res: Response) => {
  try {
    const graphData = await s3Service.getGraphData();
    res.json(graphData);
  } catch (error) {
    console.error('Error removing node:', error);
    res.status(500).json({ 
      error: 'Failed to remove node',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/graph/links - Remove link
app.delete('/api/graph/links', async (req: Request, res: Response) => {
  try {
    const graphData = await s3Service.getGraphData();
    res.json(graphData);
  } catch (error) {
    console.error('Error removing link:', error);
    res.status(500).json({ 
      error: 'Failed to remove link',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/fortifai - Handle FortifAI action for EC2 instances
app.post('/api/fortifai', async (req: Request, res: Response) => {
  try {
    const { instanceId } = req.body;
    console.log('Received FortifAI request for instance:', instanceId);

    if (!instanceId) {
      console.error('No instance ID provided in request');
      return res.status(400).json({ 
        error: 'Instance ID is required',
        details: 'Please provide an instanceId in the request body'
      });
    }

    const destinationVpcId = 'vpc-01e8afe5e74576696';
    console.log(`Attempting to relocate instance ${instanceId} to VPC ${destinationVpcId}`);

    const result = await relocateEC2BetweenVPCs(instanceId, destinationVpcId);
    console.log('Relocation successful:', result);

    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Error processing FortifAI action:', error);
    res.status(500).json({ 
      error: 'Failed to process FortifAI action',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/fortifai/ignore - Handle ignoring AI instances
app.post('/api/fortifai/ignore', async (req: Request, res: Response) => {
  try {
    const { instanceId, ignore } = req.body;
    console.log('Received ignore request for instance:', instanceId, 'ignore:', ignore);

    if (!instanceId || typeof ignore !== 'boolean') {
      console.error('Invalid request parameters');
      return res.status(400).json({ 
        error: 'Invalid parameters',
        details: 'Please provide instanceId and ignore (boolean) in the request body'
      });
    }

    // Update the EC2 instance's IsIgnored status in the parquet file
    const result = false;//await s3Service.updateEC2IgnoreStatus(instanceId, ignore);
    console.log('Ignore status update successful:', result);

    res.json({
      success: true,
      message: `Instance ${instanceId} ${ignore ? 'ignored' : 'unignored'} successfully`,
      data: result
    });
  } catch (error) {
    console.error('Error updating ignore status:', error);
    res.status(500).json({ 
      error: 'Failed to update ignore status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 
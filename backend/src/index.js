const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { S3Service } = require('./services/s3Service');
const { relocateEC2BetweenVPCs } = require('./services/EnvAction');

dotenv.config();

const app = express();
const s3Service = new S3Service();

app.use(cors());
app.use(express.json());

// GET /api/graph - Get all graph data
app.get('/api/graph', async (req, res) => {
  try {
    const graphData = await s3Service.getGraphData();
    //console.log('Serving graph data',JSON.stringify(graphData));
    res.json(graphData);
  } catch (error) {
    console.error('Error fetching graph data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch graph data',
      details: error.message || 'Unknown error'
    });
  }
});

// POST /api/graph/refresh - Force refresh data and clear cache
app.post('/api/graph/refresh', async (req, res) => {
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
      details: error.message || 'Unknown error'
    });
  }
});

// PUT /api/graph - Update entire graph
app.put('/api/graph', async (req, res) => {
  try {
    const graphData = await s3Service.getGraphData();
    res.json(graphData);
  } catch (error) {
    console.error('Error updating graph data:', error);
    res.status(500).json({ 
      error: 'Failed to update graph data',
      details: error.message || 'Unknown error'
    });
  }
});

// POST /api/graph/nodes - Add new node
app.post('/api/graph/nodes', async (req, res) => {
  try {
    const graphData = await s3Service.getGraphData();
    res.json(graphData);
  } catch (error) {
    console.error('Error adding node:', error);
    res.status(500).json({ 
      error: 'Failed to add node',
      details: error.message || 'Unknown error'
    });
  }
});

// POST /api/graph/links - Add new link
app.post('/api/graph/links', async (req, res) => {
  try {
    const graphData = await s3Service.getGraphData();
    res.json(graphData);
  } catch (error) {
    console.error('Error adding link:', error);
    res.status(500).json({ 
      error: 'Failed to add link',
      details: error.message || 'Unknown error'
    });
  }
});

// DELETE /api/graph/nodes/:nodeId - Remove node
app.delete('/api/graph/nodes/:nodeId', async (req, res) => {
  try {
    const graphData = await s3Service.getGraphData();
    res.json(graphData);
  } catch (error) {
    console.error('Error removing node:', error);
    res.status(500).json({ 
      error: 'Failed to remove node',
      details: error.message || 'Unknown error'
    });
  }
});

// DELETE /api/graph/links - Remove link
app.delete('/api/graph/links', async (req, res) => {
  try {
    const graphData = await s3Service.getGraphData();
    res.json(graphData);
  } catch (error) {
    console.error('Error removing link:', error);
    res.status(500).json({ 
      error: 'Failed to remove link',
      details: error.message || 'Unknown error'
    });
  }
});

// POST /api/fortifai - Handle FortifAI action for EC2 instances
app.post('/api/fortifai', async (req, res) => {
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
      details: error.message || 'Unknown error'
    });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 
import { GraphData, Node, Link } from './types';

// In-memory storage for graph data
let graphData: GraphData = {
  nodes: [
    { id: 'compute', name: 'Compute', group: 'compute', val: 2, type: 'compute' },
    { id: 'database', name: 'Database', group: 'database', val: 2, type: 'database' },
    { id: 'storage', name: 'Storage', group: 'storage', val: 2, type: 'storage' },
    { id: 'streaming', name: 'Streaming', group: 'streaming', val: 2, type: 'streaming' },
    { id: 'etl', name: 'ETL', group: 'etl', val: 2, type: 'etl' },
    { id: 'hilik', name: 'Hilik', group: 'hilik', val: 3, type: 'storage' },
    { id: 'ai-instance-1', name: 'AI Instance 1', group: 'ai', val: 3, type: 'ai' },
    { id: 'ai-instance-2', name: 'AI Instance 2', group: 'ai', val: 3, type: 'ai' },
  ],
  links: [
    { source: 'compute', target: 'database', value: 1 },
    { source: 'compute', target: 'storage', value: 1 },
    { source: 'compute', target: 'streaming', value: 1 },
    { source: 'compute', target: 'etl', value: 1 },
    { source: 'ai-instance-1', target: 'compute', value: 2 },
    { source: 'ai-instance-2', target: 'compute', value: 2 },
  ],
};

export const getGraphData = (): GraphData => {
  return graphData;
};

export const updateGraphData = (newData: GraphData): GraphData => {
  graphData = newData;
  return graphData;
};

export const addNode = (node: Node): GraphData => {
  graphData.nodes.push(node);
  return graphData;
};

export const addLink = (link: Link): GraphData => {
  graphData.links.push(link);
  return graphData;
};

export const removeNode = (nodeId: string): GraphData => {
  graphData.nodes = graphData.nodes.filter(node => node.id !== nodeId);
  graphData.links = graphData.links.filter(link => 
    link.source !== nodeId && link.target !== nodeId
  );
  return graphData;
};

export const removeLink = (source: string, target: string): GraphData => {
  graphData.links = graphData.links.filter(link => 
    !(link.source === source && link.target === target)
  );
  return graphData;
}; 
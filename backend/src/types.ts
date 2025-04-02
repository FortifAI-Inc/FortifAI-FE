export interface Node {
  id: string;
  name: string;
  group: string;
  val: number;
  type: string;
}

export interface Link {
  source: string;
  target: string;
  value: number;
}

export interface GraphData {
  nodes: Node[];
  links: Link[];
} 
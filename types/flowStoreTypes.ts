import { Node, Edge } from "reactflow";

export type PacketType = "text" | "file" | "data";

export interface FlowPacket {
  type: PacketType;
  payload: any;
  meta?: {
    name?: string;
    size?: number;
    mimeType?: string;
  };
}

export interface NodeData {
  label: string;
  
  // UNIVERSAL PACKET SYSTEM
  packet?: FlowPacket;
  
  // 1. INPUT (Dropzone)
  // Uses 'packet' for storage
  
  // 2. ACTION (Natural Integration)
  // "What are we doing here?"
  connectionType?: string; 
  
  // 3. AI (Brain)
  // "What should the brain focus on?"
  instructions?: string;
  
  // 4. ROUTER (N-Way)
  // "Where should we go next?"
  routes?: string[];
  conditions?: Record<string, string>;
  
  // 5. OUTPUT (Response Gallery)
  // Uses 'packet' from previous nodes or custom format
  resultFormat?: string;

  // Internal legacy mapping
  uploadedFileName?: string;
}

export type ExecutionStatus = "pending" | "success" | "error";

export interface ExecutionLogEntry {
  nodeId: string;
  nodeType: string;
  status: ExecutionStatus;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  inputSnapshot: unknown;
  outputSnapshot: unknown;
  error?: string;
}

export interface ExecutionContext {
  variables: Record<string, FlowPacket>;
  nodes: Record<string, FlowPacket>;
}

export interface FlowState {
  nodes: Node<NodeData>[];
  edges: Edge[];
  theme: string;
  selectedNodeId: string | null;
  running: boolean;
  highlightedNodeId: string | null;
  currentContext: ExecutionContext | null;
  executionLogs: ExecutionLogEntry[];
  finalResult: FlowPacket | null;
  activeEdgeId?: string | null;
  executedNodeIds: string[];
  showMinimap: boolean;
  showExecutionLogPanel: boolean;
  showVariablesPanel: boolean;
  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  setSelectedNodeId: (id: string | null) => void;
  setRunning: (running: boolean) => void;
  setHighlightedNodeId: (id: string | null) => void;
  setTheme: (theme: string) => void;
  clearCanvas: () => void;
  setFinalResult: (result: FlowPacket | null) => void;
  setShowMinimap: (value: boolean) => void;
  setShowExecutionLogPanel: (value: boolean) => void;
  setShowVariablesPanel: (value: boolean) => void;
  simulateFlow: (startNodeId: string) => Promise<void>;
}

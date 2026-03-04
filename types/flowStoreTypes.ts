import { Node, Edge } from "reactflow";

export interface NodeData {
  label: string;
  // Fetch node
  apiUrl?: string; // legacy
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;

  // AI node
  prompt?: string;
  temperature?: number;
  jsonMode?: boolean;

  // Decision / expression
  condition?: string;
  expression?: string;
  value?: any;
  nextNode?: string;
  trueOutput?: string;
  falseOutput?: string;

  // Input node
  rawJson?: string;
  inputText?: string;
  inputMode?: "text" | "json";

  // Output node
  template?: string;
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
  /**
   * High-level variables available to templates, e.g. `input`, `output`.
   */
  variables: Record<string, unknown>;
  /**
   * Per-node outputs, accessed via {{nodeId}} / {{nodeId.property}} in templates.
   */
  nodes: Record<string, unknown>;
}

export interface FlowState {
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  running: boolean;
  highlightedNodeId: string | null;
  /**
   * Last execution context snapshot (after a run).
   */
  currentContext: ExecutionContext | null;
  /**
   * Ordered execution logs for the last run.
   */
  executionLogs: ExecutionLogEntry[];
  /**
   * Last resolved output string from the most recently executed Output node.
   */
  finalResult: string | null;
  /**
   * The currently traversed edge during execution (for live path highlighting).
   */
  activeEdgeId?: string | null;
  /**
   * Ordered list of node ids visited during the last run.
   */
  executedNodeIds: string[];
  /**
   * UI preferences
   */
  showMinimap: boolean;
  showExecutionLogPanel: boolean;
  showVariablesPanel: boolean;
  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  setSelectedNodeId: (id: string | null) => void;
  setRunning: (running: boolean) => void;
  setHighlightedNodeId: (id: string | null) => void;
  setShowMinimap: (value: boolean) => void;
  setShowExecutionLogPanel: (value: boolean) => void;
  setShowVariablesPanel: (value: boolean) => void;
  simulateFlow: (startNodeId: string) => Promise<void>;
}

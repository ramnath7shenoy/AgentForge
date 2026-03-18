import { Node, Edge } from "reactflow";

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  nodes: Node[];
  edges: Edge[];
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: "basic-chatbot",
    name: "Basic Chatbot",
    description: "A simple Input → AI → Output pipeline. Great starting point for any conversational agent.",
    icon: "💬",
    nodes: [
      {
        id: "t-input-1",
        type: "input",
        position: { x: 80, y: 200 },
        data: {
          label: "User Message",
          packet: { type: "text", payload: "Hello! What can you help me with today?" },
        },
      },
      {
        id: "t-ai-1",
        type: "ai",
        position: { x: 380, y: 200 },
        data: {
          label: "AI Assistant",
          model: "gpt-4o-mini",
          instructions: "You are a friendly and helpful AI assistant. Answer the user's message: {{input}}",
        },
      },
      {
        id: "t-output-1",
        type: "output",
        position: { x: 680, y: 200 },
        data: {
          label: "Response",
          resultFormat: "{{t-ai-1}}",
        },
      },
    ],
    edges: [
      { id: "te-1", source: "t-input-1", target: "t-ai-1" },
      { id: "te-2", source: "t-ai-1", target: "t-output-1" },
    ],
  },
  {
    id: "research-assistant",
    name: "Research Assistant",
    description: "Input → AI Researcher → AI Summarizer → Output. Ideal for deep-dive analysis workflows.",
    icon: "🔬",
    nodes: [
      {
        id: "r-input-1",
        type: "input",
        position: { x: 60, y: 220 },
        data: {
          label: "Research Topic",
          packet: { type: "text", payload: "The impact of AI on the future of work" },
        },
      },
      {
        id: "r-ai-1",
        type: "ai",
        position: { x: 340, y: 120 },
        data: {
          label: "Researcher",
          model: "gpt-4o-mini",
          instructions: "You are an expert researcher. Investigate this topic thoroughly and list key findings:\n\n{{input}}",
        },
      },
      {
        id: "r-ai-2",
        type: "ai",
        position: { x: 340, y: 340 },
        data: {
          label: "Summarizer",
          model: "gpt-4o-mini",
          instructions: "You are a concise writer. Summarize the following research findings into an executive summary:\n\n{{r-ai-1}}",
        },
      },
      {
        id: "r-output-1",
        type: "output",
        position: { x: 640, y: 220 },
        data: {
          label: "Research Report",
          resultFormat: "RESEARCH FINDINGS:\n{{r-ai-1}}\n\nEXECUTIVE SUMMARY:\n{{r-ai-2}}",
        },
      },
    ],
    edges: [
      { id: "re-1", source: "r-input-1", target: "r-ai-1" },
      { id: "re-2", source: "r-input-1", target: "r-ai-2" },
      { id: "re-3", source: "r-ai-1", target: "r-output-1" },
      { id: "re-4", source: "r-ai-2", target: "r-output-1" },
    ],
  },
  {
    id: "webhook-processor",
    name: "Webhook Processor",
    description: "Webhook → Processor → AI → Output. Perfect for automating responses to external events.",
    icon: "🔗",
    nodes: [
      {
        id: "w-trigger-1",
        type: "trigger",
        position: { x: 60, y: 200 },
        data: {
          label: "Webhook",
          schedule: "Webhook",
        },
      },
      {
        id: "w-processor-1",
        type: "processor",
        position: { x: 320, y: 200 },
        data: {
          label: "Data Processor",
          batchLogic: "Transform",
        },
      },
      {
        id: "w-ai-1",
        type: "ai",
        position: { x: 580, y: 200 },
        data: {
          label: "AI Responder",
          model: "gpt-4o-mini",
          instructions: "Process this webhook payload and generate an appropriate response: {{w-processor-1}}",
        },
      },
      {
        id: "w-output-1",
        type: "output",
        position: { x: 840, y: 200 },
        data: {
          label: "Webhook Response",
          resultFormat: "{{w-ai-1}}",
        },
      },
    ],
    edges: [
      { id: "we-1", source: "w-trigger-1", target: "w-processor-1" },
      { id: "we-2", source: "w-processor-1", target: "w-ai-1" },
      { id: "we-3", source: "w-ai-1", target: "w-output-1" },
    ],
  },
];

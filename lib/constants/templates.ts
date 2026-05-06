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
        position: { x: 60, y: 200 },
        data: {
          label: "Research Topic",
          packet: { type: "text", payload: "The impact of AI on the future of work" },
        },
      },
      {
        id: "r-ai-1",
        type: "ai",
        position: { x: 380, y: 200 },
        data: {
          label: "Researcher",
          instructions: "You are an expert researcher. Investigate this topic thoroughly and list key findings:\n\n{{input}}",
        },
      },
      {
        id: "r-ai-2",
        type: "ai",
        position: { x: 700, y: 200 },
        data: {
          label: "Summarizer",
          instructions: "You are a concise writer. Summarize the following research findings into an executive summary:\n\n{{r-ai-1.output}}",
        },
      },
      {
        id: "r-output-1",
        type: "output",
        position: { x: 1020, y: 200 },
        data: {
          label: "Research Report",
          resultFormat: "{{r-ai-2}}",
        },
      },
    ],
    edges: [
      { id: "re-1", source: "r-input-1", target: "r-ai-1" },
      { id: "re-2", source: "r-ai-1", target: "r-ai-2" },
      { id: "re-3", source: "r-ai-2", target: "r-output-1" },
    ],
  },
  {
    id: "omnichannel-content",
    name: "Omnichannel Content Generator",
    description:
      "Input topic → AI generates platform-specific JSON → parallel App Action posts to X, LinkedIn & Medium with human approval gate.",
    icon: "📡",
    nodes: [
      {
        id: "oc-input-1",
        type: "input",
        position: { x: 60, y: 280 },
        data: {
          label: "Content Topic",
          packet: { type: "text", payload: "The future of AI agents in software development" },
        },
      },
      {
        id: "oc-ai-1",
        type: "ai",
        position: { x: 360, y: 280 },
        data: {
          label: "Content Generator",
          provider: "auto",
          instructions: `You are a social media content strategist.

Create platform-specific content for the following topic: {{oc-input-1}}

Return ONLY a valid JSON object — no markdown fences, no explanation, no extra keys:
{
  "x": "<tweet ≤ 280 characters, punchy and engaging, include 1-2 relevant hashtags>",
  "linkedin": "<professional LinkedIn post 3-5 sentences, include a call-to-action>",
  "medium": "<Medium article introduction paragraph 80-120 words, compelling hook>"
}`,
        },
      },
      {
        id: "oc-approval-1",
        type: "approval",
        position: { x: 680, y: 280 },
        data: {
          label: "Review & Approve",
          gatekeeperMessage: "Review the generated content above. Type 'go' to publish to all three platforms.",
        },
      },
      {
        id: "oc-x-1",
        type: "appaction",
        position: { x: 980, y: 100 },
        data: {
          label: "Post to X",
          appProvider: "x",
          appAction: "create_tweet",
          appInputs: { text: "{{oc-ai-1.x}}" },
        },
      },
      {
        id: "oc-linkedin-1",
        type: "appaction",
        position: { x: 980, y: 280 },
        data: {
          label: "Post to LinkedIn",
          appProvider: "linkedin",
          appAction: "create_post",
          appInputs: { text: "{{oc-ai-1.linkedin}}" },
        },
      },
      {
        id: "oc-medium-1",
        type: "appaction",
        position: { x: 980, y: 460 },
        data: {
          label: "Publish to Medium",
          appProvider: "medium",
          appAction: "create_post",
          appInputs: {
            title: "{{oc-input-1}}",
            content: "{{oc-ai-1.medium}}",
            contentFormat: "markdown",
          },
        },
      },
      {
        id: "oc-output-1",
        type: "output",
        position: { x: 1280, y: 280 },
        data: {
          label: "Publication Report",
          resultFormat:
            "✅ X: {{oc-x-1}}\n✅ LinkedIn: {{oc-linkedin-1}}\n✅ Medium: {{oc-medium-1}}",
        },
      },
    ],
    edges: [
      { id: "oc-e1", source: "oc-input-1", target: "oc-ai-1" },
      { id: "oc-e2", source: "oc-ai-1", target: "oc-approval-1" },
      { id: "oc-e3", source: "oc-approval-1", target: "oc-x-1" },
      { id: "oc-e4", source: "oc-approval-1", target: "oc-linkedin-1" },
      { id: "oc-e5", source: "oc-approval-1", target: "oc-medium-1" },
      { id: "oc-e6", source: "oc-x-1", target: "oc-output-1" },
      { id: "oc-e7", source: "oc-linkedin-1", target: "oc-output-1" },
      { id: "oc-e8", source: "oc-medium-1", target: "oc-output-1" },
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

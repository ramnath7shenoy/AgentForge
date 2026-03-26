import { GoogleGenerativeAI } from "@google/generative-ai";
import { Node, Edge } from "reactflow";
import { NodeData, FlowPacket, ExecutionContext } from "@/types/flowStoreTypes";
import { resolveTemplates } from "../template";
import { getSavedAgents } from "../savedAgents";

/**
 * Universal LLM Router (Browser-Safe Raw Fetch)
 */
async function callLLM(
  provider: string,
  modelName: string,
  apiKey: string,
  prompt: string,
  onLog: (msg: string, type: any) => void
): Promise<string> {
  onLog(`🤖 Routing to ${provider.toUpperCase()}...`, "INFO");

  if (provider === "gemini") {
    // OLD SDK LOGIC (Kept as comment for viva demo)
    /*
    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({ model: modelName || "gemini-1.5-flash" }, { apiVersion: "v1" });
    const result = await genModel.generateContent(prompt);
    return result.response.text();
    */

    // NEW RAW FETCH LOGIC (More stable in 2026)
    const baseUrl = "https://generativelanguage.googleapis.com/v1/models";
    const model = modelName || "gemini-1.5-flash";
    const url = `${baseUrl}/${model}:generateContent?key=${apiKey}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
    });

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error?.message || "Gemini API Error");
    }
    const data = await resp.json();
    return data.candidates[0].content.parts[0].text;
  }

  if (provider === "openai") {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName || "gpt-4o",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error?.message || "OpenAI API Error");
    }
    const data = await resp.json();
    return data.choices[0].message.content;
  }

  if (provider === "anthropic") {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerously-allow-browser": "true"
      },
      body: JSON.stringify({
        model: modelName || "claude-3-5-sonnet",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error?.message || "Anthropic API Error");
    }
    const data = await resp.json();
    return data.content[0].text;
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

/**
 * Client-side execution engine for the flow graph.
 * Uses BFS to traverse the graph and executes each node's logic.
 * 
 * @param nodes List of nodes in the graph
 * @param edges List of edges connecting the nodes
 * @param initialInput The input value that starts the flow
 * @param onLog Callback function to send logs back to the UI
 * @returns An object containing success status, final context, and execution logs
 */
export async function executeGraph(
  nodes: Node<NodeData>[],
  edges: Edge[],
  initialInput: string,
  onLog?: (message: string, type?: "INFO" | "SUCCESS" | "ERROR" | "WARN", nodeId?: string) => void
) {
  const context: ExecutionContext = {
    variables: {
      input: { type: "text", payload: initialInput },
    },
    nodes: {},
  };
  const logs: string[] = [];

  const sendLog = (message: string, type: "INFO" | "SUCCESS" | "ERROR" | "WARN" = "INFO", nodeId?: string) => {
    logs.push(`[${type}] ${message}`);
    if (onLog) {
      onLog(message, type, nodeId);
    }
  };

  sendLog("🚀 Client-side execution started (Bypassing Server)...", "INFO");

  // 1. Discovery Block (Optional/Legacy check)
  const discoveryNode = nodes.find((n) => (n.type === "ai") && n.data?.apiKey && (n.data?.provider === "gemini" || !n.data?.provider));
  if (discoveryNode?.data?.apiKey) {
    sendLog("🔍 LLM Hub initializing...", "INFO");
  }

  // 2. Find the 'trigger' node or nodes[0]
  const startNode = nodes.find((n) => n.type === "trigger") || nodes[0];
  if (!startNode) {
    sendLog("No nodes found in graph.", "ERROR");
    return { success: false, context, logs };
  }

  // 3. Use a Queue (BFS) to traverse the graph.
  const queue: string[] = [startNode.id];
  const executed = new Set<string>();
  const visited = new Set<string>();
  visited.add(startNode.id);

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    sendLog(`Executing ${node.type} node: ${node.data.label || node.id}`, "INFO", node.id);

    try {
      // 4. Maintain a context object to store results of each node.
      let resultPacket: FlowPacket = { type: "text", payload: "" };

      switch (node.type) {
        case "trigger":
          resultPacket = { type: "text", payload: `Triggered with: ${initialInput}` };
          break;

        case "agent-brain":
        case "llm":
        case "ai":
          const provider = node.data?.provider || "gemini";
          const modelName = node.data?.modelName || node.data?.model || "";
          const apiKey = node.data?.apiKey;

          if (!apiKey) {
            sendLog(`ERROR: Missing ${provider.toUpperCase()} Key.`, "ERROR", node.id);
            throw new Error(`Missing ${provider} API Key`);
          }

          // Memory Bridge: resolveTemplates handles {{input}} and {{node_id}}
          const finalPrompt = resolveTemplates(node.data.instructions || "", context);
          const responseText = await callLLM(provider, modelName, apiKey, finalPrompt, (msg, type) => sendLog(msg, type, node.id));

          resultPacket = { type: "text", payload: responseText };
          context.nodes[node.id] = resultPacket;
          sendLog("AI Response captured.", "SUCCESS", node.id);
          break;

        case "input":
          resultPacket = node.data.packet || { type: "text", payload: initialInput };
          break;

        case "output":
          const outputText = resolveTemplates(node.data.resultFormat || "", context);
          resultPacket = { type: "text", payload: outputText };
          context.variables.output = resultPacket;
          break;

        case "processor":
          const inputNodeId = edges.find(e => e.target === node.id)?.source;
          const inputData = inputNodeId ? context.nodes[inputNodeId] : null;
          resultPacket = { 
            type: "text", 
            payload: `Processed: ${JSON.stringify(inputData?.payload || "")}` 
          };
          break;

        case "subagent":
        case "subflow":
          // Prioritize localized workflow overrides for this specific instance
          const executionData = node.data.workflowOverride || node.data.localOverride;
          if (executionData && executionData.nodes && executionData.nodes.length > 0) {
            sendLog(`🚀 Running localized override for: ${node.data.label}`, "INFO", node.id);
            
            // Determine input for subflow: use incoming edge data if available, else initialInput
            const incomingEdge = edges.find(e => e.target === node.id);
            const subInput = incomingEdge ? (context.nodes[incomingEdge.source]?.payload || initialInput) : initialInput;
            const inputStr = typeof subInput === 'string' ? subInput : JSON.stringify(subInput);

            const subResult = await executeGraph(
              executionData.nodes,
              executionData.edges,
              inputStr,
              onLog
            );
            resultPacket = subResult.context.variables.output || 
                           Object.values(subResult.context.nodes).pop() || 
                           { type: "text", payload: "Sub-agent complete" };
          } else if (node.data.subflowId) {
            // Fetch template data if no override is found
            const agents = getSavedAgents();
            const agent = agents.find(a => a.id === node.data.subflowId);
            if (agent && agent.nodes && agent.nodes.length > 0) {
              sendLog(`🚀 Running template for: ${agent.name}`, "INFO", node.id);
              
              const incomingEdge = edges.find(e => e.target === node.id);
              const subInput = incomingEdge ? (context.nodes[incomingEdge.source]?.payload || initialInput) : initialInput;
              const inputStr = typeof subInput === 'string' ? subInput : JSON.stringify(subInput);

              const subResult = await executeGraph(
                agent.nodes,
                agent.edges,
                inputStr,
                onLog
              );
              resultPacket = subResult.context.variables.output || 
                             Object.values(subResult.context.nodes).pop() || 
                             { type: "text", payload: "Sub-agent complete" };
            }
          }
          break;

        default:
          resultPacket = { type: "text", payload: `Executed ${node.type}` };
          break;
      }

      context.nodes[node.id] = resultPacket;
      executed.add(nodeId);
      sendLog(`Completed node: ${node.data.label || node.id}`, "SUCCESS", node.id);

      // Add children to queue
      const children = edges.filter((e) => e.source === nodeId).map((e) => e.target);
      for (const childId of children) {
        if (!visited.has(childId)) {
          visited.add(childId);
          queue.push(childId);
        }
      }
    } catch (error: any) {
      sendLog(`Error in node ${node.id}: ${error.message}`, "ERROR", node.id);
      return { success: false, context, logs };
    }
  }

  sendLog("Flow execution finished successfully", "SUCCESS");
  return { success: true, context, logs };
}

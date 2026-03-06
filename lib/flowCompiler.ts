import { Node, Edge } from "reactflow";
import { NodeData } from "@/types/flowStoreTypes";

/**
 * Clean up node labels for developer-friendly variable and function names.
 */
function toSnakeCase(str: string): string {
  return str
    .replace(/[^\w\s]/gi, '')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase();
}

/**
 * Generates a unique semantic name for each node to prevent collisions.
 */
function getSemanticNames(nodes: Node<NodeData>[]): Record<string, string> {
  const names: Record<string, string> = {};
  const usedNames = new Set<string>();

  nodes.forEach((node, index) => {
    let baseName = toSnakeCase(node.data.label || node.type || `node_${index + 1}`);
    if (!baseName || baseName === "") baseName = `node_${index + 1}`;
    
    let finalName = baseName;
    let counter = 1;
    while (usedNames.has(finalName)) {
      finalName = `${baseName}_${counter}`;
      counter++;
    }
    
    usedNames.add(finalName);
    names[node.id] = finalName;
  });

  return names;
}

export function compileFlow(nodes: Node<NodeData>[], edges: Edge[], targetLanguage: 'python' | 'javascript'): string {
  const inputNode = nodes.find(n => n.type === 'input') || nodes[0];
  if (!inputNode) return "// No nodes found to compile.";

  const semanticNames = getSemanticNames(nodes);

  return targetLanguage === 'python' 
    ? compilePython(nodes, edges, inputNode, semanticNames) 
    : compileJavascript(nodes, edges, inputNode, semanticNames);
}

function getNextNodes(nodeId: string, edges: Edge[]): Edge[] {
  return edges.filter(e => e.source === nodeId);
}

function compilePython(
  nodes: Node<NodeData>[], 
  edges: Edge[], 
  startNode: Node<NodeData>, 
  semanticNames: Record<string, string>
): string {
  let code = `import json\nimport requests\n\nclass AgentForgeAgent:\n    """\n    Developer-Friendly AgentForge compiled agent.\n    Usage:\n        agent = AgentForgeAgent()\n        result = agent.run({"type": "text", "payload": "..."})\n        print(result["${semanticNames[startNode.id]}"])\n    """\n\n    def __init__(self):\n        self.context = {}\n\n`;

  nodes.forEach(node => {
    const semanticName = semanticNames[node.id];
    code += `    def _process_${semanticName}(self):\n`;
    code += `        # Node: ${node.data.label}\n`;

    if (node.type === 'input') {
      code += `        packet = self.context.get('input', {"type": "text", "payload": ""})\n`;
      code += `        self.context['${semanticName}'] = packet\n`;
      const nextEdges = getNextNodes(node.id, edges);
      if (nextEdges.length > 0) {
        return code += `        return self._process_${semanticNames[nextEdges[0].target]}()\n`;
      }
      return code += `        return packet\n`;
    } 
    else if (node.type === 'action') {
      const connection = node.data.connectionType || 'Integration';
      code += `        packet = {"type": "data", "payload": {"ok": True, "connection": "${connection}"}}\n`;
      code += `        self.context['${semanticName}'] = packet\n`;
      const nextEdges = getNextNodes(node.id, edges);
      if (nextEdges.length > 0) {
        return code += `        return self._process_${semanticNames[nextEdges[0].target]}()\n`;
      }
      return code += `        return packet\n`;
    }
    else if (node.type === 'ai') {
      const inst = (node.data.instructions || '').replace(/"/g, '\\"').replace(/\n/g, '\\n');
      code += `        instructions = "${inst}"\n`;
      code += `        packet = {"type": "text", "payload": f"Brain Result: {instructions[:30]}..."}\n`;
      code += `        self.context['${semanticName}'] = packet\n`;
      const nextEdges = getNextNodes(node.id, edges);
      if (nextEdges.length > 0) {
        return code += `        return self._process_${semanticNames[nextEdges[0].target]}()\n`;
      }
      return code += `        return packet\n`;
    }
    else if (node.type === 'router' || node.type === 'decision') {
      code += `        keys = list(self.context.keys())\n`;
      code += `        last_key = keys[-1] if keys else None\n`;
      code += `        last_payload = str(self.context[last_key].get('payload', '')).lower() if last_key else ""\n\n`;
      
      const routes = node.data.routes || ['Path A', 'Path B'];
      const conditions = node.data.conditions || {};
      
      let isFirst = true;
      for (const route of routes) {
        const targetEdge = edges.find(e => e.source === node.id && e.sourceHandle === route.toLowerCase());
        if (!targetEdge) continue;

        const conditionStr = (conditions[route] || '').toLowerCase();
        let pyCondition = 'True';
        
        if (conditionStr.includes('positive') || conditionStr.includes('good')) {
           pyCondition = `'positive' in last_payload or 'good' in last_payload`;
        } else if (conditionStr.includes('negative') || conditionStr.includes('bad')) {
           pyCondition = `'negative' in last_payload or 'bad' in last_payload`;
        } else if (conditionStr) {
           pyCondition = `'${conditionStr.replace(/'/g, "\\'")}' in last_payload`;
        }

        if (isFirst) {
          code += `        if ${pyCondition}:\n`;
          isFirst = false;
        } else {
          code += `        elif ${pyCondition}:\n`;
        }
        code += `            return self._process_${semanticNames[targetEdge.target]}()\n`;
      }
      code += isFirst ? `        return None\n` : `        else:\n            return None\n`;
    }
    else if (node.type === 'output') {
      const template = (node.data.resultFormat || '').replace(/"/g, '\\"').replace(/\n/g, '\\n');
      code += `        template = "${template}"\n`;
      code += `        packet = {"type": "text", "payload": f"Result: {template}"}\n`;
      code += `        self.context['${semanticName}'] = packet\n`;
      code += `        return packet\n`;
    }
    code += `\n`;
  });

  code += `    def run(self, input_packet=None):\n`;
  code += `        if input_packet is None:\n`;
  code += `            input_packet = {"type": "text", "payload": "Default"}\n`;
  code += `        self.context = {'input': input_packet}\n`;
  code += `        self._process_${semanticNames[startNode.id]}()\n`;
  code += `        return self.context\n\n`;
  
  code += `if __name__ == "__main__":\n`;
  code += `    agent = AgentForgeAgent()\n`;
  code += `    result = agent.run({"type": "text", "payload": "Hello"})\n`;
  code += `    print(json.dumps(result, indent=2))\n`;

  return code;
}

function compileJavascript(
  nodes: Node<NodeData>[], 
  edges: Edge[], 
  startNode: Node<NodeData>,
  semanticNames: Record<string, string>
): string {
  let code = `/**\n * AgentForge Universal Flow\n */\n\n`;

  nodes.forEach(node => {
    const semanticName = semanticNames[node.id];
    code += `async function process_${semanticName}(context) {\n`;

    if (node.type === 'input') {
      code += `  const packet = context.input || { type: 'text', payload: '' };\n`;
      code += `  context['${semanticName}'] = packet;\n`;
      const nextEdges = getNextNodes(node.id, edges);
      if (nextEdges.length > 0) {
        return code += `  return process_${semanticNames[nextEdges[0].target]}(context);\n}\n\n`;
      }
      return code += `  return packet;\n}\n\n`;
    } 
    else if (node.type === 'action') {
      const connection = node.data.connectionType || 'Integration';
      code += `  const packet = { type: "data", payload: { ok: true, connection: "${connection}" } };\n`;
      code += `  context['${semanticName}'] = packet;\n`;
      const nextEdges = getNextNodes(node.id, edges);
      if (nextEdges.length > 0) {
        return code += `  return process_${semanticNames[nextEdges[0].target]}(context);\n}\n\n`;
      }
      return code += `  return packet;\n}\n\n`;
    }
    else if (node.type === 'ai') {
      const inst = (node.data.instructions || '').replace(/"/g, '\\"').replace(/\n/g, '\\n');
      code += `  const instructions = "${inst}";\n`;
      code += `  const packet = { type: "text", payload: \`Brain Result: \${instructions.substring(0, 30)}...\` };\n`;
      code += `  context['${semanticName}'] = packet;\n`;
      const nextEdges = getNextNodes(node.id, edges);
      if (nextEdges.length > 0) {
        return code += `  return process_${semanticNames[nextEdges[0].target]}(context);\n}\n\n`;
      }
      return code += `  return packet;\n}\n\n`;
    }
    else if (node.type === 'router' || node.type === 'decision') {
      code += `  const lastPayload = String(context[Object.keys(context).pop()]?.payload || '').toLowerCase();\n`;
      
      const routes = node.data.routes || ['Path A', 'Path B'];
      const conditions = node.data.conditions || {};
      
      let isFirst = true;
      for (const route of routes) {
        const targetEdge = edges.find(e => e.source === node.id && e.sourceHandle === route.toLowerCase());
        if (!targetEdge) continue;

        const conditionStr = (conditions[route] || '').toLowerCase();
        let jsCond = conditionStr ? `lastPayload.includes('${conditionStr.replace(/'/g, "\\'")}')` : 'true';

        if (isFirst) {
          code += `  if (${jsCond}) {\n`;
          isFirst = false;
        } else {
          code += `  else if (${jsCond}) {\n`;
        }
        code += `    return process_${semanticNames[targetEdge.target]}(context);\n  }\n`;
      }
      code += isFirst ? `  return null;\n}\n\n` : `  else { return null; }\n}\n\n`;
    }
    else if (node.type === 'output') {
      const template = (node.data.resultFormat || '').replace(/"/g, '\\"').replace(/\n/g, '\\n');
      code += `  const template = "${template}";\n`;
      code += `  const packet = { type: "text", payload: \`Result: \${template}\` };\n`;
      code += `  context['${semanticName}'] = packet;\n`;
      code += `  return packet;\n}\n\n`;
    }
  });

  code += `export const runAgent = async (initialInput = null) => {\n`;
  code += `  const context = { input: initialInput || { type: 'text', payload: 'Default' } };\n`;
  code += `  await process_${semanticNames[startNode.id]}(context);\n`;
  code += `  return context;\n};\n`;

  return code;
}

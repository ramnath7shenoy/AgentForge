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

export function compileFlow(nodes: Node<NodeData>[], edges: Edge[], targetLanguage: 'python' | 'javascript' | 'typescript'): string {
  const inputNode = nodes.find(n => n.type === 'input') || nodes[0];
  if (!inputNode) return "// No nodes found to compile.";

  const semanticNames = getSemanticNames(nodes);

  if (targetLanguage === 'python') return compilePython(nodes, edges, inputNode, semanticNames);
  if (targetLanguage === 'typescript') return compileTypescript(nodes, edges, inputNode, semanticNames);
  return compileJavascript(nodes, edges, inputNode, semanticNames);
}

function compileTypescript(
  nodes: Node<NodeData>[], 
  edges: Edge[], 
  startNode: Node<NodeData>,
  semanticNames: Record<string, string>
): string {
  const triggerNode = nodes.find(n => n.type === 'trigger');
  const usesSchedule = triggerNode?.data?.schedule === 'Schedule';

  let code = `/**\n * AgentForge Universal Flow (TypeScript)\n */\n\n`;
  if (usesSchedule) {
    code += `// Requires 'node-cron' package. Run 'npm install node-cron @types/node-cron'\n`;
    code += `import * as cron from 'node-cron';\n\n`;
  }

  code += `export interface FlowPacket {\n  type: 'text' | 'data' | 'file';\n  payload: any;\n  meta?: any;\n}\n\n`;
  code += `export interface FlowContext {\n  input: FlowPacket;\n  [key: string]: FlowPacket;\n}\n\n`;

  code += `export class UniversalAgent {\n  private context: FlowContext;\n\n  constructor() {\n    this.context = { input: { type: 'text', payload: 'Default' } };\n  }\n\n`;

  nodes.forEach(node => {
    const semanticName = semanticNames[node.id];
    code += `  private async process_${semanticName}(context: FlowContext): Promise<FlowPacket | null> {\n`;
    code += `    // Node: ${node.data.label}\n`;

    if (node.type === 'input') {
      code += `    const packet: FlowPacket = context.input;\n`;
      code += `    context['${semanticName}'] = packet;\n`;
      const nextEdges = getNextNodes(node.id, edges);
      if (nextEdges.length > 0) {
        return code += `    return this.process_${semanticNames[nextEdges[0].target]}(context);\n  }\n\n`;
      }
      return code += `    return packet;\n  }\n\n`;
    } 
    else if (node.type === 'action') {
      const connection = node.data.connectionType || 'Integration';
      code += `    const packet: FlowPacket = { type: 'data', payload: { ok: true, connection: '${connection}' } };\n`;
      code += `    context['${semanticName}'] = packet;\n`;
      const nextEdges = getNextNodes(node.id, edges);
      if (nextEdges.length > 0) {
        return code += `    return this.process_${semanticNames[nextEdges[0].target]}(context);\n  }\n\n`;
      }
      return code += `    return packet;\n  }\n\n`;
    }
    else if (node.type === 'ai') {
      const inst = (node.data.instructions || '').replace(/'/g, "\\'").replace(/\n/g, '\\n');
      code += `    const instructions = '${inst}';\n`;
      code += `    const packet: FlowPacket = { type: 'text', payload: \`Brain Result for: \${instructions.substring(0, 30)}...\` };\n`;
      code += `    context['${semanticName}'] = packet;\n`;
      const nextEdges = getNextNodes(node.id, edges);
      if (nextEdges.length > 0) {
        return code += `    return this.process_${semanticNames[nextEdges[0].target]}(context);\n  }\n\n`;
      }
      return code += `    return packet;\n  }\n\n`;
    }
    else if (node.type === 'router' || node.type === 'decision') {
      code += `    const keys = Object.keys(context);\n`;
      code += `    const lastPayload = String(context[keys[keys.length - 1]]?.payload || '').toLowerCase();\n`;
      
      const routes = node.data.routes || ['Path A', 'Path B'];
      const conditions = node.data.conditions || {};
      
      let isFirst = true;
      for (const route of routes) {
        const targetEdge = edges.find(e => e.source === node.id && e.sourceHandle === route.toLowerCase());
        if (!targetEdge) continue;

        const conditionStr = (conditions[route] || '').toLowerCase();
        const jsCond = conditionStr ? `lastPayload.includes('${conditionStr.replace(/'/g, "\\'")}')` : 'true';

        if (isFirst) {
          code += `    if (${jsCond}) {\n`;
          isFirst = false;
        } else {
          code += `    else if (${jsCond}) {\n`;
        }
        code += `      return this.process_${semanticNames[targetEdge.target]}(context);\n    }\n`;
      }
      code += isFirst ? `    return null;\n  }\n\n` : `    else { return null; }\n  }\n\n`;
    }
    else if (node.type === 'output') {
      const template = (node.data.resultFormat || '').replace(/'/g, "\\'").replace(/\n/g, '\\n');
      code += `    const template = '${template}';\n`;
      code += `    const packet: FlowPacket = { type: 'text', payload: \`Final Result: \${template}\` };\n`;
      code += `    context['${semanticName}'] = packet;\n`;
      code += `    return packet;\n  }\n\n`;
    }
  });

  code += `  public async run(initialInput?: FlowPacket): Promise<FlowContext> {\n`;
  code += `    if (initialInput) this.context.input = initialInput;\n`;
  code += `    await this.process_${semanticNames[startNode.id]}(this.context);\n`;
  code += `    return this.context;\n  }\n}\n\n`;

  if (usesSchedule && triggerNode) {
    const cronSetting = triggerNode.data.cron || 'Every Minute';
    const timeStr = triggerNode.data.time || '09:00';
    const days = triggerNode.data.days || ['Mon'];
    let cronExpression = '* * * * *';

    if (cronSetting === 'Hourly') {
      cronExpression = '0 * * * *';
    } else if (cronSetting === 'Daily') {
      const [hour, minute] = timeStr.split(':');
      cronExpression = `${parseInt(minute || '0')} ${parseInt(hour || '9')} * * *`;
    } else if (cronSetting === 'Weekly') {
      const [hour, minute] = timeStr.split(':');
      const dayMap: Record<string, string> = { Sun: '0', Mon: '1', Tue: '2', Wed: '3', Thu: '4', Fri: '5', Sat: '6' };
      const dayNumbers = days.map(d => dayMap[d]).filter(d => d !== undefined).join(',');
      cronExpression = `${parseInt(minute || '0')} ${parseInt(hour || '9')} * * ${dayNumbers || '1'}`;
    }

    code += `// Scheduled Execution\nconst agent = new UniversalAgent();\ncron.schedule('${cronExpression}', () => {\n  agent.run().catch(console.error);\n});\n`;
  } else {
    code += `// Immediate Run (Main)\nif (require.main === module) {\n  const agent = new UniversalAgent();\n  agent.run().then(ctx => console.log(JSON.stringify(ctx, null, 2))).catch(console.error);\n}\n`;
  }

  return code;
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
  const triggerNode = nodes.find(n => n.type === 'trigger');
  const usesSchedule = triggerNode?.data?.schedule === 'Schedule';
  
  let code = `import json\nimport requests\n`;
  if (usesSchedule) {
    code += `import schedule\nimport time\n`;
  }
  
  code += `\nclass AgentForgeAgent:\n    """\n    Developer-Friendly AgentForge compiled agent.\n    Usage:\n        agent = AgentForgeAgent()\n        result = agent.run({"type": "text", "payload": "..."})\n        print(result["${semanticNames[startNode.id]}"])\n    """\n\n    def __init__(self):\n        self.context = {}\n\n`;

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
  code += `    agent = AgentForgeAgent()\n\n`;
  
  if (usesSchedule && triggerNode) {
    const cron = triggerNode.data.cron || 'Every Minute';
    const timeStr = triggerNode.data.time || '09:00';
    const days = triggerNode.data.days || ['Mon'];
    
    code += `    def job():\n`;
    code += `        print("Running scheduled agent...")\n`;
    code += `        agent.run({"type": "text", "payload": "Scheduled Run"})\n\n`;

    if (cron === 'Every Minute') {
      code += `    schedule.every(1).minutes.do(job)\n`;
    } else if (cron === 'Hourly') {
      code += `    schedule.every(1).hours.do(job)\n`;
    } else if (cron === 'Daily') {
      code += `    schedule.every().day.at("${timeStr}").do(job)\n`;
    } else if (cron === 'Weekly') {
      const dayMap: Record<string, string> = {
        'Mon': 'monday', 'Tue': 'tuesday', 'Wed': 'wednesday', 
        'Thu': 'thursday', 'Fri': 'friday', 'Sat': 'saturday', 'Sun': 'sunday'
      };
      days.forEach(day => {
        const pyDay = dayMap[day] || 'monday';
        code += `    schedule.every().${pyDay}.at("${timeStr}").do(job)\n`;
      });
    }

    code += `\n    print("Scheduler activated. Waiting for next run...")\n`;
    code += `    while True:\n`;
    code += `        schedule.run_pending()\n`;
    code += `        time.sleep(1)\n`;
  } else {
    code += `    result = agent.run({"type": "text", "payload": "Hello"})\n`;
    code += `    print(json.dumps(result, indent=2))\n`;
  }

  return code;
}

function compileJavascript(
  nodes: Node<NodeData>[], 
  edges: Edge[], 
  startNode: Node<NodeData>,
  semanticNames: Record<string, string>
): string {
  const triggerNode = nodes.find(n => n.type === 'trigger');
  const usesSchedule = triggerNode?.data?.schedule === 'Schedule';

  let code = `/**\n * AgentForge Universal Flow\n */\n\n`;
  if (usesSchedule) {
    code += `// Requires 'node-cron' package. Run 'npm install node-cron'\n`;
    code += `const cron = require('node-cron');\n\n`;
  }

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
        const jsCond = conditionStr ? `lastPayload.includes('${conditionStr.replace(/'/g, "\\'")}')` : 'true';

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
  code += `  console.log("Running agent flow...");\n`;
  code += `  const context = { input: initialInput || { type: 'text', payload: 'Default' } };\n`;
  code += `  await process_${semanticNames[startNode.id]}(context);\n`;
  code += `  return context;\n};\n\n`;

  if (usesSchedule && triggerNode) {
    const cronSetting = triggerNode.data.cron || 'Every Minute';
    const timeStr = triggerNode.data.time || '09:00';
    const days = triggerNode.data.days || ['Mon'];
    let cronExpression = '* * * * *'; // Default: matching 'Every Minute'

    if (cronSetting === 'Hourly') {
      cronExpression = '0 * * * *';
    } else if (cronSetting === 'Daily') {
      const parts = timeStr.split(':');
      const hour = parts[0] || '9';
      const minute = parts[1] || '0';
      cronExpression = `${parseInt(minute)} ${parseInt(hour)} * * *`;
    } else if (cronSetting === 'Weekly') {
      const parts = timeStr.split(':');
      const hour = parts[0] || '9';
      const minute = parts[1] || '0';
      const dayMap: Record<string, string> = {
        'Sun': '0', 'Mon': '1', 'Tue': '2', 'Wed': '3', 
        'Thu': '4', 'Fri': '5', 'Sat': '6'
      };
      
      const dayNumbers = days.map(d => dayMap[d]).filter(Boolean).join(',');
      const cronDays = dayNumbers.length > 0 ? dayNumbers : '1';
      cronExpression = `${parseInt(minute)} ${parseInt(hour)} * * ${cronDays}`;
    }

    code += `// Boot up the scheduler\n`;
    code += `console.log("Starting scheduler with expression: '${cronExpression}'...");\n`;
    code += `cron.schedule('${cronExpression}', () => {\n`;
    code += `  runAgent().catch(console.error);\n`;
    code += `});\n`;
  } else {
    code += `// Auto-run immediately if not scheduled\n`;
    code += `if (require.main === module) {\n`;
    code += `  runAgent().then(result => console.log("Final Context:", JSON.stringify(result, null, 2))).catch(console.error);\n`;
    code += `}\n`;
  }

  return code;
}

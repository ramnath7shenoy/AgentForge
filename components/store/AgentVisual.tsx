import React from "react";

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

function seeded(seed: number, n: number): number {
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    s = s >>> 0;
  }
  return s / 0x100000000;
}

const THEMES = [
  { from: "#3b0764", to: "#1e1b4b", mid: "#6d28d9", accent: "#a78bfa", dot: "#c4b5fd" },
  { from: "#0c1445", to: "#0f172a", mid: "#1d4ed8", accent: "#60a5fa", dot: "#93c5fd" },
  { from: "#042f2e", to: "#0f172a", mid: "#0d9488", accent: "#34d399", dot: "#6ee7b7" },
  { from: "#1c0533", to: "#0f0a1e", mid: "#7c3aed", accent: "#e879f9", dot: "#f0abfc" },
  { from: "#1a0a00", to: "#1c1400", mid: "#b45309", accent: "#fbbf24", dot: "#fde68a" },
  { from: "#0f0f1a", to: "#1a1030", mid: "#4f46e5", accent: "#818cf8", dot: "#a5b4fc" },
];

interface AgentVisualProps {
  agentId: string;
  name?: string;
  width?: number;
  height?: number;
  className?: string;
}

export default function AgentVisual({ agentId, name, width = 320, height = 160, className }: AgentVisualProps) {
  const seed = djb2(agentId);
  const theme = THEMES[seed % THEMES.length];
  const uid = agentId.replace(/[^a-z0-9]/gi, "").slice(0, 10) || "av";
  const initial = (name?.[0] ?? agentId[0] ?? "A").toUpperCase();

  // Generate node positions for a mini-graph
  const nodeCount = 5 + (seed % 4);
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    x: seeded(seed, i * 4 + 1) * width * 0.8 + width * 0.1,
    y: seeded(seed, i * 4 + 2) * height * 0.7 + height * 0.15,
    r: 2.5 + seeded(seed, i * 4 + 3) * 3,
    opacity: 0.3 + seeded(seed, i * 4 + 4) * 0.5,
  }));

  // Connect nodes with edges (simple sequential + a few cross-links)
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({ x1: nodes[i].x, y1: nodes[i].y, x2: nodes[i + 1].x, y2: nodes[i + 1].y });
  }
  if (nodes.length > 3) {
    edges.push({ x1: nodes[0].x, y1: nodes[0].y, x2: nodes[2].x, y2: nodes[2].y });
  }

  // Decorative glow circles
  const glowCx = width * (0.2 + seeded(seed, 50) * 0.6);
  const glowCy = height * (0.2 + seeded(seed, 51) * 0.6);

  const gradId = `g_${uid}`;
  const glowId = `gl_${uid}`;
  const radId = `r_${uid}`;
  const fontSize = Math.min(width, height) * 0.38;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={theme.from} />
          <stop offset="50%" stopColor={theme.mid} stopOpacity="0.6" />
          <stop offset="100%" stopColor={theme.to} />
        </linearGradient>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={theme.accent} stopOpacity="0.25" />
          <stop offset="100%" stopColor={theme.accent} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={radId} cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor={theme.mid} stopOpacity="0.4" />
          <stop offset="100%" stopColor={theme.to} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Background */}
      <rect width={width} height={height} fill={`url(#${gradId})`} />
      <rect width={width} height={height} fill={`url(#${radId})`} />

      {/* Glow blob */}
      <ellipse
        cx={glowCx} cy={glowCy}
        rx={width * 0.45} ry={height * 0.45}
        fill={`url(#${glowId})`}
      />

      {/* Graph edges */}
      {edges.map((e, i) => (
        <line
          key={i}
          x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
          stroke={theme.accent}
          strokeWidth={0.8}
          opacity={0.2}
          strokeDasharray="3 4"
        />
      ))}

      {/* Graph nodes */}
      {nodes.map((n, i) => (
        <circle
          key={i}
          cx={n.x} cy={n.y} r={n.r}
          fill={theme.dot}
          opacity={n.opacity}
        />
      ))}

      {/* Central initial letter */}
      <text
        x={width / 2}
        y={height / 2 + fontSize * 0.35}
        textAnchor="middle"
        fontSize={fontSize}
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="900"
        fill={theme.accent}
        opacity="0.15"
        letterSpacing="-2"
      >
        {initial}
      </text>

      {/* Subtle border vignette */}
      <rect
        width={width} height={height}
        fill="none"
        stroke={theme.accent}
        strokeWidth="1"
        opacity="0.1"
        rx="0"
      />
    </svg>
  );
}

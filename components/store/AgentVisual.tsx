import React from "react";

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

function lcg(seed: number, n: number): number {
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    s = s >>> 0;
  }
  return s / 0x100000000;
}

const PALETTES = [
  { bg: "#0a0a0a", shapes: ["#1c1c1c", "#2a2a2a", "#3f3f3f"], accent: "#e4e4e7" },
  { bg: "#0f0e17", shapes: ["#1e1b4b", "#312e81", "#3730a3"], accent: "#a78bfa" },
  { bg: "#0b1120", shapes: ["#0f172a", "#1e3a5f", "#1e3a8a"], accent: "#60a5fa" },
  { bg: "#0a1a12", shapes: ["#052e16", "#14532d", "#166534"], accent: "#34d399" },
  { bg: "#150a0c", shapes: ["#3b0764", "#4c1d95", "#5b21b6"], accent: "#c084fc" },
];

type Pattern = "circles" | "grid" | "bauhaus" | "rings" | "stripes";
const PATTERNS: Pattern[] = ["circles", "grid", "bauhaus", "rings", "stripes"];

function renderCircles(uid: string, p: typeof PALETTES[0], seed: number, w: number, h: number) {
  const circles = Array.from({ length: 6 }, (_, i) => ({
    cx: lcg(seed, i * 3 + 1) * w,
    cy: lcg(seed, i * 3 + 2) * h,
    r: 12 + lcg(seed, i * 3 + 3) * 48,
    fill: p.shapes[i % p.shapes.length],
  }));
  return (
    <>
      {circles.map((c, i) => (
        <circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill={c.fill} opacity={0.7} />
      ))}
      <circle
        cx={lcg(seed, 20) * w}
        cy={lcg(seed, 21) * h}
        r={8}
        fill={p.accent}
        opacity={0.9}
      />
    </>
  );
}

function renderGrid(uid: string, p: typeof PALETTES[0], seed: number, w: number, h: number) {
  const cols = 6, rows = 4;
  const cw = w / cols, ch = h / rows;
  return (
    <>
      {Array.from({ length: cols * rows }, (_, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const val = lcg(seed, i + 1);
        const fill = val > 0.7 ? p.accent : val > 0.4 ? p.shapes[1] : p.shapes[0];
        const opacity = 0.4 + val * 0.5;
        return (
          <rect
            key={i}
            x={col * cw + 1}
            y={row * ch + 1}
            width={cw - 2}
            height={ch - 2}
            fill={fill}
            opacity={opacity}
            rx={2}
          />
        );
      })}
    </>
  );
}

function renderBauhaus(uid: string, p: typeof PALETTES[0], seed: number, w: number, h: number) {
  return (
    <>
      <rect x={0} y={0} width={w * 0.5} height={h} fill={p.shapes[0]} />
      <rect x={w * 0.5} y={0} width={w * 0.5} height={h * 0.5} fill={p.shapes[1]} />
      <rect x={w * 0.5} y={h * 0.5} width={w * 0.5} height={h * 0.5} fill={p.shapes[2]} />
      <circle cx={w * 0.25} cy={h * 0.5} r={Math.min(w, h) * 0.22} fill={p.accent} opacity={0.85} />
      <rect
        x={w * 0.5 + 8}
        y={8}
        width={w * 0.4}
        height={h * 0.18}
        fill={p.accent}
        opacity={0.4}
        rx={3}
      />
    </>
  );
}

function renderRings(uid: string, p: typeof PALETTES[0], seed: number, w: number, h: number) {
  const cx = w * (0.3 + lcg(seed, 1) * 0.4);
  const cy = h * (0.3 + lcg(seed, 2) * 0.4);
  return (
    <>
      {[60, 42, 26, 13].map((r, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={i % 2 === 0 ? p.accent : p.shapes[i % p.shapes.length]}
          strokeWidth={i === 0 ? 1 : 2}
          opacity={0.5 + i * 0.12}
        />
      ))}
      <circle cx={cx} cy={cy} r={5} fill={p.accent} />
      <circle
        cx={w * 0.72}
        cy={h * 0.22}
        r={18}
        fill="none"
        stroke={p.shapes[2]}
        strokeWidth={1.5}
        opacity={0.4}
      />
    </>
  );
}

function renderStripes(uid: string, p: typeof PALETTES[0], seed: number, w: number, h: number) {
  const count = 7;
  const sw = w / count;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const val = lcg(seed, i + 1);
        return (
          <rect
            key={i}
            x={i * sw}
            y={0}
            width={sw}
            height={h}
            fill={val > 0.6 ? p.accent : val > 0.35 ? p.shapes[1] : p.shapes[0]}
            opacity={0.5 + val * 0.4}
          />
        );
      })}
      <rect
        x={lcg(seed, 10) * w * 0.7}
        y={h * 0.3}
        width={w * 0.25}
        height={h * 0.4}
        fill={p.accent}
        opacity={0.15}
        rx={4}
      />
    </>
  );
}

interface AgentVisualProps {
  agentId: string;
  width?: number;
  height?: number;
  className?: string;
}

export default function AgentVisual({ agentId, width = 320, height = 160, className }: AgentVisualProps) {
  const seed = djb2(agentId);
  const palette = PALETTES[seed % 5];
  const pattern = PATTERNS[(seed >> 8) % 5];
  const uid = agentId.replace(/[^a-z0-9]/gi, "").slice(0, 12) || "av";

  let shapes: React.ReactNode;
  switch (pattern) {
    case "circles":  shapes = renderCircles(uid, palette, seed, width, height); break;
    case "grid":     shapes = renderGrid(uid, palette, seed, width, height); break;
    case "bauhaus":  shapes = renderBauhaus(uid, palette, seed, width, height); break;
    case "rings":    shapes = renderRings(uid, palette, seed, width, height); break;
    case "stripes":  shapes = renderStripes(uid, palette, seed, width, height); break;
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "block" }}
    >
      <rect width={width} height={height} fill={palette.bg} />
      {shapes}
    </svg>
  );
}

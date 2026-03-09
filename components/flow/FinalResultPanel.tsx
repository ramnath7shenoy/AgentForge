"use client";

import React from "react";
import { useFlowStore } from "@/stores/flowStore";

const FinalResultPanel: React.FC = () => {
  const finalResult = useFlowStore((state) => state.finalResult);
  const running = useFlowStore((state) => state.running);

  const [animate, setAnimate] = React.useState(false);
  const previousResultRef = React.useRef<any>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (finalResult && finalResult.payload !== previousResultRef.current) {
      setAnimate(true);
      previousResultRef.current = finalResult.payload;
      const timeout = setTimeout(() => setAnimate(false), 450);
      return () => clearTimeout(timeout);
    }
  }, [finalResult]);

  // Scroll the final result into view when a run completes.
  React.useEffect(() => {
    if (!running && finalResult && containerRef.current) {
      containerRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [running, finalResult]);

  return (
    <div
      ref={containerRef}
      className="border-t border-border bg-card px-4 py-4"
    >
      <div className="max-w-3xl mx-auto">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          FINAL RESULT
        </h3>
        <div
          className={[
            "rounded-xl border text-sm md:text-base px-4 py-3 bg-background border-border transition-all",
            animate ? "ring-2 ring-primary/60 shadow-md" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {running && !finalResult && (
            <div className="text-sm text-muted-foreground">
              Running workflow... awaiting output.
            </div>
          )}
          {!running && !finalResult && (
            <div className="text-sm text-muted-foreground">
              Run the flow to see the final result from the last Output node.
            </div>
          )}
          {finalResult && (
            <pre className="whitespace-pre-wrap break-all font-sans text-sm md:text-base text-foreground">
              {typeof finalResult.payload === 'object' ? JSON.stringify(finalResult.payload, null, 2) : String(finalResult.payload)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinalResultPanel;


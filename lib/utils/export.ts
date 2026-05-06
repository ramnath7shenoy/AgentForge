import { toPng, toJpeg } from "html-to-image";

function getCanvasElement(): HTMLElement | null {
  return (
    (document.querySelector(".react-flow__viewport")?.parentElement as HTMLElement | null) ??
    (document.querySelector(".react-flow__renderer") as HTMLElement | null)
  );
}

function getBgColor(format: "png" | "jpeg" | "pdf"): string {
  const isDark = document.documentElement.classList.contains("dark");
  if (format === "jpeg" || format === "pdf") {
    return isDark ? "#0f172a" : "#f8fafc";
  }
  return isDark ? "#0f172a" : "#f8fafc";
}

export async function exportAsPng(): Promise<void> {
  const el = getCanvasElement();
  if (!el) return;
  const dataUrl = await toPng(el, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: getBgColor("png"),
  });
  const link = document.createElement("a");
  link.download = "workflow.png";
  link.href = dataUrl;
  link.click();
}

export async function exportAsJpeg(): Promise<void> {
  const el = getCanvasElement();
  if (!el) return;
  const dataUrl = await toJpeg(el, {
    cacheBust: true,
    pixelRatio: 2,
    quality: 0.92,
    backgroundColor: getBgColor("jpeg"),
  });
  const link = document.createElement("a");
  link.download = "workflow.jpg";
  link.href = dataUrl;
  link.click();
}

export async function exportAsPdf(): Promise<void> {
  const el = getCanvasElement();
  if (!el) return;
  const dataUrl = await toPng(el, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: getBgColor("pdf"),
  });
  const { jsPDF } = await import("jspdf");
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((resolve) => { img.onload = () => resolve(); });
  const w = img.width;
  const h = img.height;
  const orientation = w > h ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "px", format: [w, h] });
  pdf.addImage(dataUrl, "PNG", 0, 0, w, h);
  pdf.save("workflow.pdf");
}

"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const FONTS = [
  { label: "Helvetica (Sans-serif)", value: StandardFonts.Helvetica },
  { label: "Helvetica Bold", value: StandardFonts.HelveticaBold },
  { label: "Times Roman (Serif)", value: StandardFonts.TimesRoman },
  { label: "Times Bold", value: StandardFonts.TimesRomanBold },
  { label: "Courier (Monospace)", value: StandardFonts.Courier },
  { label: "Courier Bold", value: StandardFonts.CourierBold },
];

const COLORS = [
  { label: "Black", hex: "#000000" },
  { label: "White", hex: "#ffffff" },
  { label: "Red", hex: "#dc2626" },
  { label: "Blue", hex: "#2563eb" },
  { label: "Green", hex: "#16a34a" },
  { label: "Violet", hex: "#7c3aed" },
  { label: "Orange", hex: "#ea580c" },
];

interface Annotation {
  id: number;
  text: string;
  page: number;
  x: number;
  y: number;
  fontSize: number;
  fontValue: string;
  color: string;
  bullet: boolean;
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
}

export default function EditPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [pageCount, setPageCount] = useState(1);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [nextId, setNextId] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [usesLeft, setUsesLeft] = useState<number | null>(null);

  // Form state
  const [text, setText] = useState("");
  const [page, setPage] = useState(1);
  const [x, setX] = useState(10);
  const [y, setY] = useState(10);
  const [fontSize, setFontSize] = useState(14);
  const [fontValue, setFontValue] = useState(StandardFonts.Helvetica as string);
  const [color, setColor] = useState("#000000");
  const [bullet, setBullet] = useState(false);

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") { setError("Please upload a PDF file."); return; }
    setPdfFile(file);
    setPdfUrl(URL.createObjectURL(file));
    setAnnotations([]);
    setError("");
    try {
      const buf = await file.arrayBuffer();
      const doc = await PDFDocument.load(buf);
      setPageCount(doc.getPageCount());
    } catch { setPageCount(1); }
  }

  function addAnnotation() {
    if (!pdfFile) { setError("Upload a PDF first."); return; }
    if (!text.trim()) { setError("Enter some text first."); return; }
    setAnnotations((prev) => [
      ...prev,
      { id: nextId, text: text.trim(), page, x, y, fontSize, fontValue, color, bullet },
    ]);
    setNextId((n) => n + 1);
    setText("");
    setError("");
  }

  async function handleDownload() {
    if (!pdfFile) { setError("Upload a PDF first."); return; }
    if (annotations.length === 0) { setError("Add at least one text annotation first."); return; }
    setDownloading(true);
    setError("");

    const res = await fetch("/api/pdf-edit", { method: "POST" });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setDownloading(false); return; }
    setUsesLeft(data.remaining ?? null);

    try {
      const buf = await pdfFile.arrayBuffer();
      const doc = await PDFDocument.load(buf);
      const pages = doc.getPages();

      for (const ann of annotations) {
        const pg = pages[Math.min(ann.page - 1, pages.length - 1)];
        const { width, height } = pg.getSize();
        const font = await doc.embedFont(ann.fontValue as StandardFonts);
        const label = ann.bullet ? `• ${ann.text}` : ann.text;
        const px = (ann.x / 100) * width;
        const py = height - (ann.y / 100) * height - ann.fontSize;
        pg.drawText(label, { x: px, y: py, size: ann.fontSize, font, color: hexToRgb(ann.color) });
      }

      const bytes = await doc.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `edited_${pdfFile.name}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to process PDF. It may be encrypted or corrupted.");
    }
    setDownloading(false);
  }

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[500px] rounded-full bg-amber-800/15 blur-[120px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center px-6 py-4 border-b border-white/[0.06]">
        <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back
        </Link>
        <span className="mx-auto font-semibold text-white tracking-tight">Edit PDF</span>
        <span className="text-xs text-amber-400 border border-amber-500/30 bg-amber-500/10 px-2 py-1 rounded-lg">
          {usesLeft !== null ? `${usesLeft} uses left` : "5 uses / hour"}
        </span>
      </nav>

      <main className="relative z-10 flex flex-col gap-4 px-4 py-6 flex-1 max-w-6xl mx-auto w-full">

        {/* Rate limit banner */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span><strong className="text-amber-200">Free feature — 5 downloads per hour.</strong> Add text overlays with custom font, size, color &amp; bullet points. Your PDF never leaves the browser.</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* LEFT — Upload + Preview */}
          <div className="flex flex-col gap-3">
            {/* Upload zone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all
                ${pdfFile
                  ? "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10"
                  : "border-white/10 bg-white/[0.02] hover:border-violet-500/40 hover:bg-violet-500/5"}`}
            >
              <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {pdfFile ? (
                <div className="flex items-center gap-3 w-full">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{pdfFile.name}</p>
                    <p className="text-xs text-slate-500">{pageCount} page{pageCount !== 1 ? "s" : ""} · click to change</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-200">Drop your PDF here</p>
                    <p className="text-xs text-slate-500 mt-0.5">or click to browse</p>
                  </div>
                </>
              )}
            </div>

            {/* PDF Preview */}
            {pdfFile && (
              <iframe src={pdfUrl} className="w-full h-[420px] rounded-xl border border-white/[0.08] bg-white" />
            )}
          </div>

          {/* RIGHT — Edit controls */}
          <div className="flex flex-col gap-3">

            {/* Text input */}
            <div className="flex flex-col gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
                Add Text
              </h2>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type the text you want to add to the PDF..."
                rows={3}
                className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />

              {/* Position + Page + Size */}
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-500">Page</label>
                  <input type="number" min={1} max={pageCount} value={page}
                    onChange={(e) => setPage(Number(e.target.value))}
                    className="bg-white/[0.05] border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/40" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-slate-500">Size (pt)</label>
                  <input type="number" min={6} max={144} value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="bg-white/[0.05] border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/40" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-slate-500">X pos (%)</label>
                  <input type="number" min={0} max={100} value={x}
                    onChange={(e) => setX(Number(e.target.value))}
                    className="bg-white/[0.05] border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/40" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-slate-500">Y pos (%)</label>
                  <input type="number" min={0} max={100} value={y}
                    onChange={(e) => setY(Number(e.target.value))}
                    className="bg-white/[0.05] border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/40" />
                </div>
              </div>

              {/* Font */}
              <div className="flex flex-col gap-1 text-xs">
                <label className="text-slate-500">Font</label>
                <select value={fontValue} onChange={(e) => setFontValue(e.target.value)}
                  className="bg-[#0f1422] border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/40">
                  {FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>

              {/* Color */}
              <div className="flex flex-col gap-1.5 text-xs">
                <label className="text-slate-500">Text color</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button key={c.hex} title={c.label}
                      onClick={() => setColor(c.hex)}
                      style={{ backgroundColor: c.hex }}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${color === c.hex ? "border-white scale-110" : "border-transparent"}`}
                    />
                  ))}
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-500 hover:text-slate-300 transition-colors">
                    <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent" />
                    <span>Custom</span>
                  </label>
                </div>
              </div>

              {/* Bullet */}
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-400 select-none">
                <input type="checkbox" checked={bullet} onChange={(e) => setBullet(e.target.checked)}
                  className="w-4 h-4 accent-amber-500" />
                Add bullet point prefix (• )
              </label>

              <button onClick={addAnnotation}
                className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-colors">
                + Queue this text
              </button>
            </div>

            {/* Queue */}
            {annotations.length > 0 && (
              <div className="flex flex-col gap-2 p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Text queue ({annotations.length})</h3>
                  <button onClick={() => setAnnotations([])} className="text-xs text-slate-600 hover:text-red-400 transition-colors">Clear all</button>
                </div>
                <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                  {annotations.map((ann) => (
                    <div key={ann.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ann.color, border: "1px solid rgba(255,255,255,0.2)" }} />
                        <span className="text-xs text-slate-300 truncate">{ann.bullet ? "• " : ""}{ann.text}</span>
                        <span className="text-xs text-slate-600 shrink-0">p{ann.page} · {ann.fontSize}pt</span>
                      </div>
                      <button onClick={() => setAnnotations((a) => a.filter((x) => x.id !== ann.id))}
                        className="text-slate-600 hover:text-red-400 transition-colors shrink-0">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                {error}
              </div>
            )}

            {/* Download */}
            <button onClick={handleDownload}
              disabled={downloading || !pdfFile || annotations.length === 0}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2">
              {downloading ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>Processing…</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>Download Edited PDF</>
              )}
            </button>
            {(!pdfFile || annotations.length === 0) && (
              <p className="text-center text-xs text-slate-600">
                {!pdfFile ? "Upload a PDF to get started" : "Queue at least one text annotation to download"}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

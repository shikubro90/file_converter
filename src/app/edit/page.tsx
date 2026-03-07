"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

interface TextItem {
  id: number;
  text: string;
  originalText: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  pageIndex: number;
  deleted: boolean;
  modified: boolean;
}

const SCALE = 1.5;

async function getPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  return pdfjs;
}

export default function EditPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseImageRef = useRef<ImageData | null>(null);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfProxy, setPdfProxy] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usesLeft, setUsesLeft] = useState<number | null>(null);
  const nextId = useRef(0);

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") { setError("Please upload a PDF file."); return; }
    setError("");
    setLoading(true);
    setPdfFile(file);
    setTextItems([]);
    setSelectedId(null);
    setCurrentPage(0);
    baseImageRef.current = null;

    try {
      const pdfjs = await getPdfJs();
      const buf = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
      setPdfProxy(doc);
      setNumPages(doc.numPages);

      const items: TextItem[] = [];
      for (let i = 0; i < doc.numPages; i++) {
        const page = await doc.getPage(i + 1);
        const content = await page.getTextContent();
        for (const item of content.items) {
          if (!("str" in item) || !item.str.trim()) continue;
          const t = item.transform;
          const fontSize = Math.sqrt(t[0] ** 2 + t[1] ** 2);
          if (fontSize < 1) continue;
          items.push({
            id: nextId.current++,
            text: item.str,
            originalText: item.str,
            x: t[4],
            y: t[5],
            width: (item as { width?: number }).width || fontSize * item.str.length * 0.55,
            fontSize: Math.max(fontSize, 3),
            pageIndex: i,
            deleted: false,
            modified: false,
          });
        }
      }
      setTextItems(items);
    } catch (e) {
      setError("Failed to load PDF. It may be corrupted or password-protected.");
    }
    setLoading(false);
  }

  // Render base PDF page to canvas and save pixels
  useEffect(() => {
    if (!pdfProxy) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await pdfProxy.getPage(currentPage + 1);
        const vp = page.getViewport({ scale: SCALE });
        if (cancelled || !canvasRef.current) return;
        const canvas = canvasRef.current;
        canvas.width = vp.width;
        canvas.height = vp.height;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, vp.width, vp.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        if (cancelled) return;
        baseImageRef.current = ctx.getImageData(0, 0, vp.width, vp.height);
        setCanvasSize({ width: vp.width, height: vp.height });
      } catch { /* cancelled */ }
    })();
    return () => { cancelled = true; };
  }, [pdfProxy, currentPage]);

  // Redraw overlays whenever edits, selection, or canvas changes
  useEffect(() => {
    if (!canvasRef.current || !baseImageRef.current || canvasSize.width === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    // Restore clean base
    ctx.putImageData(baseImageRef.current, 0, 0);

    const pageItems = textItems.filter(i => i.pageIndex === currentPage);
    for (const item of pageItems) {
      const isSelected = item.id === selectedId;
      const liveText = isSelected ? editText : item.text;
      const shouldRender = item.deleted || item.modified || isSelected;
      if (!shouldRender) continue;

      const sx = item.x * SCALE;
      const sy = canvas.height - (item.y + item.fontSize) * SCALE;
      const sw = Math.max(item.width * SCALE, 10);
      const sh = item.fontSize * SCALE * 1.4;

      // Whiteout original text
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(sx - 1, sy, sw + 2, sh);

      // Draw replacement text
      if (!item.deleted && liveText.trim()) {
        ctx.fillStyle = "#000000";
        ctx.font = `${item.fontSize * SCALE}px Arial, Helvetica, sans-serif`;
        ctx.textBaseline = "alphabetic";
        ctx.fillText(liveText, sx, sy + item.fontSize * SCALE);
      }

      // Highlight selected item
      if (isSelected) {
        ctx.strokeStyle = "rgba(251,191,36,0.85)";
        ctx.lineWidth = 2;
        ctx.strokeRect(sx - 3, sy - 2, sw + 6, sh + 4);
      }
    }
  }, [textItems, selectedId, editText, currentPage, canvasSize]);

  // Canvas click → find and select text item
  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvasRef.current.width / rect.width);
    const my = (e.clientY - rect.top) * (canvasRef.current.height / rect.height);

    const pageItems = textItems.filter(i => i.pageIndex === currentPage && !i.deleted);
    for (const item of [...pageItems].reverse()) {
      const sx = item.x * SCALE;
      const sy = canvasRef.current.height - (item.y + item.fontSize) * SCALE;
      const sw = Math.max(item.width * SCALE, 20);
      const sh = item.fontSize * SCALE * 1.4;
      if (mx >= sx - 4 && mx <= sx + sw + 4 && my >= sy - 4 && my <= sy + sh + 4) {
        setSelectedId(item.id);
        setEditText(item.text);
        return;
      }
    }
    setSelectedId(null);
    setEditText("");
  }

  function handleCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvasRef.current.width / rect.width);
    const my = (e.clientY - rect.top) * (canvasRef.current.height / rect.height);
    const over = textItems.filter(i => i.pageIndex === currentPage && !i.deleted).some(item => {
      const sx = item.x * SCALE;
      const sy = canvasRef.current!.height - (item.y + item.fontSize) * SCALE;
      const sw = Math.max(item.width * SCALE, 20);
      const sh = item.fontSize * SCALE * 1.4;
      return mx >= sx - 4 && mx <= sx + sw + 4 && my >= sy - 4 && my <= sy + sh + 4;
    });
    canvasRef.current.style.cursor = over ? "pointer" : "default";
  }

  function deleteSelected() {
    if (selectedId === null) return;
    setTextItems(prev => prev.map(i => i.id === selectedId ? { ...i, deleted: true } : i));
    setSelectedId(null);
    setEditText("");
  }

  function restoreAll() {
    setTextItems(prev => prev.map(i => ({ ...i, text: i.originalText, deleted: false, modified: false })));
    setSelectedId(null);
    setEditText("");
  }

  const selected = textItems.find(i => i.id === selectedId) ?? null;
  const modifiedCount = textItems.filter(i => i.modified || i.deleted).length;
  // Live changes: items that are visually different from original on current page
  const currentPageChanges = textItems.filter(i => i.pageIndex === currentPage && (i.modified || i.deleted));

  async function handleSave() {
    if (!pdfFile) return;
    setSaving(true);
    setError("");

    const res = await fetch("/api/pdf-edit", { method: "POST" });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    setUsesLeft(data.remaining ?? null);

    try {
      const buf = await pdfFile.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      const pages = doc.getPages();
      const font = await doc.embedFont(StandardFonts.Helvetica);

      for (const item of textItems) {
        if (!item.deleted && !item.modified) continue;
        const pg = pages[item.pageIndex];
        pg.drawRectangle({
          x: item.x - 1,
          y: item.y - item.fontSize * 0.3,
          width: item.width + 2,
          height: item.fontSize * 1.5,
          color: rgb(1, 1, 1),
          opacity: 1,
        });
        if (!item.deleted && item.text.trim()) {
          pg.drawText(item.text, { x: item.x, y: item.y, size: item.fontSize, font, color: rgb(0, 0, 0) });
        }
      }

      const bytes = await doc.save();
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `edited_${pdfFile.name}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to process PDF. It may be encrypted or unsupported.");
    }
    setSaving(false);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#080b14] text-white">
      {/* Nav */}
      <nav className="flex items-center px-6 py-4 border-b border-white/[0.06] shrink-0">
        <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back
        </Link>
        <span className="mx-auto font-semibold tracking-tight">Edit PDF</span>
        <span className="text-xs text-amber-400 border border-amber-500/30 bg-amber-500/10 px-2 py-1 rounded-lg">
          {usesLeft !== null ? `${usesLeft} uses left` : "5 uses / hour"}
        </span>
      </nav>

      {/* Banner */}
      <div className="px-4 pt-3 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
          </svg>
          <span><strong className="text-amber-200">Click any text in the PDF</strong> to select and edit it live. Changes appear instantly. 5 saves/hour · file never leaves your browser.</span>
        </div>
      </div>

      {!pdfFile ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            className="w-full max-w-md border-2 border-dashed border-white/10 rounded-2xl p-16 flex flex-col items-center gap-5 cursor-pointer hover:border-amber-500/40 hover:bg-amber-500/5 transition-all bg-white/[0.02]"
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-slate-200">Drop your PDF here</p>
              <p className="text-sm text-slate-500 mt-1">or click to browse</p>
              <p className="text-xs text-slate-600 mt-3">Click text in the PDF to edit it live</p>
            </div>
            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT — PDF canvas */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-white/[0.06]">
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06] shrink-0 bg-white/[0.02]">
              <button onClick={() => { setPdfFile(null); setPdfProxy(null); setTextItems([]); setSelectedId(null); baseImageRef.current = null; }}
                className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Change file
              </button>
              <span className="text-slate-600 text-xs truncate max-w-[200px]">{pdfFile.name}</span>
              {loading && <span className="text-xs text-amber-400 ml-auto animate-pulse">Reading text…</span>}
              {!loading && textItems.length > 0 && (
                <span className="text-xs text-slate-600 ml-auto">{textItems.filter(i => i.pageIndex === currentPage).length} text items on this page</span>
              )}
              {numPages > 1 && (
                <div className="flex items-center gap-1.5 ml-2">
                  <button onClick={() => { setCurrentPage(p => Math.max(0, p - 1)); setSelectedId(null); }} disabled={currentPage === 0}
                    className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                  </button>
                  <span className="text-xs text-slate-400 tabular-nums">{currentPage + 1}/{numPages}</span>
                  <button onClick={() => { setCurrentPage(p => Math.min(numPages - 1, p + 1)); setSelectedId(null); }} disabled={currentPage === numPages - 1}
                    className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                  </button>
                </div>
              )}
            </div>

            {/* Canvas */}
            <div className="flex-1 overflow-auto p-4 flex justify-center bg-slate-900/30">
              <div className="shadow-2xl shadow-black/60 h-fit">
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  onMouseMove={handleCanvasMouseMove}
                  style={{ display: "block", maxWidth: "100%" }}
                />
              </div>
            </div>
          </div>

          {/* RIGHT — Edit panel */}
          <div className="w-72 shrink-0 flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

              {/* Selected item editor */}
              {!selected ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-10">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-400">Click any text in the PDF</p>
                    <p className="text-xs text-slate-600 mt-1">It will highlight in amber and appear here to edit</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      Editing
                    </h3>
                    <button onClick={() => { setSelectedId(null); setEditText(""); }}
                      className="text-slate-600 hover:text-slate-300 transition-colors text-xs">dismiss</button>
                  </div>

                  <div className="text-xs text-slate-600 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 line-through">
                    {selected.originalText}
                  </div>

                  <textarea
                    value={editText}
                    onChange={(e) => {
                      setEditText(e.target.value);
                      // Mark as modified live
                      setTextItems(prev => prev.map(i =>
                        i.id === selectedId
                          ? { ...i, text: e.target.value, modified: e.target.value !== i.originalText }
                          : i
                      ));
                    }}
                    rows={3}
                    placeholder="Type new text… (preview updates live)"
                    className="w-full bg-white/[0.05] border border-amber-500/30 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setTextItems(prev => prev.map(i =>
                          i.id === selectedId ? { ...i, text: selected.originalText, modified: false } : i
                        ));
                        setEditText(selected.originalText);
                      }}
                      className="flex-1 py-2 rounded-lg bg-white/[0.05] hover:bg-white/10 text-slate-400 text-xs font-medium transition-colors border border-white/[0.07]"
                    >
                      Restore
                    </button>
                    <button
                      onClick={deleteSelected}
                      className="flex-1 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 transition-colors"
                    >
                      Delete text
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 text-center">
                    Page {selected.pageIndex + 1} · {Math.round(selected.fontSize)}pt · changes show live ↑
                  </p>
                </div>
              )}

              {/* Changes summary */}
              {modifiedCount > 0 && (
                <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">{modifiedCount} change{modifiedCount !== 1 ? "s" : ""} total</span>
                    <button onClick={restoreAll} className="text-xs text-slate-600 hover:text-red-400 transition-colors">Reset all</button>
                  </div>
                  <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                    {textItems.filter(i => i.modified || i.deleted).map(item => (
                      <div key={item.id} className="flex items-start gap-2 text-xs py-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1 ${item.deleted ? "bg-red-500" : "bg-amber-400"}`} />
                        <span className="text-slate-600 truncate line-through">{item.originalText}</span>
                        {!item.deleted && <span className="text-slate-300 truncate shrink-0">→ {item.text}</span>}
                        {item.deleted && <span className="text-red-400 shrink-0">removed</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}

            {/* Save */}
            <div className="p-4 border-t border-white/[0.06] shrink-0">
              <button
                onClick={handleSave}
                disabled={saving || modifiedCount === 0}
                className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-900/30"
              >
                {saving ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>Saving…</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>Save &amp; Download</>
                )}
              </button>
              {modifiedCount === 0 && (
                <p className="text-center text-xs text-slate-600 mt-2">Click text in the PDF to start editing</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

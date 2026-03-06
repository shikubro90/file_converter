"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

interface TextItem {
  id: number;
  text: string;
  originalText: string;
  x: number;       // PDF points from left
  y: number;       // PDF points from bottom
  width: number;   // PDF points
  fontSize: number;
  pageIndex: number;
  deleted: boolean;
  modified: boolean;
}

const SCALE = 1.5;

async function getPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
  }
  return pdfjs;
}

export default function EditPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfProxy, setPdfProxy] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
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
    } catch {
      setError("Failed to load PDF.");
    }
    setLoading(false);
  }

  // Render page to canvas
  useEffect(() => {
    if (!pdfProxy || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await pdfProxy.getPage(currentPage + 1);
        const vp = page.getViewport({ scale: SCALE });
        if (cancelled) return;
        const canvas = canvasRef.current!;
        canvas.width = vp.width;
        canvas.height = vp.height;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, vp.width, vp.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        if (!cancelled) setViewport({ width: vp.width, height: vp.height });
      } catch { /* cancelled */ }
    })();
    return () => { cancelled = true; };
  }, [pdfProxy, currentPage]);

  function toScreen(item: TextItem) {
    return {
      left: item.x * SCALE,
      top: viewport.height - (item.y + item.fontSize) * SCALE,
      width: item.width * SCALE,
      height: item.fontSize * SCALE * 1.2,
    };
  }

  const pageItems = textItems.filter(i => i.pageIndex === currentPage && !i.deleted);
  const selected = textItems.find(i => i.id === selectedId) ?? null;
  const modifiedCount = textItems.filter(i => i.modified || i.deleted).length;

  function selectItem(item: TextItem) {
    setSelectedId(item.id);
    setEditText(item.text);
  }

  function commitEdit() {
    if (selectedId === null) return;
    setTextItems(prev => prev.map(i =>
      i.id === selectedId
        ? { ...i, text: editText, modified: editText !== i.originalText }
        : i
    ));
  }

  function deleteSelected() {
    if (selectedId === null) return;
    setTextItems(prev => prev.map(i => i.id === selectedId ? { ...i, deleted: true } : i));
    setSelectedId(null);
    setEditText("");
  }

  function restoreAll() {
    setTextItems(prev => prev.map(i => ({
      ...i, text: i.originalText, deleted: false, modified: false,
    })));
    setSelectedId(null);
  }

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
        // Cover original text with white rectangle
        pg.drawRectangle({
          x: item.x - 1,
          y: item.y - item.fontSize * 0.3,
          width: item.width + 2,
          height: item.fontSize * 1.5,
          color: rgb(1, 1, 1),
          opacity: 1,
        });
        // Draw replacement text (if not deleted)
        if (!item.deleted && item.text.trim()) {
          pg.drawText(item.text, {
            x: item.x,
            y: item.y,
            size: item.fontSize,
            font,
            color: rgb(0, 0, 0),
          });
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

      {/* Rate limit info */}
      <div className="px-4 pt-3 pb-0 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span><strong className="text-amber-200">Free feature — 5 saves per hour.</strong> Click any text in the PDF to edit or delete it. Your file never leaves your browser.</span>
        </div>
      </div>

      {!pdfFile ? (
        /* Upload zone */
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
              <p className="text-xs text-slate-600 mt-3">Click on any text in the PDF to edit or delete it</p>
            </div>
            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT — PDF canvas with overlay */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-white/[0.06]">
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06] shrink-0 bg-white/[0.02]">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Change file
              </button>
              <span className="text-slate-600 text-xs truncate max-w-[180px]">{pdfFile.name}</span>
              {loading && <span className="text-xs text-amber-400 ml-auto animate-pulse">Loading text…</span>}
              {/* Page nav */}
              {numPages > 1 && (
                <div className="flex items-center gap-2 ml-auto">
                  <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}
                    className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </button>
                  <span className="text-xs text-slate-400">{currentPage + 1} / {numPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(numPages - 1, p + 1))} disabled={currentPage === numPages - 1}
                    className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) { setPdfFile(null); setTimeout(() => handleFile(e.target.files![0]), 50); } }} />
            </div>

            {/* Canvas + text overlay */}
            <div className="flex-1 overflow-auto p-4 flex justify-center">
              <div className="relative shadow-2xl shadow-black/60" style={{ width: viewport.width, height: viewport.height }}>
                <canvas ref={canvasRef} className="block" />

                {/* Clickable text overlays */}
                {pageItems.map((item) => {
                  const pos = toScreen(item);
                  const isSel = item.id === selectedId;
                  return (
                    <div
                      key={item.id}
                      onClick={() => selectItem(item)}
                      title={item.text}
                      style={{
                        position: "absolute",
                        left: pos.left,
                        top: pos.top,
                        width: Math.max(pos.width, 8),
                        height: Math.max(pos.height, 8),
                        cursor: "pointer",
                      }}
                      className={`group transition-all rounded-[2px] ${
                        isSel
                          ? "bg-amber-400/30 outline outline-2 outline-amber-400"
                          : "hover:bg-blue-400/20 hover:outline hover:outline-1 hover:outline-blue-400/60"
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT — Edit panel */}
          <div className="w-72 shrink-0 flex flex-col border-l border-white/[0.06] bg-white/[0.01]">
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

              {!selected ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                    <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-400">Click any text</p>
                    <p className="text-xs text-slate-600 mt-1">Select text in the PDF to edit or delete it</p>
                  </div>
                  {pageItems.length === 0 && !loading && (
                    <p className="text-xs text-slate-700 mt-2">No editable text found on this page</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Edit Text</h3>
                    <button onClick={() => { setSelectedId(null); setEditText(""); }}
                      className="text-slate-600 hover:text-slate-400 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex flex-col gap-1 text-xs">
                    <label className="text-slate-500">Original text</label>
                    <p className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-400 text-xs leading-relaxed">
                      {selected.originalText}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1 text-xs">
                    <label className="text-slate-500">New text</label>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={commitEdit}
                      className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-colors"
                    >
                      Apply Edit
                    </button>
                    <button
                      onClick={deleteSelected}
                      className="px-3 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-semibold border border-red-500/20 transition-colors"
                    >
                      Delete
                    </button>
                  </div>

                  <p className="text-xs text-slate-600">
                    Page {selected.pageIndex + 1} · {Math.round(selected.fontSize)}pt
                  </p>
                </div>
              )}

              {/* Changes summary */}
              {modifiedCount > 0 && (
                <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">{modifiedCount} change{modifiedCount !== 1 ? "s" : ""}</span>
                    <button onClick={restoreAll} className="text-xs text-slate-600 hover:text-red-400 transition-colors">Reset all</button>
                  </div>
                  <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                    {textItems.filter(i => i.modified || i.deleted).map(item => (
                      <div key={item.id} className="flex items-center gap-2 text-xs">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.deleted ? "bg-red-500" : "bg-amber-400"}`} />
                        <span className="text-slate-500 truncate">{item.originalText}</span>
                        {!item.deleted && <span className="text-slate-300 truncate">→ {item.text}</span>}
                        {item.deleted && <span className="text-red-400">deleted</span>}
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

            {/* Save button */}
            <div className="p-4 border-t border-white/[0.06] shrink-0">
              <button
                onClick={handleSave}
                disabled={saving || modifiedCount === 0}
                className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm"
              >
                {saving ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>Saving…</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>Save & Download</>
                )}
              </button>
              {modifiedCount === 0 && (
                <p className="text-center text-xs text-slate-600 mt-2">Edit or delete text to enable save</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

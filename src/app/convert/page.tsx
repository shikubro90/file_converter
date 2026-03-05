"use client";

import Link from "next/link";
import { useRef, useState, useEffect, DragEvent, ChangeEvent } from "react";

interface UploadResult {
  fileId: string;
  fileName: string;
  mime: string;
  size: number;
}

interface Job {
  id: string;
  status: "queued" | "processing" | "done" | "failed";
  progress: number;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_LABEL: Record<Job["status"], string> = {
  queued: "Queued…",
  processing: "Processing…",
  done: "Done",
  failed: "Failed",
};

export default function ConvertPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [formats, setFormats] = useState<string[]>([]);
  const [formatsLoading, setFormatsLoading] = useState(false);
  const [targetFormat, setTargetFormat] = useState("");

  const [converting, setConverting] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setSelectedFile(files[0]);
    setUploadResult(null);
    setUploadError(null);
    setFormats([]);
    setTargetFormat("");
    setJob(null);
    setConvertError(null);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) { e.preventDefault(); setDragging(true); }
  function onDragLeave(e: DragEvent<HTMLDivElement>) { e.preventDefault(); setDragging(false); }
  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }
  function onInputChange(e: ChangeEvent<HTMLInputElement>) { handleFiles(e.target.files); }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error ?? "Upload failed"); return; }
      setUploadResult(data);
      setFormatsLoading(true);
      const fRes = await fetch(`/api/formats?mime=${encodeURIComponent(data.mime)}`);
      const fData = await fRes.json();
      const targets: string[] = fData.targets ?? [];
      setFormats(targets);
      setTargetFormat(targets[0] ?? "");
    } catch {
      setUploadError("Network error");
    } finally {
      setUploading(false);
      setFormatsLoading(false);
    }
  }

  async function handleConvert() {
    if (!uploadResult || !targetFormat) return;
    setConverting(true);
    setConvertError(null);
    setJob(null);
    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: uploadResult.fileId, targetExt: targetFormat, sourceMime: uploadResult.mime }),
      });
      const data = await res.json();
      if (!res.ok) { setConvertError(data.error ?? "Conversion failed"); setConverting(false); return; }

      const { jobId } = data;
      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/job/${jobId}`);
          const pollData: Job = await pollRes.json();
          setJob(pollData);
          if (pollData.status === "done" || pollData.status === "failed") {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            setConverting(false);
            if (pollData.status === "failed") setConvertError(pollData.error ?? "Conversion failed");
          }
        } catch {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setConvertError("Lost connection while polling");
          setConverting(false);
        }
      }, 1000);
    } catch {
      setConvertError("Network error");
      setConverting(false);
    }
  }

  const isDone = job?.status === "done";
  const canConvert = !!uploadResult && formats.length > 0 && !!targetFormat && !converting && !isDone;

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">

      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-60 left-1/2 -translate-x-1/2 w-[600px] h-[500px] rounded-full bg-violet-800/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-indigo-900/20 blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center px-6 py-4 border-b border-white/[0.06]">
        <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back
        </Link>
        <span className="mx-auto font-semibold text-white tracking-tight">Converter</span>
      </nav>

      <main className="relative z-10 flex flex-col items-center gap-6 px-4 py-12 flex-1">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Convert a File</h1>
          <p className="mt-1 text-slate-400 text-sm">Drop your file, pick a format, download the result.</p>
        </div>

        <div className="w-full max-w-lg flex flex-col gap-4">

          {/* Drop zone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`group relative flex flex-col items-center justify-center gap-3 p-10 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
              dragging
                ? "border-violet-500 bg-violet-500/10 scale-[1.01]"
                : "border-white/10 bg-white/[0.02] hover:border-violet-500/40 hover:bg-violet-500/5"
            }`}
          >
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${dragging ? "bg-violet-500/20" : "bg-white/[0.04] group-hover:bg-violet-500/10"}`}>
              <svg className="w-7 h-7 text-violet-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>

            {selectedFile ? (
              <div className="text-center">
                <p className="text-sm font-medium text-white">{selectedFile.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{formatBytes(selectedFile.size)}</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm font-medium text-slate-300">Drop your file here</p>
                <p className="text-xs text-slate-500 mt-0.5">or click to browse — up to 100 MB</p>
              </div>
            )}
            <input ref={inputRef} type="file" className="hidden" onChange={onInputChange} />
          </div>

          {/* Upload button */}
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-violet-900/30 hover:shadow-violet-700/30"
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Uploading…
              </span>
            ) : "Upload"}
          </button>

          {uploadError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              {uploadError}
            </div>
          )}

          {/* Result card */}
          {uploadResult && (
            <div className="flex flex-col gap-4 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08]">

              {/* File info */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{uploadResult.fileName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{formatBytes(uploadResult.size)} · {uploadResult.mime}</p>
                  <p className="text-xs text-slate-600 mt-0.5 font-mono truncate">{uploadResult.fileId}</p>
                </div>
                <span className="shrink-0 text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Uploaded
                </span>
              </div>

              {/* Divider */}
              <div className="border-t border-white/[0.06]" />

              {/* Format selector */}
              {formatsLoading && (
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Loading formats…
                </p>
              )}

              {!formatsLoading && formats.length === 0 && (
                <p className="text-xs text-amber-400/80">No supported output formats for this file type.</p>
              )}

              {!formatsLoading && formats.length > 0 && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-400">Convert to</span>
                  {formats.length === 1 ? (
                    <span className="text-sm font-semibold text-violet-300 uppercase">{formats[0]}</span>
                  ) : (
                    <select
                      value={targetFormat}
                      onChange={(e) => setTargetFormat(e.target.value)}
                      disabled={converting}
                      className="bg-white/[0.05] border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 disabled:opacity-40 transition-colors"
                    >
                      {formats.map((f) => (
                        <option key={f} value={f} className="bg-[#0f1422]">{f.toUpperCase()}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Convert button */}
              <button
                onClick={handleConvert}
                disabled={!canConvert}
                className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-violet-900/30"
              >
                {converting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Converting…
                  </span>
                ) : isDone ? "Converted ✓" : "Convert"}
              </button>

              {/* Progress */}
              {job && (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{STATUS_LABEL[job.status]}</span>
                    <span>{job.progress}%</span>
                  </div>
                  <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        job.status === "failed"
                          ? "bg-red-500"
                          : "bg-gradient-to-r from-violet-500 to-fuchsia-500"
                      }`}
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {convertError && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  {convertError}
                </div>
              )}

              {/* Download */}
              {isDone && (
                <a
                  href={`/api/download/${job!.id}`}
                  download
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all duration-200 shadow-lg shadow-emerald-900/30"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download converted.{targetFormat}
                </a>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

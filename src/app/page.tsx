import Link from "next/link";

const FEATURES = [
  { icon: "🖼️", label: "Images", desc: "JPG · PNG · WebP · GIF · BMP · TIFF" },
  { icon: "📄", label: "Documents", desc: "DOCX · PPTX · XLSX → PDF" },
  { icon: "🎵", label: "Audio", desc: "MP3 · WAV · OGG · FLAC · AAC" },
  { icon: "🎬", label: "Video", desc: "MP4 · WebM · MKV · AVI · GIF" },
];

export default function Home() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">

      {/* Background glow blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-violet-700/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-indigo-800/20 blur-[100px]" />
        <div className="absolute bottom-20 right-1/4 w-[300px] h-[300px] rounded-full bg-cyan-800/15 blur-[80px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-3xl w-full text-center">

        {/* Badge */}
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-violet-500/10 text-violet-300 border border-violet-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          Free · No sign-up · Files deleted after 30 min
        </span>

        {/* Headline */}
        <div className="flex flex-col gap-4">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
            <span className="text-white">Convert</span>
            <span className="block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
              anything, instantly
            </span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
            Images, documents, audio, video — drop a file and convert it in seconds. No account needed.
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/convert"
          className="group relative inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 shadow-lg shadow-violet-900/40 transition-all duration-200 hover:shadow-violet-700/40 hover:scale-[1.02]"
        >
          Start Converting
          <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>

        {/* Format grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full mt-4">
          {FEATURES.map((f) => (
            <div
              key={f.label}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-violet-500/30 hover:bg-violet-500/5 transition-all"
            >
              <span className="text-2xl">{f.icon}</span>
              <span className="text-sm font-semibold text-slate-200">{f.label}</span>
              <span className="text-xs text-slate-500 leading-relaxed">{f.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

import Link from "next/link";

const FEATURES = [
  { icon: "🖼️", label: "Images", desc: "JPG · PNG · WebP · GIF · BMP · TIFF" },
  { icon: "📄", label: "Documents", desc: "DOCX · PPTX · XLSX → PDF" },
  { icon: "🎵", label: "Audio", desc: "MP3 · WAV · OGG · FLAC · AAC" },
  { icon: "🎬", label: "Video", desc: "MP4 · WebM · MKV · AVI · GIF" },
];

const TOOLS = [
  {
    href: "/convert",
    icon: "⇄",
    label: "Convert Files",
    desc: "Images, documents, audio & video",
    gradient: "from-violet-600 to-fuchsia-600",
    glow: "shadow-violet-900/40",
  },
  {
    href: "/edit",
    icon: "✏️",
    label: "Edit PDF",
    desc: "Add text, change font, size & color",
    gradient: "from-amber-500 to-orange-600",
    glow: "shadow-amber-900/40",
    badge: "5 uses / hour",
  },
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

        {/* CTA buttons */}
        <div className="flex flex-wrap gap-3 justify-center">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`group relative inline-flex flex-col items-center gap-1 px-8 py-4 rounded-xl font-semibold text-white bg-gradient-to-r ${t.gradient} shadow-lg ${t.glow} transition-all duration-200 hover:scale-[1.02] hover:brightness-110`}
            >
              <span className="text-xl">{t.icon}</span>
              <span>{t.label}</span>
              <span className="text-xs font-normal opacity-80">{t.desc}</span>
              {t.badge && (
                <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 border border-white/30">
                  {t.badge}
                </span>
              )}
            </Link>
          ))}
        </div>

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

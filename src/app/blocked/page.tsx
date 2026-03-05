"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function BlockedContent() {
  const params = useSearchParams();
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const until = parseInt(params.get("until") ?? "0", 10);
    if (!until) return;

    const update = () => {
      const left = until - Date.now();
      if (left <= 0) { setRemaining("less than a minute"); return; }
      const mins = Math.ceil(left / 60_000);
      setRemaining(`${mins} minute${mins !== 1 ? "s" : ""}`);
    };

    update();
    const id = setInterval(update, 10_000);
    return () => clearInterval(id);
  }, [params]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">

      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] rounded-full bg-red-900/20 blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 max-w-md text-center">
        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        {/* Heading */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-white">Access Blocked</h1>
          <p className="text-slate-400 leading-relaxed">
            Your IP has been blocked for <span className="text-white font-semibold">1 hour</span> due to suspicious activity.
          </p>
        </div>

        {/* Timer */}
        {remaining && (
          <div className="w-full px-5 py-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-300">
              Try again in <span className="font-semibold text-white">{remaining}</span>
            </p>
          </div>
        )}

        {/* Info */}
        <div className="w-full flex flex-col gap-2 text-left text-sm text-slate-500 bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <p className="text-slate-400 font-medium mb-1">This block may have been triggered by:</p>
          <ul className="flex flex-col gap-1.5 list-none">
            {[
              "Exceeding the upload or conversion rate limit",
              "Repeatedly sending invalid or malformed requests",
              "Multiple failed upload attempts in a short period",
              "Flooding non-existent API endpoints",
            ].map((reason) => (
              <li key={reason} className="flex items-start gap-2">
                <span className="mt-0.5 text-red-500">•</span>
                {reason}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-slate-600">
          If you believe this is a mistake, please contact support.
        </p>
      </div>
    </div>
  );
}

export default function BlockedPage() {
  return (
    <Suspense>
      <BlockedContent />
    </Suspense>
  );
}

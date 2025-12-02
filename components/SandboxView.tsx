"use client";

import React, { useState } from "react";

interface SandboxResult {
  result: unknown;
  error: string | null;
}

const SandboxView: React.FC = () => {
  const [code, setCode] = useState<string>("1 + 2 * 3");
  const [output, setOutput] = useState<SandboxResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCode = async () => {
    setLoading(true);
    setError(null);
    setOutput(null);

    try {
      const res = await fetch("/api/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          timeout_ms: 300,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Unknown sandbox error.");
      } else {
        setOutput({ result: data.result, error: null });
      }
    } catch (e: any) {
      console.error("SandboxView error:", e);
      setError("Failed to call sandbox API.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full p-4 text-sm text-gray-200 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Sandbox</h1>
        <button
          className="bg-blue-600 hover:bg-blue-500 text-xs px-3 py-1 rounded disabled:opacity-50"
          onClick={runCode}
          disabled={loading}
        >
          {loading ? "Running..." : "Run"}
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-2">
        <textarea
          className="flex-1 bg-[#1e1e1e] border border-gray-700 rounded px-2 py-1 text-xs font-mono"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter a small Python expression or snippet..."
        />
        {error && (
          <div className="text-red-400 text-xs whitespace-pre-wrap">
            {error}
          </div>
        )}
        {output && (
          <div className="border border-gray-700 rounded bg-[#1e1e1e] text-xs whitespace-pre-wrap p-2 font-mono">
            <div className="font-semibold mb-1">Result:</div>
            <pre>{JSON.stringify(output.result, null, 2)}</pre>
          </div>
        )}
        {!error && !output && !loading && (
          <div className="text-xs text-gray-400">
            Use this sandbox to quickly test math expressions or small snippets in ATLAS's
            isolated runtime.
          </div>
        )}
      </div>
    </div>
  );
};

export default SandboxView;

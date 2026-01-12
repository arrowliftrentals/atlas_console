"use client";

import React, { useState } from "react";

interface SandboxResult {
  output: string;
  error: string;
  exit_code: number;
  execution_time: number;
}

const SandboxView: React.FC = () => {
  const [code, setCode] = useState<string>("print(2 + 2)");
  const [language, setLanguage] = useState<string>("python");
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runCode = async () => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language,
        }),
      });

      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      console.error("SandboxView error:", e);
      setResult({
        output: "",
        error: "Failed to call sandbox API.",
        exit_code: -1,
        execution_time: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full p-4 text-sm text-gray-200 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Sandbox Executor</h1>
        <div className="flex gap-2 items-center">
          <select
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="python">Python</option>
            <option value="shell">Shell</option>
          </select>
          <button
            className="bg-blue-600 hover:bg-blue-500 text-xs px-3 py-1 rounded disabled:opacity-50"
            onClick={runCode}
            disabled={loading}
          >
            {loading ? "Running..." : "Execute"}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-2">
        <textarea
          className="flex-1 bg-[#1e1e1e] border border-gray-700 rounded px-2 py-1 text-xs font-mono"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={language === "python" ? "print('Hello from Atlas sandbox!')" : "echo 'Hello from Atlas sandbox!'"}
        />
        {result && result.error && (
          <div className="border border-red-700 rounded bg-red-900/20 text-xs whitespace-pre-wrap p-2 font-mono">
            <div className="font-semibold mb-1 text-red-400">Error:</div>
            <pre className="text-red-300">{result.error}</pre>
          </div>
        )}
        {result && result.output && (
          <div className="border border-gray-700 rounded bg-[#1e1e1e] text-xs whitespace-pre-wrap p-2 font-mono">
            <div className="font-semibold mb-1 text-green-400">Output:</div>
            <pre>{result.output}</pre>
            <div className="mt-2 text-gray-500 text-xs">
              Exit code: {result.exit_code} | Time: {result.execution_time.toFixed(3)}s
            </div>
          </div>
        )}
        {!result && !loading && (
          <div className="text-xs text-gray-400 p-2">
            Execute code in Atlas's sandbox environment. Note: Sandbox VM must be running and configured.
          </div>
        )}
      </div>
    </div>
  );
};

export default SandboxView;

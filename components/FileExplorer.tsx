"use client";

import React, { useEffect, useState, useCallback } from "react";
import { fetchProjectFileList } from "@/lib/atlasProjectFs";

interface FileExplorerProps {
  projectName: string;
  basePath: string;
  onFileSelect: (relativePath: string) => void;
  selectedFile?: string;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  projectName,
  basePath,
  onFileSelect,
  selectedFile,
}) => {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchProjectFileList(projectName, basePath);
      setFiles(list);
    } catch (e: any) {
      console.error("FileExplorer error:", e);
      setError("Failed to load file list from ATLAS Core.");
    } finally {
      setLoading(false);
    }
  }, [projectName, basePath]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  return (
    <div className="h-full w-full text-xs text-gray-200 bg-[#252526] border-r border-gray-700 flex flex-col">
      <div className="flex items-center justify-between px-2 py-1 border-b border-gray-700">
        <span className="font-semibold">
          {projectName} / {basePath || "."}
        </span>
        <button
          className="bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded text-[10px]"
          onClick={loadFiles}
          disabled={loading}
        >
          {loading ? "…" : "Refresh"}
        </button>
      </div>
      {error && (
        <div className="p-2 text-red-400 whitespace-pre-wrap">{error}</div>
      )}
      {!error && (
        <div className="flex-1 overflow-auto px-2 py-1 space-y-1">
          {files.length === 0 && !loading && (
            <div className="text-gray-400">No files found.</div>
          )}
          {files.map((f) => {
            const isSelected = f === selectedFile;
            return (
              <div
                key={f}
                className={`cursor-pointer rounded px-1 py-0.5 truncate ${
                  isSelected ? "bg-[#094771]" : "hover:bg-[#3c3c3c]"
                }`}
                onClick={() => onFileSelect(f)}
                title={f}
              >
                {f}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FileExplorer;

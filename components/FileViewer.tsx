'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useConsole } from './ConsoleProvider';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/plugins/line-numbers/prism-line-numbers.css';
import 'prismjs/plugins/line-numbers/prism-line-numbers';
// Import language support
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';

// Map file extensions to Prism language identifiers
const getLanguage = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: { [key: string]: string } = {
    'ts': 'typescript',
    'tsx': 'tsx',
    'js': 'javascript',
    'jsx': 'jsx',
    'py': 'python',
    'json': 'json',
    'md': 'markdown',
    'yml': 'yaml',
    'yaml': 'yaml',
    'sh': 'bash',
    'bash': 'bash',
    'sql': 'sql',
    'css': 'css',
    'html': 'markup',
    'xml': 'markup',
  };
  return langMap[ext || ''] || 'markup';
};

const FileViewer: React.FC = () => {
  const { selectedFile } = useConsole();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!selectedFile) {
      setContent('');
      setError(null);
      return;
    }

    const loadFile = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ path: selectedFile });
        const res = await fetch(`/api/console/files/content?${params.toString()}`);
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(errorData.error || `Failed to load file: ${res.statusText}`);
        }
        
        const data = await res.json();
        
        if (data.error) {
          throw new Error(data.error);
        }
        
        setContent(data.content || '');
      } catch (err: any) {
        console.error('Error loading file:', err);
        setError(err.message || 'Failed to load file');
      } finally {
        setLoading(false);
      }
    };

    loadFile();
  }, [selectedFile]);

  // Apply syntax highlighting when content changes
  useEffect(() => {
    if (codeRef.current && content && selectedFile) {
      Prism.highlightElement(codeRef.current);
    }
  }, [content, selectedFile]);

  if (!selectedFile) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        <div className="text-center">
          <div className="text-lg mb-2">No File Selected</div>
          <div>Select a file from the workspace to view its contents</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading {selectedFile}...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-red-400 bg-red-900/20 border border-red-800 rounded p-4 max-w-lg">
          <div className="font-semibold mb-2">Error Loading File</div>
          <div className="text-sm">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {/* File header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-[#252526]">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">📄</span>
          <span className="text-sm font-medium text-gray-200">{selectedFile}</span>
        </div>
        <button
          onClick={() => {
            // Future: Add edit mode
          }}
          className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-[#2a2d2e]"
        >
          Read Only
        </button>
      </div>

      {/* File content */}
      <div className="flex-1 overflow-auto">
        <pre className="line-numbers p-4 m-0" style={{ background: '#1e1e1e', fontSize: '12px', lineHeight: '1.5' }}>
          <code 
            ref={codeRef}
            className={`language-${getLanguage(selectedFile)}`}
          >
            {content}
          </code>
        </pre>
      </div>
    </div>
  );
};

export default FileViewer;

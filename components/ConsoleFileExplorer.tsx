'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useConsole } from './ConsoleProvider';
import { fetchConsoleFiles } from '@/lib/atlasConsoleClient';
import { ConsoleFileInfo } from '@/lib/types';

interface ConsoleFileExplorerProps {
  onFileSelect: (relativePath: string) => void;
  selectedFile?: string;
}

interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[];
  isExpanded?: boolean;
}

const ConsoleFileExplorer: React.FC<ConsoleFileExplorerProps> = ({
  onFileSelect,
  selectedFile,
}) => {
  const { activeSessionId } = useConsole();
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaceRoot, setWorkspaceRoot] = useState<string>('');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loadedDirs, setLoadedDirs] = useState<Map<string, ConsoleFileInfo[]>>(new Map());

  const isBinaryFile = (fileName: string): boolean => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const binaryExtensions = ['db', 'db-wal', 'db-shm', 'sqlite', 'png', 'jpg', 'jpeg', 'gif', 
                              'ico', 'pdf', 'zip', 'tar', 'gz', 'bin', 'exe', 'dll', 'so', 
                              'dylib', 'wasm', 'pyc', 'pyo', 'egg-info'];
    return binaryExtensions.includes(ext || '');
  };

  const buildFileTree = useCallback((dirPath: string, files: ConsoleFileInfo[]): FileNode[] => {
    // Separate viewable and binary files
    const viewableFiles: ConsoleFileInfo[] = [];
    const binaryFiles: ConsoleFileInfo[] = [];
    
    files.forEach(file => {
      if (file.is_dir || !isBinaryFile(file.path)) {
        viewableFiles.push(file);
      } else {
        binaryFiles.push(file);
      }
    });

    // Sort viewable files: directories first, then alphabetically
    const sortedViewable = [...viewableFiles].sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      return a.path.localeCompare(b.path);
    });

    // Sort binary files alphabetically
    const sortedBinary = [...binaryFiles].sort((a, b) => 
      a.path.localeCompare(b.path)
    );

    // Combine: viewable first, then binary
    const sorted = [...sortedViewable, ...sortedBinary];

    return sorted.map(file => {
      // API returns full paths for subdirectories, just filenames for root
      const fullPath = file.path;
      const fileName = file.path.split('/').pop() || file.path;
      
      const node: FileNode = {
        name: fileName,
        path: fullPath,
        isDir: file.is_dir,
        children: file.is_dir ? [] : undefined,
        isExpanded: false,
      };
      return node;
    });
  }, []);

  const loadDirectory = useCallback(async (path: string) => {
    if (loadedDirs.has(path)) {
      // Already loaded, just expand
      setExpandedDirs(prev => new Set(prev).add(path));
      return;
    }

    try {
      const data = await fetchConsoleFiles(path);
      const children = buildFileTree(path, data.files);
      
      setLoadedDirs(prev => new Map(prev).set(path, data.files));
      setExpandedDirs(prev => new Set(prev).add(path));
      
      // Update the tree to include the children
      setFileTree(prevTree => {
        const updateNode = (nodes: FileNode[]): FileNode[] => {
          return nodes.map(node => {
            if (node.path === path) {
              return { ...node, children, isExpanded: true };
            }
            if (node.children) {
              return { ...node, children: updateNode(node.children) };
            }
            return node;
          });
        };
        return updateNode(prevTree);
      });
    } catch (e: any) {
      console.error('Error loading directory:', e);
      setError(e.message || 'Failed to load directory');
    }
  }, [loadedDirs, buildFileTree]);

  const loadRootFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConsoleFiles('.');
      setWorkspaceRoot(data.workspace_root);
      const tree = buildFileTree('.', data.files);
      setFileTree(tree);
      setLoadedDirs(new Map([['.',  data.files]]));
    } catch (e: any) {
      console.error('ConsoleFileExplorer error:', e);
      setError(e.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [buildFileTree]);

  useEffect(() => {
    void loadRootFiles();
  }, [loadRootFiles]);

  const toggleDirectory = async (path: string) => {
    if (expandedDirs.has(path)) {
      // Collapse
      setExpandedDirs(prev => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
      
      // Update tree to reflect collapsed state
      setFileTree(prevTree => {
        const updateNode = (nodes: FileNode[]): FileNode[] => {
          return nodes.map(node => {
            if (node.path === path) {
              return { ...node, isExpanded: false };
            }
            if (node.children) {
              return { ...node, children: updateNode(node.children) };
            }
            return node;
          });
        };
        return updateNode(prevTree);
      });
    } else {
      // Expand - load children if not already loaded
      await loadDirectory(path);
    }
  };

  const getFileIcon = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
      'ts': 'TS',
      'tsx': 'TSX',
      'js': 'JS',
      'jsx': 'JSX',
      'py': 'PY',
      'md': 'MD',
      'json': 'JSON',
      'yaml': 'YAML',
      'yml': 'YML',
      'txt': 'TXT',
      'sh': 'SH',
      'css': 'CSS',
      'html': 'HTML',
      'sql': 'SQL',
      'db': 'DB',
      'env': 'ENV',
      'lock': 'LOCK',
      'toml': 'TOML',
      'xml': 'XML',
      'csv': 'CSV',
    };
    return iconMap[ext || ''] || 'FILE';
  };

  const getFileIconColor = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const name = fileName.toLowerCase();
    
    if (ext === 'py') return 'text-yellow-400';
    if (ext === 'env' || name === '.env' || name.startsWith('.env.')) return 'text-red-400';
    return 'text-blue-400';
  };

  const renderNode = (node: FileNode, depth: number = 0): React.ReactNode => {
    const isExpanded = node.isExpanded || false;
    const isSelected = node.path === selectedFile;
    const paddingLeft = `${depth * 12 + 4}px`;

    return (
      <div key={node.path}>
        <div
          className={`flex items-center cursor-pointer rounded px-1 py-0.5 hover:bg-[#2a2d2e] ${
            isSelected ? 'bg-[#094771]' : ''
          }`}
          style={{ paddingLeft }}
          onClick={() => {
            if (node.isDir) {
              toggleDirectory(node.path);
            } else {
              onFileSelect(node.path);
            }
          }}
          title={node.path}
        >
          {node.isDir ? (
            <span className="mr-1.5 text-gray-400 text-[10px]">
              {isExpanded ? '▼' : '▶'}
            </span>
          ) : (
            <span className={`mr-1.5 text-[9px] font-semibold ${getFileIconColor(node.name)} w-8 text-center`}>
              {getFileIcon(node.name)}
            </span>
          )}
          <span className="truncate">{node.name}</span>
        </div>
        {node.isDir && isExpanded && node.children && node.children.length > 0 && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full w-full text-xs text-gray-200 bg-black flex flex-col">
      {error && (
        <div className="p-2 text-red-400 text-[10px]">{error}</div>
      )}
      {!error && (
        <div className="flex-1 overflow-auto py-1">
          {fileTree.length === 0 && !loading && (
            <div className="px-2 text-gray-400 text-[10px]">No files found.</div>
          )}
          {fileTree.map((node, index) => {
            // Check if this is the first binary file (separator needed)
            const isBinary = !node.isDir && isBinaryFile(node.name);
            const prevNode = index > 0 ? fileTree[index - 1] : null;
            const isPrevBinary = prevNode && !prevNode.isDir && isBinaryFile(prevNode.name);
            const needsSeparator = isBinary && !isPrevBinary;

            return (
              <React.Fragment key={node.path}>
                {needsSeparator && (
                  <div className="mx-2 my-2 border-t border-gray-600"></div>
                )}
                {renderNode(node, 0)}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ConsoleFileExplorer;

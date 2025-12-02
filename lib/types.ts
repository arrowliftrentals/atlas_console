export interface AtlasAssumption {
  description: string;
  resolved: boolean;
}

export interface AtlasChatRequest {
  query: string;
  assumptions: AtlasAssumption[];
  context?: string | null;
  override_unresolved_assumptions: boolean;
  session_id?: string;
}

export interface AtlasChatResponse {
  answer: string;
  tool_calls?: ToolCall[];
  patches?: Patch[];
  commands?: Command[];
  tests?: TestInstruction[];
  context_requests?: ContextRequest[];
  skills?: SkillInvocation[];
  assumptions_used: AtlasAssumption[];
  unresolved_assumptions: AtlasAssumption[];
  notes?: string | null;
  session_id?: string | null;
}

// Console API Types
export type ConsoleSession = {
  session_id: string;
  project_id?: string;
  root_path?: string;
  created_at?: string;
  updated_at?: string;
};

export type ConsoleFileInfo = {
  path: string;
  is_dir: boolean;
  size?: number;
};

export type ConsoleFileListResponse = {
  workspace_root: string;
  current_path: string;
  files: ConsoleFileInfo[];
};

export type Patch = {
  file_path: string;
  diff: string;
  description?: string;
};

export type Command = {
  command: string;
  description?: string;
  cwd?: string;
};

export type TestInstruction = {
  command: string;
  description?: string;
  expected_outcome?: string;
};

export type ContextRequest = {
  request_id: string;
  description: string;
  required: boolean;
  suggested_tool?: string;
};

export type SkillStatus = 'pending' | 'running' | 'completed' | 'failed';

export type SkillInvocation = {
  skill_name: string;
  status: SkillStatus;
  progress?: number;
  details?: Record<string, unknown>;
  error_message?: string;
};

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ToolResult = {
  tool_call_id: string;
  output: Record<string, unknown>;
  error?: string;
};

// Agent Response Types - matches backend AtlasChatResponse
export interface Assumption {
  description: string;
  resolved: boolean;
}

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LogEntry {
  timestamp: string;
  level: LogLevel | string;
  message: string;
}

export interface AgentResponse {
  answer: string;
  tool_calls?: ToolCall[];
  patches?: Patch[];
  commands?: Command[];
  tests?: TestInstruction[];
  context_requests?: ContextRequest[];
  skills?: SkillInvocation[];
  assumptions_used: Assumption[];
  unresolved_assumptions: Assumption[];
  notes?: string;
}

// Task types (re-export from atlasClient for backward compatibility)
export type TaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AtlasTask {
  id: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  name?: string;
  progress?: number;
  description?: string;
}

// Alias for TasksView
export type TaskInfo = AtlasTask;

# API Contract Audit System — Implementation Handoff

## What This Is
You are continuing the implementation of an API Contract Audit System for the ATLAS Web Console. The plan is approved and all research is complete. No files have been created yet — you are starting fresh on the implementation.

## Repository Locations
- **Console**: `/Users/mac_m3/Projects/WARP Ecosystem/console` (Next.js 16, React 19, TypeScript strict)
- **Atlas backend**: `/Users/mac_m3/Projects/WARP Ecosystem/atlas` (FastAPI, Python 3.11+, Pydantic)
- **Backend runs at**: `http://127.0.0.1:8000` (OpenAPI spec at `/openapi.json`)
- **Console runs at**: `http://localhost:3000` (proxies to backend via Next.js rewrites)

## What to Build (4 Deliverables)

### 1. `console/contracts/api-contracts.json`
The contract definition file. Single source of truth. See "Contract Schema" and "Complete Endpoint Inventory" sections below.

### 2. `console/scripts/discover-api-usage.py`
Auto-discovery script that scrapes `fetch()`, `getAtlasWsUrl()`, and `EventSource()` calls from the console codebase. Compares against `api-contracts.json` to find uncovered endpoints (fetch calls not in contract) and orphaned contracts (contract entries no longer in code).

### 3. `console/scripts/audit-api-contracts.py`
Standalone audit script. Reads the contract JSON, runs discovery, hits each endpoint through the proxy (localhost:3000), validates response shapes, handles POST side effects (safe_payload + cleanup), tests WebSocket/SSE connections, outputs structured report.

Usage: `python scripts/audit-api-contracts.py [--base-url http://localhost:3000] [--openapi] [--json-output results.json]`

### 4. Atlas Integration (`atlas/src/api/routes/contract_audit.py`)
- `POST /v1/api/contracts/audit` — accepts contract JSON as request body, validates against its own endpoints
- `GET /v1/api/contracts/status` — cached last audit result
- Pydantic models defined inline in the route file (no `src/api/schemas/` directory exists — all atlas routes define models inline)
- Register in `atlas/src/api/server.py` following existing pattern
- Write tests in `atlas/tests/api/test_contract_audit.py`

## Contract Entry Schema

Each entry in `api-contracts.json` follows this structure:

```json
{
  "path": "/v1/security/scan",
  "method": "GET",
  "protocol": "http",
  "consumers": ["SecurityView.tsx"],
  "params": {"force_refresh": "false"},
  "unwrap": "result",
  "wrapper_fields": {
    "status": {"type": "string", "required": true},
    "cache_age_seconds": {"type": "number", "required": false}
  },
  "expected_fields": {
    "scan_id": {"type": "string", "required": true},
    "total_findings": {"type": "number", "required": true},
    "findings": {"type": "array", "required": true},
    "overall_score": {"type": "number", "required": true}
  }
}
```

For POST endpoints with side effects:
```json
{
  "path": "/v1/atlas/tasks",
  "method": "POST",
  "consumers": ["TasksView.tsx"],
  "safe_payload": {"name": "Contract Audit Test Task", "status": "pending"},
  "cleanup": {"method": "DELETE", "path_template": "/v1/atlas/tasks/{id}"},
  "expected_fields": {
    "id": {"type": "string", "required": true},
    "name": {"type": "string", "required": true},
    "status": {"type": "string", "required": true}
  }
}
```

For destructive/expensive POSTs:
```json
{
  "path": "/v1/telemetry/clear",
  "method": "POST",
  "consumers": ["AnalysisPanel.tsx"],
  "skip_in_audit": true
}
```

For WebSocket entries:
```json
{
  "path": "/v1/telemetry/stream",
  "method": "GET",
  "protocol": "ws",
  "consumers": ["TelemetryContext.tsx", "ArchitectureViewV2.tsx", "NeuralArchitecture3DV2.tsx", "NeuralNetworkScene.tsx"],
  "message_types": [
    {
      "type": "telemetry_update",
      "expected_fields": {
        "type": {"type": "string", "required": true},
        "timestamp": {"type": "string", "required": true}
      }
    }
  ]
}
```

For SSE entries:
```json
{
  "path": "/v1/benchmarks/stream",
  "method": "GET",
  "protocol": "sse",
  "consumers": ["BenchmarkLiveView.tsx"],
  "message_types": [
    {
      "type": "suite_start",
      "expected_fields": {
        "type": {"type": "string", "required": true},
        "total_benchmarks": {"type": "number", "required": true}
      }
    }
  ]
}
```

## Complete Endpoint Inventory

All fetch paths extracted from the console codebase. These ALL need contract entries.

### Static paths (literal URL strings in fetch calls):
```
/health
/api/analysis/mark-fixed
/api/analysis/run
/api/analysis/runs
/api/atlasChat/stream
/api/atlasLearning/corrections?limit=1
/api/atlasLearning/corrections?limit=50
/api/atlasLearning/patterns
/api/atlasLearning/stats
/api/console-logs
/api/console/commands/run
/api/database/health
/api/debug-log
/api/fix/generate
/api/learning/corrections
/api/logs
/api/memory/stats
/api/metrics/summary
/api/neural-graph
/api/sandbox
/api/sandbox/health
/api/sandbox/history?limit=50
/api/sandbox/proposals
/api/sandbox/statistics
/api/scheduler/stats
/api/stt/elevenlabs/convert
/api/stt/elevenlabs/token
/api/system/resources
/api/systems
/api/tts
/api/tts/cartesia
/api/voiceprint/enroll
/api/voiceprint/status?user_id=owner
/v1/architecture/graph
/v1/architecture/stats
/v1/atlas/logs?limit=20
/v1/benchmarks
/v1/classify/stats
/v1/learning/corrections/stats
/v1/memory/l6/focus
/v1/meta/dynamic/latest
/v1/recommendations/analyze?force_refresh=false
/v1/recommendations/summary
/v1/safety/stats
/v1/security/summary
/v1/telemetry/bottlenecks
/v1/telemetry/clear
/v1/telemetry/critical-paths
/v1/telemetry/error-edges
/v1/telemetry/flows
/v1/telemetry/hot-paths
/v1/telemetry/traces/recent?limit=1000
/v1/voice/realtime/session
```

### Dynamic/template paths (use ${variable} substitution):
```
${BACKEND_URL}/api/database/check              (POST)
${BACKEND_URL}/api/database/checkpoint          (POST)
${BACKEND_URL}/api/systems/${subsystemName}/initialize  (POST)
${BACKEND_URL}/v1/meta/assess                   (POST)
${BACKEND_URL}/v1/meta/dynamic/history?limit=50
${BACKEND_URL}/v1/meta/progress/status
${atlasApiBase}/v1/atlas/tasks                  (GET + POST)
${atlasApiBase}/v1/atlas/tasks/${taskId}        (DELETE)
${atlasApiBase}/v1/atlas/tasks/${taskId}/status  (PATCH)
${atlasApiBase}/v1/documentation/drift/statistics
${atlasApiBase}/v1/documentation/drift/review?min_confidence=0.5  (POST)
${atlasApiBase}/api/proposals/${proposalId}
${atlasApiBase}/api/proposals/${proposalId}/status  (PATCH)
/api/analysis/cancel/${currentRunId}             (POST)
/api/analysis/delete/${runId}                    (DELETE)
/api/analysis/issues/${runId}
/api/analysis/progress/${runId}
/api/atlasLearning/pattern/${tool}/${errorCode}
/api/fix/batch?${params}                        (POST)
/api/fix/cancel/${fixJobId}                     (POST)
/api/fix/status/${jobId}
/v1/memory/l3/episodes?limit=${limit}
/v1/memory/l4/facts?limit=${limit}
/v1/memory/l5/skills?limit=${limit}
/v1/memory/l7/snapshots?limit=${limit}
/v1/memory/l8/goals?limit=${limit}
/v1/security/scan?force_refresh=${forceRefresh}
/v1/telemetry/flows?limit=${traceLimit}
/v1/telemetry/hot-paths?limit=${limit}
/v1/telemetry/traces/recent?limit=${limit}
```

### WebSocket paths:
```
/v1/telemetry/stream          — TelemetryContext.tsx, ArchitectureViewV2.tsx, NeuralArchitecture3DV2.tsx, NeuralNetworkScene.tsx
/v1/progress/stream/${sessionId}  — ProgressIndicator.tsx, PermanentProgressBar.tsx
/api/analysis/ws/${runId}     — CodeAnalysisDashboard.tsx
```

### SSE paths:
```
/v1/benchmarks/stream         — BenchmarkLiveView.tsx (via EventSource)
```

## Key Component → Endpoint Mappings

These are the components you need to read to extract exact `expected_fields` for each contract entry:

| Component | Key Endpoints |
|-----------|--------------|
| `components/DashboardView.tsx` | /health, /v1/architecture/graph, /api/memory/stats, /api/system/resources, /v1/meta/dynamic/latest, /v1/security/summary, /v1/recommendations/summary, /v1/safety/stats, /v1/classify/stats, /v1/learning/corrections/stats, /v1/telemetry/bottlenecks, /v1/telemetry/critical-paths, /v1/telemetry/hot-paths, /v1/telemetry/traces/recent, /api/database/health, /api/sandbox/statistics, /api/scheduler/stats, /api/metrics/summary |
| `components/dashboard-cards/index.tsx` | /v1/memory/l6/focus, /v1/memory/l8/goals, /v1/memory/l5/skills, /v1/memory/l3/episodes, /v1/memory/l4/facts, /v1/memory/l7/snapshots |
| `components/ArchitectureViewV2.tsx` | /v1/architecture/graph, /v1/telemetry/error-edges, WS /v1/telemetry/stream |
| `components/MetaView.tsx` | /v1/meta/dynamic/latest, /v1/meta/dynamic/history, /v1/meta/progress/status, POST /v1/meta/assess |
| `components/SandboxView.tsx` | /api/sandbox/health, /api/sandbox/history, /api/sandbox/statistics, /api/sandbox/proposals, POST /api/sandbox, /api/proposals/{id}, PATCH /api/proposals/{id}/status |
| `components/SecurityView.tsx` | /v1/security/scan (unwrap "result") |
| `components/RecommendationsView.tsx` | /v1/recommendations/analyze (unwrap "result"), /v1/recommendations/summary |
| `components/SystemsView.tsx` | /api/systems, /api/database/health, POST /api/database/check, POST /api/database/checkpoint, POST /api/systems/{name}/initialize |
| `components/LearningView.tsx` | /v1/learning/corrections/stats, /api/atlasLearning/patterns, /api/atlasLearning/corrections |
| `components/LogsView.tsx` | /v1/atlas/logs |
| `components/TasksView.tsx` | /v1/atlas/tasks, POST /v1/atlas/tasks, PATCH /v1/atlas/tasks/{id}/status, DELETE /v1/atlas/tasks/{id} |
| `components/MemoryView.tsx` | /api/memory/stats |
| `components/AttentionView.tsx` | /v1/memory/l6/focus |
| `components/BenchmarkLiveView.tsx` | /v1/benchmarks, SSE /v1/benchmarks/stream |
| `components/DriftReviewView.tsx` | /v1/documentation/drift/statistics, POST /v1/documentation/drift/review |
| `components/CodeAnalysisDashboard.tsx` | /api/analysis/run, /api/analysis/runs, /api/analysis/issues/{id}, /api/analysis/progress/{id}, WS /api/analysis/ws/{id} |
| `contexts/TelemetryContext.tsx` | WS /v1/telemetry/stream |
| `components/ProgressIndicator.tsx` | WS /v1/progress/stream/{sessionId} |
| `components/PermanentProgressBar.tsx` | WS /v1/progress/stream/{sessionId} |
| `lib/atlasClient.ts` | /api/atlasChat/stream, /v1/atlas/chat/chunk/{sessionId} |
| `lib/atlasConsoleClient.ts` | /api/console/sessions, /api/console/files, /api/console/commands/run |

## Atlas Code Patterns to Follow

### Route file pattern (defined inline, no separate schemas dir):
```python
# atlas/src/api/routes/contract_audit.py
from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from loguru import logger

router = APIRouter(prefix="/v1/api/contracts", tags=["contracts"])

class EndpointContractViolation(BaseModel):
    """Single contract violation."""
    path: str
    method: str
    violation_type: str  # missing_field, wrong_type, etc.
    field: Optional[str] = None
    expected: Optional[str] = None
    actual: Optional[str] = None
    consumers: List[str] = Field(default_factory=list)
    message: str

class ContractAuditResult(BaseModel):
    """Full audit result."""
    timestamp: str
    total_endpoints: int
    passed: int
    failed: int
    violations: List[EndpointContractViolation]
    score: float  # 0-100

@router.post("/audit")
async def run_contract_audit(contracts: dict):
    ...

@router.get("/status")
async def get_audit_status():
    ...
```

### Route registration in server.py (line ~35-50 for imports, ~289-303 for include):
```python
# Import at top of server.py:
from src.api.routes.contract_audit import router as contract_audit_router

# Register near line 303:
app.include_router(contract_audit_router)
```

### Test pattern (atlas/tests/api/test_api.py):
- Uses `pytest` with `@pytest.mark.no_parallel`
- Mock-based testing with `unittest.mock`
- Tests use Pydantic model constructors directly

## Validation Rules Summary

**HTTP endpoints:**
1. HTTP 200
2. Valid JSON
3. wrapper_fields validated (if specified)
4. unwrap key exists (if specified)
5. All required expected_fields present in unwrapped payload
6. Types match (string, number, boolean, array, object)
7. Optional fields, if present, have correct type

**POST with side effects:**
- Use safe_payload as request body
- Run cleanup after (e.g. DELETE created task)
- Skip if skip_in_audit: true

**WebSocket:**
- Connection established
- First message received within 5s timeout
- Message matches a defined message_type
- matched type's expected_fields validated

**SSE:**
- Connection established
- At least one event received
- Event data matches a defined message_type

## Violation Types
`missing_field`, `wrong_type`, `missing_unwrap_key`, `missing_wrapper_field`, `http_error`, `invalid_json`, `ws_connection_failed`, `ws_message_mismatch`, `uncovered_endpoint`, `orphaned_contract`

## Important Notes

1. **No `src/api/schemas/` dir exists** in atlas. All Pydantic models are defined inline in route files. Follow this convention.
2. **BACKEND_URL in SystemsView.tsx is `""`** (empty string, relative URL). Same for `atlasApiBase` in DriftReviewView.tsx — uses `(window as any).__ATLAS_API_BASE || ""`.
3. **`lib/api.ts`** exports `ATLAS_API_URL` and `getAtlasWsUrl()` for WebSocket connections.
4. **Console proxy**: `next.config.js` rewrites `/v1/*`, `/api/*`, `/health` to backend. WebSockets bypass the proxy (connect directly via getAtlasWsUrl).
5. **Bug already fixed**: `SandboxView.tsx` resource_usage fields were corrected from `peak_memory_mb`/`cpu_time_seconds` to `memory_used_mb`/`cpu_percent` to match the actual API response. This is the motivating example for why this system exists.
6. **Atlas test count**: 442/442 passing. Any changes to atlas must maintain this.
7. **Python 3.11+ required** for atlas code. Use modern type hints.
8. The `console/scripts/` directory already exists and contains Python files, so adding Python scripts there is consistent.
9. For the discovery script, the key regex patterns to extract are:
   - `fetch("..."` or `fetch('...'` or `fetch(\`...\`` — extract URL paths
   - `getAtlasWsUrl("..."` — extract WS paths
   - `new EventSource(` with nearby URL — extract SSE paths
10. When testing through proxy (localhost:3000), both the console dev server and atlas backend must be running.

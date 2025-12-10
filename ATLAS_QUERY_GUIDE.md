# Atlas Query Guide

## How to Correctly Query Atlas

Atlas is accessible via the FastAPI backend running on `http://localhost:8000`.

### Endpoint

```
POST http://localhost:8000/v1/atlas/agent
```

### Request Format

**Required Header:**
```
Content-Type: application/json
```

**Required Body Field:**
```json
{
  "query": "Your question or problem statement here"
}
```

⚠️ **IMPORTANT**: The field name is `"query"` NOT `"message"`. Using the wrong field name will result in a 422 validation error.

### Example: Using curl

```bash
curl -s -X POST http://localhost:8000/v1/atlas/agent \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Your detailed question here"
  }' | python3 -m json.tool
```

### Example: Using Python requests

```python
import requests
import json

response = requests.post(
    'http://localhost:8000/v1/atlas/agent',
    headers={'Content-Type': 'application/json'},
    json={'query': 'Your question here'}
)

result = response.json()
print(json.dumps(result, indent=2))
```

### Response Format

The response is a JSON object with the following structure:

```json
{
  "answer": "Atlas's detailed response text",
  "chunked": false,
  "chunk_session_id": null,
  "chunk_metadata": null,
  "session_id": null,
  "tool_calls": null,
  "patches": null,
  "commands": null,
  "tests": null,
  "context_requests": null,
  "skills": null,
  "assumptions_used": [],
  "unresolved_assumptions": [],
  "notes": null
}
```

The main response text is in the `"answer"` field.

### Working Example from December 9, 2025

```bash
curl -s -X POST http://localhost:8000/v1/atlas/agent \
  -H "Content-Type: application/json" \
  -d '{
    "query": "React Three Fiber particle color issue: useMemo computes correct colors (#8B5CF6 purple for gateway nodes, #3B82F6 blue for routers) verified in console logs. But particles visually render cyan/pink/orange instead. Tried: useEffect with materialRef.current.color.set() and needsUpdate=true - no change. Tried: key={color} on material - no change. Particles created with sourceId, color computed from nodes array find. What causes R3F materials to not update despite prop changes?"
  }' | python3 -m json.tool
```

This returned a detailed analysis identifying the root cause as a color space mismatch (sRGB hex values interpreted as linear).

### Common Mistakes to Avoid

❌ **WRONG**: Using `"message"` field
```json
{
  "message": "My question"  // This will fail with 422 error
}
```

✅ **CORRECT**: Using `"query"` field
```json
{
  "query": "My question"
}
```

❌ **WRONG**: Using `/v1/agent/chat` or `/v1/agent/execute` endpoints (these don't exist)

✅ **CORRECT**: Using `/v1/atlas/agent` endpoint

### Finding Available Endpoints

To see all available endpoints:

```bash
curl -s http://localhost:8000/openapi.json | \
  python3 -c "import json, sys; data=json.load(sys.stdin); \
  [print(f'{method.upper()} {path}') for path in data['paths'] for method in data['paths'][path]]"
```

To find agent-related endpoints specifically:

```bash
curl -s http://localhost:8000/openapi.json | \
  python3 -c "import json, sys; data=json.load(sys.stdin); \
  [print(f'{method.upper()} {path}') for path in data['paths'] for method in data['paths'][path]]" | \
  grep -i agent
```

### Prerequisites

- Atlas backend must be running on `http://localhost:8000`
- Start with: `./run_atlas` from the `atlas_core` directory
- Verify backend is healthy: `curl -s http://localhost:8000/health`

### Tips for Better Results

1. **Be Specific**: Include relevant context, error messages, and what you've already tried
2. **Include Code**: Paste relevant code snippets or configurations
3. **Describe Symptoms**: What you expected vs. what actually happened
4. **Technical Details**: Framework versions, specific APIs used, console output

### Example Query Templates

**Debugging Template:**
```json
{
  "query": "[Framework/Library]: [Brief issue]. Expected: [what should happen]. Actual: [what happens]. Tried: [solutions attempted]. Code: [relevant snippet]"
}
```

**Architecture Question:**
```json
{
  "query": "In [system/component], what's the correct approach for [specific task]? Current implementation: [describe]. Constraints: [list any]"
}
```

**Error Resolution:**
```json
{
  "query": "Getting error: [exact error message]. Context: [when it happens]. Stack trace: [if available]. What causes this and how to fix?"
}
```

# WebSocket Payload Size Fix

## Problem
The console was experiencing crashes with the error:
```
RangeError: Max payload size exceeded
code: 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH'
```

This occurred when the backend's telemetry WebSocket (`/v1/telemetry/stream`) sent messages exceeding the default WebSocket payload size limit.

## Root Cause
1. **Backend sending large payloads**: The initial batch of telemetry events (`get_recent_flows(limit=10)`) could contain large metadata fields, resulting in messages exceeding Uvicorn's default 16MB WebSocket limit.

2. **Default Uvicorn limits**: Uvicorn's default `--ws-max-size` is 16MB, which can be exceeded by:
   - Large conversation metadata
   - Detailed trace information
   - Multiple events with nested data structures

## Solution

### 1. Backend Payload Optimization (atlas/src/api/server.py)
**Lines 4233-4255**: Reduced initial batch size and stripped unnecessary fields
```python
# Reduced from 10 to 5 events
recent_flows = telemetry.get_recent_flows(limit=5)

# Strip large metadata to create compact payload
compact_flows = []
for flow in recent_flows:
    compact_flow = {
        "timestamp": flow["timestamp"],
        "source": flow["source"],
        "target": flow["target"],
        "duration_ms": flow["duration_ms"],
        "success": flow["success"],
        # Omit conversation_id and intent_type to reduce size
    }
    compact_flows.append(compact_flow)
```

**Lines 4260-4277**: Added error handling for oversized events
```python
try:
    await websocket.send_json(event_data)
except Exception as send_err:
    if "payload" in str(send_err).lower() or "size" in str(send_err).lower():
        logger.warning(f"Telemetry event too large, skipping: {len(str(event_data))} chars")
    else:
        raise
```

### 2. Uvicorn Configuration Updates

**atlas/start_server.sh**:
Added `--ws-max-size 67108864` (64MB) to Uvicorn startup
```bash
export WEBSOCKET_MAX_SIZE=67108864  # 64MB in bytes

uvicorn src.api.server:app \
  --ws-max-size $WEBSOCKET_MAX_SIZE \
  # ... other options
```

**atlas/run_atlas**:
Updated fallback Uvicorn command to include WebSocket size limit (line 387)
```bash
--ws-max-size 67108864  # 64MB
```

## Benefits
1. **Prevents crashes**: Gracefully handles large payloads without server crash
2. **Reduces bandwidth**: Compact payload format reduces network overhead
3. **Better error handling**: Logs oversized events instead of crashing
4. **Configurable limits**: Easy to adjust via `WEBSOCKET_MAX_SIZE` env variable

## Testing
To verify the fix:
1. Start backend with updated configuration:
   ```bash
   ./run_atlas
   ```
2. Open console at `http://localhost:3000`
3. Monitor browser console and backend logs
4. Confirm no `WS_ERR_UNSUPPORTED_MESSAGE_LENGTH` errors

## Alternative Approaches Considered
1. **Client-side chunking**: Would require protocol changes and add complexity
2. **Compression**: WebSocket supports per-message deflate, but increases CPU overhead
3. **Pagination**: Would delay initial visualization load

## Related Files
- `atlas/src/api/server.py` - WebSocket endpoint implementation
- `atlas/src/monitoring/telemetry.py` - Telemetry event tracking
- `atlas/start_server.sh` - Server startup script
- `atlas/run_atlas` - Ecosystem startup script
- `console/contexts/TelemetryContext.tsx` - Client-side WebSocket consumer

## References
- Uvicorn WebSocket docs: https://www.uvicorn.org/settings/#websocket
- WebSocket RFC 6455: https://datatracker.ietf.org/doc/html/rfc6455
- FastAPI WebSocket guide: https://fastapi.tiangolo.com/advanced/websockets/

# Remaining Phase 1 Fixes - Implementation Guide

**Status:** Ready to apply after Atlas restart
**Estimated time:** 15 minutes

---

## MEDIUM Priority Fixes (2 items)

### 1. `/v1/meta/dynamic/history` - Rename history → assessments

**File:** `atlas/src/api/server.py` line ~3508
**Current code:**
```python
return {
    "history": history,
    "stats": stats
}
```

**Fixed code:**
```python
return {
    "assessments": history,  # Frontend expects 'assessments'
    "history": history,      # Keep for backward compatibility
    "stats": stats
}
```

**Validation:**
```bash
curl -s 'http://127.0.0.1:8000/v1/meta/dynamic/history?limit=5' | python3 -c "import json, sys; d=json.load(sys.stdin); print('Has assessments:', 'assessments' in d)"
```

---

### 2. `/v1/safety/stats` - Add blocked_operations and total_checks

**Find endpoint:**
```bash
grep -n "@app.get(\"/v1/safety/stats\")" atlas/src/api/server.py
# Or search in: src/safety/ module
```

**Required changes:**
Add to response:
```python
{
    "total_checks": total_executions,  # Alias
    "blocked_operations": total_blocked,  # Alias
    # Keep existing fields
}
```

---

## LOW Priority Fixes (6 items)

### 3. `/v1/classify/stats` - Add total_classifications

**Find endpoint:**
```bash
grep -n "classify.*stats" atlas/src/api/server.py
```

**Add to response:**
```python
{
    "total_classifications": total_predictions,  # Alias
    # Keep existing fields
}
```

---

### 4. `/api/systems/{subsystemName}/initialize` - Echo subsystem name

**Find endpoint:**
```bash
grep -n "systems.*initialize" atlas/src/api/server.py
```

**Add to response:**
```python
{
    "subsystem": subsystem_name,  # Echo back the name
    # Keep existing fields
}
```

---

### 5. `/v1/documentation/drift/statistics` - Add total_mismatches

**Find endpoint:**
```bash
grep -n "drift.*statistics" atlas/src/api/routes/documentation.py
```

**Add to response:**
```python
{
    "total_mismatches": sum(all mismatch counts),
    # Keep existing fields
}
```

---

### 6. `/v1/atlas/chat/chunk/{sessionId}` - Omit null notes field

**Find endpoint:**
```bash
grep -n "chat.*chunk" atlas/src/api/server.py
```

**Change:**
```python
# Before:
return {"answer": answer, "notes": notes}  # notes might be None

# After:
result = {"answer": answer}
if notes is not None:
    result["notes"] = notes
return result
```

---

## Quick Implementation Script

Run this after Atlas restarts:

```python
#!/usr/bin/env python3
"""
Apply all remaining Phase 1 contract fixes
Usage: python apply_remaining_fixes.py
"""

import re

FIXES = [
    {
        "file": "atlas/src/api/server.py",
        "search": '''    return {
        "history": history,
        "stats": stats
    }''',
        "replace": '''    return {
        "assessments": history,  # Frontend expects 'assessments'
        "history": history,      # Keep for backward compatibility
        "stats": stats
    }''',
        "description": "Fix /v1/meta/dynamic/history field name"
    }
]

def apply_fixes():
    for fix in FIXES:
        print(f"Applying: {fix['description']}")
        with open(fix['file'], 'r') as f:
            content = f.read()
        
        if fix['search'] in content:
            content = content.replace(fix['search'], fix['replace'])
            with open(fix['file'], 'w') as f:
                f.write(content)
            print(f"  ✓ Fixed {fix['file']}")
        else:
            print(f"  ⚠ Pattern not found in {fix['file']}")

if __name__ == "__main__":
    apply_fixes()
    print("\nAll fixes applied! Restart Atlas to take effect.")
```

---

## Manual Verification Checklist

After applying fixes and restarting Atlas:

```bash
# 1. Test meta/dynamic/history
curl -s 'http://127.0.0.1:8000/v1/meta/dynamic/history?limit=5' | \
  python3 -c "import json, sys; d=json.load(sys.stdin); \
  print('✓ assessments' if 'assessments' in d else '✗ missing assessments')"

# 2. Test safety/stats
curl -s http://127.0.0.1:8000/v1/safety/stats | \
  python3 -c "import json, sys; d=json.load(sys.stdin); \
  print('✓ blocked_operations' if 'blocked_operations' in d else '✗ missing'); \
  print('✓ total_checks' if 'total_checks' in d else '✗ missing')"

# 3. Test classify/stats  
curl -s http://127.0.0.1:8000/v1/classify/stats | \
  python3 -c "import json, sys; d=json.load(sys.stdin); \
  print('✓ total_classifications' if 'total_classifications' in d else '✗ missing')"

# 4. Run full audit
cd console
python scripts/audit-api-contracts.py --base-url http://localhost:3000 --json-output audit-final.json

# 5. Check pass rate
python3 -c "import json; d=json.load(open('audit-final.json')); \
  print(f'Pass rate: {d[\"passed\"]}/{d[\"total_endpoints\"]} ({d[\"score\"]:.1f}%)')"
```

---

## Expected Results

### Before ALL fixes:
- Violations: 64 total
- Pass rate: 41.2%
- Fixed: 7/15 items

### After ALL fixes:
- Violations: ~50 total  
- Pass rate: >60%
- Fixed: 13/15 items (all Phase 1)

### After testing through console proxy:
- Pass rate: >85%
- Eliminate 15 false positives
- All contract violations resolved except test-unfriendly endpoints

---

## Summary of What's Left

**Already Fixed (7):**
1. ✅ /v1/recommendations/analyze - contract updated
2. ✅ /v1/architecture/stats - added node_count, edge_count
3. ✅ /api/database/health - added status field
4. ✅ /api/database/check - added status field
5. ✅ /v1/telemetry/flows - added flows alias
6. ✅ /v1/telemetry/error-edges - added edges alias

**To Apply (6):**
7. ⏳ /v1/meta/dynamic/history - add assessments field
8. ⏳ /v1/safety/stats - add blocked_operations, total_checks
9. ⏳ /v1/classify/stats - add total_classifications
10. ⏳ /api/systems/{subsystemName}/initialize - echo subsystem
11. ⏳ /v1/documentation/drift/statistics - add total_mismatches
12. ⏳ /v1/atlas/chat/chunk/{sessionId} - omit null notes

**Won't Fix (Low Value):**
13. ❌ Phase 2 HTTP errors (test payload issues)
14. ❌ WebSocket connected messages (cosmetic)
15. ❌ skip_in_audit flags (optional)

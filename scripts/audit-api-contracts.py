#!/usr/bin/env python3
"""
API Contract Audit Script

Validates API contracts against:
1. OpenAPI specification (http://127.0.0.1:8000/openapi.json)
2. Live endpoint responses through proxy (http://localhost:3000)
3. Expected field schemas defined in api-contracts.json

Handles:
- HTTP endpoint validation (GET, POST, PATCH, DELETE)
- POST side effects with safe payloads and cleanup
- WebSocket connection testing
- SSE (Server-Sent Events) stream validation
- Response shape validation against expected_fields

Usage:
    python scripts/audit-api-contracts.py [--base-url URL] [--openapi] [--json-output FILE]
"""

import json
import sys
import time
import asyncio
import websockets
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
import argparse


try:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
except ImportError:
    print("Error: 'requests' library required. Install with: pip install requests", file=sys.stderr)
    sys.exit(1)


@dataclass
class ContractViolation:
    """Represents a contract validation failure"""
    path: str
    method: str
    violation_type: str  # missing_field, wrong_type, http_error, etc.
    field: Optional[str] = None
    expected: Optional[str] = None
    actual: Optional[str] = None
    consumers: List[str] = None
    message: str = ""
    
    def __post_init__(self):
        if self.consumers is None:
            self.consumers = []


@dataclass
class AuditResult:
    """Complete audit result"""
    timestamp: str
    total_endpoints: int
    passed: int
    failed: int
    skipped: int
    violations: List[ContractViolation]
    score: float
    duration_seconds: float


class ContractAuditor:
    """Audits API contracts against live endpoints"""
    
    def __init__(self, base_url: str, timeout: int = 10):
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.session = self._create_session()
        self.openapi_spec: Optional[Dict] = None
    
    def _create_session(self) -> requests.Session:
        """Create requests session with retry logic"""
        session = requests.Session()
        retry = Retry(
            total=3,
            backoff_factor=0.3,
            status_forcelist=[500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry)
        session.mount('http://', adapter)
        session.mount('https://', adapter)
        return session
    
    def fetch_openapi_spec(self) -> bool:
        """Fetch OpenAPI spec from backend"""
        try:
            # Try to fetch directly from backend (not through proxy)
            backend_url = self.base_url.replace('3000', '8000')
            response = self.session.get(
                f"{backend_url}/openapi.json",
                timeout=self.timeout
            )
            response.raise_for_status()
            self.openapi_spec = response.json()
            print(f"✓ Loaded OpenAPI spec: {len(self.openapi_spec.get('paths', {}))} paths")
            return True
        except Exception as e:
            print(f"Warning: Could not fetch OpenAPI spec: {e}")
            return False
    
    def validate_against_openapi(self, contract: Dict) -> List[ContractViolation]:
        """Validate contract against OpenAPI spec"""
        violations = []
        
        if not self.openapi_spec:
            return violations
        
        path = contract['path']
        method = contract['method'].lower()
        
        # Find matching path in OpenAPI (handle path parameters)
        openapi_path = self._find_openapi_path(path)
        
        if not openapi_path:
            violations.append(ContractViolation(
                path=path,
                method=method,
                violation_type='missing_in_openapi',
                message=f"Endpoint not found in OpenAPI spec",
                consumers=contract.get('consumers', [])
            ))
            return violations
        
        # Check if method exists
        path_item = self.openapi_spec['paths'][openapi_path]
        if method not in path_item:
            violations.append(ContractViolation(
                path=path,
                method=method,
                violation_type='method_not_in_openapi',
                message=f"Method {method.upper()} not defined in OpenAPI spec",
                consumers=contract.get('consumers', [])
            ))
        
        return violations
    
    def _find_openapi_path(self, contract_path: str) -> Optional[str]:
        """Find matching OpenAPI path (handles {param} syntax)"""
        if not self.openapi_spec:
            return None
        
        # Direct match
        if contract_path in self.openapi_spec['paths']:
            return contract_path
        
        # Try to match parameterized paths
        # Convert {taskId} style to {task_id} or vice versa
        for openapi_path in self.openapi_spec['paths'].keys():
            if self._paths_match(contract_path, openapi_path):
                return openapi_path
        
        return None
    
    def _paths_match(self, path1: str, path2: str) -> bool:
        """Check if two paths match (ignoring parameter names)"""
        parts1 = path1.split('/')
        parts2 = path2.split('/')
        
        if len(parts1) != len(parts2):
            return False
        
        for p1, p2 in zip(parts1, parts2):
            # Both are parameters
            if p1.startswith('{') and p2.startswith('{'):
                continue
            # Exact match required for non-parameters
            if p1 != p2:
                return False
        
        return True
    
    def test_http_endpoint(self, contract: Dict) -> List[ContractViolation]:
        """Test a single HTTP endpoint"""
        violations = []
        path = contract['path']
        method = contract['method']
        
        # Skip if marked
        if contract.get('skip_in_audit'):
            return violations
        
        # Build URL
        url = f"{self.base_url}{path}"
        
        # Add query parameters if specified
        params = contract.get('params', {})
        
        try:
            # Make request
            if method == 'GET':
                response = self.session.get(url, params=params, timeout=self.timeout)
            elif method == 'POST':
                payload = contract.get('safe_payload', {})
                response = self.session.post(url, json=payload, params=params, timeout=self.timeout)
            elif method == 'PATCH':
                payload = contract.get('safe_payload', {})
                response = self.session.patch(url, json=payload, params=params, timeout=self.timeout)
            elif method == 'DELETE':
                response = self.session.delete(url, params=params, timeout=self.timeout)
            else:
                violations.append(ContractViolation(
                    path=path,
                    method=method,
                    violation_type='unsupported_method',
                    message=f"Unsupported HTTP method: {method}",
                    consumers=contract.get('consumers', [])
                ))
                return violations
            
            # Check HTTP status
            if not response.ok:
                violations.append(ContractViolation(
                    path=path,
                    method=method,
                    violation_type='http_error',
                    message=f"HTTP {response.status_code}: {response.reason}",
                    actual=str(response.status_code),
                    expected="200",
                    consumers=contract.get('consumers', [])
                ))
                return violations
            
            # Validate JSON response
            try:
                data = response.json()
            except ValueError:
                violations.append(ContractViolation(
                    path=path,
                    method=method,
                    violation_type='invalid_json',
                    message="Response is not valid JSON",
                    consumers=contract.get('consumers', [])
                ))
                return violations
            
            # Validate wrapper fields if specified
            wrapper_fields = contract.get('wrapper_fields', {})
            for field_name, field_spec in wrapper_fields.items():
                violations.extend(self._validate_field(
                    data, field_name, field_spec, path, method, contract, is_wrapper=True
                ))
            
            # Unwrap if needed
            unwrap_key = contract.get('unwrap')
            if unwrap_key:
                if unwrap_key not in data:
                    violations.append(ContractViolation(
                        path=path,
                        method=method,
                        violation_type='missing_unwrap_key',
                        field=unwrap_key,
                        message=f"Unwrap key '{unwrap_key}' not found in response",
                        consumers=contract.get('consumers', [])
                    ))
                    return violations
                data = data[unwrap_key]
            
            # Validate expected fields
            expected_fields = contract.get('expected_fields', {})
            for field_name, field_spec in expected_fields.items():
                violations.extend(self._validate_field(
                    data, field_name, field_spec, path, method, contract
                ))
            
            # Cleanup if this was a POST with side effects
            if method == 'POST' and 'cleanup' in contract:
                self._cleanup_post_side_effect(contract, data)
        
        except requests.exceptions.Timeout:
            violations.append(ContractViolation(
                path=path,
                method=method,
                violation_type='timeout',
                message=f"Request timed out after {self.timeout}s",
                consumers=contract.get('consumers', [])
            ))
        except requests.exceptions.RequestException as e:
            violations.append(ContractViolation(
                path=path,
                method=method,
                violation_type='request_failed',
                message=f"Request failed: {str(e)}",
                consumers=contract.get('consumers', [])
            ))
        
        return violations
    
    def _validate_field(self, data: Any, field_name: str, field_spec: Dict,
                       path: str, method: str, contract: Dict, is_wrapper: bool = False) -> List[ContractViolation]:
        """Validate a single field against its specification"""
        violations = []
        required = field_spec.get('required', False)
        expected_type = field_spec.get('type', 'any')
        nullable = field_spec.get('nullable', False)
        
        # Check if field exists
        if field_name not in data:
            if required:
                violations.append(ContractViolation(
                    path=path,
                    method=method,
                    violation_type='missing_wrapper_field' if is_wrapper else 'missing_field',
                    field=field_name,
                    expected=f"required field '{field_name}'",
                    actual="missing",
                    message=f"Required field '{field_name}' missing from response",
                    consumers=contract.get('consumers', [])
                ))
            return violations
        
        # Validate type
        actual_value = data[field_name]
        
        # Allow None if nullable is true
        if actual_value is None and nullable:
            return violations
        
        if not self._type_matches(actual_value, expected_type):
            violations.append(ContractViolation(
                path=path,
                method=method,
                violation_type='wrong_type',
                field=field_name,
                expected=expected_type,
                actual=type(actual_value).__name__,
                message=f"Field '{field_name}' has wrong type: expected {expected_type}, got {type(actual_value).__name__}",
                consumers=contract.get('consumers', [])
            ))
        
        return violations
    
    def _type_matches(self, value: Any, expected_type: str) -> bool:
        """Check if value matches expected type"""
        if expected_type == 'any':
            return True
        
        type_map = {
            'string': str,
            'number': (int, float),
            'boolean': bool,
            'array': list,
            'object': dict,
        }
        
        expected_python_type = type_map.get(expected_type)
        if expected_python_type is None:
            return True  # Unknown type, assume valid
        
        return isinstance(value, expected_python_type)
    
    def _cleanup_post_side_effect(self, contract: Dict, response_data: Dict):
        """Clean up after POST request with side effects"""
        cleanup = contract.get('cleanup', {})
        if not cleanup:
            return
        
        method = cleanup.get('method', 'DELETE')
        path_template = cleanup.get('path_template', '')
        
        # Extract ID from response
        resource_id = response_data.get('id') or response_data.get('task_id') or response_data.get('proposal_id')
        if not resource_id:
            print(f"  Warning: Could not find ID in response for cleanup of {contract['path']}")
            return
        
        # Build cleanup URL
        cleanup_path = path_template.replace('{id}', resource_id)
        cleanup_url = f"{self.base_url}{cleanup_path}"
        
        try:
            if method == 'DELETE':
                self.session.delete(cleanup_url, timeout=self.timeout)
            elif method == 'POST':
                self.session.post(cleanup_url, json={}, timeout=self.timeout)
            print(f"  ✓ Cleaned up: {method} {cleanup_path}")
        except Exception as e:
            print(f"  Warning: Cleanup failed for {cleanup_path}: {e}")
    
    async def test_websocket_endpoint(self, contract: Dict) -> List[ContractViolation]:
        """Test WebSocket endpoint"""
        violations = []
        path = contract['path']
        
        # Build WebSocket URL
        ws_url = self.base_url.replace('http://', 'ws://').replace('https://', 'wss://')
        ws_url = ws_url.replace('3000', '8000')  # WS goes direct to backend
        ws_url = f"{ws_url}{path}"
        
        try:
            async with websockets.connect(ws_url, close_timeout=5) as websocket:
                # Wait for first message (5 second timeout)
                try:
                    message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    data = json.loads(message)
                    
                    # Validate against message_types
                    message_types = contract.get('message_types', [])
                    if message_types:
                        matched = False
                        for msg_type_spec in message_types:
                            if data.get('type') == msg_type_spec.get('type'):
                                matched = True
                                # Validate fields for this message type
                                expected_fields = msg_type_spec.get('expected_fields', {})
                                for field_name, field_spec in expected_fields.items():
                                    violations.extend(self._validate_field(
                                        data, field_name, field_spec, path, 'WS', contract
                                    ))
                                break
                        
                        if not matched:
                            violations.append(ContractViolation(
                                path=path,
                                method='WS',
                                violation_type='ws_message_mismatch',
                                message=f"Message type '{data.get('type')}' not in defined message_types",
                                consumers=contract.get('consumers', [])
                            ))
                
                except asyncio.TimeoutError:
                    violations.append(ContractViolation(
                        path=path,
                        method='WS',
                        violation_type='ws_timeout',
                        message="No message received within 5 seconds",
                        consumers=contract.get('consumers', [])
                    ))
        
        except Exception as e:
            violations.append(ContractViolation(
                path=path,
                method='WS',
                violation_type='ws_connection_failed',
                message=f"WebSocket connection failed: {str(e)}",
                consumers=contract.get('consumers', [])
            ))
        
        return violations
    
    def test_sse_endpoint(self, contract: Dict) -> List[ContractViolation]:
        """Test SSE (Server-Sent Events) endpoint"""
        violations = []
        path = contract['path']
        
        # Build URL
        url = f"{self.base_url}{path}"
        
        try:
            response = self.session.get(url, stream=True, timeout=10)
            
            if not response.ok:
                violations.append(ContractViolation(
                    path=path,
                    method='SSE',
                    violation_type='http_error',
                    message=f"HTTP {response.status_code}: {response.reason}",
                    consumers=contract.get('consumers', [])
                ))
                return violations
            
            # Read first event
            event_received = False
            for line in response.iter_lines(decode_unicode=True):
                if line.startswith('data: '):
                    try:
                        data = json.loads(line[6:])
                        event_received = True
                        
                        # Validate against message_types
                        message_types = contract.get('message_types', [])
                        if message_types:
                            for msg_type_spec in message_types:
                                if data.get('type') == msg_type_spec.get('type'):
                                    expected_fields = msg_type_spec.get('expected_fields', {})
                                    for field_name, field_spec in expected_fields.items():
                                        violations.extend(self._validate_field(
                                            data, field_name, field_spec, path, 'SSE', contract
                                        ))
                                    break
                        
                        break  # Only check first event
                    except json.JSONDecodeError:
                        violations.append(ContractViolation(
                            path=path,
                            method='SSE',
                            violation_type='invalid_json',
                            message="SSE event data is not valid JSON",
                            consumers=contract.get('consumers', [])
                        ))
                        break
            
            if not event_received:
                violations.append(ContractViolation(
                    path=path,
                    method='SSE',
                    violation_type='sse_no_events',
                    message="No SSE events received",
                    consumers=contract.get('consumers', [])
                ))
        
        except Exception as e:
            violations.append(ContractViolation(
                path=path,
                method='SSE',
                violation_type='sse_connection_failed',
                message=f"SSE connection failed: {str(e)}",
                consumers=contract.get('consumers', [])
            ))
        
        return violations


def load_contracts(contracts_path: Path) -> Dict:
    """Load api-contracts.json"""
    try:
        with open(contracts_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading contracts: {e}", file=sys.stderr)
        sys.exit(1)


async def audit_contracts(contracts_path: Path, base_url: str, use_openapi: bool) -> AuditResult:
    """Run full contract audit"""
    start_time = time.time()
    
    print(f"\n{'='*80}")
    print("API CONTRACT AUDIT")
    print(f"{'='*80}\n")
    print(f"Base URL: {base_url}")
    print(f"Contracts: {contracts_path}")
    print(f"OpenAPI validation: {'enabled' if use_openapi else 'disabled'}\n")
    
    # Load contracts
    contracts = load_contracts(contracts_path)
    endpoints = contracts.get('endpoints', [])
    
    print(f"Loaded {len(endpoints)} contract definitions\n")
    
    # Create auditor
    auditor = ContractAuditor(base_url)
    
    # Fetch OpenAPI spec if requested
    if use_openapi:
        auditor.fetch_openapi_spec()
        print()
    
    # Audit each endpoint
    all_violations = []
    passed = 0
    failed = 0
    skipped = 0
    
    for i, contract in enumerate(endpoints, 1):
        path = contract['path']
        method = contract['method']
        protocol = contract.get('protocol', 'http')
        
        # Skip if marked
        if contract.get('skip_in_audit'):
            skipped += 1
            print(f"[{i}/{len(endpoints)}] SKIP {method:6} {path}")
            continue
        
        print(f"[{i}/{len(endpoints)}] TEST {method:6} {path}...", end=' ', flush=True)
        
        violations = []
        
        try:
            # Validate against OpenAPI if available
            if use_openapi and auditor.openapi_spec and protocol == 'http':
                violations.extend(auditor.validate_against_openapi(contract))
            
            # Test live endpoint
            if protocol == 'http':
                violations.extend(auditor.test_http_endpoint(contract))
            elif protocol == 'ws':
                violations.extend(await auditor.test_websocket_endpoint(contract))
            elif protocol == 'sse':
                violations.extend(auditor.test_sse_endpoint(contract))
            
            if violations:
                failed += 1
                print(f"FAIL ({len(violations)} violation(s))")
                for v in violations:
                    print(f"  ❌ {v.violation_type}: {v.message}")
            else:
                passed += 1
                print("✓")
        
        except Exception as e:
            failed += 1
            print(f"ERROR: {str(e)}")
            violations.append(ContractViolation(
                path=path,
                method=method,
                violation_type='unexpected_error',
                message=f"Unexpected error: {str(e)}",
                consumers=contract.get('consumers', [])
            ))
        
        all_violations.extend(violations)
    
    # Calculate score
    total_tested = passed + failed
    score = (passed / total_tested * 100) if total_tested > 0 else 0
    duration = time.time() - start_time
    
    # Build result
    result = AuditResult(
        timestamp=datetime.utcnow().isoformat() + 'Z',
        total_endpoints=len(endpoints),
        passed=passed,
        failed=failed,
        skipped=skipped,
        violations=all_violations,
        score=score,
        duration_seconds=duration
    )
    
    return result


def print_audit_report(result: AuditResult):
    """Print human-readable audit report"""
    print(f"\n{'='*80}")
    print("AUDIT RESULTS")
    print(f"{'='*80}\n")
    
    print(f"📊 SUMMARY")
    print(f"  Total endpoints: {result.total_endpoints}")
    print(f"  Passed:          {result.passed} ✓")
    print(f"  Failed:          {result.failed} ✗")
    print(f"  Skipped:         {result.skipped} ⊝")
    print(f"  Score:           {result.score:.1f}%")
    print(f"  Duration:        {result.duration_seconds:.2f}s")
    
    if result.violations:
        print(f"\n❌ VIOLATIONS ({len(result.violations)})\n")
        
        # Group by violation type
        by_type = {}
        for v in result.violations:
            if v.violation_type not in by_type:
                by_type[v.violation_type] = []
            by_type[v.violation_type].append(v)
        
        for vtype, violations in sorted(by_type.items()):
            print(f"  {vtype} ({len(violations)})")
            for v in violations[:5]:  # Show first 5
                print(f"    • {v.method} {v.path}")
                if v.field:
                    print(f"      Field: {v.field}")
                print(f"      {v.message}")
            if len(violations) > 5:
                print(f"    ... and {len(violations) - 5} more")
            print()
    
    print(f"{'='*80}\n")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Audit API contracts')
    parser.add_argument('--base-url', type=str,
                       default='http://localhost:3000',
                       help='Base URL for console proxy (default: http://localhost:3000)')
    parser.add_argument('--contracts-path', type=Path,
                       default=Path(__file__).parent.parent / 'contracts' / 'api-contracts.json',
                       help='Path to api-contracts.json')
    parser.add_argument('--openapi', action='store_true',
                       help='Validate against OpenAPI spec')
    parser.add_argument('--json-output', type=Path,
                       help='Save results as JSON to specified file')
    
    args = parser.parse_args()
    
    # Validate paths
    if not args.contracts_path.exists():
        print(f"Error: Contracts file not found: {args.contracts_path}", file=sys.stderr)
        sys.exit(1)
    
    # Run audit
    try:
        result = asyncio.run(audit_contracts(args.contracts_path, args.base_url, args.openapi))
    except KeyboardInterrupt:
        print("\n\nAudit interrupted by user")
        sys.exit(130)
    
    # Output results
    if args.json_output:
        output_data = {
            'timestamp': result.timestamp,
            'total_endpoints': result.total_endpoints,
            'passed': result.passed,
            'failed': result.failed,
            'skipped': result.skipped,
            'score': result.score,
            'duration_seconds': result.duration_seconds,
            'violations': [asdict(v) for v in result.violations],
        }
        with open(args.json_output, 'w') as f:
            json.dump(output_data, f, indent=2)
        print(f"\nResults saved to: {args.json_output}")
    else:
        print_audit_report(result)
    
    # Exit with error if any failures
    sys.exit(0 if result.failed == 0 else 1)


if __name__ == '__main__':
    main()

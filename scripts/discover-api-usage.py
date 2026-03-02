#!/usr/bin/env python3
"""
API Usage Discovery Script

Scans the console codebase for fetch(), getAtlasWsUrl(), and EventSource() calls.
Compares discovered endpoints against api-contracts.json to find:
- Uncovered endpoints (used in code but not in contracts)
- Orphaned contracts (in contracts but not used in code)

Usage:
    python scripts/discover-api-usage.py [--console-path PATH] [--contracts-path PATH]
"""

import json
import re
import sys
from pathlib import Path
from typing import Set, Dict, List, Tuple
from dataclasses import dataclass


@dataclass
class DiscoveredEndpoint:
    """Represents an endpoint discovered in the codebase"""
    path: str
    method: str
    file: str
    line: int
    context: str


def extract_url_from_fetch(line: str) -> List[str]:
    """
    Extract URL paths from fetch() calls.
    Matches: fetch("/path"), fetch('/path'), fetch(`/path`), fetch(varName)
    """
    urls = []
    
    # Match string literals (", ', `)
    patterns = [
        r'fetch\s*\(\s*["\']([^"\']+)["\']',  # Single/double quotes
        r'fetch\s*\(\s*`([^`]+)`',             # Template literals
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, line)
        for match in matches:
            # Extract just the path part (remove domain if present)
            path = match.split('?')[0]  # Remove query params for now
            if path.startswith('http'):
                # Extract path from full URL
                path = '/' + '/'.join(path.split('/')[3:])
            urls.append(path)
    
    # Match variable interpolation like ${BACKEND_URL}/path
    var_pattern = r'\$\{[^}]+\}(/[^\s"\'\`]+)'
    var_matches = re.findall(var_pattern, line)
    urls.extend(var_matches)
    
    return urls


def extract_url_from_ws(line: str) -> List[str]:
    """
    Extract URL paths from getAtlasWsUrl() calls.
    Matches: getAtlasWsUrl("/path"), getAtlasWsUrl('/path')
    """
    patterns = [
        r'getAtlasWsUrl\s*\(\s*["\']([^"\']+)["\']',
    ]
    
    urls = []
    for pattern in patterns:
        matches = re.findall(pattern, line)
        urls.extend(matches)
    
    return urls


def extract_url_from_sse(line: str) -> List[str]:
    """
    Extract URL paths from EventSource() calls.
    Matches: new EventSource("/path"), new EventSource('/path')
    """
    patterns = [
        r'new\s+EventSource\s*\(\s*["\']([^"\']+)["\']',
    ]
    
    urls = []
    for pattern in patterns:
        matches = re.findall(pattern, line)
        urls.extend(matches)
    
    return urls


def normalize_path(path: str) -> str:
    """
    Normalize a path for comparison.
    - Remove trailing slashes
    - Convert template variables ${var} to {var}
    - Handle dynamic path segments
    """
    path = path.rstrip('/')
    
    # Convert ${var} to {var}
    path = re.sub(r'\$\{([^}]+)\}', r'{\1}', path)
    
    # Detect dynamic segments like /api/tasks/123 -> /api/tasks/{id}
    # (This is heuristic-based and may need refinement)
    
    return path


def scan_file(file_path: Path) -> List[DiscoveredEndpoint]:
    """Scan a single file for API calls"""
    endpoints = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except Exception as e:
        print(f"Warning: Could not read {file_path}: {e}", file=sys.stderr)
        return endpoints
    
    for line_num, line in enumerate(lines, start=1):
        # Check for fetch() calls
        fetch_urls = extract_url_from_fetch(line)
        for url in fetch_urls:
            # Try to determine method from context
            method = 'GET'
            if 'method:' in line or 'method :' in line:
                if 'POST' in line.upper():
                    method = 'POST'
                elif 'PUT' in line.upper():
                    method = 'PUT'
                elif 'PATCH' in line.upper():
                    method = 'PATCH'
                elif 'DELETE' in line.upper():
                    method = 'DELETE'
            
            endpoints.append(DiscoveredEndpoint(
                path=normalize_path(url),
                method=method,
                file=str(file_path.relative_to(file_path.parents[2])),
                line=line_num,
                context=line.strip()[:80]
            ))
        
        # Check for WebSocket calls
        ws_urls = extract_url_from_ws(line)
        for url in ws_urls:
            endpoints.append(DiscoveredEndpoint(
                path=normalize_path(url),
                method='GET',
                file=str(file_path.relative_to(file_path.parents[2])),
                line=line_num,
                context=line.strip()[:80]
            ))
        
        # Check for SSE calls
        sse_urls = extract_url_from_sse(line)
        for url in sse_urls:
            endpoints.append(DiscoveredEndpoint(
                path=normalize_path(url),
                method='GET',
                file=str(file_path.relative_to(file_path.parents[2])),
                line=line_num,
                context=line.strip()[:80]
            ))
    
    return endpoints


def scan_codebase(console_path: Path) -> List[DiscoveredEndpoint]:
    """Scan entire console codebase for API calls"""
    print(f"Scanning codebase at: {console_path}")
    
    # File patterns to scan
    patterns = [
        '**/*.tsx',
        '**/*.ts',
        '**/*.jsx',
        '**/*.js',
    ]
    
    all_endpoints = []
    file_count = 0
    
    for pattern in patterns:
        for file_path in console_path.rglob(pattern):
            # Skip node_modules and .next directories
            if 'node_modules' in str(file_path) or '.next' in str(file_path):
                continue
            
            endpoints = scan_file(file_path)
            all_endpoints.extend(endpoints)
            if endpoints:
                file_count += 1
    
    print(f"Scanned {file_count} files, found {len(all_endpoints)} API call sites")
    return all_endpoints


def load_contracts(contracts_path: Path) -> Dict:
    """Load api-contracts.json"""
    print(f"Loading contracts from: {contracts_path}")
    
    try:
        with open(contracts_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading contracts: {e}", file=sys.stderr)
        sys.exit(1)


def extract_contract_paths(contracts: Dict) -> Set[Tuple[str, str]]:
    """Extract (path, method) tuples from contracts"""
    paths = set()
    for endpoint in contracts.get('endpoints', []):
        path = endpoint['path']
        method = endpoint['method']
        paths.add((normalize_path(path), method))
    return paths


def find_uncovered_endpoints(discovered: List[DiscoveredEndpoint], 
                            contract_paths: Set[Tuple[str, str]]) -> List[DiscoveredEndpoint]:
    """Find endpoints used in code but not in contracts"""
    uncovered = []
    
    for endpoint in discovered:
        # Check if this path+method exists in contracts
        key = (endpoint.path, endpoint.method)
        
        # Also check if path exists with any method (some contracts may not specify method)
        path_exists = any(path == endpoint.path for path, _ in contract_paths)
        
        if key not in contract_paths and not path_exists:
            uncovered.append(endpoint)
    
    return uncovered


def find_orphaned_contracts(discovered: List[DiscoveredEndpoint],
                           contracts: Dict) -> List[Dict]:
    """Find contracts that are not used in the codebase"""
    # Build set of discovered paths
    discovered_paths = set()
    for endpoint in discovered:
        discovered_paths.add(endpoint.path)
    
    orphaned = []
    for contract in contracts.get('endpoints', []):
        path = normalize_path(contract['path'])
        
        # Check if this contract path appears in discovered endpoints
        if path not in discovered_paths:
            orphaned.append(contract)
    
    return orphaned


def print_report(uncovered: List[DiscoveredEndpoint], 
                orphaned: List[Dict],
                discovered: List[DiscoveredEndpoint],
                contracts: Dict):
    """Print comprehensive discovery report"""
    print("\n" + "="*80)
    print("API CONTRACT DISCOVERY REPORT")
    print("="*80)
    
    print(f"\n📊 SUMMARY")
    print(f"  Total endpoints discovered in code: {len(discovered)}")
    print(f"  Total contracts defined:            {len(contracts.get('endpoints', []))}")
    print(f"  Unique discovered paths:            {len(set(e.path for e in discovered))}")
    print(f"  Uncovered endpoints:                {len(uncovered)}")
    print(f"  Orphaned contracts:                 {len(orphaned)}")
    
    if uncovered:
        print(f"\n❌ UNCOVERED ENDPOINTS ({len(uncovered)})")
        print("These endpoints are used in code but not defined in api-contracts.json:\n")
        
        # Group by path
        by_path = {}
        for endpoint in uncovered:
            if endpoint.path not in by_path:
                by_path[endpoint.path] = []
            by_path[endpoint.path].append(endpoint)
        
        for path, endpoints in sorted(by_path.items()):
            print(f"  {path}")
            for e in endpoints[:3]:  # Show first 3 usages
                print(f"    └─ {e.file}:{e.line} ({e.method})")
            if len(endpoints) > 3:
                print(f"    └─ ... and {len(endpoints) - 3} more usage(s)")
            print()
    
    if orphaned:
        print(f"\n⚠️  ORPHANED CONTRACTS ({len(orphaned)})")
        print("These contracts are defined but not found in the codebase:\n")
        
        for contract in orphaned:
            consumers = ', '.join(contract.get('consumers', ['unknown']))
            print(f"  {contract['method']} {contract['path']}")
            print(f"    └─ Defined consumers: {consumers}")
            print()
    
    # Coverage statistics
    total_contracts = len(contracts.get('endpoints', []))
    covered_contracts = total_contracts - len(orphaned)
    coverage = (covered_contracts / total_contracts * 100) if total_contracts > 0 else 0
    
    print(f"\n📈 COVERAGE")
    print(f"  Contract coverage: {coverage:.1f}% ({covered_contracts}/{total_contracts})")
    
    if uncovered:
        print(f"\n💡 NEXT STEPS")
        print(f"  1. Add contract definitions for {len(uncovered)} uncovered endpoints")
        print(f"  2. Run: python scripts/audit-api-contracts.py")
    
    if orphaned:
        print(f"\n💡 ORPHANED CONTRACTS")
        print(f"  - Review {len(orphaned)} orphaned contracts")
        print(f"  - Remove if no longer used, or update consumer references")
    
    print("\n" + "="*80)


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Discover API usage in console codebase')
    parser.add_argument('--console-path', type=Path, 
                       default=Path(__file__).parent.parent,
                       help='Path to console directory')
    parser.add_argument('--contracts-path', type=Path,
                       default=Path(__file__).parent.parent / 'contracts' / 'api-contracts.json',
                       help='Path to api-contracts.json')
    parser.add_argument('--json', action='store_true',
                       help='Output results as JSON')
    
    args = parser.parse_args()
    
    # Validate paths
    if not args.console_path.exists():
        print(f"Error: Console path does not exist: {args.console_path}", file=sys.stderr)
        sys.exit(1)
    
    if not args.contracts_path.exists():
        print(f"Error: Contracts file does not exist: {args.contracts_path}", file=sys.stderr)
        sys.exit(1)
    
    # Scan codebase
    discovered = scan_codebase(args.console_path)
    
    # Load contracts
    contracts = load_contracts(args.contracts_path)
    contract_paths = extract_contract_paths(contracts)
    
    # Find discrepancies
    uncovered = find_uncovered_endpoints(discovered, contract_paths)
    orphaned = find_orphaned_contracts(discovered, contracts)
    
    # Output report
    if args.json:
        result = {
            'summary': {
                'total_discovered': len(discovered),
                'total_contracts': len(contracts.get('endpoints', [])),
                'uncovered_count': len(uncovered),
                'orphaned_count': len(orphaned),
            },
            'uncovered': [
                {
                    'path': e.path,
                    'method': e.method,
                    'file': e.file,
                    'line': e.line,
                }
                for e in uncovered
            ],
            'orphaned': orphaned,
        }
        print(json.dumps(result, indent=2))
    else:
        print_report(uncovered, orphaned, discovered, contracts)
    
    # Exit with error code if there are issues
    if uncovered or orphaned:
        sys.exit(1)
    else:
        print("\n✅ All endpoints are covered by contracts!")
        sys.exit(0)


if __name__ == '__main__':
    main()

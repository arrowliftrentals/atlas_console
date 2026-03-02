/**
 * Intelligent test output parser - extracts key failure information
 */

export interface ParsedTestFailure {
  type: 'import_error' | 'syntax_error' | 'test_failure' | 'unknown';
  summary: string;
  details: string[];
  affectedFiles: string[];
  errorMessages: string[];
}

export function parseTestOutput(output: string): ParsedTestFailure {
  const lines = output.split('\n');
  
  // Check for import errors (most common failure mode)
  const importErrorMatch = output.match(/ModuleNotFoundError: No module named '([^']+)'/);
  if (importErrorMatch) {
    const missingModule = importErrorMatch[1];
    const affectedFiles = extractAffectedFiles(output, /ImportError|ModuleNotFoundError/);
    
    return {
      type: 'import_error',
      summary: `Missing Python module: ${missingModule}`,
      details: [
        `Tests failed to import required module: ${missingModule}`,
        `This typically means a dependency is not installed in the sandbox environment`,
        affectedFiles.length > 0 ? `Affects: ${affectedFiles.join(', ')}` : ''
      ].filter(Boolean),
      affectedFiles,
      errorMessages: [`ModuleNotFoundError: No module named '${missingModule}'`]
    };
  }
  
  // Check for syntax errors
  const syntaxErrorMatch = output.match(/SyntaxError: (.+)/);
  if (syntaxErrorMatch) {
    const errorMsg = syntaxErrorMatch[1];
    const affectedFiles = extractAffectedFiles(output, /SyntaxError/);
    const fileContext = extractFileContext(output, /File "([^"]+)", line (\d+)/);
    
    return {
      type: 'syntax_error',
      summary: `Syntax error in generated code`,
      details: [
        `Python syntax error: ${errorMsg}`,
        fileContext ? `Location: ${fileContext.file}:${fileContext.line}` : '',
        'The fix generator produced invalid Python syntax'
      ].filter(Boolean),
      affectedFiles,
      errorMessages: [syntaxErrorMatch[0]]
    };
  }
  
  // Check for test collection errors (import issues during test discovery)
  const collectionErrors = output.match(/(\d+) errors? during collection/);
  if (collectionErrors) {
    const errorCount = collectionErrors[1];
    const errorSections = extractErrorSections(output);
    const affectedFiles = errorSections.map(s => s.file).filter(Boolean);
    
    return {
      type: 'import_error',
      summary: `${errorCount} test collection error${errorCount !== '1' ? 's' : ''} - tests couldn't load`,
      details: [
        `${errorCount} test file${errorCount !== '1' ? 's' : ''} failed to import`,
        ...errorSections.slice(0, 3).map(s => 
          s.file ? `• ${s.file}: ${s.error.split('\n')[0]}` : ''
        ).filter(Boolean),
        errorSections.length > 3 ? `... and ${errorSections.length - 3} more` : ''
      ].filter(Boolean),
      affectedFiles,
      errorMessages: errorSections.slice(0, 3).map(s => s.error)
    };
  }
  
  // Check for actual test failures (tests ran but failed)
  const failureMatch = output.match(/(\d+) failed.*?(\d+) passed/);
  if (failureMatch) {
    const [_, failed, passed] = failureMatch;
    const failedTests = extractFailedTests(output);
    
    return {
      type: 'test_failure',
      summary: `${failed} test${failed !== '1' ? 's' : ''} failed (${passed} passed)`,
      details: [
        `Tests ran successfully but ${failed} assertion${failed !== '1' ? 's' : ''} failed`,
        ...failedTests.slice(0, 5).map(t => `• ${t.name}: ${t.error.split('\n')[0]}`),
        failedTests.length > 5 ? `... and ${failedTests.length - 5} more failures` : ''
      ].filter(Boolean),
      affectedFiles: failedTests.map(t => t.file).filter(Boolean),
      errorMessages: failedTests.slice(0, 3).map(t => t.error)
    };
  }
  
  // Fallback - couldn't parse specific error
  return {
    type: 'unknown',
    summary: 'Test execution failed',
    details: [
      'Could not parse specific failure mode from test output',
      'See full output below for details'
    ],
    affectedFiles: [],
    errorMessages: []
  };
}

function extractAffectedFiles(output: string, pattern: RegExp): string[] {
  const files = new Set<string>();
  const filePattern = /File "([^"]+)"/g;
  
  // Find all file references near the error pattern
  const lines = output.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      // Look backwards for file references
      for (let j = Math.max(0, i - 10); j <= i; j++) {
        const match = filePattern.exec(lines[j]);
        if (match) {
          const file = match[1];
          // Only include project files, not stdlib
          if (!file.startsWith('/usr/') && !file.startsWith('/Library/')) {
            files.add(file);
          }
        }
      }
    }
  }
  
  return Array.from(files);
}

function extractFileContext(output: string, pattern: RegExp): { file: string; line: string } | null {
  const match = pattern.exec(output);
  if (match) {
    return { file: match[1], line: match[2] };
  }
  return null;
}

function extractErrorSections(output: string): Array<{ file: string; error: string }> {
  const sections: Array<{ file: string; error: string }> = [];
  const errorPattern = /ERROR collecting (.+?)\n([\s\S]+?)(?=\n(?:ERROR|___|===)|$)/g;
  
  let match;
  while ((match = errorPattern.exec(output)) !== null) {
    const file = match[1];
    const errorText = match[2].trim();
    
    // Extract the actual error message (usually after "E   ")
    const errorLines = errorText.split('\n')
      .filter(line => line.startsWith('E   ') || line.includes('Error'))
      .map(line => line.replace(/^E   /, '').trim())
      .slice(0, 2); // First 2 lines of error
    
    sections.push({
      file,
      error: errorLines.join('\n') || errorText.slice(0, 200)
    });
  }
  
  return sections;
}

function extractFailedTests(output: string): Array<{ name: string; file: string; error: string }> {
  const tests: Array<{ name: string; file: string; error: string }> = [];
  const failPattern = /FAILED (.+?) - (.+?)(?=\n(?:FAILED|PASSED|===)|$)/g;
  
  let match;
  while ((match = failPattern.exec(output)) !== null) {
    const testName = match[1];
    const error = match[2].trim();
    const file = testName.split('::')[0] || '';
    
    tests.push({
      name: testName,
      file,
      error: error.slice(0, 200) // Limit error length
    });
  }
  
  return tests;
}

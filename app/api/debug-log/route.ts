import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { logs } = await request.json();
    
    const logDir = path.join(process.cwd(), 'debug_logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logFile = path.join(logDir, 'browser_console.log');
    const logContent = logs.join('\n') + '\n';
    
    fs.appendFileSync(logFile, logContent);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to write debug logs:', error);
    return NextResponse.json({ error: 'Failed to write logs' }, { status: 500 });
  }
}

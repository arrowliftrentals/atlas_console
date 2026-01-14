import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const logs = await request.json();
    const logFile = path.join(process.cwd(), 'client-debug.log');
    
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${JSON.stringify(logs)}\n`;
    
    fs.appendFileSync(logFile, logEntry);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to log' }, { status: 500 });
  }
}

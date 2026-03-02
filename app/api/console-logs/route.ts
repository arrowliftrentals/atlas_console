import { NextResponse } from 'next/server';
import { writeFile, appendFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'console-logs.txt');

// Ensure logs directory exists
async function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    await mkdir(LOG_DIR, { recursive: true });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { level, message, timestamp } = body;
    
    await ensureLogDir();
    
    const logEntry = `[${new Date(timestamp).toISOString()}] [${level.toUpperCase()}] ${message}\n`;
    
    // Append to log file
    await appendFile(LOG_FILE, logEntry);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to write log:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function GET() {
  try {
    await ensureLogDir();
    
    // Check if log file exists
    if (!existsSync(LOG_FILE)) {
      return NextResponse.json({ 
        logs: [], 
        message: 'No logs yet. Send a chat message or click Test Particle button.' 
      });
    }
    
    const logs = await readFile(LOG_FILE, 'utf-8');
    
    // Get last 100 lines as array
    const lines = logs.split('\n').slice(-100).filter(line => line.trim());
    
    return NextResponse.json({ logs: lines });
  } catch (error) {
    return NextResponse.json({ 
      logs: [], 
      error: String(error) 
    }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await ensureLogDir();
    
    if (existsSync(LOG_FILE)) {
      await writeFile(LOG_FILE, '');
    }
    
    return NextResponse.json({ success: true, message: 'Logs cleared' });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: String(error) 
    }, { status: 500 });
  }
}

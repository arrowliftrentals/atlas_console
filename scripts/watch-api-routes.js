#!/usr/bin/env node

/**
 * API Route Watcher - Detects when new API routes are added
 * and notifies user to restart Next.js dev server.
 * 
 * Next.js dynamic routes with [brackets] require server restart
 * to be recognized.
 */

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

const API_DIR = path.join(__dirname, '../app/api');
const LOCK_FILE = path.join(__dirname, '../.api-routes.lock');

// Track known routes
let knownRoutes = new Set();

function loadKnownRoutes() {
  if (fs.existsSync(LOCK_FILE)) {
    const data = fs.readFileSync(LOCK_FILE, 'utf8');
    knownRoutes = new Set(JSON.parse(data));
  }
}

function saveKnownRoutes() {
  fs.writeFileSync(LOCK_FILE, JSON.stringify([...knownRoutes], null, 2));
}

function scanRoutes() {
  const routes = [];
  
  function scan(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
        const relativePath = path.relative(API_DIR, fullPath);
        routes.push(relativePath);
      }
    }
  }
  
  scan(API_DIR);
  return routes;
}

function checkForNewRoutes() {
  const currentRoutes = scanRoutes();
  const newRoutes = currentRoutes.filter(r => !knownRoutes.has(r));
  
  if (newRoutes.length > 0) {
    console.log('\n⚠️  NEW API ROUTES DETECTED:');
    newRoutes.forEach(route => {
      console.log(`   📁 ${route}`);
      knownRoutes.add(route);
    });
    console.log('\n🔄 RESTART REQUIRED: Run `npm run dev` again to recognize new routes.\n');
    
    saveKnownRoutes();
  }
}

// Initial scan
loadKnownRoutes();
const initialRoutes = scanRoutes();
initialRoutes.forEach(r => knownRoutes.add(r));
saveKnownRoutes();

console.log('🔍 Watching for new API routes...');

// Watch for new route files
const watcher = chokidar.watch(`${API_DIR}/**/route.{ts,js}`, {
  ignored: /node_modules/,
  persistent: true,
  ignoreInitial: true
});

watcher
  .on('add', (filePath) => {
    const relativePath = path.relative(API_DIR, filePath);
    if (!knownRoutes.has(relativePath)) {
      knownRoutes.add(relativePath);
      saveKnownRoutes();
      
      console.log(`\n⚠️  NEW API ROUTE: ${relativePath}`);
      console.log('🔄 RESTART REQUIRED: Stop and restart `npm run dev`\n');
    }
  });

// Check periodically in case file was added while watcher wasn't running
setInterval(checkForNewRoutes, 5000);

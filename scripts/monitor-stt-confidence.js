#!/usr/bin/env node

/**
 * Monitor STT Confidence Values
 * 
 * This script helps diagnose echo issues by monitoring confidence scores
 * from the browser console logs.
 * 
 * Usage:
 * 1. Start the console: npm run dev
 * 2. Open browser DevTools Console
 * 3. Copy/paste this into console, or use as reference
 */

// In-browser monitoring code
const monitorSTTConfidence = () => {
  const confidenceHistory = [];
  let isAtlasSpeaking = false;
  
  // Intercept console.log to capture STT logs
  const originalLog = console.log;
  console.log = function(...args) {
    originalLog.apply(console, args);
    
    const message = args.join(' ');
    
    // Detect ATLAS speaking state
    if (message.includes('ATLAS speaking')) {
      isAtlasSpeaking = true;
      console.warn('📊 MONITORING: ATLAS started speaking - tracking confidence values...');
    } else if (message.includes('ATLAS finished')) {
      isAtlasSpeaking = false;
      console.warn('📊 MONITORING: ATLAS finished - analyzing confidence data...');
      analyzeConfidence();
    }
    
    // Capture confidence values from STT logs
    if (message.includes('[STT]') && message.includes('confidence:')) {
      const match = message.match(/confidence:\s*([\d.]+)/);
      if (match) {
        const confidence = parseFloat(match[1]);
        const isFiltered = message.includes('Filtering echo');
        
        confidenceHistory.push({
          timestamp: Date.now(),
          confidence,
          text: args[2] || '',
          atlasSpeaking: isAtlasSpeaking,
          filtered: isFiltered,
        });
        
        if (isAtlasSpeaking) {
          const symbol = confidence >= 0.7 ? '⚠️' : '✅';
          console.warn(`${symbol} Confidence while ATLAS speaking: ${confidence.toFixed(2)}`);
        }
      }
    }
  };
  
  function analyzeConfidence() {
    const duringAtlas = confidenceHistory.filter(h => h.atlasSpeaking);
    
    if (duringAtlas.length === 0) {
      console.warn('📊 No confidence data captured during ATLAS speech');
      return;
    }
    
    const avgConfidence = duringAtlas.reduce((sum, h) => sum + h.confidence, 0) / duringAtlas.length;
    const maxConfidence = Math.max(...duringAtlas.map(h => h.confidence));
    const minConfidence = Math.min(...duringAtlas.map(h => h.confidence));
    const highConfidenceCount = duringAtlas.filter(h => h.confidence >= 0.7).length;
    const filteredCount = duringAtlas.filter(h => h.filtered).length;
    
    console.warn('\n📊 ====== CONFIDENCE ANALYSIS ======');
    console.warn(`Total transcripts during ATLAS speech: ${duringAtlas.length}`);
    console.warn(`Average confidence: ${avgConfidence.toFixed(2)}`);
    console.warn(`Min confidence: ${minConfidence.toFixed(2)}`);
    console.warn(`Max confidence: ${maxConfidence.toFixed(2)}`);
    console.warn(`High confidence (≥0.7): ${highConfidenceCount} (${(highConfidenceCount/duringAtlas.length*100).toFixed(1)}%)`);
    console.warn(`Filtered by threshold: ${filteredCount} (${(filteredCount/duringAtlas.length*100).toFixed(1)}%)`);
    
    if (highConfidenceCount > duringAtlas.length * 0.3) {
      console.error('⚠️ HIGH CONFIDENCE ECHO DETECTED!');
      console.error('📢 RECOMMENDATION: Use headphones or lower speaker volume');
      console.error(`   ${(highConfidenceCount/duringAtlas.length*100).toFixed(0)}% of echo has confidence ≥0.7`);
    } else if (avgConfidence < 0.5) {
      console.warn('✅ Echo has low confidence - filtering should work');
      console.warn('📢 Current 0.7 threshold is effective');
    } else {
      console.warn('⚠️ Echo has moderate confidence');
      console.warn(`📢 Consider lowering threshold to ${(avgConfidence - 0.1).toFixed(1)} or using headphones`);
    }
    
    console.warn('\n📋 Recent transcripts during ATLAS speech:');
    duringAtlas.slice(-5).forEach(h => {
      const status = h.filtered ? '🚫 Filtered' : h.confidence >= 0.7 ? '⚠️ Passed' : '✅ Passed';
      console.warn(`  ${status} | Confidence: ${h.confidence.toFixed(2)} | Text: "${h.text}"`);
    });
    console.warn('===================================\n');
  }
  
  console.warn('📊 STT Confidence Monitor Started');
  console.warn('📢 Speak while ATLAS is talking to test echo filtering');
  console.warn('📢 Analysis will show after ATLAS finishes speaking');
  
  return {
    getHistory: () => confidenceHistory,
    analyze: analyzeConfidence,
    reset: () => { confidenceHistory.length = 0; },
  };
};

// Export for use in browser console
if (typeof window !== 'undefined') {
  window.monitorSTT = monitorSTTConfidence;
  console.log('📊 Run: window.monitorSTT() to start monitoring');
}

// For Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { monitorSTTConfidence };
}

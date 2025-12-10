'use client';

import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Clock } from 'lucide-react';

interface Span {
  component_id: string;
  start_time: string;
}

interface Trace {
  trace_id: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  spans: Span[];
  status: string;
}

interface TimelineProps {
  onTraceSelect?: (trace: Trace) => void;
  onPlaybackSpeed?: (speed: number) => void;
}

export default function Timeline({ onTraceSelect, onPlaybackSpeed }: TimelineProps) {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeRange, setTimeRange] = useState<{ start: Date; end: Date } | null>(null);

  useEffect(() => {
    fetchTraces();
    const interval = setInterval(fetchTraces, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchTraces = async () => {
    try {
      const response = await fetch('http://localhost:8000/v1/telemetry/traces/recent?limit=100');
      if (response.ok) {
        const data = await response.json();
        const traceData = data.traces || [];
        setTraces(traceData);
        
        if (traceData.length > 0) {
          const times = traceData.map((t: Trace) => new Date(t.start_time).getTime());
          setTimeRange({
            start: new Date(Math.min(...times)),
            end: new Date(Math.max(...times)),
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch traces:', error);
    }
  };

  useEffect(() => {
    if (!isPlaying || traces.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => {
        const next = prev + 1;
        if (next >= traces.length) {
          setIsPlaying(false);
          return prev;
        }
        
        const trace = traces[next];
        if (trace) {
          setSelectedTrace(trace);
          // Defer callback to avoid setState during render
          setTimeout(() => onTraceSelect?.(trace), 0);
        }
        return next;
      });
    }, 1000 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, traces, onTraceSelect]);

  const handlePlay = () => {
    if (traces.length === 0) return;
    
    if (currentIndex >= traces.length - 1) {
      setCurrentIndex(0);
      setSelectedTrace(traces[0]);
      // Defer callback to avoid setState during render
      setTimeout(() => onTraceSelect?.(traces[0]), 0);
    }
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
    setSelectedTrace(null);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    onPlaybackSpeed?.(speed);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value);
    setCurrentIndex(index);
    if (traces[index]) {
      setSelectedTrace(traces[index]);
      // Defer callback to avoid setState during render
      setTimeout(() => onTraceSelect?.(traces[index]), 0);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getComponentPath = (trace: Trace): string[] => {
    if (!trace.spans || trace.spans.length === 0) return [];
    const sorted = [...trace.spans].sort((a, b) => 
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
    return sorted.map(s => s.component_id);
  };

  return (
    <div className="bg-[#252526] border-t border-gray-700 p-3 relative z-50">
      <div className="flex items-center gap-4">
        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="p-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            title="Reset"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          
          {isPlaying ? (
            <button
              onClick={handlePause}
              className="p-2 rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              title="Pause"
            >
              <Pause className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handlePlay}
              className="p-2 rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              title="Play"
              disabled={traces.length === 0}
            >
              <Play className="w-4 h-4" />
            </button>
          )}
          
          <button
            onClick={() => setCurrentIndex(Math.min(currentIndex + 1, traces.length - 1))}
            className="p-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            title="Next"
            disabled={currentIndex >= traces.length - 1}
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Speed Control */}
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-400">Speed:</span>
          {[0.5, 1, 2, 5, 10].map(speed => (
            <button
              key={speed}
              onClick={() => handleSpeedChange(speed)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                playbackSpeed === speed
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Timeline Slider */}
        <div className="flex-1 flex items-center gap-3">
          <input
            type="range"
            min="0"
            max={Math.max(0, traces.length - 1)}
            value={currentIndex}
            onChange={handleSliderChange}
            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            disabled={traces.length === 0}
          />
          <span className="text-xs text-gray-400 font-mono min-w-[100px]">
            {currentIndex + 1} / {traces.length}
          </span>
        </div>

        {/* Current Trace Info */}
        {selectedTrace && (
          <div className="flex items-center gap-3 px-3 py-1 bg-[#1E1E1E] rounded border border-gray-700">
            <div className="text-xs">
              <span className="text-gray-400">Time:</span>{' '}
              <span className="text-white font-mono">{formatTime(selectedTrace.start_time)}</span>
            </div>
            <div className="text-xs">
              <span className="text-gray-400">Duration:</span>{' '}
              <span className={`font-mono ${
                selectedTrace.duration_ms > 1000 ? 'text-red-400' :
                selectedTrace.duration_ms > 500 ? 'text-yellow-400' :
                'text-green-400'
              }`}>
                {formatDuration(selectedTrace.duration_ms)}
              </span>
            </div>
            <div className="text-xs">
              <span className="text-gray-400">Path:</span>{' '}
              <span className="text-blue-400 font-mono">
                {getComponentPath(selectedTrace).join(' → ') || 'N/A'}
              </span>
            </div>
            <div className="text-xs">
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                selectedTrace.status === 'ok' ? 'bg-green-500/20 text-green-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {selectedTrace.status.toUpperCase()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Time Range Display */}
      {timeRange && (
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span>{formatTime(timeRange.start.toISOString())}</span>
          <span>Historical Traces (Last 100)</span>
          <span>{formatTime(timeRange.end.toISOString())}</span>
        </div>
      )}
    </div>
  );
}

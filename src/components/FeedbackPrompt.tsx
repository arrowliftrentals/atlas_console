
import React, { useState } from "react";

interface FeedbackPromptProps {
  query: string;
  predictedIntent: string;
  confidence: number;
  message: string;
  sessionId?: string;
  onFeedbackSubmitted?: () => void;
}

const INTENT_OPTIONS = [
  { value: "ui_interaction", label: "UI Interaction (open, click, type)" },
  { value: "file_operation", label: "File Operation (read, write, delete)" },
  { value: "device_management", label: "Device Management (connect, control)" },
  { value: "self_improvement", label: "Self Improvement (learn, improve)" },
  { value: "system_query", label: "System Query (status, info)" },
  { value: "conversation", label: "Conversation (chat, discuss)" },
];

export default function FeedbackPrompt({
  query,
  predictedIntent,
  confidence,
  message,
  sessionId,
  onFeedbackSubmitted,
}: FeedbackPromptProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [selectedIntent, setSelectedIntent] = useState<string>(predictedIntent);

  const handleConfirm = async () => {
    // User confirms prediction is correct
    await submitFeedback(predictedIntent);
  };

  const handleCorrect = () => {
    // Show correction interface
    setShowCorrection(true);
  };

  const handleSubmitCorrection = async () => {
    // User corrects to different intent
    if (selectedIntent === predictedIntent) {
      // Same as prediction, just confirm
      await submitFeedback(predictedIntent);
    } else {
      await submitFeedback(selectedIntent);
    }
  };

  const submitFeedback = async (correctIntent: string) => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/learning/corrections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          predicted_intent: predictedIntent,
          correct_intent: correctIntent,
          confidence,
          session_id: sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit feedback");
      }

      const data = await response.json();
      console.log("Feedback submitted:", data);

      setSubmitted(true);
      onFeedbackSubmitted?.();
    } catch (err) {
      console.error("Error submitting feedback:", err);
      setError("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-green-900/20 border border-green-700 rounded-lg px-3 py-2 mt-2">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span className="text-xs text-green-300">
            Thank you! Your feedback helps ATLAS learn.
          </span>
        </div>
      </div>
    );
  }

  if (showCorrection) {
    return (
      <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg px-3 py-2 mt-2">
        <div className="text-xs text-yellow-300 mb-2">
          What should the correct intent be?
        </div>
        <select
          value={selectedIntent}
          onChange={(e) => setSelectedIntent(e.target.value)}
          className="w-full bg-[#1e1e1e] border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 mb-2"
          disabled={submitting}
        >
          {INTENT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <div className="text-xs text-red-400 mb-2">{error}</div>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleSubmitCorrection}
            disabled={submitting}
            className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs px-3 py-1 rounded transition-colors disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
          <button
            onClick={() => setShowCorrection(false)}
            disabled={submitting}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-900/20 border border-blue-700 rounded-lg px-3 py-2 mt-2">
      <div className="flex items-start gap-2 mb-2">
        <svg
          className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="flex-1">
          <div className="text-xs text-blue-300 mb-1">{message}</div>
          <div className="text-xs text-gray-400">
            Confidence: {(confidence * 100).toFixed(0)}%
          </div>
        </div>
      </div>
      {error && <div className="text-xs text-red-400 mb-2">{error}</div>}
      <div className="flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={submitting}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          {submitting ? "..." : "Yes"}
        </button>
        <button
          onClick={handleCorrect}
          disabled={submitting}
          className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs px-3 py-1 rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          {submitting ? "..." : "No, correct it"}
        </button>
      </div>
    </div>
  );
}

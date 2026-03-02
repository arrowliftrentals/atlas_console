
import React, { useEffect, useState } from "react";
import TabHeader from "./TabHeader";
import { useHealth } from "@/contexts/HealthContext";

interface SecurityFinding {
  id: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  location?: string;
  recommendation: string;
  cwe_id?: string;
  owasp_category?: string;
  detected_at: string;
  is_remediated: boolean;
}

interface ComplianceCheck {
  standard: string;
  requirement: string;
  status: "compliant" | "non_compliant" | "partial" | "not_applicable";
  details: string;
  priority: string;
}

interface SecurityScanResult {
  scan_id: string;
  scan_time: string;
  scan_duration_seconds: number;
  total_findings: number;
  findings_by_severity: Record<string, number>;
  findings_by_category: Record<string, number>;
  findings: SecurityFinding[];
  compliance_status: {
    checks: Record<string, ComplianceCheck[]>;
    summary: {
      total_checks: number;
      compliant: number;
      partial: number;
      non_compliant: number;
    };
  };
  overall_score: number;
  next_scan_recommended: string;
}

const SecurityView: React.FC = () => {
  const { health } = useHealth();
  const [scanResult, setScanResult] = useState<SecurityScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"findings" | "compliance">("findings");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);

  const fetchSecurityScan = async (forceRefresh = false) => {
    if (forceRefresh) setScanning(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/v1/security/scan?force_refresh=${forceRefresh}`
      );
      if (!res.ok) throw new Error("Failed to fetch security scan");

      const data = await res.json();

      if (data.status === "scan_in_progress") {
        // Poll for completion
        setTimeout(() => fetchSecurityScan(false), 2000);
        return;
      }

      setScanResult(data.result);
    } catch (e) {
      console.error("Security scan error:", e);
      setError(e instanceof Error ? e.message : "Failed to load security data");
    } finally {
      setLoading(false);
      setScanning(false);
    }
  };

  useEffect(() => {
    fetchSecurityScan();
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => fetchSecurityScan(false), 300000);
    return () => clearInterval(interval);
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-red-400";
      case "high":
        return "text-orange-400";
      case "medium":
        return "text-yellow-400";
      case "low":
        return "text-blue-400";
      default:
        return "text-gray-400";
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/20";
      case "high":
        return "bg-orange-500/20";
      case "medium":
        return "bg-yellow-500/20";
      case "low":
        return "bg-blue-500/20";
      default:
        return "bg-gray-500/20";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  };

  const getComplianceStatusColor = (status: string) => {
    switch (status) {
      case "compliant":
        return "text-green-400 bg-green-500/20";
      case "partial":
        return "text-yellow-400 bg-yellow-500/20";
      case "non_compliant":
        return "text-red-400 bg-red-500/20";
      default:
        return "text-gray-400 bg-gray-500/20";
    }
  };

  const categories = scanResult?.findings
    ? [...new Set(scanResult.findings.map((f) => f.category))]
    : [];

  const filteredFindings =
    scanResult?.findings?.filter((f) => {
      if (severityFilter !== "all" && f.severity !== severityFilter) return false;
      if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
      return true;
    }) || [];

  return (
    <div className="h-full flex flex-col bg-[#1E1E1E]">
      <TabHeader
        title="Security Scanner"
        subtitle={
          scanResult
            ? `${scanResult.total_findings} findings · Score: ${scanResult.overall_score}/100`
            : "Scanning..."
        }
        statusConnected={health.backend === "connected"}
        statusLabel={health.backend === "connected" ? "Connected" : "Disconnected"}
      >
        <button
          className="px-3 py-2 bg-red-600 hover:bg-red-700 border border-red-500 rounded text-xs text-white font-medium transition-colors disabled:opacity-50"
          onClick={() => fetchSecurityScan(true)}
          disabled={scanning}
        >
          {scanning ? "Scanning..." : "Run Scan"}
        </button>
      </TabHeader>

      <div className="flex-1 overflow-hidden flex flex-col">
        {error && (
          <div className="text-red-400 text-sm m-4 p-3 bg-red-500/10 rounded border border-red-500/20">
            {error}
          </div>
        )}

        {loading && !scanResult ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-4" />
              <div className="text-gray-400">Running security scan...</div>
              <div className="text-gray-500 text-sm mt-2">
                Analyzing code, configurations, and compliance
              </div>
            </div>
          </div>
        ) : scanResult ? (
          <>
            {/* Score Overview */}
            <div className="px-4 py-4 bg-[#252526] border-b border-gray-700">
              <div className="grid grid-cols-6 gap-4">
                {/* Overall Score */}
                <div className="col-span-2 p-4 bg-[#1E1E1E] rounded-lg border border-gray-700">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                    Security Score
                  </div>
                  <div className="flex items-end gap-2">
                    <span
                      className={`text-4xl font-bold tabular-nums ${getScoreColor(
                        scanResult.overall_score
                      )}`}
                    >
                      {scanResult.overall_score}
                    </span>
                    <span className="text-gray-500 text-lg mb-1">/100</span>
                  </div>
                  <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        scanResult.overall_score >= 80
                          ? "bg-green-500"
                          : scanResult.overall_score >= 60
                          ? "bg-yellow-500"
                          : scanResult.overall_score >= 40
                          ? "bg-orange-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${scanResult.overall_score}%` }}
                    />
                  </div>
                </div>

                {/* Severity Breakdown */}
                <div className="col-span-2 p-4 bg-[#1E1E1E] rounded-lg border border-gray-700">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                    Findings by Severity
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-400 tabular-nums">
                        {scanResult.findings_by_severity.critical || 0}
                      </div>
                      <div className="text-[9px] text-gray-500">Critical</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-400 tabular-nums">
                        {scanResult.findings_by_severity.high || 0}
                      </div>
                      <div className="text-[9px] text-gray-500">High</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-400 tabular-nums">
                        {scanResult.findings_by_severity.medium || 0}
                      </div>
                      <div className="text-[9px] text-gray-500">Medium</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400 tabular-nums">
                        {scanResult.findings_by_severity.low || 0}
                      </div>
                      <div className="text-[9px] text-gray-500">Low</div>
                    </div>
                  </div>
                </div>

                {/* Compliance Summary */}
                <div className="col-span-2 p-4 bg-[#1E1E1E] rounded-lg border border-gray-700">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                    Compliance Status
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400 tabular-nums">
                        {scanResult.compliance_status.summary.compliant}
                      </div>
                      <div className="text-[9px] text-gray-500">Compliant</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-400 tabular-nums">
                        {scanResult.compliance_status.summary.partial}
                      </div>
                      <div className="text-[9px] text-gray-500">Partial</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-400 tabular-nums">
                        {scanResult.compliance_status.summary.non_compliant}
                      </div>
                      <div className="text-[9px] text-gray-500">Non-Compliant</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-4 py-2 bg-[#252526] border-b border-gray-700 flex items-center gap-4">
              <button
                onClick={() => setActiveTab("findings")}
                className={`text-sm px-3 py-1.5 rounded transition-colors ${
                  activeTab === "findings"
                    ? "bg-red-500 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Vulnerabilities ({scanResult.total_findings})
              </button>
              <button
                onClick={() => setActiveTab("compliance")}
                className={`text-sm px-3 py-1.5 rounded transition-colors ${
                  activeTab === "compliance"
                    ? "bg-red-500 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Compliance ({scanResult.compliance_status.summary.total_checks})
              </button>

              {activeTab === "findings" && (
                <>
                  <div className="w-px h-6 bg-gray-600" />
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="text-xs bg-[#1E1E1E] border border-gray-600 rounded px-2 py-1 text-gray-300"
                  >
                    <option value="all">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="text-xs bg-[#1E1E1E] border border-gray-600 rounded px-2 py-1 text-gray-300"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
              {activeTab === "findings" ? (
                <div className="space-y-3">
                  {filteredFindings.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      {scanResult.total_findings === 0
                        ? "No security vulnerabilities detected! 🎉"
                        : "No findings match the current filters."}
                    </div>
                  ) : (
                    filteredFindings.map((finding) => {
                      const isExpanded = expandedFinding === finding.id;
                      return (
                        <div
                          key={finding.id}
                          className={`rounded-lg border transition-all ${
                            isExpanded
                              ? "border-red-500/50 bg-red-500/5"
                              : "border-gray-700 bg-[#252526] hover:border-gray-600"
                          }`}
                        >
                          <button
                            className="w-full p-4 text-left"
                            onClick={() =>
                              setExpandedFinding(isExpanded ? null : finding.id)
                            }
                          >
                            <div className="flex items-start gap-3">
                              {/* Severity Badge */}
                              <div
                                className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${getSeverityBg(
                                  finding.severity
                                )} ${getSeverityColor(finding.severity)}`}
                              >
                                {finding.severity}
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-white font-medium">
                                    {finding.title}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-gray-700 text-gray-400 text-[10px]">
                                    {finding.category.replace(/_/g, " ")}
                                  </span>
                                  {finding.cwe_id && (
                                    <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px]">
                                      {finding.cwe_id}
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-400 line-clamp-1">
                                  {finding.description}
                                </div>
                                {finding.location && (
                                  <div className="text-xs text-gray-500 mt-1 font-mono">
                                    📍 {finding.location}
                                  </div>
                                )}
                              </div>

                              {/* Expand Icon */}
                              <svg
                                className={`w-4 h-4 text-gray-400 transition-transform ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </div>
                          </button>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="px-4 pb-4 border-t border-gray-700/50 pt-4">
                              <div className="grid grid-cols-2 gap-6">
                                <div>
                                  <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                                    Description
                                  </div>
                                  <div className="text-sm text-gray-300">
                                    {finding.description}
                                  </div>

                                  {finding.owasp_category && (
                                    <div className="mt-4">
                                      <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                                        OWASP Category
                                      </div>
                                      <div className="text-sm text-orange-400">
                                        {finding.owasp_category}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                                    Recommendation
                                  </div>
                                  <div className="text-sm text-green-400">
                                    {finding.recommendation}
                                  </div>

                                  {finding.cwe_id && (
                                    <div className="mt-4">
                                      <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                                        Reference
                                      </div>
                                      <a
                                        href={`https://cwe.mitre.org/data/definitions/${finding.cwe_id.replace(
                                          "CWE-",
                                          ""
                                        )}.html`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-blue-400 hover:underline"
                                      >
                                        {finding.cwe_id} →
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(scanResult.compliance_status.checks).map(
                    ([standard, checks]) => (
                      <div key={standard}>
                        <div className="text-sm font-medium text-white mb-3">
                          {standard.replace(/_/g, " ")}
                        </div>
                        <div className="space-y-2">
                          {checks.map((check, idx) => (
                            <div
                              key={idx}
                              className="p-3 bg-[#252526] rounded-lg border border-gray-700"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-white">
                                  {check.requirement}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] uppercase font-medium ${getComplianceStatusColor(
                                    check.status
                                  )}`}
                                >
                                  {check.status.replace(/_/g, " ")}
                                </span>
                              </div>
                              <div className="text-xs text-gray-400">
                                {check.details}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-gray-700 flex items-center justify-between text-xs text-gray-500">
              <span>
                Last scan:{" "}
                {new Date(scanResult.scan_time).toLocaleString()} (
                {scanResult.scan_duration_seconds.toFixed(1)}s)
              </span>
              <span>
                Next recommended:{" "}
                {new Date(scanResult.next_scan_recommended).toLocaleString()}
              </span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default SecurityView;

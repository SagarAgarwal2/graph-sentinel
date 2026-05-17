import { useEffect, useState } from 'react';
import {
  ShieldAlert, X, CheckCircle, XCircle, ChevronDown, ChevronUp,
  MessageSquare, AlertTriangle, Clock, TrendingUp, User, ChevronRight,
} from 'lucide-react';
import { type FraudAlert, type Account, type InvestigatorFeedback } from '../lib/supabase';
import {
  formatCurrency, formatDateTime, timeAgo, patternLabel, severityBg, statusBg,
} from '../lib/formatters';
import { fetchAccounts, fetchAlerts, fetchFeedback, postFeedback, updateAlert } from '../lib/api';

const STATUS_TABS = ['all', 'open', 'confirmed', 'dismissed'];

const SEVERITY_BORDER: Record<string, string> = {
  critical: 'border-l-critical',
  high:     'border-l-high',
  medium:   'border-l-medium',
  low:      'border-l-low',
};

export default function FraudAlerts() {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [accounts, setAccounts] = useState<Map<string, Account>>(new Map());
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [feedback, setFeedback] = useState<InvestigatorFeedback[]>([]);
  const [activeTab, setActiveTab] = useState('open');
  const [sortBy, setSortBy] = useState<'created_at' | 'confidence_score' | 'total_amount'>('created_at');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [alertData, accountData] = await Promise.all([
        fetchAlerts(),
        fetchAccounts(),
      ]);
      setAlerts(alertData);
      setAccounts(new Map(accountData.map((a) => [a.id, a])));
      setLoading(false);
    };
    load();
  }, []);

  const loadFeedback = async (alertId: string) => {
    setFeedback(await fetchFeedback(alertId));
  };

  const selectAlert = (a: FraudAlert) => {
    setSelectedAlert(a);
    loadFeedback(a.id);
    setNoteText('');
  };

  const updateAlertStatus = async (status: string) => {
    if (!selectedAlert) return;
    setActionLoading(true);
    await updateAlert({ id: selectedAlert.id, status, updated_at: new Date().toISOString() });
    await postFeedback({
      alert_id: selectedAlert.id,
      status,
      investigator_action: status === 'confirmed' ? 'confirmed' : 'dismissed',
      investigator_name: 'Investigator Arjun Mehta',
      notes: noteText || `Alert ${status} by investigator.`,
    });
    setAlerts((prev) => prev.map((a) => (a.id === selectedAlert.id ? { ...a, status } : a)));
    setSelectedAlert((prev) => (prev ? { ...prev, status } : null));
    await loadFeedback(selectedAlert.id);
    setNoteText('');
    setActionLoading(false);
  };

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir('desc'); }
  };

  const filtered = alerts
    .filter((a) => activeTab === 'all' || a.status === activeTab)
    .sort((a, b) => {
      const factor = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'created_at') return factor * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      if (sortBy === 'confidence_score') return factor * (a.confidence_score - b.confidence_score);
      return factor * (a.total_amount - b.total_amount);
    });

  const SortIcon = ({ col }: { col: typeof sortBy }) =>
    sortBy === col ? (
      sortDir === 'desc' ? <ChevronDown className="w-3 h-3 inline ml-0.5 opacity-70" /> : <ChevronUp className="w-3 h-3 inline ml-0.5 opacity-70" />
    ) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm text-subtext">Loading alerts...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Alert List */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Tab Bar */}
        <div className="flex items-center border-b border-border px-6 pt-0 flex-shrink-0 bg-card">
          {STATUS_TABS.map((tab) => {
            const count = tab === 'all' ? alerts.length : alerts.filter((a) => a.status === tab).length;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-4 py-3 text-[12px] font-medium border-b-2 transition-all duration-150 capitalize focus-visible:outline-none ${
                  activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted hover:text-subtext'
                }`}
              >
                {tab}
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  activeTab === tab ? 'bg-primary/15 text-primary' : 'bg-elevated text-muted'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-elevated z-10 border-b border-border">
              <tr>
                {[
                  { label: 'Pattern', col: null },
                  { label: 'Severity', col: null },
                  { label: 'Confidence', col: 'confidence_score' as const },
                  { label: 'Amount', col: 'total_amount' as const },
                  { label: 'Accounts', col: null },
                  { label: 'Assigned', col: null },
                  { label: 'Status', col: null },
                  { label: 'Date', col: 'created_at' as const },
                ].map(({ label, col }) => (
                  <th
                    key={label}
                    onClick={() => col && handleSort(col)}
                    className={`px-5 py-2.5 text-left text-[10px] font-semibold text-muted uppercase tracking-widest ${col ? 'cursor-pointer hover:text-subtext transition-colors' : ''}`}
                  >
                    {label}{col && <SortIcon col={col} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => selectAlert(a)}
                  className={`tr-row cursor-pointer ${SEVERITY_BORDER[a.severity] || ''} ${
                    selectedAlert?.id === a.id ? 'bg-elevated' : ''
                  }`}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                      <span className="text-[13px] text-text font-medium">{patternLabel(a.pattern_type)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`badge ${severityBg(a.severity)}`}>{a.severity.toUpperCase()}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-16 h-1.5 bg-elevated rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${a.confidence_score * 100}%`,
                            backgroundColor: a.confidence_score > 0.9 ? '#EF4444' : a.confidence_score > 0.75 ? '#F59E0B' : '#F59E0B',
                          }}
                        />
                      </div>
                      <span className="text-[12px] text-subtext tabular-nums">{(a.confidence_score * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-[13px] text-text font-semibold tabular-nums">{formatCurrency(a.total_amount)}</td>
                  <td className="px-5 py-3.5 text-[12px] text-subtext">{a.involved_accounts.length} accts</td>
                  <td className="px-5 py-3.5 text-[12px] text-subtext">{a.assigned_investigator.replace('Investigator ', '')}</td>
                  <td className="px-5 py-3.5">
                    <span className={`badge ${statusBg(a.status)}`}>{a.status}</span>
                  </td>
                  <td className="px-5 py-3.5 text-[12px] text-muted">{timeAgo(a.created_at)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-muted text-[13px]">No alerts in this category.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Panel */}
      {selectedAlert && (
        <div className="w-96 xl:w-[440px] flex flex-col bg-card border-l border-border overflow-hidden flex-shrink-0 shadow-panel">
          {/* Severity accent top bar */}
          <div className={`h-0.5 flex-shrink-0 ${
            selectedAlert.severity === 'critical' ? 'bg-danger' :
            selectedAlert.severity === 'high' ? 'bg-warning' :
            selectedAlert.severity === 'medium' ? 'bg-warning' : 'bg-success'
          }`} />

          {/* Header */}
          <div className="flex items-start justify-between px-5 py-4 border-b border-border flex-shrink-0">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-text leading-tight">{patternLabel(selectedAlert.pattern_type)}</p>
              <p className="text-[11px] text-muted font-mono mt-0.5">{selectedAlert.id}</p>
            </div>
            <button
              onClick={() => setSelectedAlert(null)}
              className="p-1.5 text-muted hover:text-text hover:bg-elevated rounded-md transition-all duration-150 ml-2 flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Score + Meta */}
            <div className="px-5 py-4 border-b border-border">
              <div className="flex items-center gap-4">
                <ConfidenceGauge score={selectedAlert.confidence_score} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`badge ${severityBg(selectedAlert.severity)}`}>{selectedAlert.severity.toUpperCase()}</span>
                    <span className={`badge ${statusBg(selectedAlert.status)}`}>{selectedAlert.status}</span>
                  </div>
                  <p className="text-[13px] text-text">
                    <span className="text-text font-bold">{formatCurrency(selectedAlert.total_amount)}</span>
                    <span className="text-muted text-[11px] ml-1">total exposure</span>
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">{formatDateTime(selectedAlert.created_at)}</p>
                </div>
              </div>
            </div>

            {/* SHAP Narrative */}
            <div className="px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2 mb-2.5">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                <p className="text-[11px] font-semibold text-muted uppercase tracking-widest">AI Causal Analysis</p>
              </div>
              <div
                className="text-[12px] text-subtext leading-relaxed p-3.5 rounded-lg bg-bg border border-border"
                style={{
                  borderLeftColor: selectedAlert.severity === 'critical' ? '#EF4444' : selectedAlert.severity === 'high' ? '#F59E0B' : '#F59E0B',
                  borderLeftWidth: '3px',
                }}
              >
                {selectedAlert.shap_narrative}
              </div>
            </div>

            {/* SHAP Factors */}
            <div className="px-5 py-4 border-b border-border">
              <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-3">Key Risk Factors</p>
              <div className="space-y-3">
                {selectedAlert.shap_factors.map((f, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-subtext">{f.factor}</span>
                      <span className="text-[11px] text-danger font-semibold tabular-nums">{(f.weight * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${f.weight * 100}%`, backgroundColor: '#EF4444' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Involved Accounts */}
            <div className="px-5 py-4 border-b border-border">
              <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-3">Involved Accounts</p>
              <div className="space-y-2">
                {selectedAlert.involved_accounts.map((id) => {
                  const acc = accounts.get(id);
                  return (
                    <div key={id} className="flex items-center gap-2.5 p-2.5 bg-elevated border border-border rounded-md hover:border-[#374151] transition-colors">
                      <div className="w-7 h-7 rounded-full bg-bg border border-border flex items-center justify-center flex-shrink-0">
                        <User className="w-3.5 h-3.5 text-muted" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-text font-medium leading-tight truncate">{acc?.holder_name || id}</p>
                        <p className="text-[10px] text-muted">{acc?.bank_branch || id}</p>
                      </div>
                      {acc && (
                        <span className={`badge ${severityBg(acc.risk_level)}`}>
                          {acc.risk_level}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Evidence Timeline */}
            <div className="px-5 py-4 border-b border-border">
              <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-3">Evidence Chain</p>
              <div className="space-y-0">
                {selectedAlert.linked_transaction_ids.map((id, i) => (
                  <div key={id} className="flex items-stretch gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full bg-elevated border border-border flex items-center justify-center text-[9px] text-muted font-mono font-semibold flex-shrink-0">
                        {i + 1}
                      </div>
                      {i < selectedAlert.linked_transaction_ids.length - 1 && (
                        <div className="w-px flex-1 bg-border my-0.5" style={{ minHeight: '12px' }} />
                      )}
                    </div>
                    <div className="pb-2 pt-0.5 flex items-center">
                      <span className="text-[11px] text-subtext font-mono">{id}</span>
                      <ChevronRight className="w-3 h-3 text-muted ml-1" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Feedback History */}
            {feedback.length > 0 && (
              <div className="px-5 py-4 border-b border-border">
                <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-3">Investigator History</p>
                <div className="space-y-2">
                  {feedback.map((f) => (
                    <div key={f.id} className="p-2.5 bg-elevated border border-border rounded-md">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-3 h-3 text-muted" />
                        <span className="text-[10px] text-muted">{timeAgo(f.created_at)}</span>
                        <span className={`badge text-[10px] ${statusBg(f.investigator_action)}`}>
                          {f.investigator_action}
                        </span>
                      </div>
                      <p className="text-[11px] text-subtext leading-relaxed">{f.notes}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Area */}
            {selectedAlert.status === 'open' && (
              <div className="px-5 py-4">
                <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-3">Investigator Action</p>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add investigation notes..."
                  className="w-full bg-bg border border-border rounded-md px-3 py-2.5 text-[12px] text-text placeholder-muted resize-none focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all duration-150"
                  rows={3}
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => updateAlertStatus('confirmed')}
                    disabled={actionLoading}
                    className="btn-danger flex-1 text-xs"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Confirm & Escalate
                  </button>
                  <button
                    onClick={() => updateAlertStatus('dismissed')}
                    disabled={actionLoading}
                    className="btn-secondary flex-1 text-xs"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Dismiss
                  </button>
                </div>
                <button
                  onClick={async () => {
                    if (!noteText.trim()) return;
                    setActionLoading(true);
                    await postFeedback({
                      alert_id: selectedAlert.id,
                      status: selectedAlert.status,
                      investigator_action: 'note_added',
                      investigator_name: 'Investigator Arjun Mehta',
                      notes: noteText,
                    });
                    await loadFeedback(selectedAlert.id);
                    setNoteText('');
                    setActionLoading(false);
                  }}
                  disabled={actionLoading || !noteText.trim()}
                  className="mt-2 w-full btn-secondary text-xs"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Add Note
                </button>
              </div>
            )}

            {selectedAlert.status === 'confirmed' && (
              <div className="px-5 py-4">
                <div className="flex items-start gap-2.5 p-3 bg-[rgba(16,185,129,0.05)] border border-success/20 rounded-md text-[12px] text-success">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>Alert confirmed — generate an STR/CTR report from the Reports section.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfidenceGauge({ score }: { score: number }) {
  const pct = score * 100;
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct > 90 ? '#EF4444' : pct > 75 ? '#F59E0B' : '#F59E0B';

  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#1F2937" strokeWidth="5" />
        <circle
          cx="36" cy="36" r={r} fill="none" stroke={color}
          strokeWidth="5" strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[12px] font-bold tabular-nums" style={{ color }}>{pct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

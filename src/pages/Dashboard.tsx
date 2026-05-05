import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, ShieldAlert, FileText, Activity,
  ArrowUpRight, ArrowRight, BarChart2,
} from 'lucide-react';
import { supabase, type Transaction, type FraudAlert } from '../lib/supabase';
import {
  formatCurrency, timeAgo, channelColor,
  severityBg, patternLabel, statusBg,
} from '../lib/formatters';

const PATTERN_COLORS: Record<string, string> = {
  multi_hop_layering:   '#EF4444',
  circular_round_trip:  '#F59E0B',
  structuring:          '#F59E0B',
  dormant_reactivation: '#2B6DEF',
  kyc_mismatch:         '#EF4444',
};

type BranchRisk = 'critical' | 'high' | 'medium' | 'low';

const BRANCHES: { name: string; risk: BranchRisk; alerts: number }[] = [
  { name: 'Mumbai Main',        risk: 'critical', alerts: 4 },
  { name: 'Mumbai Andheri',     risk: 'high',     alerts: 2 },
  { name: 'Delhi CP',           risk: 'high',     alerts: 3 },
  { name: 'Pune Deccan',        risk: 'high',     alerts: 2 },
  { name: 'Kolkata Salt Lake',  risk: 'high',     alerts: 1 },
  { name: 'Patna Boring Road',  risk: 'critical', alerts: 3 },
  { name: 'Bangalore KMgl',     risk: 'medium',   alerts: 1 },
  { name: 'Chennai T Nagar',    risk: 'low',      alerts: 0 },
  { name: 'Hyderabad Jubilee',  risk: 'low',      alerts: 0 },
  { name: 'Ahmedabad West',     risk: 'medium',   alerts: 1 },
  { name: 'Jaipur MI Road',     risk: 'low',      alerts: 0 },
  { name: 'Lucknow Hazratganj', risk: 'low',      alerts: 0 },
];

const RISK_CELL: Record<BranchRisk, string> = {
  critical: 'bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.25)] text-[#EF4444]',
  high:     'bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.20)] text-[#F59E0B]',
  medium:   'bg-elevated border border-border text-subtext',
  low:      'bg-transparent border border-border/50 text-muted',
};

export default function Dashboard() {
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [totalTxns, setTotalTxns] = useState(0);
  const [pendingReports, setPendingReports] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [txnRes, alertRes, reportRes, txnCount] = await Promise.all([
        supabase.from('transactions').select('*').order('timestamp', { ascending: false }).limit(20),
        supabase.from('fraud_alerts').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('str_ctr_reports').select('*', { count: 'exact', head: true }).eq('submission_status', 'draft'),
        supabase.from('transactions').select('*', { count: 'exact', head: true }),
      ]);
      setRecentTxns(txnRes.data || []);
      setAlerts(alertRes.data || []);
      setPendingReports(reportRes.count || 0);
      setTotalTxns(txnCount.count || 0);
      setLoading(false);
    };
    load();
  }, []);

  const openAlerts    = alerts.filter((a) => a.status === 'open');
  const criticalAlerts = openAlerts.filter((a) => a.severity === 'critical');
  const systemRisk    = criticalAlerts.length > 2 ? 'Critical' : criticalAlerts.length > 0 ? 'High' : 'Medium';

  const patternCounts = Object.entries(
    alerts.reduce((acc: Record<string, number>, a) => {
      acc[a.pattern_type] = (acc[a.pattern_type] || 0) + 1;
      return acc;
    }, {})
  ).map(([pattern, count]) => ({ pattern, count, color: PATTERN_COLORS[pattern] || '#6B7280' }));

  const maxCount = Math.max(...patternCounts.map((p) => p.count), 1);
  const flaggedIds = new Set(alerts.flatMap((a) => a.linked_transaction_ids));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm text-subtext">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 overflow-auto h-full">

      {/* KPI Strip — neutral cards, colored icons only */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Transactions Today"
          value={totalTxns.toString()}
          sub="+12 in last hour"
          icon={<Activity className="w-5 h-5" />}
          iconColor="text-primary"
          iconBg="bg-primary/10"
        />
        <KpiCard
          title="Active Alerts"
          value={openAlerts.length.toString()}
          sub={`${criticalAlerts.length} critical`}
          icon={<ShieldAlert className="w-5 h-5" />}
          iconColor="text-danger"
          iconBg="bg-[rgba(239,68,68,0.1)]"
        />
        <KpiCard
          title="Pending Reports"
          value={pendingReports.toString()}
          sub="STR / CTR drafts"
          icon={<FileText className="w-5 h-5" />}
          iconColor="text-warning"
          iconBg="bg-[rgba(245,158,11,0.1)]"
        />
        <KpiCard
          title="System Risk"
          value={systemRisk}
          sub="Based on active alerts"
          icon={<TrendingUp className="w-5 h-5" />}
          iconColor={systemRisk === 'Critical' ? 'text-danger' : 'text-warning'}
          iconBg={systemRisk === 'Critical' ? 'bg-[rgba(239,68,68,0.1)]' : 'bg-[rgba(245,158,11,0.1)]'}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Live Transaction Feed */}
        <div className="xl:col-span-2 card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-success" />
                <div className="absolute inset-0 rounded-full bg-success animate-ping-slow" />
              </div>
              <span className="text-[14px] font-semibold text-text">Live Transaction Feed</span>
            </div>
            <Link to="/graph" className="flex items-center gap-1 text-[12px] text-primary hover:text-primary-hover font-medium transition-colors">
              View Graph <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-elevated border-b border-border">
                  {['Time', 'Reference', 'Channel', 'From', 'To', 'Amount', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentTxns.map((t) => {
                  const isFlagged = flaggedIds.has(t.id);
                  return (
                    <tr key={t.id} className={`tr-row ${isFlagged ? 'border-l-critical' : ''}`}>
                      <td className="px-4 py-3 text-[12px] text-subtext">{timeAgo(t.timestamp)}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-muted">{t.reference_number.slice(-8)}</td>
                      <td className="px-4 py-3">
                        <span className={`badge border ${channelColor(t.channel)}`}>{t.channel}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-muted">{t.sender_account_id.slice(-6)}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-muted">{t.receiver_account_id.slice(-6)}</td>
                      <td className="px-4 py-3 text-[13px] text-text font-semibold">{formatCurrency(t.amount)}</td>
                      <td className="px-4 py-3">
                        {isFlagged ? (
                          <span className="flex items-center gap-1.5 text-[12px] text-danger font-medium">
                            <ShieldAlert className="w-3.5 h-3.5" />Flagged
                          </span>
                        ) : (
                          <span className="text-[12px] text-success">{t.status}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* Pattern Distribution */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-4 h-4 text-primary" />
              <span className="text-[14px] font-semibold text-text">Alert Distribution</span>
            </div>
            <div className="space-y-3">
              {patternCounts.map(({ pattern, count, color }) => (
                <div key={pattern}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-subtext">{patternLabel(pattern)}</span>
                    <span className="text-[12px] font-semibold tabular-nums" style={{ color }}>{count}</span>
                  </div>
                  <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Critical Alerts */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-danger" />
                <span className="text-[14px] font-semibold text-text">Active Alerts</span>
              </div>
              <Link to="/alerts" className="flex items-center gap-1 text-[12px] text-primary hover:text-primary-hover font-medium transition-colors">
                All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-border/60">
              {openAlerts.slice(0, 5).map((a) => (
                <Link
                  key={a.id}
                  to="/alerts"
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-elevated transition-colors ${a.severity === 'critical' ? 'border-l-critical' : a.severity === 'high' ? 'border-l-high' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge ${severityBg(a.severity)}`}>{a.severity.toUpperCase()}</span>
                      <span className="text-[11px] text-muted">{(a.confidence_score * 100).toFixed(0)}%</span>
                    </div>
                    <p className="text-[13px] text-text font-medium leading-tight">{patternLabel(a.pattern_type)}</p>
                    <p className="text-[11px] text-muted mt-0.5">{timeAgo(a.created_at)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[13px] font-semibold text-text">{formatCurrency(a.total_amount)}</div>
                    <span className={`badge mt-1 ${statusBg(a.status)}`}>{a.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Branch Risk Heatmap */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[14px] font-semibold text-text">Branch Risk Heatmap</span>
          <div className="flex items-center gap-4">
            {(['critical', 'high', 'medium', 'low'] as BranchRisk[]).map((r) => (
              <div key={r} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-sm ${r === 'critical' ? 'bg-danger' : r === 'high' ? 'bg-warning' : r === 'medium' ? 'bg-subtext' : 'bg-border'}`} />
                <span className="text-[11px] text-muted capitalize">{r}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {BRANCHES.map((b) => (
            <div key={b.name} className={`p-3 rounded-md text-center transition-all duration-150 hover:scale-[1.02] cursor-default ${RISK_CELL[b.risk]}`}>
              <div className="text-[11px] font-medium leading-snug">{b.name}</div>
              {b.alerts > 0 && (
                <div className="mt-1 flex items-center justify-center gap-0.5 text-[10px] font-medium">
                  <ArrowUpRight className="w-3 h-3" />{b.alerts}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  title, value, sub, icon, iconColor, iconBg,
}: {
  title: string; value: string; sub: string;
  icon: React.ReactNode; iconColor: string; iconBg: string;
}) {
  return (
    <div className="card p-5 flex items-start justify-between hover:shadow-card-hover transition-shadow duration-200">
      <div>
        <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-semibold text-text mt-1.5">{value}</p>
        <p className="text-[11px] text-muted mt-1">{sub}</p>
      </div>
      <div className={`p-2.5 rounded-md ${iconBg} ${iconColor} mt-0.5`}>{icon}</div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import {
  FileText, Plus, Download, X, ChevronRight, Timer, Send,
  CheckCircle, AlertTriangle, Sparkles,
} from 'lucide-react';
import { supabase, type FraudAlert, type Account, type Transaction, type StrCtrReport } from '../lib/supabase';
import { formatCurrency, formatDateTime, timeAgo, patternLabel, severityBg, statusBg } from '../lib/formatters';
import { generateGoAMLXml } from '../lib/goaml';

type Step = 'list' | 'select' | 'preview';

export default function Reports() {
  const [reports, setReports] = useState<StrCtrReport[]>([]);
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [step, setStep] = useState<Step>('list');
  const [selectedAlertIds, setSelectedAlertIds] = useState<string[]>([]);
  const [reportType, setReportType] = useState<'STR' | 'CTR'>('STR');
  const [narrative, setNarrative] = useState('');
  const [previewReport, setPreviewReport] = useState<StrCtrReport | null>(null);
  const [generatedXml, setGeneratedXml] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [repRes, alertRes, accRes, txnRes] = await Promise.all([
        supabase.from('str_ctr_reports').select('*').order('created_at', { ascending: false }),
        supabase.from('fraud_alerts').select('*').order('created_at', { ascending: false }),
        supabase.from('accounts').select('*'),
        supabase.from('transactions').select('*'),
      ]);
      setReports(repRes.data || []);
      setAlerts(alertRes.data || []);
      setAccounts(accRes.data || []);
      setTransactions(txnRes.data || []);
      setLoading(false);
    };
    load();
  }, []);

  const confirmedAlerts = alerts.filter((a) => a.status === 'confirmed');

  const generateReport = async () => {
    if (selectedAlertIds.length === 0) return;
    setGenerating(true);
    const startTime = Date.now();
    await new Promise((r) => setTimeout(r, 1200));

    const selectedAlerts = alerts.filter((a) => selectedAlertIds.includes(a.id));
    const allTxnIds = [...new Set(selectedAlerts.flatMap((a) => a.linked_transaction_ids))];
    const allAccIds = [...new Set(selectedAlerts.flatMap((a) => a.involved_accounts))];
    const involvedTxns = transactions.filter((t) => allTxnIds.includes(t.id));
    const involvedAccs = accounts.filter((a) => allAccIds.includes(a.id));
    const totalAmount = selectedAlerts.reduce((s, a) => s + a.total_amount, 0);
    const genTimeSecs = Math.round((Date.now() - startTime) / 1000);
    const reportId = `RPT_${Date.now()}`;
    const defaultNarrative = narrative ||
      `${reportType} Report: Suspicious activity detected across ${selectedAlerts.length} alert(s) involving ${allAccIds.length} accounts. Total suspicious transaction value: ${formatCurrency(totalAmount)}. Pattern types: ${[...new Set(selectedAlerts.map((a) => patternLabel(a.pattern_type)))].join(', ')}. AI analysis indicates high-confidence fraud indicators. Immediate investigation and regulatory reporting recommended.`;

    const subjectAcc = involvedAccs[0];
    const xml = generateGoAMLXml(
      { id: reportId, report_type: reportType, narrative: defaultNarrative },
      selectedAlerts, involvedAccs, involvedTxns
    );

    const newReport: Partial<StrCtrReport> = {
      id: reportId, alert_ids: selectedAlertIds, report_type: reportType, goaml_xml: xml,
      narrative: defaultNarrative,
      subject_details: {
        reporting_entity: 'Union Bank of India',
        branch: subjectAcc?.bank_branch || 'Multiple Branches',
        officer: 'Chief Compliance Officer',
        date: new Date().toISOString().split('T')[0],
      },
      transaction_summary: {
        total_amount: totalAmount, transaction_count: allTxnIds.length,
        account_count: allAccIds.length,
        channels: [...new Set(involvedTxns.map((t) => t.channel))],
      },
      generation_time_seconds: genTimeSecs,
      submission_status: 'draft',
    };

    await supabase.from('str_ctr_reports').insert(newReport);
    const inserted = { ...newReport, created_at: new Date().toISOString() } as StrCtrReport;
    setReports((prev) => [inserted, ...prev]);
    setPreviewReport(inserted);
    setGeneratedXml(xml);
    setStep('preview');
    setGenerating(false);
  };

  const submitReport = async (id: string) => {
    const now = new Date().toISOString();
    await supabase.from('str_ctr_reports').update({ submission_status: 'submitted', submitted_at: now }).eq('id', id);
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, submission_status: 'submitted', submitted_at: now } : r));
    if (previewReport?.id === id) setPreviewReport((r) => r ? { ...r, submission_status: 'submitted' } : null);
  };

  const downloadXml = (xml: string, id: string) => {
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${id}_goAML.xml`; a.click();
    URL.revokeObjectURL(url);
  };

  const colorizeXml = (xml: string) => {
    return xml
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/&lt;(\/?[\w:]+)/g, '<span style="color:#2B6DEF">&lt;$1</span>')
      .replace(/&gt;/g, '<span style="color:#2B6DEF">&gt;</span>')
      .replace(/&gt;([^&<]+)&lt;/g, '&gt;<span style="color:#E5E7EB">$1</span>&lt;')
      .replace(/([\w:]+)="([^"]*)"/g, '<span style="color:#9CA3AF">$1</span>=<span style="color:#10B981">"$2"</span>');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm text-subtext">Loading reports...</span>
        </div>
      </div>
    );
  }

  /* ── SELECT STEP ── */
  if (step === 'select') {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[15px] font-semibold text-text">Generate New Report</h2>
            <p className="text-[12px] text-muted mt-0.5">Select confirmed alerts to include</p>
          </div>
          <button onClick={() => setStep('list')} className="p-2 rounded-md text-muted hover:text-text hover:bg-elevated transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Report Type */}
        <div className="card p-5 mb-4">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-3">Report Type</p>
          <div className="flex gap-3">
            {(['STR', 'CTR'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setReportType(t)}
                className={`flex-1 py-3 rounded-md text-sm font-semibold border transition-all duration-150 ${
                  reportType === t
                    ? 'bg-primary/10 border-primary/40 text-primary'
                    : 'bg-elevated border-border text-muted hover:text-text hover:border-[#374151]'
                }`}
              >
                {t}
                <span className="block text-[10px] font-normal mt-0.5 opacity-70">
                  {t === 'STR' ? 'Suspicious Transaction Report' : 'Cash Transaction Report'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Alert Selection */}
        <div className="card overflow-hidden mb-4">
          <div className="px-5 py-3 border-b border-border bg-elevated">
            <p className="text-[13px] font-semibold text-text">Confirmed Alerts</p>
          </div>
          {confirmedAlerts.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <AlertTriangle className="w-8 h-8 text-muted mx-auto mb-2" />
              <p className="text-[13px] text-subtext">No confirmed alerts available.</p>
              <p className="text-[11px] text-muted mt-1">Confirm alerts from the Fraud Alert Workbench first.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {confirmedAlerts.map((a) => (
                <label key={a.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-elevated cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedAlertIds.includes(a.id)}
                    onChange={(e) => setSelectedAlertIds((prev) =>
                      e.target.checked ? [...prev, a.id] : prev.filter((id) => id !== a.id)
                    )}
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`badge ${severityBg(a.severity)}`}>{a.severity.toUpperCase()}</span>
                      <span className="text-[13px] text-text font-medium">{patternLabel(a.pattern_type)}</span>
                    </div>
                    <p className="text-[11px] text-muted">{a.involved_accounts.length} accounts · {timeAgo(a.created_at)}</p>
                  </div>
                  <span className="text-[13px] font-semibold text-text">{formatCurrency(a.total_amount)}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Narrative */}
        <div className="card p-5 mb-5">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-2">Narrative Override (optional)</p>
          <textarea
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            placeholder="Auto-generated from alert data if left blank..."
            rows={3}
            className="w-full bg-bg border border-border rounded-md px-3 py-2.5 text-[12px] text-text placeholder-muted resize-none focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </div>

        <button
          onClick={generateReport}
          disabled={selectedAlertIds.length === 0 || generating}
          className="btn-primary w-full py-3 text-[13px]"
        >
          {generating ? (
            <><Timer className="w-4 h-4 animate-spin" /> Generating report...</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Generate {reportType} Report</>
          )}
        </button>
      </div>
    );
  }

  /* ── PREVIEW STEP ── */
  if (step === 'preview' && previewReport) {
    const totalAmt = (previewReport.transaction_summary as { total_amount?: number })?.total_amount || 0;
    const txnCount = (previewReport.transaction_summary as { transaction_count?: number })?.transaction_count || 0;
    const accCount = (previewReport.transaction_summary as { account_count?: number })?.account_count || 0;

    return (
      <div className="p-6 max-w-4xl mx-auto space-y-5 overflow-auto h-full">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="badge bg-[rgba(16,185,129,0.1)] text-success border border-success/20">
                Generated in {previewReport.generation_time_seconds}s
              </span>
              <span className="text-[11px] text-muted">vs. 4 hours manual</span>
              <span className="text-[11px] text-success font-semibold">96% faster</span>
            </div>
            <h2 className="text-[15px] font-semibold text-text">
              {previewReport.report_type} Report
              <span className="font-mono text-muted text-[13px] ml-2">{previewReport.id}</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadXml(generatedXml || previewReport.goaml_xml, previewReport.id)}
              className="btn-secondary text-xs"
            >
              <Download className="w-3.5 h-3.5" /> Download XML
            </button>
            {previewReport.submission_status === 'draft' && (
              <button onClick={() => submitReport(previewReport.id)} className="btn-primary text-xs">
                <Send className="w-3.5 h-3.5" /> Submit to FIU-IND
              </button>
            )}
            {previewReport.submission_status === 'submitted' && (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-[rgba(16,185,129,0.08)] border border-success/20 rounded-md text-[12px] text-success">
                <CheckCircle className="w-3.5 h-3.5" /> Submitted
              </div>
            )}
            <button onClick={() => setStep('list')} className="p-2 rounded-md text-muted hover:text-text hover:bg-elevated transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Time Saved Banner */}
        <div className="card p-5 border border-success/15">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-md bg-[rgba(16,185,129,0.08)] border border-success/20 flex items-center justify-center flex-shrink-0">
              <Timer className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-text">Report ready in under 2 seconds</p>
              <p className="text-[12px] text-subtext mt-0.5">
                Traditional manual reporting takes <span className="text-text">~4 hours</span>.
                GraphSentinel AI generated this in <span className="text-success font-semibold">{previewReport.generation_time_seconds}s</span> —
                saving your team <span className="text-success font-semibold">96% of the time</span>.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Report Details */}
          <div className="card p-5">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-3">Report Details</p>
            <div className="space-y-2.5">
              {[
                ['Report ID', previewReport.id],
                ['Type', previewReport.report_type],
                ['Filing Entity', previewReport.subject_details?.reporting_entity || 'Union Bank of India'],
                ['Reporting Officer', 'Chief Compliance Officer'],
                ['Filing Date', formatDateTime(previewReport.created_at)],
                ['FIU Reference', `FIU-IND-${previewReport.id}`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted">{label}</span>
                  <span className="text-[12px] text-subtext font-medium text-right">{value}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1 border-t border-border">
                <span className="text-[11px] text-muted">Status</span>
                <span className={`badge ${statusBg(previewReport.submission_status)}`}>
                  {previewReport.submission_status}
                </span>
              </div>
            </div>
          </div>

          {/* Transaction Summary */}
          <div className="card p-5">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-3">Transaction Summary</p>
            <div className="space-y-3">
              {[
                { label: 'Total Suspicious Value', value: formatCurrency(totalAmt), accent: true },
                { label: 'Transaction Count', value: String(txnCount) },
                { label: 'Accounts Involved', value: String(accCount) },
                { label: 'Alerts Covered', value: String(previewReport.alert_ids.length) },
              ].map(({ label, value, accent }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[11px] text-muted">{label}</span>
                  <span className={`text-[13px] font-semibold ${accent ? 'text-text' : 'text-subtext'}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Narrative */}
        <div className="card p-5">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-2">Narrative Description</p>
          <p className="text-[12px] text-subtext leading-relaxed">{previewReport.narrative}</p>
        </div>

        {/* goAML XML */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-elevated">
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-primary" />
              <p className="text-[13px] font-semibold text-text">goAML XML</p>
            </div>
            <span className="badge bg-elevated text-muted border border-border text-[10px]">FIU-IND v2.0</span>
          </div>
          <div className="relative">
            <pre
              className="p-5 text-[11px] font-mono overflow-auto max-h-72 leading-relaxed bg-bg"
              dangerouslySetInnerHTML={{ __html: colorizeXml((generatedXml || previewReport.goaml_xml).slice(0, 3000) + ((generatedXml || previewReport.goaml_xml).length > 3000 ? '\n\n... (truncated for display)' : '')) }}
            />
          </div>
        </div>
      </div>
    );
  }

  /* ── LIST STEP ── */
  return (
    <div className="p-6 space-y-5 overflow-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-text">STR / CTR Reports</h2>
          <p className="text-[12px] text-muted mt-0.5">
            {reports.length} total &bull; {reports.filter((r) => r.submission_status === 'draft').length} pending submission
          </p>
        </div>
        <button
          onClick={() => { setSelectedAlertIds([]); setNarrative(''); setStep('select'); }}
          className="btn-primary text-xs"
        >
          <Plus className="w-3.5 h-3.5" /> New Report
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Reports', value: reports.length, valueClass: 'text-text' },
          { label: 'Draft', value: reports.filter((r) => r.submission_status === 'draft').length, valueClass: 'text-warning' },
          { label: 'Submitted', value: reports.filter((r) => r.submission_status === 'submitted').length, valueClass: 'text-success' },
          { label: 'Avg Gen Time', value: `${Math.round(reports.reduce((s, r) => s + r.generation_time_seconds, 0) / Math.max(reports.length, 1))}s`, valueClass: 'text-primary' },
        ].map(({ label, value, valueClass }) => (
          <div key={label} className="card p-4">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-widest">{label}</p>
            <p className={`text-2xl font-semibold mt-1.5 ${valueClass}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-border bg-elevated">
            <tr>
              {['Report ID', 'Type', 'Alerts', 'Total Value', 'Generated', 'Gen Time', 'Status', ''].map((h) => (
                <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold text-muted uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => {
              const totalAmt = (r.transaction_summary as { total_amount?: number })?.total_amount || 0;
              return (
                <tr key={r.id} className="tr-row">
                  <td className="px-5 py-3.5 font-mono text-[11px] text-muted">{r.id}</td>
                  <td className="px-5 py-3.5">
                    <span className={`badge ${r.report_type === 'STR' ? 'bg-[rgba(239,68,68,0.1)] text-danger border border-danger/30' : 'bg-primary/10 text-primary border border-primary/30'}`}>
                      {r.report_type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[12px] text-subtext">{r.alert_ids.length}</td>
                  <td className="px-5 py-3.5 text-[13px] text-text font-semibold">{formatCurrency(totalAmt)}</td>
                  <td className="px-5 py-3.5 text-[12px] text-muted">{timeAgo(r.created_at)}</td>
                  <td className="px-5 py-3.5 text-[12px] text-subtext">{r.generation_time_seconds}s</td>
                  <td className="px-5 py-3.5">
                    <span className={`badge ${statusBg(r.submission_status)}`}>{r.submission_status}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => { setPreviewReport(r); setGeneratedXml(r.goaml_xml); setStep('preview'); }}
                      className="flex items-center gap-1 text-[11px] text-primary hover:text-primary-hover transition-colors font-medium"
                    >
                      View <ChevronRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {reports.length === 0 && (
          <div className="py-16 text-center">
            <FileText className="w-10 h-10 text-muted mx-auto mb-3" />
            <p className="text-[13px] text-subtext">No reports yet</p>
            <p className="text-[11px] text-muted mt-1">Confirm alerts and generate your first report</p>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Clock, User, ShieldCheck, Check, AlertCircle } from 'lucide-react';
import { supabase, type FraudPattern, type InvestigatorFeedback } from '../lib/supabase';
import { timeAgo, statusBg } from '../lib/formatters';

export default function Settings() {
  const [patterns, setPatterns] = useState<FraudPattern[]>([]);
  const [dirtyPatterns, setDirtyPatterns] = useState<Set<string>>(new Set());
  const [auditLog, setAuditLog] = useState<InvestigatorFeedback[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedRecently, setSavedRecently] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [patRes, auditRes] = await Promise.all([
        supabase.from('fraud_patterns').select('*'),
        supabase.from('investigator_feedback').select('*').order('created_at', { ascending: false }).limit(30),
      ]);
      setPatterns(patRes.data || []);
      setAuditLog(auditRes.data || []);
      setLoading(false);
    };
    load();
  }, []);

  const updateLocalPattern = (id: string, field: string, value: number | boolean) => {
    setPatterns((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
    setDirtyPatterns((prev) => new Set(prev).add(id));
  };

  const savePattern = async (id: string) => {
    const pattern = patterns.find((p) => p.id === id);
    if (!pattern) return;
    setSaving(id);
    await supabase.from('fraud_patterns').update({
      amount_ceiling: pattern.amount_ceiling,
      time_window_hours: pattern.time_window_hours,
      hop_count: pattern.hop_count,
      multiplier: pattern.multiplier,
      is_enabled: pattern.is_enabled,
    }).eq('id', id);
    setSaving(null);
    setDirtyPatterns((prev) => { const s = new Set(prev); s.delete(id); return s; });
    setSavedRecently((prev) => new Set(prev).add(id));
    setTimeout(() => setSavedRecently((prev) => { const s = new Set(prev); s.delete(id); return s; }), 2500);
  };

  const togglePattern = async (id: string, value: boolean) => {
    setPatterns((prev) => prev.map((p) => (p.id === id ? { ...p, is_enabled: value } : p)));
    await supabase.from('fraud_patterns').update({ is_enabled: value }).eq('id', id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm text-subtext">Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 overflow-auto h-full max-w-4xl">
      <div>
        <h2 className="text-[15px] font-semibold text-text">Detection Engine Configuration</h2>
        <p className="text-[12px] text-muted mt-0.5">Adjust thresholds and enable/disable each fraud detection pattern</p>
      </div>

      {/* Pattern Configurations */}
      <div className="space-y-4">
        {patterns.map((p) => {
          const isDirty = dirtyPatterns.has(p.id);
          const isSaving = saving === p.id;
          const justSaved = savedRecently.has(p.id);

          return (
            <div key={p.id} className={`card overflow-hidden transition-all duration-200 ${isDirty ? 'ring-1 ring-primary/30 border-primary/25' : ''}`}>
              {isDirty && <div className="h-px bg-primary/40" />}

              <div className="flex items-start justify-between px-5 py-4 border-b border-border">
                <div className="flex-1">
                  <div className="flex items-center gap-2.5 mb-0.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                    <p className="text-[14px] font-semibold text-text">{p.name}</p>
                    {justSaved && (
                      <span className="flex items-center gap-1 text-[10px] text-success animate-fade-in">
                        <Check className="w-2.5 h-2.5" /> Saved
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted ml-6 leading-relaxed">{p.description}</p>
                </div>
                <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                  <button
                    onClick={() => togglePattern(p.id, !p.is_enabled)}
                    className={`relative inline-flex rounded-full transition-colors duration-200 ease-in-out focus-visible:ring-2 focus-visible:ring-primary outline-none ${
                      p.is_enabled ? 'bg-primary' : 'bg-elevated'
                    }`}
                    style={{ width: '40px', height: '22px' }}
                  >
                    <span
                      className="absolute top-0.5 left-0.5 inline-block rounded-full bg-white shadow transition-transform duration-200 ease-in-out"
                      style={{
                        width: '18px', height: '18px',
                        transform: p.is_enabled ? 'translateX(18px)' : 'translateX(0)',
                      }}
                    />
                  </button>
                  <span className={`text-[11px] font-medium ${p.is_enabled ? 'text-success' : 'text-muted'}`}>
                    {p.is_enabled ? 'On' : 'Off'}
                  </span>
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-4">
                  <ThresholdSlider
                    label="Amount Ceiling"
                    value={p.amount_ceiling}
                    min={100000} max={10000000} step={100000}
                    format={(v) => `₹${(v / 100000).toFixed(1)}L`}
                    onChange={(v) => updateLocalPattern(p.id, 'amount_ceiling', v)}
                  />
                  <ThresholdSlider
                    label="Time Window"
                    value={p.time_window_hours}
                    min={1} max={720} step={1}
                    format={(v) => `${v}h`}
                    onChange={(v) => updateLocalPattern(p.id, 'time_window_hours', v)}
                  />
                  <ThresholdSlider
                    label="Hop Count"
                    value={p.hop_count}
                    min={1} max={10} step={1}
                    format={(v) => `${v}`}
                    onChange={(v) => updateLocalPattern(p.id, 'hop_count', v)}
                  />
                  <ThresholdSlider
                    label="Income Multiplier"
                    value={p.multiplier}
                    min={1} max={20} step={0.5}
                    format={(v) => `${v}x`}
                    onChange={(v) => updateLocalPattern(p.id, 'multiplier', v)}
                  />
                </div>

                {isDirty && (
                  <div className="flex items-center justify-between pt-3 border-t border-border animate-slide-up">
                    <div className="flex items-center gap-1.5 text-[11px] text-warning">
                      <AlertCircle className="w-3 h-3" />
                      Unsaved changes
                    </div>
                    <button
                      onClick={() => savePattern(p.id)}
                      disabled={isSaving}
                      className="btn-primary text-xs py-1.5 px-3"
                    >
                      {isSaving ? (
                        <><div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Saving...</>
                      ) : (
                        <><Check className="w-3 h-3" /> Save Changes</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Alert Routing */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-elevated">
          <p className="text-[14px] font-semibold text-text">Alert Routing Rules</p>
          <p className="text-[11px] text-muted mt-0.5">Pattern type assignments to investigator teams</p>
        </div>
        <div className="divide-y divide-border/60">
          {[
            { pattern: 'Multi-Hop Layering', team: 'Financial Crime Unit — Team A', lead: 'Investigator Arjun Mehta' },
            { pattern: 'Circular Round-Trip', team: 'Financial Crime Unit — Team B', lead: 'Investigator Priya Sharma' },
            { pattern: 'Structuring', team: 'AML Compliance Unit', lead: 'Investigator Kavitha Nair' },
            { pattern: 'Dormant Reactivation', team: 'Financial Crime Unit — Team A', lead: 'Investigator Arjun Mehta' },
            { pattern: 'KYC Mismatch', team: 'KYC Compliance Unit', lead: 'Investigator Priya Sharma' },
          ].map(({ pattern, team, lead }) => (
            <div key={pattern} className="flex items-center justify-between px-5 py-3.5 hover:bg-elevated transition-colors">
              <div>
                <p className="text-[13px] text-text font-medium">{pattern}</p>
                <p className="text-[11px] text-muted mt-0.5">{team}</p>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-3 h-3 text-muted" />
                <span className="text-[11px] text-subtext">{lead}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System Config */}
      <div className="card p-5">
        <p className="text-[14px] font-semibold text-text mb-4">System Configuration</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
          <div className="space-y-0 sm:pr-5">
            {[
              ['Model Retraining Schedule', 'Daily at 02:00 IST'],
              ['Feedback Batch Size', '50 confirmed alerts'],
              ['Real-time Detection', 'Enabled (Supabase Realtime)'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
                <span className="text-[12px] text-muted">{label}</span>
                <span className="text-[12px] text-text font-medium">{value}</span>
              </div>
            ))}
          </div>
          <div className="space-y-0 sm:pl-5 pt-0">
            {[
              ['Report Template', 'goAML XML v2.0 (FIU-IND)'],
              ['Federated Sync Interval', 'Every 6 hours'],
              ['Data Retention Policy', '7 years (RBI mandate)'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
                <span className="text-[12px] text-muted">{label}</span>
                <span className="text-[12px] text-text font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Audit Log */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-elevated">
          <p className="text-[14px] font-semibold text-text">System Audit Log</p>
          <p className="text-[11px] text-muted mt-0.5">All investigator actions — read-only</p>
        </div>
        <div className="overflow-auto max-h-72">
          <table className="w-full">
            <thead className="sticky top-0 bg-elevated border-b border-border z-10">
              <tr>
                {['Time', 'Investigator', 'Action', 'Alert ID', 'Notes'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditLog.map((f) => (
                <tr key={f.id} className="tr-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted">
                      <Clock className="w-3 h-3" />
                      {timeAgo(f.created_at)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-subtext">{f.investigator_name.replace('Investigator ', '')}</td>
                  <td className="px-4 py-3">
                    <span className={`badge text-[10px] ${statusBg(f.investigator_action)}`}>{f.investigator_action}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted">{f.alert_id}</td>
                  <td className="px-4 py-3 text-[11px] text-subtext max-w-xs truncate">{f.notes}</td>
                </tr>
              ))}
              {auditLog.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-muted text-[13px]">No audit records yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ThresholdSlider({ label, value, min, max, step, format, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-muted uppercase tracking-widest">{label}</span>
        <span className="text-[12px] font-semibold text-text tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      <div className="flex items-center justify-between mt-1">
        <span className="text-[9px] text-muted">{format(min)}</span>
        <span className="text-[9px] text-muted">{format(max)}</span>
      </div>
    </div>
  );
}

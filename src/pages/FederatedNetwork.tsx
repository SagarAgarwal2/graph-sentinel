import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Shield, Lock, Activity, CheckCircle, Wifi, RefreshCw } from 'lucide-react';
import { type FederatedNode } from '../lib/supabase';
import { timeAgo } from '../lib/formatters';
import { fetchFederatedNodes } from '../lib/api';

const FEDERATED_ROUNDS = [
  { round: 1, f1: 0.71 }, { round: 2, f1: 0.75 }, { round: 3, f1: 0.79 },
  { round: 4, f1: 0.82 }, { round: 5, f1: 0.85 }, { round: 6, f1: 0.87 },
  { round: 7, f1: 0.89 }, { round: 8, f1: 0.90 }, { round: 9, f1: 0.91 }, { round: 10, f1: 0.92 },
];
const SINGLE_BANK_F1 = 0.71;

export default function FederatedNetwork() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<FederatedNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<FederatedNode | null>(null);

  useEffect(() => {
    fetchFederatedNodes().then((data) => { setNodes(data); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 500;
    const height = svgRef.current.clientHeight || 400;
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) * 0.36;
    const angleStep = (2 * Math.PI) / nodes.length;
    const g = svg.append('g');

    const defs = svg.append('defs');
    const hubGlow = defs.append('filter').attr('id', 'hub-glow');
    hubGlow.append('feGaussianBlur').attr('stdDeviation', '6').attr('result', 'blur');
    const hm = hubGlow.append('feMerge');
    hm.append('feMergeNode').attr('in', 'blur');
    hm.append('feMergeNode').attr('in', 'SourceGraphic');

    const nodeGlow = defs.append('filter').attr('id', 'node-glow');
    nodeGlow.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'blur');
    const nm = nodeGlow.append('feMerge');
    nm.append('feMergeNode').attr('in', 'blur');
    nm.append('feMergeNode').attr('in', 'SourceGraphic');

    // Spokes
    nodes.forEach((node, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const nx = cx + r * Math.cos(angle);
      const ny = cy + r * Math.sin(angle);
      const isActive = node.status === 'active';

      g.append('line')
        .attr('x1', cx).attr('y1', cy).attr('x2', nx).attr('y2', ny)
        .attr('stroke', isActive ? 'rgba(6,27,49,0.06)' : 'rgba(15,23,42,0.06)')
        .attr('stroke-width', node.id === 'FED_UNI' ? 1.5 : 0.75)
        .attr('stroke-dasharray', node.status === 'offline' ? '3,4' : 'none')
        .attr('opacity', isActive ? 0.7 : 0.3);
    });

    // Bank nodes
    nodes.forEach((node, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const nx = cx + r * Math.cos(angle);
      const ny = cy + r * Math.sin(angle);
      const isUBI = node.id === 'FED_UNI';
      const statusColor = node.status === 'active' ? 'var(--hds-success)' : node.status === 'syncing' ? '#F59E0B' : '#EF4444';
      const nr = isUBI ? 15 : 11;

      const ng = g.append('g').attr('transform', `translate(${nx},${ny})`).style('cursor', 'pointer')
        .on('click', () => setSelectedNode(node));

      if (isUBI) {
        ng.append('circle').attr('r', nr + 5).attr('fill', 'none').attr('stroke', 'var(--hds-primary)').attr('stroke-width', 1)
          .attr('opacity', 0.14).attr('filter', 'url(#hub-glow)');
      }

      ng.append('circle').attr('r', nr)
        .attr('fill', isUBI ? 'rgba(83,58,253,0.08)' : node.status === 'active' ? '#ffffff' : '#f8fafc')
        .attr('stroke', isUBI ? 'var(--hds-primary)' : statusColor)
        .attr('stroke-width', isUBI ? 1.75 : 1)
        .attr('filter', isUBI ? 'url(#node-glow)' : 'none');

      ng.append('text').text(node.bank_code.slice(0, 3))
        .attr('text-anchor', 'middle').attr('dy', '0.35em')
        .attr('font-size', isUBI ? '7.5px' : '6.5px')
        .attr('fill', isUBI ? 'var(--hds-primary)' : node.status === 'active' ? 'var(--hds-body)' : 'var(--hds-label)')
        .attr('font-weight', isUBI ? 'bold' : 'normal').style('font-family', 'JetBrains Mono, monospace');

      ng.append('circle').attr('r', 2.5).attr('cx', nr - 2).attr('cy', -(nr - 2)).attr('fill', statusColor);
    });

    // Hub
    g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 26)
      .attr('fill', 'rgba(83,58,253,0.04)').attr('stroke', 'rgba(83,58,253,0.14)').attr('stroke-width', 1.5)
      .attr('filter', 'url(#hub-glow)');

    g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 20)
      .attr('fill', 'rgba(43,109,239,0.04)').attr('stroke', 'rgba(43,109,239,0.15)').attr('stroke-width', 1);

    ['GRAPH', 'SENTINEL'].forEach((word, i) => {
      g.append('text').attr('x', cx).attr('y', cy).attr('text-anchor', 'middle')
        .attr('dy', i === 0 ? '-0.3em' : '0.9em').attr('font-size', '6.5px')
        .attr('fill', 'var(--hds-primary)').attr('font-weight', '600').attr('letter-spacing', '0.05em').text(word);
    });

    // Animated pulses
    const animateSync = () => {
      const active = nodes.filter((n) => n.status === 'active');
      if (!active.length) return;
      const node = active[Math.floor(Math.random() * active.length)];
      const idx = nodes.indexOf(node);
      const angle = idx * angleStep - Math.PI / 2;
      const nx = cx + r * Math.cos(angle);
      const ny = cy + r * Math.sin(angle);

      g.append('circle').attr('r', 3).attr('cx', nx).attr('cy', ny)
        .attr('fill', 'var(--hds-success)').attr('opacity', 0.9)
        .transition().duration(1400).ease(d3.easeLinear)
        .attr('cx', cx).attr('cy', cy).attr('r', 2.5).attr('opacity', 0).remove();
    };

    const interval = setInterval(animateSync, 500);
    return () => clearInterval(interval);
  }, [nodes]);

  const avgF1 = nodes.length > 0 ? nodes.reduce((s, n) => s + n.f1_score, 0) / nodes.length : 0;
  const avgPrecision = nodes.length > 0 ? nodes.reduce((s, n) => s + n.precision_score, 0) / nodes.length : 0;
  const avgRecall = nodes.length > 0 ? nodes.reduce((s, n) => s + n.recall_score, 0) / nodes.length : 0;
  const totalAlerts = nodes.reduce((s, n) => s + n.alerts_contributed, 0);
  const activeCount = nodes.filter((n) => n.status === 'active').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm text-subtext">Loading network...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 overflow-auto h-full">
      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Active Nodes', value: `${activeCount}/${nodes.length}`, valueClass: 'text-success' },
          { label: 'Total Alerts Shared', value: totalAlerts.toLocaleString(), valueClass: 'text-primary' },
          { label: 'Federated F1 Score', value: `${(avgF1 * 100).toFixed(1)}%`, valueClass: 'text-text' },
          { label: 'vs Single-Bank Baseline', value: `+${((avgF1 - SINGLE_BANK_F1) * 100).toFixed(1)}%`, valueClass: 'text-success' },
        ].map(({ label, value, valueClass }) => (
          <div key={label} className="card p-4">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-widest">{label}</p>
            <p className={`text-2xl font-semibold mt-1.5 ${valueClass}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Network Diagram */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border bg-elevated">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-1.5 h-1.5 rounded-full bg-success" />
                <div className="absolute inset-0 rounded-full bg-success animate-ping-slow" />
              </div>
              <p className="text-[13px] font-semibold text-text">Federated Network</p>
            </div>
            <p className="text-[10px] text-muted mt-0.5 ml-3.5">26 banks · PySyft privacy layer · live sync</p>
          </div>
          <svg ref={svgRef} className="w-full" style={{ height: '340px' }} />
        </div>

        {/* Right Column */}
        <div className="xl:col-span-2 space-y-5">
          {/* Model Performance */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-3.5 h-3.5 text-primary" />
              <p className="text-[13px] font-semibold text-text">Aggregate Model Performance</p>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Precision', value: avgPrecision, baseline: 0.72, color: '#2B6DEF' },
                { label: 'Recall', value: avgRecall, baseline: 0.70, color: '#10B981' },
                { label: 'F1 Score', value: avgF1, baseline: SINGLE_BANK_F1, color: '#F59E0B' },
              ].map(({ label, value, baseline, color }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] text-subtext">{label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-muted">Baseline {(baseline * 100).toFixed(0)}%</span>
                      <span className="text-[13px] font-semibold tabular-nums" style={{ color }}>{(value * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="relative h-1.5 bg-elevated rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 rounded-full opacity-20" style={{ width: `${baseline * 100}%`, backgroundColor: color }} />
                    <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                      style={{ width: `${value * 100}%`, backgroundColor: color }} />
                    <div className="absolute inset-y-0 w-0.5 bg-white/20" style={{ left: `${baseline * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* F1 Round Chart */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] font-semibold text-text">F1 Score Over Federated Rounds</p>
              <div className="flex items-center gap-3 text-[10px] text-muted">
                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-primary" /> Federated</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-px border-t border-dashed border-muted" /> Single-Bank</div>
              </div>
            </div>
            <div className="relative h-28">
              <div className="absolute left-0 right-0 border-t border-dashed border-border"
                style={{ bottom: `${(SINGLE_BANK_F1 - 0.65) / 0.30 * 100}%` }} />
              <div className="flex items-end gap-1 h-full">
                {FEDERATED_ROUNDS.map((d, i) => {
                  const pct = ((d.f1 - 0.65) / 0.30) * 100;
                  const isLast = i === FEDERATED_ROUNDS.length - 1;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                      <div
                        className="w-full rounded-t transition-all duration-700 relative"
                        style={{
                          height: `${pct}%`,
                          backgroundColor: isLast ? '#2B6DEF' : '#1E3A6A',
                        }}
                      >
                        {isLast && (
                          <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-primary font-bold whitespace-nowrap">
                            {(d.f1 * 100).toFixed(0)}%
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] text-muted group-hover:text-subtext transition-colors">{d.round}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 text-[10px]">
              <span className="text-muted">Round 1: 71.0%</span>
              <span className="text-primary font-semibold">Round 10: 92.0% (+21pp)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Privacy Compliance */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-md bg-[rgba(16,185,129,0.08)] border border-success/20 flex items-center justify-center">
              <Lock className="w-4 h-4 text-success" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-text">Data Privacy Shield</p>
              <p className="text-[10px] text-muted">RBI IT Framework 2016</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { icon: Lock, text: 'Zero raw customer data leaves bank perimeters' },
              { icon: Shield, text: 'Only encrypted gradient updates shared' },
              { icon: Activity, text: 'Differential privacy noise injection active' },
              { icon: CheckCircle, text: 'RBI data localisation compliant' },
              { icon: RefreshCw, text: 'Secure aggregation via PySyft v0.9' },
              { icon: Wifi, text: 'End-to-end TLS 1.3 encryption' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-md bg-[rgba(16,185,129,0.08)] border border-success/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-2.5 h-2.5 text-success" />
                </div>
                <span className="text-[11px] text-body leading-relaxed">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bank Table */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#e5edf5] bg-white">
            <p className="text-[13px] font-semibold text-navy">Bank Node Status</p>
          </div>
          <div className="overflow-auto max-h-80">
            <table className="w-full">
              <thead className="sticky top-0 bg-[#f8fafc] border-b border-[#e5edf5] z-10">
                <tr>
                  {['Bank', 'Status', 'Last Sync', 'Alerts', 'F1 Score', 'Version'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-body uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nodes.map((n) => {
                  const isUBI = n.id === 'FED_UNI';
                  const statusDot = n.status === 'active' ? 'bg-success' : n.status === 'syncing' ? 'bg-warning' : 'bg-danger';
                  const statusText = n.status === 'active' ? 'text-success' : n.status === 'syncing' ? 'text-warning' : 'text-danger';
                  const borderClass = isUBI ? 'border-l-2 border-l-primary' : n.status === 'active' ? 'border-l-2 border-l-success/40' : n.status === 'syncing' ? 'border-l-2 border-l-warning/40' : 'border-l-2 border-l-danger/40';

                  return (
                    <tr
                      key={n.id}
                      onClick={() => setSelectedNode(n)}
                      className={`tr-row cursor-pointer ${borderClass} ${selectedNode?.id === n.id ? 'bg-[rgba(83,58,253,0.02)]' : 'hover:bg-[rgba(83,58,253,0.01)]'}`}
                    >
                      <td className="px-4 py-3">
                        <span className={`text-[12px] font-medium ${isUBI ? 'text-primary' : 'text-navy'}`}>
                          {n.bank_name.length > 24 ? n.bank_name.slice(0, 24) + '…' : n.bank_name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${statusDot} ${n.status === 'syncing' ? 'animate-pulse' : ''}`} />
                          <span className={`text-[12px] font-medium ${statusText}`}>{n.status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-body">{timeAgo(n.last_sync_at)}</td>
                      <td className="px-4 py-3 text-[12px] text-body font-medium">{n.alerts_contributed}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-14 h-1.5 bg-[#e5edf5] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80" style={{ width: `${n.f1_score * 100}%` }} />
                          </div>
                          <span className="text-[12px] text-body font-medium">{(n.f1_score * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-body">{n.model_version}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

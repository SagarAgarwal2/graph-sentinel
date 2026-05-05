import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import {
  ZoomIn, ZoomOut, RotateCcw, X, ChevronRight,
  AlertTriangle, User, Building, SlidersHorizontal,
} from 'lucide-react';
import { supabase, type Account, type GraphEdge, type FraudAlert } from '../lib/supabase';
import { formatCurrency, timeAgo, riskColor, patternLabel, severityBg } from '../lib/formatters';

type NodeDatum = d3.SimulationNodeDatum & {
  id: string; account: Account; radius: number; color: string;
};
type LinkDatum = d3.SimulationLinkDatum<NodeDatum> & {
  edge: GraphEdge; sourceId: string; targetId: string;
};

const RISK_LEVELS = ['All', 'critical', 'high', 'medium', 'low'];

export default function FundFlowGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [filterRisk, setFilterRisk] = useState('All');
  const [filterSuspicious, setFilterSuspicious] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const simulationRef = useRef<d3.Simulation<NodeDatum, LinkDatum> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    const load = async () => {
      const [accRes, edgeRes, alertRes] = await Promise.all([
        supabase.from('accounts').select('*'),
        supabase.from('graph_edges').select('*'),
        supabase.from('fraud_alerts').select('*'),
      ]);
      setAccounts(accRes.data || []);
      setEdges(edgeRes.data || []);
      setAlerts(alertRes.data || []);
      setLoading(false);
    };
    load();
  }, []);

  const buildGraph = useCallback(() => {
    if (!svgRef.current || accounts.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 900;
    const height = svgRef.current.clientHeight || 600;

    let filteredAccounts = accounts;
    if (filterRisk !== 'All') filteredAccounts = accounts.filter((a) => a.risk_level === filterRisk);
    const accountIds = new Set(filteredAccounts.map((a) => a.id));

    let filteredEdges = edges.filter(
      (e) => accountIds.has(e.source_account_id) && accountIds.has(e.target_account_id)
    );
    if (filterSuspicious) filteredEdges = filteredEdges.filter((e) => e.is_suspicious);

    const volMap = new Map<string, number>();
    filteredEdges.forEach((e) => {
      volMap.set(e.source_account_id, (volMap.get(e.source_account_id) || 0) + e.total_amount);
      volMap.set(e.target_account_id, (volMap.get(e.target_account_id) || 0) + e.total_amount);
    });
    const maxVol = Math.max(...Array.from(volMap.values()), 1);

    const nodes: NodeDatum[] = filteredAccounts.map((a) => ({
      id: a.id, account: a,
      radius: 8 + ((volMap.get(a.id) || 0) / maxVol) * 20,
      color: riskColor(a.risk_level),
    }));
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const links: LinkDatum[] = filteredEdges
      .map((e) => ({
        source: nodeMap.get(e.source_account_id) as NodeDatum,
        target: nodeMap.get(e.target_account_id) as NodeDatum,
        edge: e, sourceId: e.source_account_id, targetId: e.target_account_id,
      }))
      .filter((l) => l.source && l.target);

    const defs = svg.append('defs');
    ['normal', 'suspicious'].forEach((type) => {
      defs.append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -4 8 8').attr('refX', 18).attr('refY', 0)
        .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto')
        .append('path').attr('d', 'M0,-4L8,0L0,4')
        .attr('fill', type === 'suspicious' ? '#EF4444' : '#374151');
    });

    const glowFilter = defs.append('filter').attr('id', 'node-glow');
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur');
    const gm = glowFilter.append('feMerge');
    gm.append('feMergeNode').attr('in', 'blur');
    gm.append('feMergeNode').attr('in', 'SourceGraphic');

    const g = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => g.attr('transform', event.transform.toString()));
    zoomRef.current = zoom;
    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.75));

    const link = g.append('g').selectAll<SVGLineElement, LinkDatum>('line')
      .data(links).join('line')
      .attr('stroke', (d) => d.edge.is_suspicious ? '#EF444480' : '#1F2937')
      .attr('stroke-width', (d) => d.edge.is_suspicious ? 1.75 : 0.75)
      .attr('marker-end', (d) => d.edge.is_suspicious ? 'url(#arrow-suspicious)' : 'url(#arrow-normal)')
      .style('cursor', 'pointer')
      .on('click', (_e, d) => { setSelectedEdge(d.edge); setSelectedAccount(null); });

    const alertGroups = alerts
      .filter((a) => a.status !== 'dismissed')
      .map((a) => ({
        alert: a,
        nodes: a.involved_accounts.map((id) => nodeMap.get(id)).filter(Boolean) as NodeDatum[],
      }))
      .filter((g) => g.nodes.length >= 2);
    const hullG = g.append('g');

    const node = g.append('g').selectAll<SVGGElement, NodeDatum>('g')
      .data(nodes).join('g').style('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, NodeDatum>()
          .on('start', (event, d) => {
            if (!event.active && simulationRef.current) simulationRef.current.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on('end', (event, d) => {
            if (!event.active && simulationRef.current) simulationRef.current.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      )
      .on('click', (_e, d) => { setSelectedAccount(d.account); setSelectedEdge(null); });

    node.filter((d) => d.account.risk_level === 'critical')
      .append('circle')
      .attr('r', (d) => d.radius + 5)
      .attr('fill', 'none').attr('stroke', '#EF4444').attr('stroke-width', 1)
      .attr('opacity', 0.25);

    node.append('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => d.color + '1a')
      .attr('stroke', (d) => d.color)
      .attr('stroke-width', (d) => d.account.risk_level === 'critical' ? 2 : 1.25)
      .attr('filter', (d) => d.account.risk_level !== 'low' ? 'url(#node-glow)' : 'none');

    node.append('rect')
      .attr('x', (d) => -(d.account.holder_name.split(' ')[0].length * 3))
      .attr('y', (d) => d.radius + 7)
      .attr('width', (d) => d.account.holder_name.split(' ')[0].length * 6)
      .attr('height', 13)
      .attr('rx', 3)
      .attr('fill', '#0B0F14').attr('opacity', 0.7);

    node.append('text')
      .text((d) => d.account.holder_name.split(' ')[0])
      .attr('dy', (d) => d.radius + 17)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#9CA3AF')
      .attr('font-family', 'Inter, sans-serif')
      .style('pointer-events', 'none');

    const simulation = d3.forceSimulation<NodeDatum>(nodes)
      .force('link', d3.forceLink<NodeDatum, LinkDatum>(links).id((d) => d.id).distance(110))
      .force('charge', d3.forceManyBody().strength(-280))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide<NodeDatum>().radius((d) => d.radius + 12))
      .on('tick', () => {
        link
          .attr('x1', (d) => (d.source as NodeDatum).x!)
          .attr('y1', (d) => (d.source as NodeDatum).y!)
          .attr('x2', (d) => (d.target as NodeDatum).x!)
          .attr('y2', (d) => (d.target as NodeDatum).y!);
        node.attr('transform', (d) => `translate(${d.x},${d.y})`);

        hullG.selectAll('path').remove();
        alertGroups.forEach(({ alert, nodes: hn }) => {
          const pts = hn.map((n) => [n.x!, n.y!] as [number, number]);
          const pad = 30;
          const padded: [number, number][] = pts.flatMap(([x, y]) => [
            [x - pad, y - pad], [x + pad, y - pad], [x - pad, y + pad], [x + pad, y + pad],
          ]);
          const hull = d3.polygonHull(padded);
          if (!hull) return;
          const color = alert.severity === 'critical' ? '#EF4444' : alert.severity === 'high' ? '#F59E0B' : '#F59E0B';
          hullG.append('path').datum(hull)
            .attr('d', (d) => `M${d.join('L')}Z`)
            .attr('fill', color + '0d')
            .attr('stroke', color + '50')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '5,4')
            .style('pointer-events', 'none');
        });
      });

    simulationRef.current = simulation;

    const animateParticles = () => {
      links.filter((l) => l.edge.is_suspicious).forEach((l) => {
        const src = l.source as NodeDatum;
        const tgt = l.target as NodeDatum;
        if (!src.x || !tgt.x) return;
        g.append('circle').attr('r', 2.5).attr('fill', '#EF4444').attr('opacity', 0.85)
          .attr('cx', src.x).attr('cy', src.y)
          .transition().duration(1600).ease(d3.easeLinear)
          .attr('cx', tgt.x).attr('cy', tgt.y).attr('opacity', 0).remove();
      });
    };
    const interval = setInterval(animateParticles, 900);
    return () => { clearInterval(interval); simulation.stop(); };
  }, [accounts, edges, alerts, filterRisk, filterSuspicious]);

  useEffect(() => {
    if (!loading) return buildGraph();
  }, [loading, buildGraph]);

  const handleZoom = (factor: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(280).call(zoomRef.current.scaleBy, factor);
  };
  const handleReset = () => {
    if (!svgRef.current || !zoomRef.current) return;
    const w = svgRef.current.clientWidth, h = svgRef.current.clientHeight;
    d3.select(svgRef.current).transition().duration(400)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(w / 2, h / 2).scale(0.75));
  };

  const accountAlerts = selectedAccount ? alerts.filter((a) => a.involved_accounts.includes(selectedAccount.id)) : [];

  return (
    <div className="flex h-full relative overflow-hidden">
      {/* Canvas */}
      <div className="flex-1 relative bg-bg">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-sm text-subtext">Loading graph data...</span>
            </div>
          </div>
        )}
        <svg ref={svgRef} className="w-full h-full" />

        {/* Zoom Controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-1.5">
          {[
            { icon: ZoomIn, label: 'Zoom in', action: () => handleZoom(1.3) },
            { icon: ZoomOut, label: 'Zoom out', action: () => handleZoom(0.77) },
            { icon: RotateCcw, label: 'Reset view', action: handleReset },
          ].map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              onClick={action}
              title={label}
              className="group relative p-2.5 glass rounded-md text-muted hover:text-text hover:bg-elevated transition-all duration-150"
            >
              <Icon className="w-4 h-4" />
              <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-elevated text-text text-[11px] rounded-md opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity duration-200 border border-border shadow-panel">
                {label}
              </div>
            </button>
          ))}
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`absolute top-4 left-4 flex items-center gap-2 px-3 py-2 glass rounded-md text-[12px] transition-all duration-150 ${
            showFilters || filterRisk !== 'All' || filterSuspicious
              ? 'text-primary border-primary/40'
              : 'text-muted hover:text-text'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {(filterRisk !== 'All' || filterSuspicious) && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          )}
        </button>

        {/* Filter Panel */}
        {showFilters && (
          <div className="absolute top-14 left-4 glass rounded-lg p-4 w-52 space-y-4 z-10 shadow-panel animate-slide-up">
            <div>
              <p className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">Risk Level</p>
              <div className="space-y-0.5">
                {RISK_LEVELS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setFilterRisk(r)}
                    className={`w-full text-left text-[12px] px-2.5 py-1.5 rounded-md transition-colors capitalize ${
                      filterRisk === r ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-elevated hover:text-subtext'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">Show Only</p>
              <label className="flex items-center gap-2 text-[12px] text-muted cursor-pointer hover:text-text transition-colors">
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    filterSuspicious ? 'bg-primary border-primary' : 'bg-transparent border-border'
                  }`}
                  onClick={() => setFilterSuspicious(!filterSuspicious)}
                >
                  {filterSuspicious && <div className="w-2 h-2 bg-white rounded-sm" />}
                </div>
                Suspicious flows only
              </label>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 flex items-center gap-5 px-3.5 py-2 glass rounded-md text-[10px]">
          {[
            { color: '#10B981', label: 'Clean' },
            { color: '#F59E0B', label: 'Medium' },
            { color: '#F59E0B', label: 'High' },
            { color: '#EF4444', label: 'Critical' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full border" style={{ backgroundColor: color + '33', borderColor: color }} />
              <span className="text-muted">{label}</span>
            </div>
          ))}
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-px bg-danger" />
            <span className="text-muted">Suspicious</span>
          </div>
        </div>

        {/* Node count */}
        <div className="absolute bottom-4 right-4 px-3 py-1.5 glass rounded-md text-[11px] text-muted">
          {accounts.length} nodes · {edges.length} edges
        </div>
      </div>

      {/* Detail Panel */}
      {(selectedAccount || selectedEdge) && (
        <div className="w-80 bg-card border-l border-border flex flex-col overflow-hidden flex-shrink-0 shadow-panel animate-slide-up">
          {selectedAccount && (
            <div className="h-0.5 flex-shrink-0" style={{ backgroundColor: riskColor(selectedAccount.risk_level) }} />
          )}
          {selectedEdge && <div className="h-0.5 flex-shrink-0 bg-danger" />}

          <div className="flex items-center justify-between px-4 py-3.5 border-b border-border flex-shrink-0">
            <h3 className="text-[13px] font-semibold text-text">
              {selectedAccount ? 'Account Profile' : 'Transaction Link'}
            </h3>
            <button
              onClick={() => { setSelectedAccount(null); setSelectedEdge(null); }}
              className="p-1.5 text-muted hover:text-text hover:bg-elevated rounded-md transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedAccount && (
              <>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 border"
                    style={{
                      backgroundColor: riskColor(selectedAccount.risk_level) + '15',
                      borderColor: riskColor(selectedAccount.risk_level) + '40',
                    }}
                  >
                    {selectedAccount.account_type === 'current'
                      ? <Building className="w-4 h-4" style={{ color: riskColor(selectedAccount.risk_level) }} />
                      : <User className="w-4 h-4" style={{ color: riskColor(selectedAccount.risk_level) }} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-text leading-tight">{selectedAccount.holder_name}</p>
                    <p className="text-[11px] text-muted mt-0.5">{selectedAccount.bank_branch}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className="badge text-[11px] font-semibold capitalize"
                    style={{
                      backgroundColor: riskColor(selectedAccount.risk_level) + '18',
                      color: riskColor(selectedAccount.risk_level),
                      borderColor: riskColor(selectedAccount.risk_level) + '40',
                    }}
                  >
                    {selectedAccount.risk_level} risk
                  </span>
                  <span className="text-[11px] text-muted">Score: {selectedAccount.risk_score}/100</span>
                </div>

                <div className="space-y-0 divide-y divide-border/50 rounded-md overflow-hidden border border-border bg-elevated">
                  <p className="px-3 py-2 text-[10px] font-semibold text-muted uppercase tracking-widest">KYC Profile</p>
                  {[
                    ['Account ID', selectedAccount.id, true],
                    ['Type', selectedAccount.account_type],
                    ['Profession', selectedAccount.declared_profession.replace(/_/g, ' ')],
                    ['Declared Income', formatCurrency(selectedAccount.declared_annual_income) + '/yr'],
                    ['Last Activity', timeAgo(selectedAccount.last_activity_at)],
                  ].map(([label, value, mono]) => (
                    <div key={label as string} className="flex items-start justify-between gap-2 px-3 py-2">
                      <span className="text-[11px] text-muted flex-shrink-0">{label}</span>
                      <span className={`text-[11px] text-subtext text-right ${mono ? 'font-mono text-[10px]' : ''}`}>{value}</span>
                    </div>
                  ))}
                </div>

                {selectedAccount.is_dormant && (
                  <div className="flex items-center gap-2 p-2.5 bg-[rgba(245,158,11,0.06)] border border-warning/20 rounded-md text-[11px] text-warning">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    This account was dormant before recent activity
                  </div>
                )}

                {accountAlerts.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">Linked Alerts ({accountAlerts.length})</p>
                    <div className="space-y-2">
                      {accountAlerts.map((a) => (
                        <div key={a.id} className="p-2.5 bg-elevated border border-border rounded-md hover:border-[#374151] transition-colors">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`badge text-[10px] ${severityBg(a.severity)}`}>{a.severity.toUpperCase()}</span>
                            <span className="text-[10px] text-muted">{(a.confidence_score * 100).toFixed(0)}%</span>
                          </div>
                          <p className="text-[12px] text-text leading-tight">{patternLabel(a.pattern_type)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {selectedEdge && (
              <div className="space-y-0 divide-y divide-border/50 rounded-md overflow-hidden border border-border bg-elevated">
                <p className="px-3 py-2 text-[10px] font-semibold text-muted uppercase tracking-widest">Fund Flow Details</p>
                {[
                  ['Source', selectedEdge.source_account_id, true],
                  ['Destination', selectedEdge.target_account_id, true],
                  ['Total Volume', formatCurrency(selectedEdge.total_amount)],
                  ['Transactions', selectedEdge.transaction_count.toString()],
                  ['Last Transfer', timeAgo(selectedEdge.last_transaction_at)],
                ].map(([label, value, mono]) => (
                  <div key={label as string} className="flex items-start justify-between gap-2 px-3 py-2">
                    <span className="text-[11px] text-muted flex-shrink-0">{label}</span>
                    <span className={`text-[11px] text-subtext text-right ${mono ? 'font-mono text-[10px]' : ''}`}>{value}</span>
                  </div>
                ))}
                {selectedEdge.is_suspicious && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-[rgba(239,68,68,0.06)] text-[11px] text-danger">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Flagged as suspicious flow
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedAccount && (
            <div className="px-4 py-3 border-t border-border flex-shrink-0">
              <button className="w-full btn-secondary text-xs flex items-center justify-center gap-1.5">
                View Full Transaction History <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

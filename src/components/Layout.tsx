import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, GitFork, ShieldAlert, FileText,
  Network, Settings, Bell, ChevronLeft, ChevronRight,
  Activity, AlertTriangle, Shield,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const navItems = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/graph',      icon: GitFork,         label: 'Fund Flow Graph' },
  { to: '/alerts',     icon: ShieldAlert,     label: 'Fraud Alerts',    badge: true },
  { to: '/reports',    icon: FileText,        label: 'STR / CTR Reports' },
  { to: '/federated',  icon: Network,         label: 'Federated Network' },
  { to: '/settings',   icon: Settings,        label: 'Settings' },
];

const PAGE_META: Record<string, { title: string; sub: string }> = {
  '/dashboard':  { title: 'Command Center',              sub: 'Real-time transaction monitoring and alert overview' },
  '/graph':      { title: 'Fund Flow Graph',             sub: 'Interactive fund flow visualization powered by D3.js' },
  '/alerts':     { title: 'Fraud Alert Workbench',       sub: 'AI-powered fraud detection with SHAP causal analysis' },
  '/reports':    { title: 'STR / CTR Reports',           sub: 'Auto-generated goAML-compliant documentation' },
  '/federated':  { title: 'Federated Learning Network',  sub: '26-bank privacy-preserving AI network' },
  '/settings':   { title: 'Settings & Configuration',    sub: 'Detection thresholds, routing rules and audit trail' },
};

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [openAlerts, setOpenAlerts] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const location = useLocation();

  useEffect(() => {
    const fetchAlerts = async () => {
      const { count } = await supabase
        .from('fraud_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');
      setOpenAlerts(count || 0);
    };
    fetchAlerts();

    const channel = supabase
      .channel('layout_alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fraud_alerts' }, fetchAlerts)
      .subscribe();

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => { supabase.removeChannel(channel); clearInterval(timer); };
  }, []);

  const meta = PAGE_META[location.pathname] ?? { title: 'GraphSentinel', sub: '' };

  return (
    <div className="flex h-screen bg-bg text-text overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className={`flex flex-col bg-white border-r border-[#e5edf5] transition-all duration-300 ease-in-out flex-shrink-0 ${collapsed ? 'w-14' : 'w-60'}`}>

        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 h-14 border-b border-[#e5edf5] ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <div>
              <div className="text-[15px] font-semibold text-navy leading-tight tracking-tight">GraphSentinel</div>
              <div className="text-[10px] text-body leading-tight">Union Bank of India</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {!collapsed && (
            <p className="px-2 mb-2 pt-1 text-[10px] font-semibold text-body uppercase tracking-widest">Menu</p>
          )}
          {navItems.map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-2.5 py-2 rounded-md transition-all duration-100 group relative ${
                  isActive
                    ? 'nav-active'
                    : 'text-body hover:bg-[rgba(83,58,253,0.04)] hover:text-navy'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive ? 'text-primary' : 'text-body'}`} strokeWidth={isActive ? 2.25 : 1.75} />
                  {!collapsed && (
                    <span className="text-[13px] font-medium flex-1 leading-none">{label}</span>
                  )}
                  {!collapsed && badge && openAlerts > 0 && (
                    <span className="bg-danger text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {openAlerts}
                    </span>
                  )}
                  {collapsed && badge && openAlerts > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full" />
                  )}
                  {collapsed && (
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-elevated text-text text-[12px] rounded-md opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-50 border border-border shadow-panel transition-opacity duration-150">
                      {label}
                    </div>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Online indicator */}
        {!collapsed && (
          <div className="px-4 py-3 border-t border-[#e5edf5]">
            <div className="flex items-center gap-2">
              <div className="relative w-2 h-2">
                <div className="w-2 h-2 rounded-full bg-success" />
                <div className="absolute inset-0 rounded-full bg-success animate-ping-slow" />
              </div>
              <span className="text-[11px] text-body">All systems operational</span>
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-9 border-t border-[#e5edf5] text-body hover:text-navy hover:bg-[rgba(83,58,253,0.04)] transition-all duration-100"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="flex items-center justify-between px-6 h-14 bg-white border-b border-[#e5edf5] flex-shrink-0">
          <div>
            <h1 className="text-[15px] font-semibold text-navy leading-tight">{meta.title}</h1>
            <p className="text-[11px] text-body leading-tight mt-px">{meta.sub}</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Clock */}
            <div className="hidden lg:block text-right">
              <div className="text-[12px] font-mono text-body">
                {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-[10px] text-body">
                {currentTime.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
              </div>
            </div>

            <div className="w-px h-6 bg-[#e5edf5]" />

            {/* Bell */}
            <button className="relative p-2 rounded-md text-body hover:bg-[rgba(83,58,253,0.04)] hover:text-navy transition-all duration-100">
              <Bell className="w-4 h-4" />
              {openAlerts > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-danger rounded-full" />
              )}
            </button>

            {/* Alert chip */}
            {openAlerts > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-md">
                <AlertTriangle className="w-3 h-3 text-danger" />
                <span className="text-[11px] text-danger font-semibold">{openAlerts} Alert{openAlerts !== 1 ? 's' : ''}</span>
              </div>
            )}

            <div className="w-px h-6 bg-[#e5edf5]" />

            {/* User */}
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[rgba(83,58,253,0.1)] border border-[rgba(83,58,253,0.2)] flex items-center justify-center text-[11px] font-semibold text-primary">
                AM
              </div>
              <div className="hidden sm:block">
                <div className="text-[12px] font-medium text-navy leading-tight">Arjun Mehta</div>
                <div className="text-[10px] text-body leading-tight">Senior Investigator</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-auto">
          <div key={location.pathname} className="page-enter h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

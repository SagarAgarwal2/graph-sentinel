# GraphSentinel - Reusable Component Code Snippets

## 1. BASE COMPONENTS

### Card Component
```tsx
interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = '', hover = true }: CardProps) {
  return (
    <div className={`
      bg-white rounded-lg border border-[#e5edf5] shadow-[0px_4px_12px_rgba(0,0,0,0.3)]
      ${hover ? 'hover:shadow-[0px_8px_24px_rgba(0,0,0,0.45)] transition-shadow duration-300' : ''}
      ${className}
    `}>
      {children}
    </div>
  );
}
```

### Badge Component
```tsx
type BadgeVariant = 'critical' | 'high' | 'medium' | 'low' | 'primary' | 'success';

interface BadgeProps {
  label: string;
  variant: BadgeVariant;
  icon?: React.ReactNode;
}

const BADGE_STYLES: Record<BadgeVariant, string> = {
  critical: 'bg-[rgba(239,68,68,0.1)] text-[#EF4444] border border-[#EF4444]/30',
  high:     'bg-[rgba(245,158,11,0.1)] text-[#F59E0B] border border-[#F59E0B]/30',
  medium:   'bg-[rgba(245,158,11,0.08)] text-[#F59E0B] border border-[#F59E0B]/20',
  low:      'bg-[rgba(16,185,129,0.1)] text-[#10B981] border border-[#10B981]/30',
  primary:  'bg-[rgba(83,58,253,0.1)] text-[#533afd] border border-[#533afd]/30',
  success:  'bg-[rgba(21,190,83,0.1)] text-[#15be53] border border-[#15be53]/30',
};

export function Badge({ label, variant, icon }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold ${BADGE_STYLES[variant]}`}>
      {icon && <span className="w-3 h-3">{icon}</span>}
      {label}
    </span>
  );
}
```

### Button Component
```tsx
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  loading?: boolean;
}

const BUTTON_STYLES = {
  primary: 'bg-[#533afd] text-white hover:bg-[#4434d4]',
  secondary: 'bg-transparent text-[#273951] border border-[#e5edf5] hover:bg-[rgba(83,58,253,0.04)]',
  danger: 'bg-[#EF4444] text-white hover:bg-[#DC2626]',
  success: 'bg-[#15be53] text-white hover:bg-[#059669]',
};

const SIZE_STYLES = {
  sm: 'px-3 py-1.5 text-[12px]',
  md: 'px-4 py-2 text-[13px]',
  lg: 'px-6 py-3 text-[14px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center gap-2 rounded-md font-medium transition-all duration-200
        ${BUTTON_STYLES[variant]} ${SIZE_STYLES[size]}
        ${loading ? 'opacity-75 cursor-not-allowed' : ''}
      `}
      disabled={loading}
      {...props}
    >
      {loading ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : icon}
      {children}
    </button>
  );
}
```

---

## 2. LAYOUT COMPONENTS

### Sidebar Navigation
```tsx
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: number;
}

interface SidebarProps {
  items: NavItem[];
  logo: { icon: React.ReactNode; title: string; subtitle?: string };
}

export function Sidebar({ items, logo }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`
      flex flex-col bg-white border-r border-[#e5edf5] transition-all duration-300
      flex-shrink-0 ${collapsed ? 'w-14' : 'w-60'}
    `}>
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 h-14 border-b border-[#e5edf5] ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-md bg-[#533afd] flex items-center justify-center flex-shrink-0 text-white">
          {logo.icon}
        </div>
        {!collapsed && (
          <div>
            <div className="text-[15px] font-semibold text-[#061b31] leading-tight">{logo.title}</div>
            {logo.subtitle && <div className="text-[10px] text-[#64748d] leading-tight">{logo.subtitle}</div>}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {!collapsed && <p className="px-2 mb-2 pt-1 text-[10px] font-semibold text-[#64748d] uppercase tracking-widest">Menu</p>}
        {items.map(({ to, icon: Icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `
              flex items-center gap-3 px-2.5 py-2 rounded-md transition-all duration-100 group relative
              ${isActive
                ? 'text-[#533afd] bg-[rgba(83,58,253,0.1)]'
                : 'text-[#64748d] hover:bg-[rgba(83,58,253,0.04)] hover:text-[#061b31]'
              }
            `}
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#533afd]' : 'text-[#64748d]'}`} />
                {!collapsed && <span className="text-[13px] font-medium flex-1">{label}</span>}
                {!collapsed && badge && <span className="bg-[#EF4444] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">{badge}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-9 border-t border-[#e5edf5] text-[#64748d] hover:text-[#061b31] hover:bg-[rgba(83,58,253,0.04)] transition-all"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>
    </aside>
  );
}
```

### Header Component
```tsx
interface HeaderProps {
  title: string;
  subtitle?: string;
  rightContent?: React.ReactNode;
}

export function Header({ title, subtitle, rightContent }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 h-14 bg-white border-b border-[#e5edf5] flex-shrink-0">
      <div>
        <h1 className="text-[15px] font-semibold text-[#061b31] leading-tight">{title}</h1>
        {subtitle && <p className="text-[11px] text-[#64748d] leading-tight mt-px">{subtitle}</p>}
      </div>
      {rightContent}
    </header>
  );
}
```

---

## 3. DATA DISPLAY COMPONENTS

### KPI Card
```tsx
interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  iconColor?: string;
  iconBg?: string;
  trend?: { value: number; direction: 'up' | 'down' };
}

export function KpiCard({ title, value, subtitle, icon, iconColor, iconBg, trend }: KpiCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between p-5">
        <div className="flex-1">
          <p className="text-[12px] text-[#64748d] font-medium mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-[28px] font-semibold text-[#061b31]">{value}</p>
            {trend && (
              <span className={`text-[12px] font-semibold ${trend.direction === 'up' ? 'text-[#15be53]' : 'text-[#EF4444]'}`}>
                {trend.direction === 'up' ? '↑' : '↓'} {trend.value}%
              </span>
            )}
          </div>
          {subtitle && <p className="text-[11px] text-[#9CA3AF] mt-1">{subtitle}</p>}
        </div>
        {icon && (
          <div className={`p-2.5 rounded-md ${iconBg || 'bg-[rgba(83,58,253,0.1)}'}`}>
            <div className={iconColor || 'text-[#533afd]'}>{icon}</div>
          </div>
        )}
      </div>
    </Card>
  );
}
```

### Status Table Row
```tsx
interface TableRowProps {
  riskLevel?: 'critical' | 'high' | 'medium' | 'low';
  data: Record<string, React.ReactNode>;
  onExpand?: () => void;
  isExpanded?: boolean;
}

const RISK_STYLES = {
  critical: 'border-l-[#EF4444]',
  high:     'border-l-[#F59E0B]',
  medium:   'border-l-[#2B6DEF]',
  low:      'border-l-[#6B7280]',
};

export function TableRow({ riskLevel, data, onExpand, isExpanded }: TableRowProps) {
  return (
    <div className={`
      flex items-center px-5 py-3.5 border-l-4
      ${riskLevel ? RISK_STYLES[riskLevel] : 'border-l-transparent'}
      hover:bg-[rgba(83,58,253,0.02)] transition-colors cursor-pointer
      ${isExpanded ? 'bg-[rgba(83,58,253,0.04)]' : 'bg-white'}
    `} onClick={onExpand}>
      <div className="flex-1 grid grid-cols-4 gap-4">
        {Object.values(data).map((value, i) => (
          <div key={i} className="text-[13px] text-[#061b31]">{value}</div>
        ))}
      </div>
    </div>
  );
}
```

### Live Indicator
```tsx
export function LiveIndicator() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-2 h-2">
        <div className="w-2 h-2 rounded-full bg-[#15be53]" />
        <div className="absolute inset-0 rounded-full bg-[#15be53] animate-ping" />
      </div>
      <span className="text-[11px] text-[#64748d] font-medium">Live</span>
    </div>
  );
}
```

---

## 4. FILTER & CONTROL COMPONENTS

### Tab Navigation
```tsx
interface TabsProps {
  tabs: string[];
  activeTab: string;
  onChange: (tab: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="flex gap-0 border-b border-[#e5edf5]">
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`
            px-4 py-3 text-[13px] font-medium border-b-2 transition-colors
            ${activeTab === tab
              ? 'text-[#533afd] border-b-[#533afd]'
              : 'text-[#64748d] border-b-transparent hover:text-[#061b31]'
            }
          `}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      ))}
    </div>
  );
}
```

### Filter Controls
```tsx
interface FilterControlsProps {
  filters: Record<string, string | boolean>;
  onChange: (key: string, value: string | boolean) => void;
}

export function FilterControls({ filters, onChange }: FilterControlsProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      {Object.entries(filters).map(([key, value]) => (
        <div key={key} className="flex items-center gap-2">
          <label className="text-[12px] font-medium text-[#273951]">{key}</label>
          {typeof value === 'boolean' ? (
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => onChange(key, e.target.checked)}
              className="w-4 h-4 rounded cursor-pointer"
            />
          ) : (
            <select
              value={value}
              onChange={(e) => onChange(key, e.target.value)}
              className="px-2 py-1 text-[12px] border border-[#e5edf5] rounded-md focus:outline-none focus:border-[#533afd]"
            >
              <option value="">{key}</option>
            </select>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Risk Level Selector
```tsx
const RISK_OPTIONS = ['All', 'critical', 'high', 'medium', 'low'];

interface RiskFilterProps {
  selected: string;
  onChange: (risk: string) => void;
}

export function RiskFilter({ selected, onChange }: RiskFilterProps) {
  return (
    <div className="flex gap-2">
      {RISK_OPTIONS.map(risk => (
        <button
          key={risk}
          onClick={() => onChange(risk)}
          className={`
            px-3 py-1.5 text-[12px] font-medium rounded-md transition-all
            ${selected === risk
              ? 'bg-[#533afd] text-white'
              : 'bg-[#e5edf5] text-[#273951] hover:bg-[#d1d8e5]'
            }
          `}
        >
          {risk}
        </button>
      ))}
    </div>
  );
}
```

---

## 5. UTILITY COMPONENTS

### Loading Spinner
```tsx
interface LoadingProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = { sm: 'w-4 h-4', md: 'w-7 h-7', lg: 'w-10 h-10' };

export function Loading({ label = 'Loading...', size = 'md' }: LoadingProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <div className={`${SIZE_MAP[size]} rounded-full border-2 border-[#533afd] border-t-transparent animate-spin`} />
        <span className="text-[13px] text-[#9CA3AF]">{label}</span>
      </div>
    </div>
  );
}
```

### Empty State
```tsx
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <div className="text-[#9CA3AF] mb-4">{icon}</div>
      <h3 className="text-[15px] font-semibold text-[#061b31] mb-2">{title}</h3>
      {message && <p className="text-[12px] text-[#64748d] mb-4 text-center max-w-xs">{message}</p>}
      {action && (
        <Button onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

### Alert Box
```tsx
type AlertType = 'error' | 'warning' | 'success' | 'info';

interface AlertProps {
  type: AlertType;
  title: string;
  message?: string;
  onClose?: () => void;
}

const ALERT_STYLES: Record<AlertType, { bg: string; border: string; text: string; icon: string }> = {
  error:   { bg: 'bg-[rgba(239,68,68,0.1)]', border: 'border-[#EF4444]/30', text: 'text-[#EF4444]', icon: '❌' },
  warning: { bg: 'bg-[rgba(245,158,11,0.1)]', border: 'border-[#F59E0B]/30', text: 'text-[#F59E0B]', icon: '⚠️' },
  success: { bg: 'bg-[rgba(21,190,83,0.1)]', border: 'border-[#15be53]/30', text: 'text-[#15be53]', icon: '✓' },
  info:    { bg: 'bg-[rgba(83,58,253,0.1)]', border: 'border-[#533afd]/30', text: 'text-[#533afd]', icon: 'ℹ️' },
};

export function Alert({ type, title, message, onClose }: AlertProps) {
  const style = ALERT_STYLES[type];
  return (
    <div className={`${style.bg} border ${style.border} rounded-md p-4 flex items-start gap-3`}>
      <span className="text-lg flex-shrink-0">{style.icon}</span>
      <div className="flex-1">
        <h4 className={`text-[13px] font-semibold ${style.text}`}>{title}</h4>
        {message && <p className={`text-[12px] ${style.text} opacity-80 mt-1`}>{message}</p>}
      </div>
      {onClose && (
        <button onClick={onClose} className={`text-lg flex-shrink-0 cursor-pointer hover:opacity-75`}>✕</button>
      )}
    </div>
  );
}
```

---

## 6. UTILITY FORMATTERS

```tsx
// Currency Formatting (Indian rupees)
export function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000)   return `₹${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000)     return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

// Time-ago formatting
export function timeAgo(dateStr: string): string {
  const diffMs    = Date.now() - new Date(dateStr).getTime();
  const diffMins  = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays  = Math.floor(diffHours / 24);
  
  if (diffMins < 1)   return 'Just now';
  if (diffMins < 60)  return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30)  return `${diffDays}d ago`;
  return formatDate(dateStr);
}

// Date formatting
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { 
    day: '2-digit', month: 'short', year: 'numeric' 
  });
}

// DateTime formatting
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// Pattern label
export function patternLabel(patternType: string): string {
  const labels: Record<string, string> = {
    multi_hop_layering:   'Multi-Hop Layering',
    circular_round_trip:  'Circular Round-Trip',
    structuring:          'Structuring',
    dormant_reactivation: 'Dormant Reactivation',
    kyc_mismatch:         'KYC Mismatch',
  };
  return labels[patternType] || patternType;
}
```

---

## 7. FULL PAGE EXAMPLE

```tsx
import { useState, useEffect } from 'react';
import { Card, Badge, Button, Tabs, KpiCard, Loading } from './components';
import { Header, Sidebar } from './layouts';
import { BarChart3, TrendingUp, AlertCircle } from 'lucide-react';

export function ExampleDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setData({ metrics: { revenue: 125000, alerts: 12, transactions: 1542 } });
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) return <Loading label="Loading dashboard..." />;

  return (
    <div className="min-h-screen bg-[#f9fafc]">
      <Header 
        title="Dashboard" 
        subtitle="Real-time performance overview"
        rightContent={<div className="text-[13px] text-[#64748d]">Last updated: now</div>}
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard 
            title="Total Revenue"
            value="₹12.5L"
            subtitle="+5% from last month"
            icon={<TrendingUp className="w-5 h-5" />}
            iconBg="bg-[rgba(21,190,83,0.1)]"
            iconColor="text-[#15be53]"
          />
          <KpiCard 
            title="Active Alerts"
            value="12"
            subtitle="3 critical"
            icon={<AlertCircle className="w-5 h-5" />}
            iconBg="bg-[rgba(239,68,68,0.1)]"
            iconColor="text-[#EF4444]"
          />
          <KpiCard 
            title="Transactions"
            value="1,542"
            subtitle="+125 today"
            icon={<BarChart3 className="w-5 h-5" />}
            iconBg="bg-[rgba(83,58,253,0.1)]"
            iconColor="text-[#533afd]"
          />
        </div>

        {/* Content Card */}
        <Card>
          <div className="px-6 py-4 border-b border-[#e5edf5]">
            <h2 className="text-[15px] font-semibold text-[#061b31]">Recent Activity</h2>
          </div>
          
          <div className="px-6 py-4">
            <Tabs 
              tabs={['all', 'success', 'error']} 
              activeTab={activeTab} 
              onChange={setActiveTab}
            />
            <div className="mt-4 space-y-2">
              {/* Table content */}
              <div className="flex items-center justify-between p-3 hover:bg-[rgba(83,58,253,0.02)]">
                <span className="text-[13px] text-[#061b31]">Transaction #12345</span>
                <Badge label="Completed" variant="success" />
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
```

---

## Quick Reference

**Import Statement:**
```tsx
import { 
  Card, Badge, Button, Tabs, KpiCard, Loading, EmptyState, Alert,
  Sidebar, Header, RiskFilter, TableRow, LiveIndicator
} from '@/components';
```

**Tailwind Config Extension:**
```js
{
  colors: {
    primary: '#533afd',
    'primary-hover': '#4434d4',
    navy: '#061b31',
    danger: '#EF4444',
    success: '#15be53',
    warning: '#F59E0B',
  },
  boxShadow: {
    card: '0px 4px 12px rgba(0,0,0,0.3)',
    'card-hover': '0px 8px 24px rgba(0,0,0,0.45)',
  }
}
```

All components are fully typed with TypeScript and support customization through props.

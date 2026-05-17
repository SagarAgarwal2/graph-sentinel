# GraphSentinel UI Features Reference Guide

## Overview
A comprehensive list of UI components, patterns, and design features from the Graph Sentinel project that can be applied to other websites.

---

## 1. DESIGN SYSTEM & TOKENS

### Color Palette (Stripe-inspired)
```css
--hds-primary: #533afd;           /* Stripe Purple */
--hds-primary-hover: #4434d4;     /* Purple hover state */
--hds-navy: #061b31;              /* Deep Navy text */
--hds-brand-dark: #1c1e54;        /* Brand dark */
--hds-dark-navy: #0d253d;         /* Darker navy */
--hds-border: #e5edf5;            /* Light border */
--hds-text: #061b31;              /* Main text */
--hds-label: #273951;             /* Label text */
--hds-body: #64748d;              /* Body/secondary text */
--hds-bg: #ffffff;                /* Background */
--hds-success: #15be53;           /* Success green */
--hds-ruby: #ea2261;              /* Ruby red */
--hds-magenta: #f96bee;           /* Magenta */
--hds-warning: #F59E0B;           /* Warning amber */
--hds-danger: #EF4444;            /* Danger red */
```

### Typography
- **Font Family**: `sohne-var` (local), fallback to `Inter`, `SF Pro Display`, system-ui
- **Mono Font**: `SourceCodePro`, `JetBrains Mono`
- **Display Hero**: 56px, 300 weight, -1.4px letter-spacing
- **Display Large**: 48px, 300 weight, -0.96px letter-spacing
- **Headings**: 300 weight, -0.02em letter-spacing
- **Body Text**: 14px, 13px for labels, 11px for secondary text

### Shadows & Effects
```css
--card-shadow: 0px 4px 12px rgba(0,0,0,0.3);
--card-hover-shadow: 0px 8px 24px rgba(0,0,0,0.45);
--panel-shadow: 0 24px 48px rgba(0,0,0,0.6);
--blue-glow: 0 0 16px rgba(43,109,239,0.25);
```

### Animations
- **fade-in**: 0.18s ease-out
- **slide-up**: 0.18s ease-out (translateY 6px)
- **ping-slow**: 2s infinite (scale 1 → 1.6)

---

## 2. LAYOUT & STRUCTURE

### Main Layout Architecture
```
┌─────────────────────────────────────┐
│          HEADER (14h)               │
├──────────┬──────────────────────────┤
│          │                          │
│ SIDEBAR  │      MAIN CONTENT        │
│(w-60/w14)│    (Outlet/Page)         │
│          │                          │
├──────────┤                          │
│ Footer   │                          │
└──────────┴──────────────────────────┘
```

### Sidebar Features
- **Collapsible**: Toggle between expanded (w-60) and collapsed (w-14)
- **Logo Section**: Icon + branding text/subtitle
- **Navigation Menu**: Icon-based items with labels
- **Badge System**: Shows counts on nav items (e.g., "3 Alerts")
- **Online Status Indicator**: Green dot + "All systems operational"
- **Collapse Toggle**: Chevron button at bottom

### Header Features
- **Page Meta**: Title + subtitle based on current route
- **Live Clock**: Shows time (HH:MM:SS format) + date
- **Alert Indicator**: Bell icon + red dot badge
- **Alert Chip**: Displays open alert count with icon
- **User Profile**: Avatar (initials) + name + role

---

## 3. COMPONENT LIBRARY

### KPI Cards
**Features:**
- Icon with background color
- Title + large value
- Subtitle/secondary metric
- Neutral card styling with subtle shadows
- Responsive grid layout (2 cols mobile, 4 cols desktop)

**Usage:**
```tsx
<KpiCard
  title="Transactions Today"
  value="1,234"
  sub="+12 in last hour"
  icon={<ActivityIcon />}
  iconColor="text-primary"
  iconBg="bg-primary/10"
/>
```

### Status & Severity Badges
**Severity Levels:**
- **Critical**: Red background `rgba(239,68,68,0.1)` + border
- **High**: Amber background `rgba(245,158,11,0.1)` + border
- **Medium**: Light background with border
- **Low**: Transparent border only

**Status States:**
- **Open**: Blue badge
- **Confirmed**: Red badge
- **Dismissed**: Gray badge
- **Pending**: Amber badge
- **Completed**: Green badge
- **Draft**: Amber badge
- **Submitted**: Green badge

### Channel Pills
- **NEFT**: Blue
- **RTGS**: Amber/Orange
- **UPI**: Green
- **Core**: Gray

### Data Tables
**Features:**
- Sortable columns (ascending/descending indicators)
- Filterable by status tabs
- Row selection capabilities
- Expandable row details
- Smooth transitions and hover states

### Risk Level Indicators
```css
critical: 'border-l-4 border-red-500'
high:     'border-l-4 border-amber-400'
medium:   'border-l-4 border-blue-400'
low:      'border-l-4 border-gray-400'
```

### Cards & Panels
- **Elevated Cards**: White background, subtle shadow, border
- **Hover Effects**: Shadow elevation on hover
- **Border**: Soft purple (`#d6d9fc`) or standard (`#e5edf5`)
- **Rounded**: 6-8px border radius

---

## 4. NAVIGATION PATTERNS

### Navigation Items (Sidebar)
- **Icon**: 16-18px with color transitions
- **Label**: 13px font weight 500
- **Active State**: Purple text + purple background
- **Hover State**: Light purple background (rgba)
- **Badge**: Red badge with count or dot indicator
- **Tooltip**: On hover when collapsed (positioned right)

### Tab Navigation
- **Tab Style**: Subtle underline or background
- **Active**: Bold text + color
- **Inactive**: Gray text
- **Responsive**: Horizontal scroll on mobile

---

## 5. INTERACTIVE ELEMENTS

### Buttons
- **Primary**: Purple background, hover darkens to `#4434d4`
- **Secondary**: Transparent, icon-based hover states
- **Danger**: Red background for destructive actions
- **Success**: Green background for confirmations
- **Sizes**: Regular (h-10), Small (h-8), Icon (square)

### Input Fields
- **Text Input**: Border `#e5edf5`, focus `#533afd`
- **Range Input**: Custom styled with gradient
- **Checkbox**: Custom styling with color variants
- **Dropdown**: Purple focus state, smooth transitions

### Modals & Overlays
- **Background**: Overlay with rgba(0,0,0,0.5)
- **Modal Panel**: White background, shadow, rounded corners
- **Close Button**: X icon, hover state
- **Actions**: Primary (blue) + Secondary (gray) buttons

### Filters & Controls
- **Filter Toggle**: Icon button with active state
- **Date Range Picker**: Custom input with calendar
- **Risk Filter**: Button group with active styling
- **Search Box**: Icon + input field combined

---

## 6. DATA VISUALIZATION COMPONENTS

### Live Feed
- **Live Indicator**: Animated green dot + "Live Transaction Feed"
- **Animation**: Pulse effect on indicator
- **Scroll**: Smooth infinite scroll behavior
- **Card Layout**: Transaction cards with key details

### D3 Graph (Fund Flow)
- **Nodes**: Color-coded by risk level, sized by volume
- **Edges**: Direction arrows, suspicious highlighted in red
- **Zoom**: Pan and zoom controls (buttons)
- **Filters**: Risk level filter + suspicious flag toggle
- **Node Interactions**: Click to select, highlight connections
- **Glow Effects**: Blue glow for selected nodes

### Metrics/Charts
- **Mini Charts**: Inline sparklines for trends
- **Bar Charts**: Horizontal/vertical layout with colors
- **Pie/Donut**: Pattern distribution visualization
- **Time Series**: Line charts with gradients

---

## 7. LIST VIEWS & TABLES

### Transaction List
- **Columns**: Account, Amount, Channel, Type, Time
- **Sorting**: Click header to sort ascending/descending
- **Filtering**: By channel, type, date range
- **Row Highlight**: Flagged transactions with subtle background
- **Actions**: View details, expand row

### Alert Workbench
- **Status Tabs**: All, Open, Confirmed, Dismissed
- **Sortable By**: Created at, Confidence score, Amount
- **Expand Row**: Shows detailed alert information
- **Actions**: Confirm/Dismiss buttons
- **Notes Section**: Add investigator notes

### Report List
- **Columns**: Report ID, Type (STR/CTR), Status, Amount, Created
- **Status Badges**: Draft, Submitted, Completed
- **Actions**: Download, Edit, Delete, Submit
- **Bulk Actions**: Select multiple + action

---

## 8. FORMS & WORKFLOWS

### Multi-Step Forms
- **Step Indicator**: Progress bar or numbered steps
- **Form Sections**: Clear grouped inputs
- **Validation**: Real-time feedback, error messages
- **Submit Button**: Disabled until valid

### Alert Response Form
- **Status Selector**: Open → Confirmed/Dismissed
- **Notes Field**: Text area with character count
- **Submit Button**: Loading state
- **Success Toast**: Confirmation message

### Report Generation
- **Type Selection**: STR vs CTR radio buttons
- **Alert Selection**: Checkbox list with filtering
- **Preview**: Generated XML display
- **Export**: Download button with format options

---

## 9. LOADING & STATE PATTERNS

### Loading States
- **Spinner**: Circular loader with primary color
- **Loading Text**: "Loading..." + context
- **Skeleton**: Placeholder shimmer effect
- **Progress Bar**: For long operations

### Empty States
- **Icon**: Relevant icon (inbox, alert, etc.)
- **Message**: Clear explanation of empty state
- **CTA**: "Create new" or "Go back" button

### Error States
- **Alert Box**: Red background with icon
- **Error Message**: Clear explanation + action button
- **Retry Button**: Re-attempt failed action

---

## 10. RESPONSIVE DESIGN

### Breakpoints (Tailwind)
- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

### Mobile Optimizations
- **Sidebar**: Hamburger menu or bottom nav
- **Hidden Elements**: Clock, user role hidden on small screens
- **Stacked Grids**: 2 cols on mobile, 4 cols on desktop
- **Touch Targets**: 44px minimum height

### Adaptive Layouts
- **Cards**: Full width on mobile, grid layout on desktop
- **Tables**: Horizontal scroll or card view on mobile
- **Modals**: Full screen on mobile, centered on desktop

---

## 11. ACCESSIBILITY FEATURES

### Semantic HTML
- `<nav>`, `<main>`, `<header>`, `<aside>` tags
- Proper heading hierarchy (h1, h2, h3)
- Form labels linked to inputs
- ARIA labels for icons

### Keyboard Navigation
- Tab through interactive elements
- Enter/Space to activate buttons
- Escape to close modals
- Arrow keys for navigation in menus

### Visual Indicators
- Focus states on all interactive elements
- Clear color contrast ratios
- Hover/focus states consistent
- Active navigation indicator

---

## 12. TECHNOLOGY STACK

### Dependencies
```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^7.14.2",
  "d3": "^7.9.0",
  "lucide-react": "^0.344.0",
  "@tanstack/react-query": "^5.100.9",
  "@supabase/supabase-js": "^2.57.4"
}
```

### Styling
- **Tailwind CSS**: Utility-first CSS framework
- **PostCSS**: CSS transformation
- **Custom Fonts**: Inter, Source Code Pro from Google Fonts
- **Animations**: CSS keyframes + Tailwind utilities

### Build Tools
- **Vite**: Fast build tool + dev server
- **TypeScript**: Type safety
- **ESLint**: Code linting

---

## 13. COPY & PASTE CODE SNIPPETS

### Alert Badge Component
```tsx
<span className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold ${severityBg(severity)}`}>
  {label}
</span>
```

### Live Indicator
```tsx
<div className="flex items-center gap-2">
  <div className="relative w-2 h-2">
    <div className="w-2 h-2 rounded-full bg-success" />
    <div className="absolute inset-0 rounded-full bg-success animate-ping-slow" />
  </div>
  <span className="text-[11px] text-body">All systems operational</span>
</div>
```

### Collapsible Sidebar Navigation
```tsx
<aside className={`flex flex-col bg-white border-r border-border transition-all duration-300 ${collapsed ? 'w-14' : 'w-60'}`}>
  {/* Logo */}
  {/* Nav Items */}
  {/* Collapse Toggle */}
</aside>
```

### Status Tab Filter
```tsx
<div className="flex gap-2 border-b border-border">
  {STATUS_TABS.map(tab => (
    <button 
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`px-3 py-2 text-[13px] font-medium transition-colors ${
        activeTab === tab 
          ? 'text-primary border-b-2 border-primary' 
          : 'text-body hover:text-text'
      }`}
    >
      {tab.charAt(0).toUpperCase() + tab.slice(1)}
    </button>
  ))}
</div>
```

### KPI Card
```tsx
<div className="card">
  <div className="flex items-start justify-between p-5">
    <div>
      <p className="text-[12px] text-body font-medium mb-1">{title}</p>
      <p className="text-[28px] font-semibold text-text">{value}</p>
      <p className="text-[11px] text-subtext mt-1">{sub}</p>
    </div>
    <div className={`p-2.5 rounded-md ${iconBg}`}>
      {icon}
    </div>
  </div>
</div>
```

### Row with Left Border
```tsx
<div className={`px-5 py-3.5 border-l-4 ${RISK_CELL[riskLevel]}`}>
  {/* Content */}
</div>
```

### Loading Spinner
```tsx
<div className="flex items-center justify-center h-full">
  <div className="flex flex-col items-center gap-3">
    <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    <span className="text-sm text-subtext">Loading...</span>
  </div>
</div>
```

---

## 14. DESIGN PATTERNS TO IMPLEMENT

### 1. Progressive Disclosure
- Hide detailed information until needed
- Click to expand rows/sections
- Collapsible sidebar for more space

### 2. Status-Based Styling
- Different colors for severity levels
- Visual feedback for user actions
- Badge counts for quick scanning

### 3. Real-time Indicators
- Animated pulse for live data
- Clock display for time context
- Alert badges with counts

### 4. Micro-interactions
- Hover state elevation (shadows)
- Smooth transitions (0.18s - 0.3s)
- Icon color changes on state changes

### 5. Contextual Help
- Tooltips on hover (collapsed sidebar)
- Subtitle text under titles
- Icon + label combinations

### 6. Consistent Spacing
- 6px base unit: 6, 12, 18, 24, 30px
- Padding: 12px (p-3), 16px (p-4), 20px (p-5)
- Gap between items: 12px (gap-3), 16px (gap-4)

---

## 15. QUICK IMPLEMENTATION CHECKLIST

- [ ] Set up Tailwind CSS with custom config
- [ ] Define CSS variables for colors
- [ ] Import fonts (Inter, Source Code Pro)
- [ ] Create base card component with shadow
- [ ] Create badge component with variants
- [ ] Create button component (primary/secondary)
- [ ] Create KPI card component
- [ ] Set up sidebar with toggle
- [ ] Create header with clock/alerts
- [ ] Create status tabs component
- [ ] Create data table with sorting
- [ ] Create D3 graph component
- [ ] Add animations and transitions
- [ ] Test responsive design
- [ ] Verify accessibility

---

## 16. EXAMPLE PAGE STRUCTURES

### Dashboard Page
```
├── KPI Cards Strip (4 cards)
├── 2-Column Layout
│   ├── Live Transaction Feed (left)
│   └── Risk Distribution (right)
└── Branch Risk Table (full width)
```

### Alerts Page
```
├── Status Tabs (all, open, confirmed, dismissed)
├── Sort Controls
├── Alert List
│   └── Expandable Row Details
└── Detail Panel (right side)
    ├── Alert Summary
    ├── Transaction Links
    └── Action Buttons
```

### Graph Page
```
├── Filter Controls (risk, suspicious toggle)
├── D3 Graph (main area)
├── Node Details Panel (right)
└── Zoom/Pan Controls
```

---

## 17. FILES STRUCTURE

```
src/
├── components/
│   ├── Layout.tsx           (Main layout wrapper)
│   └── [Card/Button comps]
├── pages/
│   ├── Dashboard.tsx
│   ├── FraudAlerts.tsx
│   ├── FundFlowGraph.tsx
│   ├── Reports.tsx
│   ├── FederatedNetwork.tsx
│   └── Settings.tsx
├── lib/
│   ├── api.ts              (API calls)
│   ├── supabase.ts         (DB types)
│   ├── formatters.ts       (Utility functions)
│   └── goaml.ts            (Export logic)
├── App.tsx                 (Router setup)
├── main.tsx                (Entry point)
├── index.css               (Global styles)
└── vite-env.d.ts

tailwind.config.js          (Color config)
tsconfig.app.json           (TypeScript)
vite.config.ts              (Build config)
```

---

## Summary

This design system emphasizes:
✅ **Clean, professional aesthetics** (Stripe-inspired)
✅ **Accessibility & usability**
✅ **Data-driven visualization**
✅ **Responsive mobile-first design**
✅ **Micro-interactions & smooth animations**
✅ **Color-coded status/severity indicators**
✅ **Real-time monitoring capabilities**
✅ **Efficient space utilization**

All components are built with **Tailwind CSS** and **React**, making them highly reusable and customizable.

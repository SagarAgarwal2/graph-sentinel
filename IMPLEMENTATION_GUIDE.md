# GraphSentinel - Quick Implementation Guide

## 📋 Visual Reference

### Color Palette

```
Primary Colors:
  Purple     #533afd  (Main interactions)
  Navy       #061b31  (Text/Headers)
  White      #ffffff  (Backgrounds)
  Border     #e5edf5  (Dividers)

Status Colors:
  Success    #15be53  (Green - Positive)
  Danger     #EF4444  (Red - Critical)
  Warning    #F59E0B  (Amber - Warning)
  Info       #2B6DEF  (Blue - Information)

Neutral Palette:
  Label      #273951  (Form labels)
  Body       #64748d  (Secondary text)
  Subtext    #9CA3AF  (Tertiary text)
  Muted      #6B7280  (Disabled state)
```

---

## 🎨 Component Anatomy

### Standard Card
```
┌─────────────────────────────────┐
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓│
│  ┃ Card Title                  ┃│  ← Border: #e5edf5
│  ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫│  ← Shadow: 0px 4px 12px
│  ┃ Content content content ... ┃│
│  ┃ content content content ... ┃│
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛│
└─────────────────────────────────┘
  Hover: Shadow increases to 0px 8px 24px
  Border-radius: 6-8px
  Padding: 16-20px
```

### Badge
```
┌─────────────────────┐
│ 🔴 Critical Alert   │  ← Icon optional
│                     │  ← BG: rgba(239,68,68,0.1)
│ Text: #EF4444       │  ← Border: #EF4444/30
└─────────────────────┘  ← Padding: 10px x 16px, border-radius: 6px
```

### KPI Card
```
┌──────────────────────────────────────┐
│  Transactions Today          📊      │  ← Icon on right
│  1,234                               │  ← Large value
│  +12 in last hour                    │  ← Subtitle
└──────────────────────────────────────┘
  Responsive: 2 cols mobile, 4 cols desktop
```

### Button Variants
```
Primary:      [Blue Button] bg-#533afd  → hover: #4434d4
Secondary:    [Gray Button] border      → hover: rgba(83,58,253,0.04)
Danger:       [Red Button]  bg-#EF4444  → hover: #DC2626
Success:      [Green Button] bg-#15be53 → hover: #059669

Sizes:
  Small:      px-3 py-1.5  text-12px
  Medium:     px-4 py-2    text-13px
  Large:      px-6 py-3    text-14px
```

### Status Badges (Inline)
```
┌──────────────────┐  Critical
│ 🔴 Critical      │  bg-[rgba(239,68,68,0.1)]
│ text: #EF4444    │  border: #EF4444/30
└──────────────────┘

┌──────────────────┐  High
│ 🟠 High          │  bg-[rgba(245,158,11,0.1)]
│ text: #F59E0B    │  border: #F59E0B/30
└──────────────────┘

┌──────────────────┐  Medium
│ 🔵 Medium        │  bg-[rgba(43,109,239,0.1)]
│ text: #2B6DEF    │  border: #2B6DEF/30
└──────────────────┘

┌──────────────────┐  Low
│ ⚪ Low           │  bg-transparent
│ text: #6B7280    │  border: #9CA3AF/50
└──────────────────┘
```

---

## 🚀 Implementation Steps

### Step 1: Setup Tailwind CSS
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Step 2: Configure Colors
Update `tailwind.config.js`:
```js
export default {
  theme: {
    extend: {
      colors: {
        primary: '#533afd',
        'primary-hover': '#4434d4',
        navy: '#061b31',
        danger: '#EF4444',
        success: '#15be53',
        warning: '#F59E0B',
        body: '#64748d',
        muted: '#6B7280',
      },
      boxShadow: {
        card: '0px 4px 12px rgba(0,0,0,0.3)',
        'card-hover': '0px 8px 24px rgba(0,0,0,0.45)',
      },
      animation: {
        'fade-in': 'fadeIn 0.18s ease-out',
        'slide-up': 'slideUp 0.18s ease-out',
        'ping-slow': 'pingSlow 2s infinite',
      },
    },
  },
};
```

### Step 3: Import Fonts
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

@layer base {
  html {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}
```

### Step 4: Create Base Components
1. Card component
2. Badge component
3. Button component
4. Loading component

### Step 5: Build Layout
1. Sidebar navigation
2. Header with meta info
3. Main content area
4. Outlet for pages

### Step 6: Add Page Components
1. Dashboard with KPI cards
2. Data tables with sorting/filtering
3. Detail panels with expandable rows

### Step 7: Implement Interactivity
1. Tab navigation
2. Status filters
3. Sort controls
4. Modal dialogs

---

## ✅ Implementation Checklist

### Design System
- [ ] Define color tokens in CSS variables
- [ ] Set up typography scale
- [ ] Create shadow utilities
- [ ] Add animation keyframes
- [ ] Test accessibility contrast

### Layout Components
- [ ] Build sidebar with collapse toggle
- [ ] Create header with meta display
- [ ] Add main content wrapper
- [ ] Implement responsive grid

### Base Components
- [ ] Card (with hover state)
- [ ] Badge (all variants)
- [ ] Button (all variants)
- [ ] Loading spinner
- [ ] Empty state
- [ ] Alert box

### Data Components
- [ ] KPI card (with trend)
- [ ] Table row (with status border)
- [ ] Expandable list item
- [ ] Tag/pill component
- [ ] Badge with count

### Form Components
- [ ] Text input
- [ ] Select dropdown
- [ ] Checkbox
- [ ] Radio button
- [ ] Tab navigation
- [ ] Filter controls

### Interactive Features
- [ ] Sortable columns (indicators)
- [ ] Status filters
- [ ] Search functionality
- [ ] Modal dialogs
- [ ] Toast notifications
- [ ] Tooltips

### Pages
- [ ] Dashboard page
- [ ] List/Table page
- [ ] Detail panel page
- [ ] Settings page
- [ ] Reports page

### Responsive Design
- [ ] Mobile navigation (hamburger)
- [ ] Tablet layout (sidebar partial)
- [ ] Desktop layout (full width)
- [ ] Touch targets (44px minimum)
- [ ] Orientation handling

### Accessibility
- [ ] Semantic HTML
- [ ] ARIA labels
- [ ] Keyboard navigation
- [ ] Focus indicators
- [ ] Color contrast (WCAG AA)

### Performance
- [ ] Lazy load components
- [ ] Optimize images
- [ ] Code splitting
- [ ] CSS purging (Tailwind)
- [ ] Bundle analysis

---

## 📐 Spacing Reference

```
Base Unit: 6px (multiplied for all spacing)

Padding:
  p-0.5 = 2px
  p-1   = 4px
  p-2   = 8px
  p-3   = 12px ✓ Common
  p-4   = 16px ✓ Common
  p-5   = 20px ✓ Common
  p-6   = 24px

Gaps:
  gap-1 = 4px
  gap-2 = 8px
  gap-3 = 12px ✓ Common
  gap-4 = 16px ✓ Common

Widths:
  w-14 = 56px (collapsed sidebar)
  w-60 = 240px (expanded sidebar)

Heights:
  h-14 = 56px (header/footer)
  h-9  = 36px (button)
  h-10 = 40px (input)
```

---

## 🎯 Common Patterns

### Pattern 1: Status-Based Row Styling
```tsx
<div className={`border-l-4 px-4 py-3 ${RISK_CELL[riskLevel]}`}>
  {/* Content */}
</div>

// Left border colors: red (#EF4444), amber (#F59E0B), blue (#2B6DEF), gray (#6B7280)
```

### Pattern 2: Hover Elevation
```tsx
<Card className="hover:shadow-card-hover">
  {/* Content */}
</Card>

// Shadow transitions from 0px 4px 12px to 0px 8px 24px on hover
```

### Pattern 3: Badge with Icon
```tsx
<span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-[rgba(239,68,68,0.1)] text-[#EF4444] border border-[#EF4444]/30">
  <Icon className="w-3 h-3" />
  Label
</span>
```

### Pattern 4: Live Indicator
```tsx
<div className="flex items-center gap-2">
  <div className="relative w-2 h-2">
    <div className="w-2 h-2 rounded-full bg-success" />
    <div className="absolute inset-0 rounded-full bg-success animate-ping-slow" />
  </div>
  <span className="text-[11px] text-body">Live</span>
</div>
```

### Pattern 5: Sortable Column Header
```tsx
<button onClick={() => handleSort(column)} className="flex items-center gap-1 font-medium">
  {label}
  {sortBy === column && (
    sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
  )}
</button>
```

---

## 🔧 Development Tips

### Using Tailwind Arbitrary Values
```tsx
// When you need values not in config
<div className="shadow-[0px_4px_12px_rgba(0,0,0,0.3)]">
<div className="text-[13px]">
<div className="gap-2.5">
```

### Custom CSS Classes
```css
@layer components {
  .card {
    @apply bg-white rounded-lg border border-[#e5edf5] shadow-[0px_4px_12px_rgba(0,0,0,0.3)];
  }
  
  .btn-primary {
    @apply px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover transition-colors;
  }
}
```

### Responsive Prefixes
```tsx
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
<div className="hidden lg:block">
<div className="w-full md:w-1/2">
```

### Animation Timing
```tsx
// Smooth transitions
<div className="transition-all duration-300">

// Faster UI feedback
<div className="transition-colors duration-100">

// Slow animations
<div className="transition-all duration-500">
```

---

## 📱 Responsive Breakpoints

```
Mobile:   < 640px   (full width layouts, stacked)
Tablet:   640-1024px (2 column grids)
Desktop:  > 1024px   (3-4 column grids)

Example:
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* 1 col on mobile, 2 on tablet, 4 on desktop */}
</div>
```

---

## 🎬 Animation Library

### Fade In
```tsx
<div className="animate-fade-in">Appears smoothly</div>
```

### Slide Up
```tsx
<div className="animate-slide-up">Slides up on appearance</div>
```

### Ping/Pulse
```tsx
<div className="animate-ping-slow">Pulsing dot animation</div>
```

### Spin (Loading)
```tsx
<div className="animate-spin">Loading spinner</div>
```

---

## 📊 Data Visualization Tips

### D3 Graph Integration
```tsx
import * as d3 from 'd3';

// Color scale
const colorScale = d3.scaleOrdinal()
  .domain(['critical', 'high', 'medium', 'low'])
  .range(['#EF4444', '#F59E0B', '#2B6DEF', '#6B7280']);

// Force simulation
const simulation = d3.forceSimulation(nodes)
  .force('link', d3.forceLink(links).distance(100))
  .force('charge', d3.forceManyBody().strength(-200));
```

### Chart Styling
- Use brand colors consistently
- Add subtle grid lines
- Include legends
- Add tooltips on hover
- Export to CSV/PDF capability

---

## 🔐 Security Best Practices

- Sanitize user input in forms
- Use HTTPS for API calls
- Validate data on both client & server
- Use environment variables for API keys
- Implement rate limiting
- Add CSRF tokens if using sessions

---

## 📈 Performance Optimization

```tsx
// Lazy load heavy components
const Graph = lazy(() => import('./Graph'));

// Memoize expensive renders
const MemoizedCard = memo(Card);

// Use virtualization for long lists
<FixedSizeList height={600} itemCount={1000} itemSize={35}>
  {Row}
</FixedSizeList>

// Debounce search inputs
const debouncedSearch = useMemo(
  () => debounce((query) => search(query), 300),
  []
);
```

---

## 🚨 Common Mistakes to Avoid

1. ❌ Using colors hex directly → Use CSS variables/Tailwind
2. ❌ Hard-coded spacing values → Use Tailwind scale
3. ❌ Missing hover/focus states → All interactive elements need visual feedback
4. ❌ Ignoring mobile responsiveness → Test on actual devices
5. ❌ Poor contrast ratios → Use accessible color combinations
6. ❌ No loading states → Users need feedback for async operations
7. ❌ Inconsistent typography → Define typography scale upfront
8. ❌ Animation delays too long → Keep under 0.5s for UI feedback

---

## 📚 File Structure Template

```
src/
├── components/
│   ├── ui/
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── Loading.tsx
│   │   └── Alert.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── Layout.tsx
│   ├── data/
│   │   ├── Table.tsx
│   │   ├── KpiCard.tsx
│   │   └── Chart.tsx
│   └── index.ts (exports)
├── pages/
│   ├── Dashboard.tsx
│   ├── Analytics.tsx
│   └── Settings.tsx
├── lib/
│   ├── api.ts
│   ├── formatters.ts
│   ├── constants.ts
│   └── utils.ts
├── styles/
│   └── globals.css
├── App.tsx
└── main.tsx

tailwind.config.js
tsconfig.json
vite.config.ts
```

---

## 💡 Quick Links to Components

| Component | File | Lines |
|-----------|------|-------|
| Sidebar | Layout.tsx | 20-100 |
| Header | Layout.tsx | 100-150 |
| KPI Card | Dashboard.tsx | 40-80 |
| Badge | formatters.ts | All status/severity |
| Tabs | FraudAlerts.tsx | Filter implementation |
| Table Row | FraudAlerts.tsx | Expandable pattern |
| D3 Graph | FundFlowGraph.tsx | Visualization |
| Loading | Multiple | Consistent pattern |

---

Ready to implement? Start with Step 1 and work through the checklist!

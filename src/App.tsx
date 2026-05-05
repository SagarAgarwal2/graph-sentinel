import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import FundFlowGraph from './pages/FundFlowGraph';
import FraudAlerts from './pages/FraudAlerts';
import Reports from './pages/Reports';
import FederatedNetwork from './pages/FederatedNetwork';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="graph" element={<FundFlowGraph />} />
          <Route path="alerts" element={<FraudAlerts />} />
          <Route path="reports" element={<Reports />} />
          <Route path="federated" element={<FederatedNetwork />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

import type {
  Account,
  FederatedNode,
  FraudAlert,
  FraudPattern,
  InvestigatorFeedback,
  GraphEdge,
  StrCtrReport,
  Transaction,
} from './supabase';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed for ${path}`);
  }

  return payload as T;
}

export async function fetchDashboardSummary() {
  return request<Record<string, number>>('/api/summary');
}

export async function fetchTransactions(limit = 200) {
  const { data } = await request<{ data: Transaction[] }>(`/api/transactions?limit=${limit}`);
  return data || [];
}

export async function fetchAlerts() {
  const { data } = await request<{ data: FraudAlert[] }>('/api/fraud-alerts');
  return data || [];
}

export async function fetchAccounts() {
  const { data } = await request<{ data: Account[] }>('/api/accounts');
  return data || [];
}

export async function fetchReports() {
  const { data } = await request<{ data: StrCtrReport[] }>('/api/reports');
  return data || [];
}

export async function fetchPatterns() {
  const { data } = await request<{ data: FraudPattern[] }>('/api/fraud-patterns');
  return data || [];
}

export async function fetchFederatedNodes() {
  const { data } = await request<{ data: FederatedNode[] }>('/api/federated-nodes');
  return data || [];
}

export async function fetchGraph() {
  return request<{ nodes: Account[]; edges: GraphEdge[] }>('/api/graph');
}

export async function fetchFeedback(alertId: string) {
  const { data } = await request<{ data: InvestigatorFeedback[] }>(`/api/investigator-feedback?alert_id=${encodeURIComponent(alertId)}`);
  return data || [];
}

export async function fetchAuditLog(limit = 30) {
  const { data } = await request<{ data: InvestigatorFeedback[] }>(`/api/investigator-feedback?limit=${limit}`);
  return data || [];
}

export async function updateAlert(payload: Partial<FraudAlert> & { id: string }) {
  return request<{ alert: FraudAlert }>('/api/fraud-alerts', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function updatePattern(payload: Partial<FraudPattern> & { id: string }) {
  return request<{ pattern: FraudPattern }>('/api/fraud-patterns', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function postFeedback(payload: {
  alert_id: string;
  status: string;
  investigator_action: string;
  investigator_name: string;
  notes: string;
}) {
  return request<{ feedback: InvestigatorFeedback }>('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function generateReport(payload: {
  alertIds: string[];
  reportType: 'STR' | 'CTR';
  narrative: string;
  submissionStatus?: 'draft' | 'submitted';
}) {
  return request<{ report: StrCtrReport; xml: string }>('/api/reports/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateReport(payload: Partial<StrCtrReport> & { id: string }) {
  return request<{ report: StrCtrReport }>('/api/reports', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function submitReport(id: string) {
  return request<{ report: StrCtrReport }>('/api/report/submit', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

export async function retrainModel(payload?: { epochs?: number; feedbackLimit?: number }) {
  return request<Record<string, unknown>>('/api/retrain', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
}

export async function postTransaction(payload: {
  sender_account_id: string;
  receiver_account_id: string;
  amount: number;
  channel?: string;
  status?: string;
}) {
  return request<{ transaction: Transaction; alerts: FraudAlert[] }>('/api/transactions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function triggerAnalysis() {
  return request<{
    alerts: any[];
    inserted: number;
    updated: number;
    deduplicated: number;
    count: number;
    model: string;
  }>('/api/analyze');
}


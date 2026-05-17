import { createServer } from 'node:http';
import { URL } from 'node:url';
import { createSupabaseClient } from './lib/supabase.mjs';
import { generateGoamlXml } from './lib/goaml.mjs';
import { summarizeDashboard, summarizeGraph } from './lib/detection.mjs';

const PORT = Number(process.env.PORT || 8787);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8790';
const supabase = createSupabaseClient();

function jsonResponse(res, statusCode, payload) {
  const body = JSON.stringify(payload);

  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  });

  res.end(body);
}

function textResponse(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  });

  res.end(payload);
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const bodyText = Buffer.concat(chunks).toString('utf8');
  return bodyText ? JSON.parse(bodyText) : {};
}

async function loadDataset() {
  const [accounts, transactions, alerts, reports, patterns, nodes] = await Promise.all([
    supabase.select('accounts', { order: { column: 'created_at', ascending: true }, limit: 1000 }),
    supabase.select('transactions', { order: { column: 'timestamp', ascending: true }, limit: 5000 }),
    supabase.select('fraud_alerts', { order: { column: 'created_at', ascending: false }, limit: 1000 }),
    supabase.select('str_ctr_reports', { order: { column: 'created_at', ascending: false }, limit: 1000 }),
    supabase.select('fraud_patterns', { order: { column: 'created_at', ascending: true }, limit: 100 }),
    supabase.select('federated_nodes', { order: { column: 'alerts_contributed', ascending: false }, limit: 100 }),
  ]);

  return { accounts, transactions, alerts, reports, patterns, nodes };
}

async function analyzeWithMlService(dataset) {
  const response = await fetch(`${ML_SERVICE_URL.replace(/\/$/, '')}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(dataset),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || `ML service returned ${response.status}`);
  }

  return payload;
}

async function retrainMlService(dataset) {
  const response = await fetch(`${ML_SERVICE_URL.replace(/\/$/, '')}/retrain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(dataset),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || `ML service returned ${response.status}`);
  }

  return payload;
}

/**
 * Deduplicates ML-generated alerts against the last 24 h of open alerts in
 * Supabase. Returns { toInsert, toUpdate } so callers can persist only net-new
 * records and update confidence on existing ones.
 */
async function deduplicateAlerts(newAlerts) {
  if (!newAlerts.length) return { toInsert: [], toUpdate: [] };

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const existing = await supabase.select('fraud_alerts', {
    order: { column: 'created_at', ascending: false },
    limit: 500,
  });

  const recentOpen = (existing || []).filter(
    (a) => a.status === 'open' && a.created_at >= cutoff,
  );

  const toInsert = [];
  const toUpdate = [];

  for (const alert of newAlerts) {
    const newAccounts = new Set(alert.involved_accounts || []);
    const duplicate = recentOpen.find(
      (a) =>
        a.pattern_type === alert.pattern_type &&
        (a.involved_accounts || []).some((id) => newAccounts.has(id)),
    );

    if (duplicate) {
      // Bump confidence & amount only if the new score is higher
      if (alert.confidence_score > (duplicate.confidence_score || 0)) {
        toUpdate.push({
          id: duplicate.id,
          confidence_score: alert.confidence_score,
          total_amount: alert.total_amount,
          shap_narrative: alert.shap_narrative,
          shap_factors: alert.shap_factors,
          notes: alert.notes,
          updated_at: new Date().toISOString(),
        });
      }
    } else {
      toInsert.push(alert);
    }
  }

  return { toInsert, toUpdate };
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    });
    res.end();
    return;
  }

  try {
    if (url.pathname === '/health') {
      jsonResponse(res, 200, {
        ok: true,
        service: 'graphsentinel-backend',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (url.pathname === '/api/summary') {
      const dataset = await loadDataset();

      jsonResponse(
        res,
        200,
        summarizeDashboard({
          accounts: dataset.accounts,
          transactions: dataset.transactions,
          alerts: dataset.alerts,
          reports: dataset.reports,
          nodes: dataset.nodes,
        })
      );
      return;
    }

    if (url.pathname === '/api/accounts') {
      if (req.method === 'GET') {
        const accounts = await supabase.select('accounts', { order: { column: 'created_at', ascending: true }, limit: 1000 });
        jsonResponse(res, 200, { data: accounts });
        return;
      }

      if (req.method === 'POST') {
        const body = await readJsonBody(req);
        const payload = {
          id: body.id || `ACC_${Date.now()}`,
          holder_name: body.holder_name,
          bank_branch: body.bank_branch,
          account_type: body.account_type || 'savings',
          declared_profession: body.declared_profession || 'salaried',
          declared_annual_income: body.declared_annual_income || 0,
          created_at: body.created_at || new Date().toISOString(),
          last_activity_at: body.last_activity_at || new Date().toISOString(),
          is_dormant: Boolean(body.is_dormant),
          risk_score: body.risk_score || 0,
          risk_level: body.risk_level || 'low',
        };

        const inserted = await supabase.insert('accounts', [payload]);
        jsonResponse(res, 201, { account: inserted?.[0] || payload });
        return;
      }
    }

    if (url.pathname === '/api/transactions') {
      if (req.method === 'GET') {
        const limit = Number(url.searchParams.get('limit') || 200);
        const transactions = await supabase.select('transactions', {
          order: { column: 'timestamp', ascending: false },
          limit,
        });

        jsonResponse(res, 200, { data: transactions });
        return;
      }

      if (req.method === 'POST') {
        const body = await readJsonBody(req);
        const payload = {
          id: body.id || `TXN_${Date.now()}`,
          sender_account_id: body.sender_account_id,
          receiver_account_id: body.receiver_account_id,
          amount: body.amount,
          channel: body.channel || 'NEFT',
          reference_number: body.reference_number || `REF_${Date.now()}`,
          status: body.status || 'completed',
          timestamp: body.timestamp || new Date().toISOString(),
          metadata: body.metadata || {},
        };

        const inserted = await supabase.insert('transactions', [payload]);
        const dataset = await loadDataset();
        const analysis = await analyzeWithMlService({
          accounts: dataset.accounts,
          transactions: dataset.transactions,
          patterns: dataset.patterns,
        });

        jsonResponse(res, 201, {
          transaction: inserted?.[0] || payload,
          alerts: analysis.alerts || [],
        });
        return;
      }
    }

    if (url.pathname === '/api/transactions' && req.method === 'PATCH') {
      const body = await readJsonBody(req);
      const id = body.id;
      if (!id) {
        jsonResponse(res, 400, { error: 'id is required' });
        return;
      }

      const { id: _ignored, ...updates } = body;
      const updated = await supabase.update('transactions', updates, { id });
      jsonResponse(res, 200, { transaction: updated?.[0] || { id, ...updates } });
      return;
    }

    if (url.pathname === '/api/fraud-alerts') {
      if (req.method === 'GET') {
        const alerts = await supabase.select('fraud_alerts', { order: { column: 'created_at', ascending: false }, limit: 1000 });
        jsonResponse(res, 200, { data: alerts });
        return;
      }

      if (req.method === 'PATCH') {
        const body = await readJsonBody(req);
        if (!body.id) {
          jsonResponse(res, 400, { error: 'id is required' });
          return;
        }

        const { id, ...updates } = body;
        const updated = await supabase.update('fraud_alerts', updates, { id });
        jsonResponse(res, 200, { alert: updated?.[0] || { id, ...updates } });
        return;
      }
    }

    if (url.pathname === '/api/fraud-patterns') {
      if (req.method === 'GET') {
        const patterns = await supabase.select('fraud_patterns', { order: { column: 'created_at', ascending: true }, limit: 100 });
        jsonResponse(res, 200, { data: patterns });
        return;
      }

      if (req.method === 'PATCH') {
        const body = await readJsonBody(req);
        if (!body.id) {
          jsonResponse(res, 400, { error: 'id is required' });
          return;
        }

        const { id, ...updates } = body;
        const updated = await supabase.update('fraud_patterns', updates, { id });
        jsonResponse(res, 200, { pattern: updated?.[0] || { id, ...updates } });
        return;
      }
    }

    if (url.pathname === '/api/federated-nodes') {
      const nodes = await supabase.select('federated_nodes', { order: { column: 'alerts_contributed', ascending: false }, limit: 100 });
      jsonResponse(res, 200, { data: nodes });
      return;
    }

    if (url.pathname === '/api/graph') {
      const dataset = await loadDataset();
      jsonResponse(res, 200, summarizeGraph(dataset.accounts, dataset.transactions, dataset.alerts));
      return;
    }

    if (url.pathname === '/api/analyze') {
      const dataset = await loadDataset();
      const analysis = await analyzeWithMlService({
        accounts: dataset.accounts,
        transactions: dataset.transactions,
        patterns: dataset.patterns,
      });

      const rawAlerts = analysis.alerts || [];
      const { toInsert, toUpdate } = await deduplicateAlerts(rawAlerts);

      // Persist net-new alerts
      if (toInsert.length) {
        await supabase.insert('fraud_alerts', toInsert);
      }
      // Update stale confidence scores on existing alerts
      for (const upd of toUpdate) {
        await supabase.update('fraud_alerts', upd, { id: upd.id });
      }

      jsonResponse(res, 200, {
        alerts: [...toInsert, ...toUpdate],
        inserted: toInsert.length,
        updated: toUpdate.length,
        deduplicated: rawAlerts.length - toInsert.length - toUpdate.length,
        count: toInsert.length + toUpdate.length,
        model: analysis.model || 'python-ml-service',
      });
      return;
    }

    if (url.pathname === '/api/reports') {
      if (req.method === 'GET') {
        const reports = await supabase.select('str_ctr_reports', { order: { column: 'created_at', ascending: false }, limit: 1000 });
        jsonResponse(res, 200, { data: reports });
        return;
      }

      if (req.method === 'PATCH') {
        const body = await readJsonBody(req);
        if (!body.id) {
          jsonResponse(res, 400, { error: 'id is required' });
          return;
        }

        const { id, ...updates } = body;
        const updated = await supabase.update('str_ctr_reports', updates, { id });
        jsonResponse(res, 200, { report: updated?.[0] || { id, ...updates } });
        return;
      }
    }

    if (url.pathname === '/api/report/submit' && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!body.id) {
        jsonResponse(res, 400, { error: 'id is required' });
        return;
      }

      const now = new Date().toISOString();
      const updated = await supabase.update('str_ctr_reports', {
        submission_status: 'submitted',
        submitted_at: now,
      }, { id: body.id });

      jsonResponse(res, 200, {
        report: updated?.[0] || { id: body.id, submission_status: 'submitted', submitted_at: now },
      });
      return;
    }

    if (url.pathname === '/api/retrain' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const dataset = await loadDataset();
      const feedback = await supabase.select('investigator_feedback', {
        order: { column: 'created_at', ascending: false },
        limit: Number(body.feedbackLimit || 200),
      });

      const metrics = await retrainMlService({
        ...dataset,
        feedback,
        epochs: Number(body.epochs || 5),
      });

      jsonResponse(res, 200, metrics);
      return;
    }

    if (url.pathname === '/api/investigator-feedback' && req.method === 'GET') {
      const alertId = url.searchParams.get('alert_id');
      const limit = Number(url.searchParams.get('limit') || 30);
      const filters = alertId ? { alert_id: alertId } : {};
      const feedback = await supabase.select('investigator_feedback', { filters, order: { column: 'created_at', ascending: false }, limit });
      jsonResponse(res, 200, { data: feedback });
      return;
    }

    if (url.pathname === '/api/reports/generate' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const reportType = body.reportType || 'STR';
      const dataset = await loadDataset();
      const alerts = (body.alertIds?.length
        ? dataset.alerts.filter((alert) => body.alertIds.includes(alert.id))
        : dataset.alerts.filter((alert) => alert.status === 'open')).sort((left, right) => right.confidence_score - left.confidence_score);
      const transactions = dataset.transactions.filter((transaction) =>
        alerts.some((alert) => (alert.linked_transaction_ids || []).includes(transaction.id))
      );
      const xml = generateGoamlXml({
        report: { id: body.id, report_type: reportType, narrative: body.narrative },
        alerts,
        accounts: dataset.accounts,
        transactions,
      });

      const subjectAccounts = [...new Set(alerts.flatMap((alert) => alert.involved_accounts || []))].slice(0, 5);
      const totalAmount = alerts.reduce((sum, alert) => sum + Number(alert.total_amount || 0), 0);
      const reportPayload = {
        id: body.id || `RPT_${Date.now()}`,
        alert_ids: alerts.map((alert) => alert.id),
        report_type: reportType,
        goaml_xml: xml,
        narrative: body.narrative || 'Automatically generated compliance package based on suspicious transaction alerts.',
        subject_details: {
          account_ids: subjectAccounts,
          alert_count: alerts.length,
        },
        transaction_summary: {
          total_alert_amount: Number(totalAmount.toFixed(2)),
          transaction_count: transactions.length,
        },
        generation_time_seconds: Number(body.generationTimeSeconds || 0),
        submission_status: body.submissionStatus || 'draft',
        submitted_at: body.submissionStatus === 'submitted' ? new Date().toISOString() : null,
      };

      const inserted = await supabase.insert('str_ctr_reports', [reportPayload]);
      jsonResponse(res, 201, {
        report: inserted?.[0] || reportPayload,
        xml,
      });
      return;
    }

    if (url.pathname === '/api/feedback' && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!body.alert_id) {
        jsonResponse(res, 400, { error: 'alert_id is required' });
        return;
      }

      const feedbackRecord = {
        id: body.id || `FB_${Date.now()}`,
        alert_id: body.alert_id,
        investigator_action: body.investigator_action || 'reviewed',
        investigator_name: body.investigator_name || 'Investigations Desk',
        notes: body.notes || '',
        created_at: new Date().toISOString(),
      };

      await supabase.update('fraud_alerts', {
        status: body.status || 'confirmed',
        assigned_investigator: body.investigator_name || 'Investigations Desk',
        notes: body.notes || '',
        updated_at: new Date().toISOString(),
      }, {
        id: body.alert_id,
      });

      const inserted = await supabase.insert('investigator_feedback', [feedbackRecord]);
      jsonResponse(res, 201, { feedback: inserted?.[0] || feedbackRecord });
      return;
    }

    if (url.pathname === '/api/reports/generate' && req.method === 'GET') {
      jsonResponse(res, 405, { error: 'Method not allowed' });
      return;
    }

    textResponse(res, 404, 'Not found');
  } catch (error) {
    jsonResponse(res, 500, {
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

createServer(handleRequest).listen(PORT, () => {
  console.log(`GraphSentinel backend listening on http://localhost:${PORT}`);
});
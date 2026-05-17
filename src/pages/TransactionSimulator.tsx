import { useState, useEffect } from 'react';
import { fetchAccounts, postTransaction, triggerAnalysis } from '../lib/api';
import type { Account } from '../lib/supabase';
import { 
  Send, ShieldAlert, CheckCircle2, AlertTriangle, Play, Zap, RefreshCw, BarChart2, CornerDownRight 
} from 'lucide-react';

interface AlertFactor {
  factor: string;
  weight: number;
  direction: string;
}

export default function TransactionSimulator() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [senderId, setSenderId] = useState('');
  const [receiverId, setReceiverId] = useState('');
  const [amount, setAmount] = useState('150000');
  const [channel, setChannel] = useState('NEFT');

  // Simulator Execution state
  const [isSimulating, setIsSimulating] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<{
    success: boolean;
    txId?: string;
    alertTriggered: boolean;
    alertDetails?: {
      pattern_type: string;
      confidence_score: number;
      shap_narrative: string;
      shap_factors: AlertFactor[];
      severity: string;
    };
  } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchAccounts();
        setAccounts(data);
        if (data.length > 0) {
          setSenderId(data[0].id);
          setReceiverId(data[1]?.id || data[0].id);
        }
      } catch (err) {
        console.error('Failed to load accounts:', err);
      } finally {
        setLoadingAccounts(false);
      }
    }
    load();
  }, []);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderId || !receiverId) return;
    await executeSimulation([
      {
        sender_account_id: senderId,
        receiver_account_id: receiverId,
        amount: Number(amount),
        channel,
      }
    ]);
  };

  const handleScenarioPreset = async (presetType: 'structuring' | 'velocity' | 'layering') => {
    let txs: Array<{ sender_account_id: string; receiver_account_id: string; amount: number; channel: string }> = [];

    // Choose representative accounts from seed or general lists
    const norm = accounts.find(a => a.id.startsWith('ACC_N')) || accounts[0];

    if (presetType === 'structuring') {
      // 3 transactions of 9.8 Lakhs successively from a single account to different recipients
      const targets = accounts.filter(a => a.id !== norm.id).slice(0, 3);
      txs = targets.map(t => ({
        sender_account_id: norm.id,
        receiver_account_id: t.id,
        amount: 980000,
        channel: 'NEFT'
      }));
    } else if (presetType === 'velocity') {
      // 5 rapid transfers of 1.2 Lakhs to the same receiver within UPI
      const receiver = accounts.find(a => a.id !== norm.id) || accounts[1];
      txs = Array.from({ length: 5 }).map(() => ({
        sender_account_id: norm.id,
        receiver_account_id: receiver.id,
        amount: 120000,
        channel: 'UPI'
      }));
    } else if (presetType === 'layering') {
      // Linear hops: A -> B -> C -> D
      const chain = accounts.slice(0, 4);
      if (chain.length >= 4) {
        txs = [
          { sender_account_id: chain[0].id, receiver_account_id: chain[1].id, amount: 5000000, channel: 'RTGS' },
          { sender_account_id: chain[1].id, receiver_account_id: chain[2].id, amount: 4950000, channel: 'RTGS' },
          { sender_account_id: chain[2].id, receiver_account_id: chain[3].id, amount: 4900000, channel: 'RTGS' },
        ];
      }
    }

    if (txs.length > 0) {
      await executeSimulation(txs);
    }
  };

  const executeSimulation = async (transactionsToPost: Array<{ sender_account_id: string; receiver_account_id: string; amount: number; channel: string }>) => {
    setIsSimulating(true);
    setResult(null);
    setStep(1); // Posting transactions

    try {
      let lastTxId = '';
      for (let i = 0; i < transactionsToPost.length; i++) {
        const tx = transactionsToPost[i];
        const res = await postTransaction(tx);
        lastTxId = res.transaction?.id || `TXN_${Date.now()}`;
      }

      await new Promise(r => setTimeout(r, 1000));
      setStep(2); // Analyzing neural networks GCN + LSTM

      await new Promise(r => setTimeout(r, 1200));
      setStep(3); // Running Integrated Gradients Backattribution

      const analysis = await triggerAnalysis();
      await new Promise(r => setTimeout(r, 800));

      // Find if any alert involves sender or receiver accounts in this submission
      const activeAccountIds = new Set(transactionsToPost.flatMap(t => [t.sender_account_id, t.receiver_account_id]));
      const matchingAlert = (analysis.alerts || []).find(alert => 
        (alert.involved_accounts || []).some((accId: string) => activeAccountIds.has(accId))
      );

      if (matchingAlert) {
        // Parse factors if stringified
        let shapFactors: AlertFactor[] = [];
        try {
          shapFactors = typeof matchingAlert.shap_factors === 'string' 
            ? JSON.parse(matchingAlert.shap_factors) 
            : (matchingAlert.shap_factors || []);
        } catch {
          shapFactors = [];
        }

        setResult({
          success: true,
          txId: lastTxId,
          alertTriggered: true,
          alertDetails: {
            pattern_type: matchingAlert.pattern_type,
            confidence_score: matchingAlert.confidence_score,
            shap_narrative: matchingAlert.shap_narrative,
            shap_factors: shapFactors,
            severity: matchingAlert.severity || 'high',
          }
        });
      } else {
        setResult({
          success: true,
          txId: lastTxId,
          alertTriggered: false,
        });
      }
    } catch (err) {
      console.error('Simulation error:', err);
      setResult({
        success: false,
        alertTriggered: false,
      });
    } finally {
      setIsSimulating(false);
      setStep(0);
    }
  };

  const formatPatternName = (pattern: string) => {
    return pattern.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Introduction Card */}
      <div className="bg-gradient-to-r from-primary to-purple-600 rounded-xl p-6 text-white shadow-lg">
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          <Zap className="w-5 h-5 fill-white" /> Live Transaction Simulation Sandbox
        </h2>
        <p className="text-sm opacity-90 max-w-3xl leading-relaxed">
          Test the limits of GraphSentinel’s machine learning engine in real-time. Conduct individual 
          custom transfers or trigger advanced predefined fraud patterns. Watch the hybrid LSTM + Graph Convolutional Network 
          instantly process ledger updates and construct regulator-defensible Integrated Gradients causal narratives.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Form & Presets */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Preset Fraud Scenarios Card */}
          <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
            <h3 className="text-sm font-semibold text-navy uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-primary" /> Trigger Preset Fraud Scenarios
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handleScenarioPreset('structuring')}
                disabled={isSimulating || loadingAccounts}
                className="flex flex-col items-start p-4 rounded-lg border border-border hover:border-primary hover:bg-[rgba(83,58,253,0.02)] transition text-left group disabled:opacity-50"
              >
                <span className="text-[13px] font-semibold text-navy group-hover:text-primary transition mb-1 flex items-center gap-1.5">
                  <CornerDownRight className="w-3.5 h-3.5" /> Structuring Pattern
                </span>
                <span className="text-[11px] text-body leading-snug">
                  Triggers 3 back-to-back transfers of ₹9.8 Lakhs (just below limits) from a single node to distinct targets.
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleScenarioPreset('velocity')}
                disabled={isSimulating || loadingAccounts}
                className="flex flex-col items-start p-4 rounded-lg border border-border hover:border-primary hover:bg-[rgba(83,58,253,0.02)] transition text-left group disabled:opacity-50"
              >
                <span className="text-[13px] font-semibold text-navy group-hover:text-primary transition mb-1 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> Velocity Spike
                </span>
                <span className="text-[11px] text-body leading-snug">
                  Launches 5 rapid consecutive UPI transfers within seconds to a single node, triggering anomaly alerts.
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleScenarioPreset('layering')}
                disabled={isSimulating || loadingAccounts}
                className="flex flex-col items-start p-4 rounded-lg border border-border hover:border-primary hover:bg-[rgba(83,58,253,0.02)] transition text-left group disabled:opacity-50"
              >
                <span className="text-[13px] font-semibold text-navy group-hover:text-primary transition mb-1 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5" /> Multi-hop Layering
                </span>
                <span className="text-[11px] text-body leading-snug">
                  Initiates a linear multi-hop chain (A → B → C → D) transferring large values rapidly across accounts.
                </span>
              </button>
            </div>
          </div>

          {/* Manual Simulator Form */}
          <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
            <h3 className="text-sm font-semibold text-navy uppercase tracking-wider mb-4 flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" /> Create Manual Transaction
            </h3>
            
            {loadingAccounts ? (
              <div className="flex items-center gap-2 text-sm text-body py-4">
                <RefreshCw className="w-4 h-4 animate-spin" /> Loading ledger accounts...
              </div>
            ) : (
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-body uppercase tracking-wider mb-1.5">Sender Account</label>
                    <select
                      value={senderId}
                      onChange={(e) => setSenderId(e.target.value)}
                      className="w-full text-sm bg-bg border border-border rounded-md px-3 py-2 text-navy focus:outline-none focus:border-primary"
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.id} - {acc.holder_name} (Risk: {acc.risk_level})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-body uppercase tracking-wider mb-1.5">Receiver Account</label>
                    <select
                      value={receiverId}
                      onChange={(e) => setReceiverId(e.target.value)}
                      className="w-full text-sm bg-bg border border-border rounded-md px-3 py-2 text-navy focus:outline-none focus:border-primary"
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.id} - {acc.holder_name} (Risk: {acc.risk_level})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-body uppercase tracking-wider mb-1.5">Amount (INR)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full text-sm bg-bg border border-border rounded-md px-3 py-2 text-navy focus:outline-none focus:border-primary font-mono"
                      placeholder="Enter transfer amount"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-body uppercase tracking-wider mb-1.5">Payment Channel</label>
                    <select
                      value={channel}
                      onChange={(e) => setChannel(e.target.value)}
                      className="w-full text-sm bg-bg border border-border rounded-md px-3 py-2 text-navy focus:outline-none focus:border-primary"
                    >
                      <option value="UPI">UPI (Unified Payments Interface)</option>
                      <option value="NEFT">NEFT (National Electronic Funds Transfer)</option>
                      <option value="RTGS">RTGS (Real Time Gross Settlement)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSimulating || senderId === receiverId}
                  className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-opacity-90 text-white font-medium text-sm py-2 px-4 rounded-md shadow transition disabled:opacity-50"
                >
                  <Send className="w-4 h-4" /> Inject Transaction Into Ledger
                </button>
              </form>
            )}
          </div>

        </div>

        {/* Right Column: Execution Progress & Live Prediction Result */}
        <div className="lg:col-span-5 space-y-6">
          
          <div className="bg-white rounded-xl p-5 border border-border shadow-sm h-full flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-navy uppercase tracking-wider mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary" /> Live AI Engine Response
              </h3>

              {/* Loader Screen */}
              {isSimulating && (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-navy">
                      {step === 1 && '📝 Writing to Supabase Ledger...'}
                      {step === 2 && '🧠 Running Deep Graph GCN + Sequence LSTM...'}
                      {step === 3 && '📊 Calculating Integrated Gradients Causal Weights...'}
                    </p>
                    <p className="text-[11px] text-body">This will take only a few moments...</p>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!isSimulating && !result && (
                <div className="flex flex-col items-center justify-center py-16 text-center text-body space-y-2">
                  <Play className="w-8 h-8 opacity-40 text-primary" />
                  <p className="text-sm font-medium">No simulation active</p>
                  <p className="text-[11px] max-w-xs">Inject a transaction or click a scenario preset to watch GraphSentinel respond live.</p>
                </div>
              )}

              {/* Simulation Result Screen */}
              {!isSimulating && result && (
                <div className="space-y-5 animate-fade-in">
                  {result.success ? (
                    result.alertTriggered && result.alertDetails ? (
                      <div className="space-y-4">
                        {/* Red Threat Indicator */}
                        <div className="bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.15)] rounded-lg p-4 flex gap-3">
                          <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-danger text-white px-1.5 py-0.5 rounded leading-none">
                              Alert Triggered
                            </span>
                            <h4 className="text-sm font-bold text-navy mt-1.5">
                              {formatPatternName(result.alertDetails.pattern_type)} Detected
                            </h4>
                            <p className="text-[12px] text-body mt-1">
                              Model Confidence: <span className="font-semibold text-danger font-mono">{(result.alertDetails.confidence_score * 100).toFixed(1)}%</span>
                            </p>
                          </div>
                        </div>

                        {/* SHAP/IG Attribution Factors */}
                        {result.alertDetails.shap_factors.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-[11px] font-bold text-navy uppercase tracking-wider">Causal Attribution Weights (Integrated Gradients)</h5>
                            <div className="space-y-2 bg-bg p-3 rounded-lg border border-border">
                              {result.alertDetails.shap_factors.map((factor, index) => (
                                <div key={index} className="space-y-1">
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-navy font-medium">{factor.factor}</span>
                                    <span className="text-body font-mono font-semibold">{(factor.weight * 100).toFixed(0)}%</span>
                                  </div>
                                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-danger rounded-full" 
                                      style={{ width: `${factor.weight * 100}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Narrative */}
                        <div className="space-y-1">
                          <h5 className="text-[11px] font-bold text-navy uppercase tracking-wider">Automated Causal Narrative</h5>
                          <p className="text-[11px] text-body leading-relaxed bg-bg p-3 rounded-lg border border-border">
                            {result.alertDetails.shap_narrative}
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Clean State */
                      <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                        <CheckCircle2 className="w-12 h-12 text-success" />
                        <div>
                          <h4 className="text-sm font-bold text-navy">Transaction Logged Cleanly</h4>
                          <p className="text-[11px] text-body max-w-xs mt-1">
                            The hybrid Neural Network evaluated transaction ID <span className="font-mono text-navy font-semibold">{result.txId}</span> and found no anomalous risk behaviors.
                          </p>
                        </div>
                      </div>
                    )
                  ) : (
                    /* Failure State */
                    <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                      <AlertTriangle className="w-12 h-12 text-danger" />
                      <div>
                        <h4 className="text-sm font-bold text-navy">Execution Failed</h4>
                        <p className="text-[11px] text-body max-w-xs mt-1">
                          An error occurred while connecting to the Supabase database or Python ML service. Please make sure the ML backend is active.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Subtext info */}
            {!isSimulating && (
              <div className="mt-4 pt-4 border-t border-border text-[10px] text-body leading-normal">
                💡 **Pro Tip:** Inbound and outbound transactions will expand your ledger and community graphs dynamically, updating the **Fund Flow Graph** view.
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}

import type { FraudAlert, Account, Transaction, StrCtrReport } from './supabase';

export function generateGoAMLXml(
  report: Partial<StrCtrReport>,
  alerts: FraudAlert[],
  accounts: Account[],
  transactions: Transaction[]
): string {
  const reportId = report.id || `RPT_${Date.now()}`;
  const reportType = report.report_type || 'STR';
  const today = new Date().toISOString().split('T')[0];

  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const allAccountIds = [...new Set(alerts.flatMap((a) => a.involved_accounts))];
  const subjectAccount = accountMap.get(allAccountIds[0]);

  const transactionsXml = transactions
    .map(
      (t) => `
      <transaction>
        <transactionnumber>${t.id}</transactionnumber>
        <internal_ref_number>${t.reference_number}</internal_ref_number>
        <transaction_location>${accountMap.get(t.sender_account_id)?.bank_branch || 'Unknown'}</transaction_location>
        <date_transaction>${t.timestamp.split('T')[0]}</date_transaction>
        <amount_local>${t.amount.toFixed(2)}</amount_local>
        <transmode_code>${t.channel}</transmode_code>
        <from_account>
          <account>
            <account_number>${t.sender_account_id}</account_number>
            <account_name>${accountMap.get(t.sender_account_id)?.holder_name || 'Unknown'}</account_name>
          </account>
        </from_account>
        <to_account>
          <account>
            <account_number>${t.receiver_account_id}</account_number>
            <account_name>${accountMap.get(t.receiver_account_id)?.holder_name || 'Unknown'}</account_name>
          </account>
        </to_account>
      </transaction>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<goAML>
  <report>
    <rentity_id>UBIN_MUMBAI_001</rentity_id>
    <rentity_branch>Mumbai Main Branch</rentity_branch>
    <submission_code>E</submission_code>
    <report_code>${reportType}</report_code>
    <submission_date>${today}</submission_date>
    <currency_code_local>INR</currency_code_local>
    <reporting_person>
      <first_name>Chief</first_name>
      <last_name>Compliance Officer</last_name>
      <title>CCO</title>
      <email>cco@unionbank.in</email>
      <phone>+91-22-25757000</phone>
    </reporting_person>
    <location>
      <address_type>B</address_type>
      <address>239, Vidhan Bhavan Marg, Nariman Point</address>
      <city>Mumbai</city>
      <country_code>IN</country_code>
      <zip>400021</zip>
    </location>
    <report_id>${reportId}</report_id>
    <entity_reference>${reportId}</entity_reference>
    <fiu_ref_number>FIU-IND-${reportId}</fiu_ref_number>
    <alert_ids>${alerts.map((a) => a.id).join(', ')}</alert_ids>
    <suspicious_activity_type>${alerts.map((a) => a.pattern_type).join(', ')}</suspicious_activity_type>
    <subject>
      <first_name>${subjectAccount?.holder_name?.split(' ')[0] || 'Unknown'}</first_name>
      <last_name>${subjectAccount?.holder_name?.split(' ').slice(1).join(' ') || ''}</last_name>
      <alias></alias>
      <birthdate></birthdate>
      <nationality1>IN</nationality1>
      <occupation>${subjectAccount?.declared_profession || 'Unknown'}</occupation>
      <accounts>
        ${allAccountIds
          .map((id) => {
            const acc = accountMap.get(id);
            return acc
              ? `<account>
            <account_number>${acc.id}</account_number>
            <account_name>${acc.holder_name}</account_name>
            <account_type>${acc.account_type}</account_type>
            <opening_date>${acc.created_at.split('T')[0]}</opening_date>
            <branch_name>${acc.bank_branch}</branch_name>
          </account>`
              : '';
          })
          .join('')}
      </accounts>
    </subject>
    <transactions>${transactionsXml}
    </transactions>
    <action_initiated>
      <action_code>04</action_code>
      <action_date>${today}</action_date>
      <comment>${report.narrative || 'Suspicious activity detected by GraphSentinel AI system. Under investigation.'}</comment>
    </action_initiated>
  </report>
</goAML>`;
}

export function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

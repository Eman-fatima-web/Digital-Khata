export interface DailySummaryData {
  businessName: string
  date: string
  totalSales: number
  salesCount: number
  totalPayments: number
  paymentsCount: number
  totalUdhaar: number
  udhaarCount: number
  totalOutstanding: number
  totalOverdue: number
  overdueCustomerCount: number
  topOverdueCustomers: Array<{ name: string; amount: number; dueDate: string }>
}

function formatCurrency(amount: number): string {
  return `Rs ${amount.toLocaleString('en-PK')}`
}

export function buildDailySummaryEmail(data: DailySummaryData): { subject: string; html: string } {
  const subject = `Daily Summary — ${data.businessName} (${data.date})`

  const overdueRows = data.topOverdueCustomers.length > 0
    ? data.topOverdueCustomers
        .map(
          (c) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${c.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#dc2626;">${formatCurrency(c.amount)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#6b7280;">${c.dueDate}</td>
        </tr>`
        )
        .join('')
    : `<tr><td colspan="3" style="padding:12px;text-align:center;color:#6b7280;">No overdue customers</td></tr>`

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:linear-gradient(135deg,#0d9488,#0f766e);padding:24px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Digital Khata</h1>
            <p style="margin:4px 0 0;color:#ccfbf1;font-size:14px;">Daily Business Summary</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px;">
            <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">${data.date}</p>
            <h2 style="margin:0 0 20px;color:#111827;font-size:18px;">${data.businessName}</h2>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="33%" style="padding:16px;background:#f0fdfa;border-radius:8px;text-align:center;vertical-align:top;">
                  <p style="margin:0;color:#0d9488;font-size:12px;font-weight:600;text-transform:uppercase;">Sales</p>
                  <p style="margin:4px 0 0;color:#111827;font-size:20px;font-weight:700;">${formatCurrency(data.totalSales)}</p>
                  <p style="margin:2px 0 0;color:#6b7280;font-size:12px;">${data.salesCount} entries</p>
                </td>
                <td width="2%"></td>
                <td width="33%" style="padding:16px;background:#eff6ff;border-radius:8px;text-align:center;vertical-align:top;">
                  <p style="margin:0;color:#2563eb;font-size:12px;font-weight:600;text-transform:uppercase;">Received</p>
                  <p style="margin:4px 0 0;color:#111827;font-size:20px;font-weight:700;">${formatCurrency(data.totalPayments)}</p>
                  <p style="margin:2px 0 0;color:#6b7280;font-size:12px;">${data.paymentsCount} payments</p>
                </td>
                <td width="2%"></td>
                <td width="33%" style="padding:16px;background:#fef3c7;border-radius:8px;text-align:center;vertical-align:top;">
                  <p style="margin:0;color:#d97706;font-size:12px;font-weight:600;text-transform:uppercase;">New Udhaar</p>
                  <p style="margin:4px 0 0;color:#111827;font-size:20px;font-weight:700;">${formatCurrency(data.totalUdhaar)}</p>
                  <p style="margin:2px 0 0;color:#6b7280;font-size:12px;">${data.udhaarCount} entries</p>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
              <tr>
                <td style="padding:12px 16px;background:#f9fafb;border-radius:8px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#6b7280;font-size:13px;">Total Outstanding</td>
                      <td style="text-align:right;color:#111827;font-size:15px;font-weight:600;">${formatCurrency(data.totalOutstanding)}</td>
                    </tr>
                    <tr>
                      <td style="color:#6b7280;font-size:13px;padding-top:6px;">Total Overdue</td>
                      <td style="text-align:right;color:#dc2626;font-size:15px;font-weight:600;padding-top:6px;">${formatCurrency(data.totalOverdue)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 24px;">
            <h3 style="margin:0 0 12px;color:#111827;font-size:15px;font-weight:600;">Top Overdue Customers</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
              <tr style="background:#f9fafb;">
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Name</th>
                <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;">Amount</th>
                <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;">Due Date</th>
              </tr>
              ${overdueRows}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background:#f9fafb;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">Digital Khata — Offline-first udhaar ledger for Pakistani shopkeepers</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, html }
}

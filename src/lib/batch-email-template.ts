/**
 * Batch Email Template Generator
 *
 * Generates a consolidated email when multiple ROs from the same shop
 * are being sent together. Creates an HTML table listing all ROs.
 */

export type RODetail = {
  roNumber: number | null;
  partNumber: string | null;
  serialNumber: string | null;
};

/**
 * Generates the subject line for a batch email.
 *
 * Strategy:
 * - 1 RO: "Status Update for RO #{number}"
 * - 2-3 ROs: "Status Update: RO #{num1}, #{num2}, #{num3}"
 * - 4+ ROs: "Status Update: Multiple Orders ({shopName})"
 */
export function generateBatchSubject(
  shopName: string,
  roDetails: RODetail[]
): string {
  const roNumbers = roDetails
    .map((r) => r.roNumber)
    .filter((n): n is number => n !== null);

  if (roNumbers.length === 0) {
    return `Status Update (${shopName})`;
  }

  if (roNumbers.length === 1) {
    return `Status Update for RO #${roNumbers[0]}`;
  }

  if (roNumbers.length <= 3) {
    const roList = roNumbers.map((n) => `#${n}`).join(", ");
    return `Status Update: RO ${roList}`;
  }

  return `Status Update: Multiple Orders (${shopName})`;
}

/**
 * Generates the HTML body for a batch email.
 * Includes a table listing all ROs with Part Number and Serial Number.
 */
export function generateBatchBody(
  shopName: string,
  roDetails: RODetail[]
): string {
  const tableRows = roDetails
    .map(
      (ro) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-family: monospace;">
        ${ro.roNumber ?? "-"}
      </td>
      <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;">
        ${ro.partNumber ?? "-"}
      </td>
      <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;">
        ${ro.serialNumber ?? "-"}
      </td>
    </tr>`
    )
    .join("");

  return `
<p>Hello,</p>

<p>We are reaching out regarding the following Repair Orders for <strong>${shopName}</strong>:</p>

<table style="border-collapse: collapse; width: 100%; max-width: 600px; margin: 16px 0;">
  <thead>
    <tr style="background-color: #f5f5f5;">
      <th style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">RO #</th>
      <th style="padding: 10px; border: 1px solid #ddd; text-align: left; font-weight: 600;">Part Number</th>
      <th style="padding: 10px; border: 1px solid #ddd; text-align: left; font-weight: 600;">Serial Number</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
  </tbody>
</table>

<p>Please provide status updates for these orders at your earliest convenience.</p>

<p>Thank you,<br/>
<strong>GenThrust Repairs Team</strong></p>
`.trim();
}

/**
 * Generates both subject and body for a batch email.
 * Convenience function that combines subject and body generation.
 */
export function generateBatchEmailContent(
  shopName: string,
  roDetails: RODetail[]
): { subject: string; body: string } {
  return {
    subject: generateBatchSubject(shopName, roDetails),
    body: generateBatchBody(shopName, roDetails),
  };
}

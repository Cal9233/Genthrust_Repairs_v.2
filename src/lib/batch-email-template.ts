/**
 * Batch Email Template Generator
 *
 * Generates a consolidated email when multiple ROs from the same shop
 * are being sent together. Creates an HTML table listing all ROs.
 */

import { COMPANY_NAME } from "./constants/company";

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
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-family: monospace; color: #374151;">
        ${ro.roNumber ?? "-"}
      </td>
      <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace; color: #374151;">
        ${ro.partNumber ?? "-"}
      </td>
      <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace; color: #374151;">
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
      <th style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600; color: #1f2937;">RO #</th>
      <th style="padding: 10px; border: 1px solid #ddd; text-align: left; font-weight: 600; color: #1f2937;">Part Number</th>
      <th style="padding: 10px; border: 1px solid #ddd; text-align: left; font-weight: 600; color: #1f2937;">Serial Number</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
  </tbody>
</table>

<p>Please provide status updates for these orders at your earliest convenience.</p>

<p>Thank you,<br/>
<strong>${COMPANY_NAME}</strong></p>
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

/**
 * Parse an HTML table back into RODetail array.
 * Used when editing batch emails to extract structured data.
 */
export function parseTableToRODetails(tableHtml: string): RODetail[] {
  const rows: RODetail[] = [];

  // Match all <tr> tags in tbody (skip thead)
  const tbodyMatch = tableHtml.match(/<tbody[\s\S]*?>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return rows;

  const tbody = tbodyMatch[1];
  const rowMatches = tbody.matchAll(/<tr[\s\S]*?>([\s\S]*?)<\/tr>/gi);

  for (const rowMatch of rowMatches) {
    const rowHtml = rowMatch[1];
    // Extract cell contents
    const cells = [...rowHtml.matchAll(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi)];

    if (cells.length >= 3) {
      const roNumber = cells[0][1].trim().replace(/<[^>]*>/g, "").trim();
      const partNumber = cells[1][1].trim().replace(/<[^>]*>/g, "").trim();
      const serialNumber = cells[2][1].trim().replace(/<[^>]*>/g, "").trim();

      rows.push({
        roNumber: roNumber === "-" ? null : parseInt(roNumber, 10) || null,
        partNumber: partNumber === "-" ? null : partNumber,
        serialNumber: serialNumber === "-" ? null : serialNumber,
      });
    }
  }

  return rows;
}

/**
 * Generate just the table HTML from RODetails (without intro/outro).
 * Used when reconstructing edited batch emails.
 */
export function generateTableHtml(roDetails: RODetail[]): string {
  const tableRows = roDetails
    .map(
      (ro) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-family: monospace; color: #374151;">
        ${ro.roNumber ?? "-"}
      </td>
      <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace; color: #374151;">
        ${ro.partNumber ?? "-"}
      </td>
      <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace; color: #374151;">
        ${ro.serialNumber ?? "-"}
      </td>
    </tr>`
    )
    .join("");

  return `
<table style="border-collapse: collapse; width: 100%; max-width: 600px; margin: 16px 0;">
  <thead>
    <tr style="background-color: #f5f5f5;">
      <th style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600; color: #1f2937;">RO #</th>
      <th style="padding: 10px; border: 1px solid #ddd; text-align: left; font-weight: 600; color: #1f2937;">Part Number</th>
      <th style="padding: 10px; border: 1px solid #ddd; text-align: left; font-weight: 600; color: #1f2937;">Serial Number</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
  </tbody>
</table>`.trim();
}

import type { ThreadMessage } from "@/lib/types/notification";

/**
 * Generates mock thread messages for UI testing.
 * Creates a realistic conversation with both inbound and outbound messages.
 *
 * @param roNumber - The RO number to include in subjects
 * @returns Array of ThreadMessage objects with mixed directions
 */
export function generateMockThreadMessages(
  roNumber: string | number
): ThreadMessage[] {
  const now = new Date();
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return [
    // Day 1: GenThrust sends initial quote request (OUTBOUND)
    {
      id: "mock-1",
      subject: `Quote Request - RO# G${roNumber}`,
      bodyPreview:
        "Hi Team, We have received a part requiring repair. Please review the attached documentation and provide a quote at your earliest convenience.",
      sender: { name: "GenThrust Team", email: "repairs@genthrust.com" },
      sentDateTime: daysAgo(5),
      direction: "outbound",
      isDraft: false,
      dbStatus: "SENT",
      dbId: 1,
    },
    // Day 2: Shop responds with quote (INBOUND)
    {
      id: "mock-2",
      subject: `RE: Quote Request - RO# G${roNumber}`,
      bodyPreview:
        "Thank you for contacting us. Please find attached our quote for the repair. Estimated turnaround time is 10-14 business days once approved.",
      sender: {
        name: "Florida Turbine Services",
        email: "quotes@floridaturbine.com",
      },
      sentDateTime: daysAgo(4),
      direction: "inbound",
      isDraft: false,
      webLink: "https://outlook.office.com/mail/mock",
    },
    // Day 3: GenThrust approves quote (OUTBOUND)
    {
      id: "mock-3",
      subject: `RE: Quote Request - RO# G${roNumber}`,
      bodyPreview:
        "We have reviewed your quote and approve the repair. Please proceed with the work as outlined. Let us know if you need any additional information.",
      sender: { name: "GenThrust Team", email: "repairs@genthrust.com" },
      sentDateTime: daysAgo(3),
      direction: "outbound",
      isDraft: false,
      dbStatus: "SENT",
      dbId: 2,
    },
    // Day 4: Shop confirms parts ordered (INBOUND)
    {
      id: "mock-4",
      subject: `RE: Quote Request - RO# G${roNumber}`,
      bodyPreview:
        "Parts have been ordered. Estimated completion in 5 business days. We will send a shipment notification once the repair is complete.",
      sender: {
        name: "Florida Turbine Services",
        email: "quotes@floridaturbine.com",
      },
      sentDateTime: daysAgo(2),
      direction: "inbound",
      isDraft: false,
      webLink: "https://outlook.office.com/mail/mock",
    },
    // Day 5: Pending follow-up (OUTBOUND - PENDING APPROVAL)
    {
      id: "mock-5",
      subject: `Follow-up: RO# G${roNumber}`,
      bodyPreview:
        "Just checking in on the repair status. Could you please provide an update on the estimated completion date?",
      sender: { name: "GenThrust Team", email: "repairs@genthrust.com" },
      sentDateTime: daysAgo(0),
      direction: "outbound",
      isDraft: true,
      dbStatus: "PENDING_APPROVAL",
      dbId: 3,
    },
  ];
}

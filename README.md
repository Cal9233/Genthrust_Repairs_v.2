# GenThrust RO Tracker v2

The **GenThrust Repair Order Tracker** is a mission-critical dashboard for managing aviation repair orders.

This "Version 2" architecture replaces the legacy client-side application with a **Durable, Event-Driven** system designed to eliminate timeouts, prevent database connection exhaustion, and enable long-running AI agents.

## 🏗 Architecture

The system is split into two distinct runtime environments that work in tandem:

1.  **The Frontend (Next.js 15):** Handles user interaction, data visualization, and immediate database reads/writes.
2.  **The Orchestration Engine (Trigger.dev v3):** Handles heavy background tasks (Excel Sync, AI Research) in durable containers that never time out.

### Key Technologies
* **Framework:** Next.js 15 (App Router)
* **Database:** Aiven MySQL (accessed via Drizzle ORM)
* **Orchestration:** Trigger.dev v3
* **Excel Integration:** Microsoft Graph API (Persistent Sessions + JSON Batching)
* **AI:** Vercel AI SDK (Claude 3.5 Sonnet)
* **Auth:** Auth.js v5 (Microsoft Entra ID)

---

## 🚀 Getting Started

### 1. Prerequisites
* Node.js 18+
* npm
* Access to the Aiven MySQL Database
* Access to the Trigger.dev Cloud Dashboard

### 2. Installation
```bash
# Clone the repository
git clone [https://github.com/Cal9233/Genthrust_Repairs_v.2.git](https://github.com/Cal9233/Genthrust_Repairs_v.2.git)
cd Genthrust_Repairs_v.2

# Install dependencies
npm install
3. Environment Setup

Create a .env.local file in the root directory. You need secrets for Database, Auth, Graph API, and AI.

Bash
# --- Database (Aiven) ---
DATABASE_HOST=genthrust-inventory-....aivencloud.com
DATABASE_PORT=12076
DATABASE_USER=avnadmin
DATABASE_PASSWORD=...
DATABASE_NAME=defaultdb

# --- Authentication (Auth.js) ---
AUTH_SECRET=... # Run `npx auth secret` to generate
AUTH_MICROSOFT_ENTRA_ID_ID=... # Client ID
AUTH_MICROSOFT_ENTRA_ID_SECRET=... # Client Secret
AUTH_MICROSOFT_ENTRA_ID_TENANT_ID=...
AUTH_MICROSOFT_ENTRA_ID_ISSUER=[https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0](https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0)

# --- Trigger.dev (Background Workers) ---
TRIGGER_SECRET_KEY=tr_dev_... # Get this from cloud.trigger.dev

# --- Excel Sync (Microsoft Graph) ---
# Use the Graph Explorer to find your specific SharePoint Site ID
SHAREPOINT_SITE_ID=genthrustxvii.sharepoint.com,guid,guid
EXCEL_WORKBOOK_ID=... # The specific file ID
EXCEL_WORKSHEET_NAME=Active

# --- AI Agent (Anthropic) ---
ANTHROPIC_API_KEY=sk-ant-...

# --- ERP.aero Integration ---
ERP_CID=GENTHRUST              # Use GENTHRUST for production, GENTHRUST_TEST for sandbox
ERP_EMAIL=...                   # ERP account email
ERP_PASSWORD=...                # ERP account password
ERP_API_BASE_URL=https://wapi.erp.aero/v1  # Optional, defaults to production API
ERP_SOURCE=genthrust-ro-tracker  # Optional, defaults to "genthrust-ro-tracker"

Note: You also need a certs/ca.pem file in the root directory to connect to Aiven via SSL.

4. Running the App (The Dual-Terminal Workflow)

Because this app relies on background workers, you must run two commands in parallel.

Terminal 1: The Frontend This runs the Next.js UI at http://localhost:3000.

Bash
npm run dev
Terminal 2: The Background Worker This connects your local machine to the Trigger.dev cloud to process tasks.

Bash
npx trigger.dev@latest dev
🛠 Core Features
1. Inventory Search

URL: /inventory

Tech: Debounced Server Actions.

Safety: Uses a Global Singleton database connection to prevent "Too Many Connections" errors on Aiven.

2. Excel Sync ("The Invincible Engine")

URL: /dashboard -> "Sync to Excel"

Problem Solved: Legacy timeouts.

How it works:

Uses Persistent Sessions (workbook-session-id) to keep the Excel file open in memory.

Uses JSON Batching to group updates into chunks of 20 (Graph API limit).

Runs inside a container with 2GB RAM.

3. AI Assistant

URL: Floating Bubble (Bottom Right)

Capabilities: Can search inventory and lookup Repair Order details.

Durability: Each tool call (search_inventory, get_repair_order) is an isolated sub-task. If the DB flickers, the AI retries just that step without losing context.

⚠️ Troubleshooting
Error: "Url specified is invalid" (Graph API)

Cause: Incorrect URL formatting for SharePoint.

Fix: Ensure you are using SHAREPOINT_SITE_ID in .env.local and NOT SHAREPOINT_HOSTNAME.

Error: "TokenRefreshError / AADSTS50194"

Cause: Trying to login via the /common endpoint.

Fix: Ensure src/lib/graph.ts uses ${tenantId} in the token endpoint URL, not "common".

Error: "Agent execution failed"

Cause: Usually missing ANTHROPIC_API_KEY.

Fix: Add key to .env.local and restart the Trigger.dev terminal.

Error: "Credit balance too low"

Cause: Anthropic API safety buffer.

Fix: Add $5 credits to your Anthropic Console.
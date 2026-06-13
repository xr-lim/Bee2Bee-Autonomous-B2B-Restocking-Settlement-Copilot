# 🚀 Bee2Bee  
### Autonomous B2B Restocking & Settlement Copilot

> AI-powered procurement workflow system that automates inventory monitoring, supplier negotiation, and invoice processing for SMEs.

---
### Pitching video:
link: https://drive.google.com/file/d/1rx-pVQoGYBLK321onvQKFunZYgv5PA2t/view?usp=drive_link

### Documentation:
PRD: https://github.com/xr-lim/Bee2Bee-Autonomous-B2B-Restocking-Settlement-Copilot/blob/main/Bee2Bee%20PRD.pdf
QATD: https://github.com/xr-lim/Bee2Bee-Autonomous-B2B-Restocking-Settlement-Copilot/blob/main/Bee2Bee%20QATD.pdf
SAD: https://github.com/xr-lim/Bee2Bee-Autonomous-B2B-Restocking-Settlement-Copilot/blob/main/Bee2Bee%20SAD.pdf

### Pitching Deck:
https://github.com/xr-lim/Bee2Bee-Autonomous-B2B-Restocking-Settlement-Copilot/blob/main/Pitch%20Deck%20Bee2Bee%20Autonomous%20B2B%20Restocking%20%26%20Settlement%20Copilot%20(1).pdf

## 📌 Overview

Bee2Bee is an **AI-driven, stateful procurement system** designed to eliminate manual inefficiencies in restocking workflows. It transforms fragmented and unstructured inputs — such as supplier messages, PDFs, and invoices — into structured, automated decision-making pipelines.

The system continuously monitors inventory, predicts demand, communicates with suppliers, validates invoices, and prepares payment-ready outputs — all within a single intelligent workflow.

---

## 🎯 Problem Statement

Small and medium-sized enterprises (SMEs) often struggle with:
- Manual inventory tracking  
- Inefficient supplier communication  
- Unstructured data (messages, PDFs, images)  
- Error-prone invoice validation  
- Lack of end-to-end procurement visibility  

These issues lead to delays, higher costs, and poor decision-making.

---

## 💡 Solution

Bee2Bee introduces a **fully automated procurement copilot** that:

- Detects low inventory using AI-driven thresholds  
- Initiates restocking workflows automatically  
- Negotiates with suppliers using AI  
- Processes invoices from unstructured inputs  
- Validates financial data and prepares payments  
- Maintains a **stateful workflow for full transparency**

---

## ⚙️ Key Features

### 🧠 Predictive Inventory Management
AI analyzes historical sales (7–365 days) to dynamically adjust reorder thresholds.

### 📦 Batch Restocking Optimization
Groups products from the same supplier to reduce shipping and negotiation costs.

### 🤖 Autonomous Supplier Negotiation
Generates messages, interprets replies, and decides to accept, counter, or escalate.

### 📄 Unstructured Input Processing
Understands:
- Text messages  
- PDFs  
- Images  
- Voice notes  

### 🧾 Intelligent Invoice Processing
Extracts and validates invoice data against negotiated terms.

### 💱 Financial Reconciliation
Performs FX conversion and generates payment-ready summaries.

### 🔄 Stateful Workflow Engine
Tracks every stage: LOW_STOCK → NEGOTIATION → INVOICE → APPROVAL → COMPLETED


### 👤 Human-in-the-Loop Control
Allows user intervention for:
- negotiation escalation  
- invoice mismatch  
- final approval  

---

## 🏗️ System Architecture

Bee2Bee follows a **modular, workflow-driven architecture**:

- **Frontend:** Dashboard UI  
- **Backend:** API & orchestration  
- **Workflow Engine:** Stateful execution (Temporal)  
- **AI Layer:** Decision-making (Gemini 2.5 Flash) 
- **Database:** Persistent storage (Supabase)  

---

## 🧠 AI Integration (Core Innovation)

The system leverages **ILMU GLM 5.1** as a reasoning engine:

- Multi-step decision making  
- Structured JSON outputs  
- Unstructured data understanding  
- Context-aware negotiation  

### Prompt Flow: 
Data → Prompt Builder → ILMU GLM 5.1 → Structured Output → Workflow Engine


---

## 🔄 Workflow Example

1. System detects low stock  
2. AI calculates optimal threshold  
3. Workflow starts automatically  
4. AI negotiates with supplier  
5. Supplier replies are interpreted  
6. Invoice is uploaded and validated  
7. User approves  
8. Payment-ready output generated  

---

## 🛠️ Tech Stack

### Frontend
- Next.js 15  
- TypeScript  
- Tailwind CSS  
- shadcn/ui  

### Backend
- FastAPI (Python)

### Database & Storage
- Supabase (PostgreSQL + Storage)

### AI Layer
- ILMU GLM 5.1

### Real-Time
- WebSockets / Supabase Realtime

### External APIs
- FX Conversion API (mock/real)

---

## 📊 MVP Scope

| Feature | Description |
|--------|------------|
| Inventory Prediction | AI determines restocking needs |
| Supplier Negotiation | AI handles communication |
| Invoice Processing | Extract & validate data |
| Workflow Tracking | Real-time status |
| Approval System | Human verification |

---

## 🚧 Limitations

- No real payment gateway integration  
- No multi-user collaboration  
- Limited supplier system integration  
- Prototype-level deployment  

---

## 🔮 Future Improvements

- Real payment integration (e.g., fintech APIs)  
- Multi-user support  
- Advanced analytics dashboard  
- Supplier-side integration  
- AI optimization for cost & latency  

---

## ⚠️ Risks & Challenges

- AI misinterpretation of supplier responses  
- Unstructured data ambiguity  
- Dependency on external APIs  
- Workflow failure handling  

---

## 👥 Team Roles

| Member | Role |
|------|------|
| Benjamin Lim Shi Hern | negotiation module |
| Chen Wei Jay Nickolas | Frontend & Backend + invoice processing module |
| Chu Cheng Qing | Data, Testing, Threshold Analysis module |
| Lim Xin Rou |  webSockets, Stock request module |

---

## 🏆 Why Bee2Bee is Different

Unlike traditional systems, Bee2Bee is:
- **AI-first** (not rule-based)  
- **Stateful** (tracks full workflow)  
- **End-to-end automated**  
- Built for **real-world messy data**  

---

## 📦 Getting Started (Dev Setup)

### 1. Clone The Repository

```powershell
# Clone the project
git clone https://github.com/xr-lim/Bee2Bee-Autonomous-B2B-Restocking-Settlement-Copilot.git

# Enter the project folder
cd Bee2Bee-Autonomous-B2B-Restocking-Settlement-Copilot
```

### 2. Configure Environment Variables

```powershell
# Copy the backend environment template
copy backend\.env.example backend\.env
```

Update `backend/.env` with your own values:

```env
# Supabase/Postgres database connection
SUPABASE_DB_URL=

# Supabase API keys used by backend/frontend features
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# AI provider configuration
AI_PROVIDER=
GEMINI_API_KEY=
GEMINI_MODEL=

# Telegram bot integration
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
NGROK_AUTHTOKEN=

# Business profile used by the negotiation AI
BUSINESS_COMPANY_NAME=
BUSINESS_SHIPPING_ADDRESS=
BUSINESS_PERSON_IN_CHARGE=
BUSINESS_PHONE=
BUSINESS_EMAIL=
BUSINESS_DEFAULT_PAYMENT_TERMS=
```

### 3. Install Dependencies

```powershell
# Install root helper scripts
npm install

# Install backend Node helper dependencies
cd backend
npm install

# Install backend Python dependencies
pip install -r requirements.txt

# Return to the project root
cd ..

# Install frontend dependencies
cd frontend
npm install

# Return to the project root
cd ..
```

### 4. Initialize The Database

```powershell
# Apply the Supabase schema and migrations
npm run db:init

# Optional: seed demo data
npm run db:seed
```

Useful schema files:

- `backend/supabase/schema.sql`
- `backend/supabase/seed-data.json`
- `backend/supabase/migrations/20260613_supplier_telegram_chat_id.sql`
- `backend/supabase/migrations/20260614_conversation_message_translations.sql`

### 5. Run The Backend

```powershell
# Start FastAPI + Socket.IO on http://127.0.0.1:8000
npm run backend:dev
```

The backend launcher uses:

```powershell
# Manual equivalent if needed
cd backend
python -m uvicorn app.main:socket_app --host 127.0.0.1 --port 8000 --reload
```

### 6. Run The Frontend

```powershell
# Start the Next.js dashboard
cd frontend
npm run dev
```

Open the app at:

```text
http://localhost:3000
```

### 7. Connect Telegram With Ngrok

```powershell
# Start backend first, then run this from the project root
npm run telegram:connect
```

Telegram setup notes:

- Create a bot with `@BotFather`
- Put the bot token in `TELEGRAM_BOT_TOKEN`
- Put your ngrok token in `NGROK_AUTHTOKEN`
- Add each supplier's Telegram chat id in the supplier manager or database
- Full guide: `backend/TELEGRAM_SETUP.md`

### 8. Useful Dev Checks

```powershell
# Check frontend TypeScript
cd frontend
npx tsc --noEmit

# Check backend Python syntax for a file
cd ..
python -m py_compile backend/app/api/v1/routes_negotiation.py

# Check git whitespace issues
git diff --check
```

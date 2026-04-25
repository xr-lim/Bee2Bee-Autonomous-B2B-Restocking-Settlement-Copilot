# 🚀 Bee2Bee  
### Autonomous B2B Restocking & Settlement Copilot

> AI-powered procurement workflow system that automates inventory monitoring, supplier negotiation, and invoice processing for SMEs.

---

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
- **AI Layer:** Decision-making (Z.AI GLM)  
- **Database:** Persistent storage (Supabase)  

---

## 🧠 AI Integration (Core Innovation)

The system leverages **Z.AI GLM** as a reasoning engine:

- Multi-step decision making  
- Structured JSON outputs  
- Unstructured data understanding  
- Context-aware negotiation  

### Prompt Flow: 
Data → Prompt Builder → GLM → Structured Output → Workflow Engine


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

### Workflow Engine
- Temporal (stateful orchestration)

### Database & Storage
- Supabase (PostgreSQL + Storage)

### AI Layer
- Z.AI GLM API

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
| Member A | Frontend (Dashboard UI) |
| Member B | Backend (API & DB) |
| Member C | AI + Workflow (GLM + Temporal) |
| Member D | Data, Testing & Demo |

---

## 🏆 Why Bee2Bee is Different

Unlike traditional systems, Bee2Bee is:
- **AI-first** (not rule-based)  
- **Stateful** (tracks full workflow)  
- **End-to-end automated**  
- Built for **real-world messy data**  

---

## 📦 Getting Started (Dev Setup)

```bash
# Clone repo
git clone https://github.com/your-repo/bee2bee.git

# Install frontend
cd frontend
npm install
npm run dev

# Install backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

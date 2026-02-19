# CORTEX ZERO - Core Infrastructure Blueprint

> **IMPORTANT:** This document is the primary source of truth for the AffeXAI Universal Neural Grid. Read this at the start of every session to understand the hybrid architecture and ongoing Phase 4 expansion.

## 🏗️ Architecture Overview: The Hybrid Neural Grid

AffeXAI uses a **Hybrid Cloud Intelligence** model.

1.  **Body (Local Development):** The NestJS Backend (Apps/Backend) and Next.js Frontend.
2.  **Brain (Oracle Cloud @ 161.118.171.201):** 
    *   **Cortex AI Service:** The orchestration layer (Port 3000 -> Locally tunneled to 8000).
    *   **Ollama:** Local LLM Execution (Port 11434).
    *   **Qdrant:** High-fidelity Vector Database for RAG (Port 6333).

## 🔌 Connection & Tunnels

To keep the system alive, the **Hybrid Tunnel** must be running in the background:
- **Command:** `./scripts/hybrid-tunnel.sh`
- **Mapping:**
  - Local `11434` -> Remote `11434` (Ollama)
  - Local `6333` -> Remote `6333` (Qdrant)
  - Local `8000` -> Remote `3000` (Cortex API) **<-- CRITICAL FIX**

## 🧠 Universal Neural Grid Phase 4 Roadmap

The goal is to transform AffeXAI from a monolithic silo into a self-learning neural system.

### Phase 0: Entegrasyon (COMPLETED Feb 19, 2026)
- **Fix:** Dummy vectors in `StrategyService` replaced with real Cortex Ingestion.
- **Fix:** Backend crash due to missing `usage_records` metadata column resolved.
- **Standard:** Cortex API now uses `tenantId` and `data` fields.

### Phase 1: The Backbone (IN PROGRESS)
- **Central Intelligence:** Building `NeuralGridService` to handle `EventEmitter` signals.
- **Omni-Module Support:** Tickets, Social, Email, and Forms will all flow into this point.

### Phase 2: Rewards Loop
- **Score System:** Every action (Open, Click, Resolve) generates a success score (+/-).
- **RAG Learning:** The system learns "successful strategies" vs "failed approaches".

### Phase 3: The Synapse (UI)
- **AiCoPilot Integration:** Displaying real-time intelligence from the Neural Grid across all pages.

### Phase 4 & 5: Autonomous Growth
- **Neural Crawler:** Autonomous web/X scraping for market signals.
- **Insight Engine:** Proactive nightly analysis and strategy reporting.

## 🛡️ Restore Point Info
- **Restore Tag:** `neural-grid-phase-0-stable`
- **Last Sync:** Feb 19, 04:40 AM (AEST)

---
**Status: RESONANT 🟢**

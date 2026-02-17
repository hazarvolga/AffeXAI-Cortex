# AffeXAI Dev Portability Guide

> **Zero-Error Architecture / Quantum Resonance Auditor (QRA)**
> This system provides autonomous self-healing, resonance auditing, and multi-agent orchestration. how to start ./bin/affexai audit

## 1. System Components

To transplant this system to another project, you need to migrate the following core artifacts:

| Component | Path | Role |
|-----------|------|------|
| **Agent Core** | `.agent/` | Contains all AI personas, skills, and logic. |
| **CLI Wrapper** | `bin/affexai` | The entry point for humans and agents. |
| **Circuit Map** | `docs/system_circuit_map.json` | The "Constitution" of the project structure. |
| **Ruleset** | `GEMINI.md` | The cognitive instruction set for the AI model. |

## 2. Installation Steps

### Step 1: Copy Artifacts
Run these commands from the root of your source project (AffeXAI) to copy to your target project:

```bash
# Define target
TARGET_PROJECT="../my-new-project"

# 1. Copy the Agent Brain
cp -r .agent "$TARGET_PROJECT/"

# 2. Copy the CLI
cp -r bin "$TARGET_PROJECT/"

# 3. Copy the Rules
cp GEMINI.md "$TARGET_PROJECT/"

# 4. Copy External Scripts (Required for QRA)
cp -r scripts "$TARGET_PROJECT/"

# 5. Initialize Circuit Map (Create docs folder if missing)
mkdir -p "$TARGET_PROJECT/docs"
cp docs/system_circuit_map.json "$TARGET_PROJECT/docs/"
```

### Step 2: Dependencies
The system relies on a few global or dev dependencies. Ensure your new project has:

- **Node.js** (for `ts-node` executions)
- **Python 3** (for `checklist.py`, `security_scan.py`)
- **npx**

In your `package.json`, ensure you have:
```json
"devDependencies": {
  "ts-node": "latest",
  "typescript": "latest"
}
```

## 3. Configuration

### A. Reset the Circuit Map
The `docs/system_circuit_map.json` file contains paths specific to AffeXAI (e.g., `apps/frontend/src/app/[tenant]`).
**You MUST reset this file for your new project.**

1. Open `docs/system_circuit_map.json` in the new project.
2. Clear the `modules` object but keep the structure:
```json
{
    "project": "My New Project",
    "version": "0.1.0",
    "last_audit": null,
    "modules": {},
    "deep_dive_hooks": { ... }
}
```
3. Run `bin/affexai audit` (or let the `explorer-agent` do it) to start discovering new circuits.

### B. Update CLI Paths
Check `bin/affexai`. It currently points to:
`npx ts-node .agent/scripts/qra/probe_factory.ts` (Ensure the relative path maps correctly to where you placed the `.agent` folder).

*Note: If `bin/affexai` hardcodes `scripts/` instead of `.agent/scripts/`, verify the path mapping.*

## 4. Verification

To verify the transplant was successful:

1. Open the new project in your editor.
2. Run the audit command:
   ```bash
   ./bin/affexai audit
   ```
3. If successful, you should see:
   `:: INITIATING QRA RESONANCE AUDIT ::`

## 5. Adapting GEMINI.md
Update the `User Rules` in `GEMINI.md` if your new project has different architectural constraints (e.g., if it's a minimal script repo vs a monorepo).

---
**Maintained by:** AffeXAI Dev Orchestrator

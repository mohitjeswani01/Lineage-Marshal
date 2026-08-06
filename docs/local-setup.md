# DataHub Local Dev Environment — Setup Guide

> **Audience:** Anyone cloning this repo who needs a local DataHub instance — contributors, reviewers, and hackathon judges running the demo.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Install the DataHub CLI](#2-install-the-datahub-cli)
3. [Start DataHub with Docker](#3-start-datahub-with-docker)
4. [Verify All Containers Are Healthy](#4-verify-all-containers-are-healthy)
5. [Generate a Personal Access Token (PAT)](#5-generate-a-personal-access-token-pat)
6. [Authenticate the CLI](#6-authenticate-the-cli)
7. [Load Sample Data](#7-load-sample-data)
8. [Port-Override Reference](#8-port-override-reference)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

| Requirement | Minimum | Notes |
|---|---|---|
| **Docker Desktop** | 4.x | Must be running before any `datahub docker` command |
| **Docker RAM allocation** | **8 GB** | See [§9.4](#94-containers-crash-immediately--oom) — insufficient RAM is the #1 silent failure |
| **Python** | 3.9+ | 3.12 is confirmed working |
| **pip** | 22+ | `pip install --upgrade pip` first |
| **OS** | Windows 10/11 (WSL2), macOS, or Linux | WSL2 path documented separately below |

### Windows / WSL2 users — read this first

All `datahub` CLI commands must be run **inside WSL2**, not in PowerShell or CMD. The Docker Desktop WSL2 backend makes the Docker socket available inside WSL automatically — no extra setup needed.

Open a WSL terminal:
```powershell
# From Windows Terminal or PowerShell
wsl
```

Then run everything below from the WSL shell prompt (`$`).

---

## 2. Install the DataHub CLI

```bash
# Inside WSL (or your Linux/Mac terminal)
pip install "acryl-datahub[all]>=1.0.0"

# Verify
datahub version
```

Expected output:
```
DataHub CLI version: 1.7.0
Models: bundled
Python version: 3.12.3
```

> **Version-match requirement (confirmed live):** The CLI version should match your GMS server version. Running a 1.6.x CLI against a 1.7.x GMS will cause `ReadTimeoutError` on the async bulk-ingestion endpoint — entities will silently fail to load. See [§9.7](#97-cli--server-version-mismatch--bulk-ingestion-timeouts) for details.

---

## 3. Start DataHub with Docker

```bash
datahub docker quickstart
```

This pulls and starts all required containers (~5–10 min on first run). On subsequent runs it typically takes ~60–90 seconds.

**Services started:**

| Service | Default host port | Internal role |
|---|---|---|
| `datahub-gms` | `8080` | Core metadata API (GMS) |
| `datahub-frontend-react` | `9002` | Web UI |
| `mysql` | `3306` | Relational store |
| `kafka-broker` | `9092` | Event streaming |
| `schema-registry` | `8081` | Kafka schema registry |
| `opensearch` (or elasticsearch) | `9200` | Search index |
| `elasticsearch-setup` | — | One-shot init job |
| `kafka-setup` | — | One-shot init job |

The UI is reachable at **http://localhost:9002** once GMS is healthy. Default credentials: `datahub` / `datahub`.

---

## 4. Verify All Containers Are Healthy

```bash
docker ps --format "table {{.Names}}\t{{.Status}}" | grep datahub
```

All containers should show `Up ... (healthy)`. If any show `Restarting` or `Exited`, see [§9](#9-troubleshooting).

You can also check GMS directly:
```bash
curl -s http://localhost:8080/health | python3 -m json.tool
```

Expected:
```json
{"status": "UP"}
```

---

## 5. Generate a Personal Access Token (PAT)

PATs are generated in the DataHub UI — **there is no CLI command to generate them**.

1. Open **http://localhost:9002** in your browser.
2. Log in as `datahub` / `datahub`.
3. Click your avatar (top-right) → **Settings**.
4. Navigate to **Access Tokens** in the left sidebar.
5. Click **Generate new token**.
6. Give it a name (e.g. `lineage-marshal-dev`), set expiry as needed.
7. **Copy the token immediately** — it will not be shown again.

Store the token in your local `.env` (never commit it):
```bash
# .env (git-ignored)
DATAHUB_GMS_URL=http://localhost:8080
DATAHUB_TOKEN=<paste-token-here>
```

---

## 6. Authenticate the CLI

### Quickstart (local instance with default credentials)

```bash
# Non-interactive — generates a PAT and writes ~/.datahubenv in one shot
datahub init --username datahub --password datahub

# Add --force to overwrite an existing ~/.datahubenv without prompting (useful when rebuilding)
datahub init --username datahub --password datahub --force
```

> **Known issue — acryl-datahub 1.7.0:** `datahub init --username/--password` now calls `http://localhost:9002/logIn` (the frontend) instead of GMS directly. If the frontend returns `500 Internal Server Error` during this call, the init fails even though the frontend container is healthy. This appears to be a race condition during startup or a request-format mismatch in 1.7.0. **Workaround:** If `datahub init` fails with a 500, your existing `~/.datahubenv` (written by the previous successful init) remains valid — the token in it still works. Just run the ingestion/seed commands directly; the CLI reads the file automatically.

### Interactive mode (prompts for each value)

```bash
datahub init
```

The interactive prompts:
```
Enter your DataHub host (default: https://your-org.acryl.io): http://localhost:8080
Enter your DataHub access token (or leave blank for no auth): <paste PAT here>
```

This writes `~/.datahubenv`. All subsequent `datahub` CLI commands will use it automatically.

**Non-interactive alternative** (useful in scripts/CI):
```bash
export DATAHUB_GMS_URL=http://localhost:8080
export DATAHUB_GMS_TOKEN=<your-PAT>
```

---

## 7. Load Sample Data

> **Known issue — `datahub datapack` CLI (acryl-datahub 1.6.0.17):** The standalone `datahub datapack` command crashes on `--help` with a `FileNotFoundError` for a missing bundled resource file (`DATAPACK_AGENT_CONTEXT.md`). This is a packaging bug in the current release. **Do not use `datahub datapack load`**; use the command below instead, which calls the same underlying code without the broken wrapper.

### Correct command (works on acryl-datahub ≥ 0.13, confirmed on 1.6.0.17)

```bash
# Load the e-commerce showcase pack (~1,000 entities, rich lineage)
datahub docker ingest-sample-data --pack showcase-ecommerce
```

This is functionally identical to `datahub datapack load showcase-ecommerce` — it uses the same pack registry, same underlying ingestion code, same output — but bypasses the broken `datapack` CLI wrapper.

### Fallback (no `--pack` flag, loads basic bootstrap data only)

```bash
datahub docker ingest-sample-data
```

This loads a smaller built-in bootstrap dataset. Only use this if the `--pack showcase-ecommerce` flag is not recognized on your installed version.

### Verifying the load

```bash
# Search for datasets
datahub search --entity-type dataset --query "" 2>&1 | head -40
```

Or open the UI at **http://localhost:9002** → **Catalog** — you should see datasets, dashboards, and lineage graphs populated. The showcase-ecommerce pack loads ~1,000 entities including datasets, charts, dashboards, pipelines, and lineage edges.

---

## 8. Port-Override Reference

If any default port is already in use on your host, override it **before** running `datahub docker quickstart`.

### MySQL (default: 3306)

```bash
datahub docker quickstart --mysql-port 53306
```

### GMS / Metadata API (default: 8080)

GMS port is controlled via an environment variable (not a CLI flag):
```bash
DATAHUB_MAPPED_GMS_PORT=58080 datahub docker quickstart
```

> **Important:** If you change the GMS port, update `.env` and `datahub init` accordingly — every CLI command and the agent configuration will need the new URL.

### Frontend UI (default: 9002)

Edit `~/.datahub/quickstart/docker-compose.yml` (generated after the first `quickstart` run). Find the `datahub-frontend-react` service and change the host port:
```yaml
ports:
  - "19002:9002"   # expose on 19002 instead
```

Then restart with:
```bash
datahub docker quickstart --quickstart-compose-file ~/.datahub/quickstart/docker-compose.yml
```

### Using a custom compose file for multiple overrides

```bash
# Download the default compose file first
datahub docker quickstart --dry-run --quickstart-compose-file /tmp/dh-compose.yml 2>/dev/null \
  || cp ~/.datahub/quickstart/docker-compose.yml /tmp/dh-compose.yml

# Edit /tmp/dh-compose.yml as needed, then:
datahub docker quickstart --quickstart-compose-file /tmp/dh-compose.yml
```

---

## 9. Troubleshooting

### 9.1 MySQL port conflict on Windows (3306 already in use)

**Symptom:** `datahub docker quickstart` fails or hangs; `docker ps` shows the MySQL container stuck in `Restarting`.

**Root cause:** A native Windows MySQL server (mysqld.exe) is installed and squatting on port 3306 before Docker Desktop can bind to it.

**Fix — step by step:**

**Step 1:** Open PowerShell **as Administrator** on Windows (not inside WSL).

```powershell
# Find the process holding port 3306
netstat -ano | findstr ":3306"
# Note the PID in the last column, e.g. 4872

# Kill it (replace 4872 with your actual PID)
Stop-Process -Id 4872 -Force

# Confirm it's gone
netstat -ano | findstr ":3306"   # should return nothing
```

**Step 2:** Stop all DataHub containers and remove their volumes (a partial start with port conflicts can leave corrupt state):

```bash
# Inside WSL
datahub docker quickstart --stop
docker compose -p datahub down -v --remove-orphans
docker container prune -f   # remove any leftover stopped containers
docker volume prune -f      # remove leftover volumes
```

**Step 3:** Start fresh:

```bash
datahub docker quickstart
```

**Prevent recurrence:** If you want Windows MySQL to coexist with DataHub, start DataHub on a different MySQL port permanently:

```bash
datahub docker quickstart --mysql-port 53306
```

> ⚠️ **Do not stop** the native Windows MySQL service unless you know what it's used for — some Windows tools (XAMPP, MySQL Workbench defaults, etc.) depend on it. The port remap is the safer fix.

---

### 9.2 GMS port conflict (8080 already in use)

**Symptom:** `curl http://localhost:8080/health` returns a connection refused error or returns HTML from a different application (e.g. Jenkins, Tomcat, or another Spring Boot service).

**Fix:**

```bash
DATAHUB_MAPPED_GMS_PORT=58080 datahub docker quickstart
```

Then update `.env`:
```
DATAHUB_GMS_URL=http://localhost:58080
```

And re-run `datahub init` with the new URL.

---

### 9.3 Frontend port conflict (9002 already in use)

**Symptom:** Browser to http://localhost:9002 shows the wrong app.

**Fix:** Use a custom compose file to remap the frontend port (see [§8](#8-port-override-reference)). There is no standalone CLI flag for the frontend port.

---

### 9.4 Containers crash immediately / OOM

**Symptom:** Containers start then immediately exit; `docker logs datahub-gms` shows `java.lang.OutOfMemoryError`.

**Root cause:** Docker Desktop is not allocated enough RAM. DataHub requires **at least 8 GB** to run all services. With 4 GB, containers will OOM-kill each other unpredictably.

**Fix:**

1. Open **Docker Desktop** → **Settings** → **Resources**.
2. Set **Memory** to **8 GB** (16 GB recommended for comfortable dev use).
3. Click **Apply & Restart**.
4. Re-run `datahub docker quickstart`.

---

### 9.5 WSL2 clock drift — token auth failures

**Symptom:** DataHub CLI returns `401 Unauthorized` even with a valid PAT; the error message mentions token expiry or timestamp mismatch.

**Root cause:** WSL2's internal clock can drift significantly (especially after the host machine sleeps), causing HMAC/JWT timestamp validation to fail.

**Fix:**

```bash
# Inside WSL — resync the clock
sudo hwclock -s
# Or:
sudo ntpdate pool.ntp.org
```

Then retry the CLI command.

---

### 9.6 `datahub: command not found` in WSL

**Symptom:** `datahub version` returns `bash: datahub: command not found` despite `pip install acryl-datahub` succeeding.

**Root cause:** pip installs the `datahub` script into `~/.local/bin` (user install) or a virtual-env `bin/`, neither of which may be on `$PATH` in that shell session.

**Fix:**

```bash
# Find where datahub was installed
python3 -m site --user-base
# Typically /home/<user>/.local

# Add to PATH (add this line to ~/.bashrc for persistence)
export PATH="$HOME/.local/bin:$PATH"

# Apply immediately
source ~/.bashrc

# Verify
datahub version
```

Alternatively, invoke via Python module (always works, no PATH dependency):
```bash
python3 -m datahub version
```

---

## Quick Reference — Most Common Commands

```bash
# Start DataHub
datahub docker quickstart

# Stop DataHub (preserves data)
datahub docker quickstart --stop

# Wipe and restart from scratch
datahub docker quickstart --stop
docker compose -p datahub down -v --remove-orphans
datahub docker quickstart

# Check GMS health
curl -s http://localhost:8080/health

# Authenticate CLI (non-interactive, local defaults)
datahub init --username datahub --password datahub

# Load sample data  (correct command — datahub datapack has a packaging bug in 1.6)
datahub docker ingest-sample-data --pack showcase-ecommerce

# Search datasets
datahub search --entity-type dataset --query ""
```

---

### 9.7 CLI / Server version mismatch — bulk ingestion timeouts

**Symptom:** `datahub docker ingest-sample-data --pack showcase-ecommerce` exits with exit code 1; the log shows `ReadTimeoutError` on `/openapi/v3/entity/*?async=true` for hundreds of entities. Entity counts in the catalog are far below expected (e.g., 19 datasets instead of ~100).

**Root cause:** The `acryl-datahub` CLI version does not match the running GMS version. When 1.6.x talks to a 1.7.x server, the async-batch ingestion protocol behaves differently — GMS acknowledges writes faster than the older client expects, causing spurious 30s timeouts. The CLI itself will warn you:
```
❗Client-Server Incompatible❗ Your client version 1.6.0.17 is older than your server version 1.7.0.
```

**Check your versions:**
```bash
# CLI version
datahub version

# GMS/server version
curl -s http://localhost:8080/config | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['versions'])"
```

**Fix — upgrade CLI to match server:**
```bash
# Find the server version from the config output, then install matching CLI
pip install 'acryl-datahub==1.7.0' --break-system-packages

# Re-authenticate after upgrade (token format may differ)
datahub init --username datahub --password datahub --force

# Verify versions match
datahub version
```

Then retry the ingestion. With matching versions the async-batch endpoint works correctly.

> **Note for future rebuilds:** After `datahub docker quickstart` pulls a new GMS image, always re-check the server version and upgrade/downgrade the CLI to match before running ingestion.

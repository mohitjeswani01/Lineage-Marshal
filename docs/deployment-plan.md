# Lineage Marshal — Backend Deployment Plan

> **Note:** Deployment prep for Issue 18 (backend containerization and host architecture). Deploy execution follows once Issue 12 (`agent/api/` FastAPI endpoints) is merged.

---

## 1. Hosting Architecture & Recommendation

### Selected Host: Render Web Service (or Railway)
For hosting the Python 3.12 backend container (`agent/Dockerfile`), **Render** (or Railway) is recommended:
- **Native Docker Runtime:** Builds directly from `agent/Dockerfile`.
- **Environment Management:** Secure environment variable secret injection.
- **Port Binding:** Automatically routes public HTTPS traffic to internal port `8000`.
- **Health Checks:** Built-in TCP / HTTP health probe support (`/health` once Issue 12 merges).

---

## 2. Primary Network Connectivity: Cloudflare Tunnel / Ngrok

> [!IMPORTANT]
> **DataHub Reachability Strategy (Primary Approach)**
> Because DataHub runs locally via Docker Compose (`http://localhost:8080`), a cloud backend (e.g. on Render) cannot connect directly to `localhost`.
>
> Given time constraints, **Cloudflare Tunnel (or Ngrok)** is the **PRIMARY recommended strategy** for today's demo deployment:
> 1. Expose local DataHub GMS port `8080` to a secure, public HTTPS endpoint via Cloudflare Tunnel (`cloudflared`) or Ngrok.
> 2. Set the deployed backend's `DATAHUB_GMS_URL` environment variable to the public tunnel URL.
>
> *(Note: Self-hosting a cloud VM running DataHub GMS or using Acryl Cloud is a long-term production consideration for future phases, but is out of scope for today's demo.)*

### Setup Steps for Cloudflare Tunnel (Primary Demo Path)
```bash
# 1. Install cloudflared (if not present)
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# 2. Start tunnel pointing to local DataHub GMS (port 8080)
cloudflared tunnel --url http://localhost:8080
```
*Take the generated trycloudflare URL (e.g., `https://random-subdomain.trycloudflare.com`) and configure it as `DATAHUB_GMS_URL` in your cloud host settings.*

---

## 3. Environment Variable Contract

The deployed backend requires **only** the following environment variables (matching `.env.example`):

| Variable Name | Description | Example / Required Value |
|---|---|---|
| `DATAHUB_GMS_URL` | URL of the DataHub GMS service | `https://your-tunnel.trycloudflare.com` (or `http://localhost:8080` locally) |
| `DATAHUB_GMS_TOKEN` | Personal Access Token (PAT) for DataHub authentication | `eyJhbGciOiJIUzI1NiJ9...` |
| `TOOLS_IS_MUTATION_ENABLED` | Flag allowing write-back operations (Context Documents) | `true` |

*(Note: No OpenAI or third-party LLM key is required; Lineage Marshal uses native rule-driven lineage & blast radius analysis.)*

---

## 4. Containerization (`agent/Dockerfile`)

The backend is containerized via `agent/Dockerfile`:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . ./agent

EXPOSE 8000

CMD ["uvicorn", "agent.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 5. Execution Checklist for Final Deployment

Once Issue 12's FastAPI branch (`phase3/api-and-notifications`) is merged into main:

1. **Build and Test Container Locally:**
   ```bash
   docker build -t lineage-marshal-backend -f agent/Dockerfile .
   docker run -p 8000:8000 --env-file agent/.env lineage-marshal-backend
   ```
2. **Launch Cloudflare Tunnel for DataHub GMS:**
   ```bash
   cloudflared tunnel --url http://localhost:8080
   ```
3. **Deploy to Render / Railway:**
   - Connect Git repository `mohitjeswani01/Lineage-Marshal`.
   - Set build context root to repo root, Dockerfile path to `agent/Dockerfile`.
   - Set environment variables (`DATAHUB_GMS_URL`, `DATAHUB_GMS_TOKEN`, `TOOLS_IS_MUTATION_ENABLED`).
4. **Verify Health Endpoint:**
   ```bash
   curl -s https://<your-render-app>.onrender.com/health
   ```

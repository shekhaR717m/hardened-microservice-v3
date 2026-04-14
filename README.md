# Hardened Microservice Ecosystem v3 — Full-Stack DevSecOps Dashboard

> A production-grade, security-first microservice platform with a real-time DevSecOps monitoring dashboard.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Prerequisites](#prerequisites)
4. [Setup Guide](#setup-guide)
5. [Dashboard Features](#dashboard-features)
6. [Security Hardening](#security-hardening)
7. [Docker Optimization](#docker-optimization)
8. [Error Fixing Guide](#error-fixing-guide)
9. [Testing Guide](#testing-guide)
10. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      WSL2 Host                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │                  K3s Cluster                      │  │
│  │                                                   │  │
│  │  ┌─────────────┐    ┌──────────────────────────┐  │  │
│  │  │  Dashboard   │    │   FastAPI Backend Pod    │  │  │
│  │  │  (React UI)  │───▶│  /health  /metrics       │  │  │
│  │  │  Port: 3000  │    │  Port: 8000              │  │  │
│  │  │  UID: 1000   │    │  UID: 1000 (appuser)     │  │  │
│  │  └─────────────┘    └──────────────────────────┘  │  │
│  │         │                       │                  │  │
│  │         ▼                       ▼                  │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │         kube-prometheus-stack                │  │  │
│  │  │  Prometheus ◄── ServiceMonitor              │  │  │
│  │  │  Grafana (Port 3000) ◄── Dashboards         │  │  │
│  │  │  AlertManager ◄── PrometheusRules           │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Defense in Depth Layers

| Layer | Component | Protection |
|-------|-----------|------------|
| L1 — Build | Multi-stage Dockerfile | Minimal attack surface (<50 MB) |
| L2 — Container | Non-root UID 1000 | No privilege escalation |
| L3 — Filesystem | readOnlyRootFilesystem | Immutable container |
| L4 — Network | NetworkPolicy | Namespace-level isolation |
| L5 — Runtime | SecurityContext (Triple 1000) | UID:GID:FSGroup = 1000 |
| L6 — CI/CD | Trivy scan | Block CRITICAL CVEs |
| L7 — Observability | Prometheus alerts | Error rate & latency gates |

---

## Project Structure

```
hardened-microservice-v3/
├── app/
│   ├── main.py                    # FastAPI app (JSON logs, graceful shutdown)
│   └── requirements.txt           # Python dependencies
├── dashboard/
│   ├── Dockerfile                 # Multi-stage UI build (<50 MB)
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── IdentityMonitor.tsx      # Non-root UID card
│   │   │   ├── FilesystemLockStatus.tsx # Read-only FS indicator
│   │   │   ├── SelfHealingLog.tsx       # Pod restart feed
│   │   │   ├── PrometheusGraph.tsx      # p95 latency & error chart
│   │   │   ├── HealthCheck.tsx          # K3s connectivity status
│   │   │   └── ClusterStatus.tsx        # Overall cluster health
│   │   └── hooks/
│   │       └── useK8sApi.ts             # K8s API client with error handling
│   └── nginx.conf                       # Production Nginx config
├── k8s/charts/my-app/
│   ├── Chart.yaml
│   ├── values.yaml
│   ├── templates/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── servicemonitor.yaml
│   │   ├── configmap.yaml
│   │   ├── networkpolicy.yaml
│   │   ├── prometheusrule.yaml
│   │   └── dashboard-deployment.yaml
├── .github/workflows/
│   └── pipeline.yml
├── Dockerfile                     # Backend multi-stage build
├── README.md                      # This file
├── ERROR_FIXING_GUIDE.md          # Error diagnosis & fixes
└── TESTING_GUIDE.md               # 14-point test matrix
```

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| WSL2 | Ubuntu 22.04+ | Host environment |
| K3s | v1.28+ | Lightweight Kubernetes |
| Docker | 24+ | Container builds |
| Helm | v3.12+ | Package management |
| kubectl | v1.28+ | Cluster management |
| Node.js | 20 LTS | Dashboard build |

---

## Setup Guide

### Step 1: K3s Cluster

```bash
# Install K3s
curl -sfL https://get.k3s.io | sh -
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
sudo chmod 644 /etc/rancher/k3s/k3s.yaml

# Verify cluster
kubectl get nodes
# Expected: Single node in "Ready" status
```

### Step 2: Monitoring Stack

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace
```

### Step 3: Build & Deploy Backend

```bash
# Build hardened image
docker build -t my-app:latest .

# Import into K3s
docker save my-app:latest | sudo k3s ctr images import -

# Deploy via Helm
helm upgrade --install my-app ./k8s/charts/my-app
```

### Step 4: Build & Deploy Dashboard

```bash
cd dashboard
docker build -t my-dashboard:latest .
docker save my-dashboard:latest | sudo k3s ctr images import -

# Deploy dashboard pod
kubectl apply -f ../k8s/charts/my-app/templates/dashboard-deployment.yaml
```

### Step 5: Access Services

```bash
# FastAPI Backend
kubectl port-forward svc/my-app 8000:8000

# Dashboard
kubectl port-forward svc/my-dashboard 3000:80

# Grafana
kubectl port-forward svc/monitoring-grafana 3001:80 -n monitoring
# Login: admin / prom-operator
```

---

## Dashboard Features

### 1. Identity Monitor Card

Displays whether the running pod uses **non-root UID 1000**.

- **Green badge**: `UID 1000 — Non-Root ✓`
- **Red badge**: `Running as Root — SECURITY RISK`

**Data source**: Kubernetes Downward API → `status.containerStatuses[].securityContext`

### 2. Filesystem Lock Status

Visual indicator for read-only filesystem enforcement.

| State | Display |
|-------|---------|
| Enabled | 🔒 Shield icon, green — "Read-Only Filesystem: Enabled" |
| Disabled | ⚠️ Warning icon, red — "Filesystem Writable — RISK" |

**Data source**: `deployment.spec.template.spec.containers[].securityContext.readOnlyRootFilesystem`

### 3. Self-Healing Log

Real-time feed showing pod restart events.

```
[14:32:05] ⟳ Pod my-app-7d8f9 restarted (OOMKilled) — Attempt 3/5
[14:31:50] ⟳ Pod my-app-7d8f9 restarted (CrashLoopBackOff) — Attempt 2/5
[14:31:12] ✓ Pod my-app-a3b2c healthy — Running for 4h 22m
```

**Data source**: Kubernetes Events API → `kubectl get events --field-selector reason=Restarting`

### 4. Prometheus Graph

Dual-axis chart displaying:

- **Left axis**: p95 Latency (ms) — line chart
- **Right axis**: Error Rate (%) — area chart
- **Threshold lines**: 500ms latency, 5% error rate

**Data source**: Prometheus query API → `histogram_quantile(0.95, ...)` and `rate(http_requests_total{status=~"5.."}[5m])`

### 5. Health Check with K3s Connectivity

Handles the common "Connection Refused on port 6443" error:

- Polls `/health` endpoint every 10 seconds
- If K3s API (6443) is unreachable → shows "⚠️ K3s Server Down — Connection Refused on :6443"
- Auto-retry with exponential backoff (10s → 20s → 40s → max 60s)

---

## Security Hardening

### Triple 1000 Security Context

Every container runs with:

```yaml
securityContext:
  runAsUser: 1000
  runAsGroup: 1000
  fsGroup: 1000
  runAsNonRoot: true
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL
```

### Network Policies

```yaml
# Only allow traffic from:
# 1. Prometheus (monitoring namespace) — for scraping
# 2. Ingress controller — for user traffic
# 3. Dashboard pod — for API calls
ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: monitoring
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: ingress-nginx
    - podSelector:
        matchLabels:
          app: my-dashboard
```

---

## Docker Optimization

### Backend Dockerfile (Target: <100 MB)

```dockerfile
# Stage 1: Build
FROM python:3.11-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --target=/build/deps -r requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim AS runtime
RUN addgroup --gid 1000 appgroup && \
    adduser --uid 1000 --gid 1000 --disabled-password appuser
WORKDIR /app
COPY --from=builder /build/deps /usr/local/lib/python3.11/site-packages/
COPY app/ .
USER 1000:1000
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Dashboard Dockerfile (Target: <50 MB)

```dockerfile
# Stage 1: Build React app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx (~25 MB)
FROM nginx:1.25-alpine AS runtime
RUN addgroup -g 1000 appgroup && \
    adduser -u 1000 -G appgroup -D appuser && \
    chown -R 1000:1000 /var/cache/nginx /var/log/nginx /etc/nginx/conf.d
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
USER 1000:1000
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Size comparison**:

| Image | Before | After (Multi-stage) |
|-------|--------|---------------------|
| Backend | 237 MB | ~85 MB |
| Dashboard | N/A | ~25 MB |

---

## Testing Guide

### Test Matrix (18 Tests)

| # | Feature | Command | Expected Result |
|---|---------|---------|-----------------|
| 1 | Non-Root User | `kubectl exec -it <pod> -- whoami` | `appuser` |
| 2 | UID Check | `kubectl exec -it <pod> -- id` | `uid=1000 gid=1000` |
| 3 | Read-Only FS | `kubectl exec -it <pod> -- touch /tmp/test` | "Read-only file system" |
| 4 | No Privilege Escalation | `kubectl get deploy my-app -o jsonpath='{..securityContext}'` | `allowPrivilegeEscalation: false` |
| 5 | Self-Healing | `kubectl delete pod -l app=my-app` | New pod in 10-15s |
| 6 | Zero-Downtime | `curl` loop during `rollout restart` | Zero failures |
| 7 | Graceful Shutdown | `kubectl logs` during rollout | "SIGTERM received" message |
| 8 | JSON Logs | `kubectl logs <pod>` | JSON formatted output |
| 9 | Metrics Endpoint | `curl localhost:8000/metrics` | Prometheus metrics list |
| 10 | Health Endpoint | `curl localhost:8000/health` | `{"status": "healthy"}` |
| 11 | ServiceMonitor | `kubectl get servicemonitor` | Port name "http" |
| 12 | Network Policy | `kubectl get networkpolicy` | Restricted ingress rules |
| 13 | Alert Rules | `kubectl get prometheusrule` | HighErrorRate, HighP95Latency |
| 14 | ConfigMap | `kubectl get configmap my-app-config` | APP_VERSION, APP_ENV |
| 15 | Dashboard Identity Card | Open dashboard UI | "UID 1000 — Non-Root ✓" |
| 16 | Dashboard FS Lock | Open dashboard UI | "Read-Only Filesystem: Enabled 🔒" |
| 17 | Dashboard Self-Heal Feed | Delete pod, watch dashboard | Restart event appears |
| 18 | Dashboard Latency Graph | Run `ab -n 1000 -c 50` | Latency spike on chart |

### Running All Tests

```bash
# Automated smoke test
chmod +x scripts/smoke-test.sh
./scripts/smoke-test.sh
```

---


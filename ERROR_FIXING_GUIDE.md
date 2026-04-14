# Error Fixing Guide — Hardened Microservice Ecosystem v3

> Comprehensive diagnosis and resolution for every known issue.

---

## Table of Contents

1. [Connection Refused on Port 6443](#1-connection-refused-on-port-6443)
2. [Permission Denied — Kubeconfig](#2-permission-denied--kubeconfig)
3. [Docker Image Too Large (237 MB)](#3-docker-image-too-large-237-mb)
4. [Pod Running as Root](#4-pod-running-as-root)
5. [CrashLoopBackOff — Read-Only FS](#5-crashloopbackoff--read-only-fs)
6. [Prometheus Not Scraping Metrics](#6-prometheus-not-scraping-metrics)
7. [Network Policy Blocking Traffic](#7-network-policy-blocking-traffic)
8. [Trivy Failing in CI/CD](#8-trivy-failing-in-cicd)
9. [Dashboard Cannot Reach K8s API](#9-dashboard-cannot-reach-k8s-api)
10. [Graceful Shutdown Not Working](#10-graceful-shutdown-not-working)
11. [Self-Healing Not Triggering](#11-self-healing-not-triggering)
12. [Grafana Dashboard Empty](#12-grafana-dashboard-empty)

---

## 1. Connection Refused on Port 6443

### Symptom
```
Error: dial tcp 127.0.0.1:6443: connect: connection refused
```

### Root Cause
K3s API server is not running or has crashed.

### Diagnosis
```bash
# Check K3s service status
sudo systemctl status k3s

# Check K3s logs
sudo journalctl -u k3s -n 50 --no-pager

# Check if port 6443 is listening
sudo ss -tlnp | grep 6443
```

### Fix
```bash
# Restart K3s
sudo systemctl restart k3s

# Wait for API server
until kubectl get nodes &>/dev/null; do echo "Waiting for K3s..."; sleep 3; done
echo "K3s is ready"

# If persistent failure, re-install
curl -sfL https://get.k3s.io | sh -
```

### Dashboard Integration
The dashboard's `HealthCheck` component handles this automatically:
- Polls every 10 seconds
- Shows "⚠️ K3s Server Down" banner with retry countdown
- Auto-reconnects when K3s recovers

---

## 2. Permission Denied — Kubeconfig

### Symptom
```
error: error loading config file "/etc/rancher/k3s/k3s.yaml": open: permission denied
```

### Root Cause
K3s kubeconfig is owned by root with mode 600.

### Fix
```bash
# Option A: Fix permissions (development only)
sudo chmod 644 /etc/rancher/k3s/k3s.yaml

# Option B: Copy to user directory (recommended)
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $(id -u):$(id -g) ~/.kube/config
export KUBECONFIG=~/.kube/config
echo 'export KUBECONFIG=~/.kube/config' >> ~/.bashrc

# Option C: For dashboard pod (ServiceAccount)
# The dashboard uses an in-cluster ServiceAccount with RBAC:
kubectl create serviceaccount dashboard-sa
kubectl create clusterrolebinding dashboard-binding \
  --clusterrole=view \
  --serviceaccount=default:dashboard-sa
```

### RBAC for Dashboard
```yaml
# Minimal read-only role for the dashboard
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: dashboard-reader
rules:
  - apiGroups: [""]
    resources: ["pods", "events", "services", "configmaps"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets"]
    verbs: ["get", "list", "watch"]
```

---

## 3. Docker Image Too Large (237 MB)

### Symptom
```
$ docker images my-app
REPOSITORY   TAG       SIZE
my-app       latest    237MB
```

### Root Cause
- Single-stage build including build tools and pip cache
- Using full `python:3.11` instead of `python:3.11-slim`
- Node modules left in production image

### Fix — Backend (<100 MB)
```dockerfile
# ❌ BAD: Single stage
FROM python:3.11
COPY . .
RUN pip install -r requirements.txt

# ✅ GOOD: Multi-stage
FROM python:3.11-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --target=/build/deps -r requirements.txt

FROM python:3.11-slim
COPY --from=builder /build/deps /usr/local/lib/python3.11/site-packages/
COPY app/ /app/
USER 1000:1000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Fix — Dashboard (<50 MB)
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Final image is just Nginx + static files (~25 MB)
FROM nginx:1.25-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
USER 1000:1000
```

### Verification
```bash
docker build -t my-app:latest .
docker images my-app --format "{{.Size}}"
# Expected: < 100 MB

cd dashboard
docker build -t my-dashboard:latest .
docker images my-dashboard --format "{{.Size}}"
# Expected: < 50 MB
```

---

## 4. Pod Running as Root

### Symptom
```bash
$ kubectl exec -it <pod> -- whoami
root
```

### Root Cause
Dockerfile missing `USER` directive or securityContext not enforced.

### Fix — Dockerfile
```dockerfile
# Add non-root user
RUN addgroup --gid 1000 appgroup && \
    adduser --uid 1000 --gid 1000 --disabled-password --gecos "" appuser
USER 1000:1000
```

### Fix — deployment.yaml
```yaml
spec:
  template:
    spec:
      securityContext:
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
      containers:
        - name: my-app
          securityContext:
            runAsNonRoot: true
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
```

### Verification
```bash
kubectl exec -it $(kubectl get pod -l app=my-app -o jsonpath='{.items[0].metadata.name}') -- id
# Expected: uid=1000(appuser) gid=1000(appgroup)
```

---

## 5. CrashLoopBackOff — Read-Only FS

### Symptom
```
CrashLoopBackOff: back-off 5m0s restarting failed container
```
With logs showing:
```
OSError: [Errno 30] Read-only file system: '/app/__pycache__'
```

### Root Cause
Python tries to write `.pyc` bytecode cache files, but `readOnlyRootFilesystem: true` blocks it.

### Fix
```yaml
# Option A: Set PYTHONDONTWRITEBYTECODE (recommended)
env:
  - name: PYTHONDONTWRITEBYTECODE
    value: "1"

# Option B: Mount emptyDir for cache
volumeMounts:
  - name: cache-vol
    mountPath: /tmp
volumes:
  - name: cache-vol
    emptyDir: {}
```

### Verification
```bash
kubectl logs -l app=my-app --tail=5
# Expected: Clean startup, no filesystem errors
```

---

## 6. Prometheus Not Scraping Metrics

### Symptom
Grafana shows "No data" for all metrics.

### Diagnosis
```bash
# Check ServiceMonitor exists
kubectl get servicemonitor my-app

# Check Prometheus targets
kubectl port-forward svc/monitoring-kube-prometheus-prometheus 9090:9090 -n monitoring
# Open http://localhost:9090/targets — look for my-app
```

### Common Causes & Fixes

| Cause | Fix |
|-------|-----|
| Port name mismatch | Set `port: http` in ServiceMonitor, match Service port name |
| Wrong namespace label | Add `release: monitoring` label to ServiceMonitor |
| Metrics path wrong | Set `path: /metrics` in ServiceMonitor endpoints |
| Service selector mismatch | Ensure `app: my-app` label on both Service and pods |

### Fix — ServiceMonitor
```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-app
  labels:
    release: monitoring          # ← Must match Prometheus operator selector
spec:
  selector:
    matchLabels:
      app: my-app
  endpoints:
    - port: http                 # ← Must match Service port name
      path: /metrics
      interval: 15s
```

---

## 7. Network Policy Blocking Traffic

### Symptom
```bash
curl: (7) Failed to connect to my-app port 8000: Connection timed out
```

### Diagnosis
```bash
# Check active policies
kubectl get networkpolicy

# Describe policy rules
kubectl describe networkpolicy my-app-netpol

# Test from within cluster
kubectl run test-curl --rm -it --image=curlimages/curl -- curl http://my-app:8000/health
```

### Fix
Ensure source namespace has the correct label:
```bash
# Label the monitoring namespace
kubectl label namespace monitoring kubernetes.io/metadata.name=monitoring

# Label ingress namespace
kubectl label namespace ingress-nginx kubernetes.io/metadata.name=ingress-nginx
```

---

## 8. Trivy Failing in CI/CD

### Symptom
```
GitHub Actions: ❌ Security Scan failed
Total: 3 (CRITICAL: 1)
```

### Fix
```bash
# Identify vulnerable packages
docker run --rm aquasec/trivy image my-app:latest --severity CRITICAL

# Update base image
# In Dockerfile, change:
FROM python:3.8-slim    # ❌ Old, has CVEs
FROM python:3.11-slim   # ✅ Current, patched

# Rebuild and re-scan
docker build -t my-app:latest .
docker run --rm aquasec/trivy image my-app:latest --severity CRITICAL
# Expected: Total: 0
```

---

## 9. Dashboard Cannot Reach K8s API

### Symptom
Dashboard shows "Unable to connect to cluster" or CORS errors.

### Fix — In-cluster Service Account
```yaml
# dashboard-deployment.yaml
spec:
  template:
    spec:
      serviceAccountName: dashboard-sa
      automountServiceAccountToken: true
```

### Fix — CORS for External Access
```python
# If dashboard calls FastAPI backend which proxies K8s API:
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)
```

---

## 10. Graceful Shutdown Not Working

### Symptom
Requests fail with `502 Bad Gateway` during rolling updates.

### Diagnosis
```bash
kubectl logs -l app=my-app --previous --tail=20
# Look for: "SIGTERM received" message
```

### Fix — main.py
```python
import signal
import asyncio

shutdown_event = asyncio.Event()

def handle_sigterm(*args):
    logger.info("SIGTERM received, starting graceful shutdown")
    shutdown_event.set()

signal.signal(signal.SIGTERM, handle_sigterm)

@app.on_event("shutdown")
async def shutdown():
    logger.info("Draining connections...")
    await asyncio.sleep(5)  # Allow in-flight requests to complete
```

### Fix — deployment.yaml
```yaml
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 30
      containers:
        - name: my-app
          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 5"]
```

---

## 11. Self-Healing Not Triggering

### Symptom
Pod crashes but Kubernetes doesn't restart it.

### Diagnosis
```bash
kubectl describe pod <pod-name> | grep -A5 "Restart Count"
kubectl get events --field-selector involvedObject.name=<pod-name>
```

### Fix
Ensure liveness and readiness probes are configured:
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: http
  initialDelaySeconds: 10
  periodSeconds: 15
  failureThreshold: 3
readinessProbe:
  httpGet:
    path: /health
    port: http
  initialDelaySeconds: 5
  periodSeconds: 10
```

---

## 12. Grafana Dashboard Empty

### Symptom
Grafana loads but all panels show "No data".

### Fix Checklist
1. **Data source**: Ensure Prometheus data source URL is `http://monitoring-kube-prometheus-prometheus.monitoring:9090`
2. **ServiceMonitor**: Verify Prometheus is scraping (check Targets page)
3. **Time range**: Set to "Last 15 minutes" (data may not exist for longer ranges)
4. **Metrics exist**: Run `curl localhost:8000/metrics` to confirm app exposes metrics

```bash
# Quick fix: Generate traffic to populate metrics
for i in $(seq 1 100); do curl -sf http://localhost:8000/health; done

# Then check Grafana again
```

---

## Quick Reference — Error → Fix Map

| Error Message | Section | Quick Fix |
|---------------|---------|-----------|
| `connection refused :6443` | [#1](#1-connection-refused-on-port-6443) | `sudo systemctl restart k3s` |
| `permission denied k3s.yaml` | [#2](#2-permission-denied--kubeconfig) | `sudo chmod 644 /etc/rancher/k3s/k3s.yaml` |
| Image > 200 MB | [#3](#3-docker-image-too-large-237-mb) | Use multi-stage Dockerfile |
| `whoami` → `root` | [#4](#4-pod-running-as-root) | Add `USER 1000:1000` to Dockerfile |
| `Read-only file system` crash | [#5](#5-crashloopbackoff--read-only-fs) | Set `PYTHONDONTWRITEBYTECODE=1` |
| Grafana "No data" | [#6](#6-prometheus-not-scraping-metrics) | Fix ServiceMonitor port name |
| `Connection timed out` | [#7](#7-network-policy-blocking-traffic) | Label namespaces correctly |
| CI/CD Trivy fail | [#8](#8-trivy-failing-in-cicd) | Update base image to 3.11-slim |
| Dashboard "Unable to connect" | [#9](#9-dashboard-cannot-reach-k8s-api) | Configure ServiceAccount + RBAC |
| `502` during rollout | [#10](#10-graceful-shutdown-not-working) | Add preStop hook + SIGTERM handler |
| Pod not restarting | [#11](#11-self-healing-not-triggering) | Add liveness/readiness probes |
| Grafana panels empty | [#12](#12-grafana-dashboard-empty) | Check data source URL + generate traffic |


# Testing Guide — Hardened Microservice Ecosystem v3

## Prerequisites
```bash
curl -sfL https://get.k3s.io | sh -
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
sudo chmod 644 /etc/rancher/k3s/k3s.yaml
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install monitoring prometheus-community/kube-prometheus-stack -n monitoring --create-namespace
```

## Deploy
```bash
docker build -t my-app:latest .
docker build -t my-dashboard:latest ./dashboard
docker save my-app:latest | sudo k3s ctr images import -
docker save my-dashboard:latest | sudo k3s ctr images import -
helm upgrade --install my-app ./k8s/charts/my-app
```

## Test Matrix

### 1. Non-Root User
```bash
kubectl exec -it $(kubectl get pod -l app=my-app -o jsonpath='{.items[0].metadata.name}') -- whoami
# Expected: appuser
```

### 2. UID/GID Check
```bash
kubectl exec -it $(kubectl get pod -l app=my-app -o jsonpath='{.items[0].metadata.name}') -- id
# Expected: uid=1000(appuser) gid=1000(appgroup)
```

### 3. Read-Only Filesystem
```bash
kubectl exec -it $(kubectl get pod -l app=my-app -o jsonpath='{.items[0].metadata.name}') -- touch /app/test
# Expected: "Read-only file system" error
```

### 4. No Privilege Escalation
```bash
kubectl get deploy my-app -o jsonpath='{.spec.template.spec.containers[0].securityContext}'
# Expected: {"allowPrivilegeEscalation":false,"readOnlyRootFilesystem":true,...}
```

### 5. Self-Healing
```bash
kubectl delete pod -l app=my-app
kubectl get pods -w
# Expected: New pod in Running state within 15s
```

### 6. Zero-Downtime Rollout
```bash
# Terminal 1:
while true; do curl -sf http://localhost:8000/health && echo " OK" || echo " FAIL"; sleep 0.2; done
# Terminal 2:
kubectl rollout restart deployment/my-app
# Expected: Zero FAIL outputs
```

### 7. Graceful Shutdown
```bash
kubectl logs -l app=my-app --tail=20
# During rollout, expect: "SIGTERM received, starting graceful shutdown"
```

### 8. Structured JSON Logs
```bash
kubectl logs $(kubectl get pod -l app=my-app -o jsonpath='{.items[0].metadata.name}')
# Expected: {"timestamp":"...","level":"INFO","message":"..."}
```

### 9. Prometheus Metrics
```bash
kubectl port-forward svc/my-app 8000:8000 &
curl http://localhost:8000/metrics
# Expected: http_request_duration_seconds_*, http_requests_total, etc.
```

### 10. ServiceMonitor
```bash
kubectl get servicemonitor my-app -o yaml | grep "port: http"
# Expected: port name "http"
```

### 11. Network Policy
```bash
kubectl get networkpolicy my-app-netpol -o yaml
# Expected: Ingress restricted to monitoring and ingress-nginx namespaces
```

### 12. Alert Rules
```bash
kubectl get prometheusrule my-app-alerts -o yaml
# Expected: HighErrorRate, HighP95Latency, PodRestartLoop rules
```

### 13. ConfigMap
```bash
kubectl get configmap my-app-config -o yaml
# Expected: APP_VERSION, APP_ENV, LOG_LEVEL
```

### 14. Trivy CI/CD Gate
Edit Dockerfile: change `FROM python:3.11-slim` to `FROM python:3.8` and push.
Expected: Pipeline fails at Security Scan stage.

### 15. Dashboard — Identity Monitor
```bash
kubectl port-forward svc/my-app-dashboard 3000:80 &
# Open http://localhost:3000 → Identity card shows "UID 1000 — Non-Root ✓"
```

### 16. Dashboard — Filesystem Lock
Open dashboard → Filesystem card shows "Read-Only Filesystem: Enabled 🛡️"

### 17. Dashboard — Self-Healing Feed
```bash
kubectl delete pod -l app=my-app
# Dashboard self-healing log shows restart event
```

### 18. Dashboard Image Size
```bash
docker images my-dashboard --format "{{.Size}}"
# Expected: < 50 MB
```

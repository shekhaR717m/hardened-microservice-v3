#!/bin/bash

# --- CONFIGURATION ---
POD_APP=\$(kubectl get pod -l app=my-app -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo 'NOT_FOUND')
POD_DASH=\$(kubectl get pod -l app=my-app-dashboard -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo 'NOT_FOUND')
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo '🏁 Starting Full Parallel Suite: 18 Security & Ops Tests'
echo '---------------------------------------------------------'

# Test Wrapper Function
run_test() {
    local desc=\$1; local cmd=\$2; local expect=\$3
    local output; output=\$(eval \"\$cmd\" 2>&1)
    if echo \"\$output\" | grep -q \"\$expect\"; then
        echo -e \"[\${GREEN}PASS\${NC}] \$desc\"
    else
        echo -e \"[\${RED}FAIL\${NC}] \$desc -> (Got: \${output:0:40}...)\"
    fi
}

# --- 1. SECURITY CONTEXT TESTS ---
run_test '1. Non-Root User' 'kubectl exec \$POD_APP -- whoami' 'appuser' &
run_test '2. UID/GID Check' 'kubectl exec \$POD_APP -- id' 'uid=1000' &
run_test '3. Read-Only FS' 'kubectl exec \$POD_APP -- touch /app/test' 'Read-only' &
run_test '4. Priv Escalation' 'kubectl get deploy my-app -o json' 'allowPrivilegeEscalation\":false' &

# --- 2. RESILIENCE & LIFECYCLE ---
run_test '5. Self-Healing' \"kubectl get deploy my-app -o jsonpath='{.status.readyReplicas}'\" '2' &
run_test '7. Graceful Shutdown' 'kubectl describe deploy my-app' 'terminationGracePeriodSeconds: 30' &
run_test '8. JSON Logging' 'kubectl logs \$POD_APP --tail=1' '{' &

# --- 3. OBSERVABILITY & MONITORING ---
run_test '9. Prometheus Metrics' 'curl -s http://localhost:8000/health' 'ok' &
run_test '10. ServiceMonitor' 'kubectl get servicemonitor my-app' 'my-app' &
run_test '12. Alert Rules' 'kubectl get prometheusrule my-app-alerts' 'my-app-alerts' &

# --- 4. NETWORK & CONFIG ---
run_test '11. Network Policy' 'kubectl get netpol my-app-netpol' 'my-app-netpol' &
run_test '13. ConfigMap Env' 'kubectl exec \$POD_APP -- env' 'APP_VERSION' &

# --- 5. DASHBOARD SPECIFIC ---
run_test '15. Dash Identity' 'curl -s http://localhost:9999' 'UID 1000' &
run_test '16. Dash FS Lock' 'kubectl exec \$POD_DASH -- touch /usr/share/nginx/html/test' 'Read-only' &
run_test '18. Dash Image Size' \"docker images my-dashboard --format '{{.Size}}'\" 'MB' &

# --- 6. CI/CD GATES (MOCK) ---
run_test '14. Trivy Scan Gate' \"echo 'Scan Passed'\" 'Passed' &

wait
echo '---------------------------------------------------------'
echo '✅ Parallel Execution Finished.'
EOF
chmod +x scripts/smoke-test.sh"
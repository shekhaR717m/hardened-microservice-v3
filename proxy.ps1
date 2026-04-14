while($true) { 
    Write-Host "--- Starting Port-Forward to Dashboard ---" -ForegroundColor Cyan
    kubectl port-forward svc/my-app-dashboard 9999:80
    Write-Host "Connection lost. Pod likely restarted (Self-Healing). Reconnecting in 1s..." -ForegroundColor Yellow
    Start-Sleep -Seconds 1
}

while($true) { 
    kubectl port-forward svc/my-app-dashboard 9999:80
    Write-Host "Connection lost. Re-establishing tunnel..." -ForegroundColor Yellow
    Start-Sleep -Seconds 1
}
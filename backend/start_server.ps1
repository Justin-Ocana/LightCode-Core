# ============================================================================
# lightcode Backend Startup Script - Smart Mode Detection
# Automatically detects if Redis is available and configures accordingly
# ============================================================================

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "          lightcode BACKEND - SMART STARTUP                        " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Set Python path and Django settings
$env:PYTHONPATH = "$PSScriptRoot"
$env:DJANGO_SETTINGS_MODULE = "settings.development"

# Check virtual environment
if (-not $env:VIRTUAL_ENV) {
    Write-Host "WARNING: Virtual environment not detected" -ForegroundColor Yellow
    Write-Host "   Consider activating your venv first" -ForegroundColor Yellow
    Write-Host ""
}

# Change to backend directory
Set-Location $PSScriptRoot

# ============================================================================
# Pre-flight checks
# ============================================================================
Write-Host "Running pre-flight checks..." -ForegroundColor Cyan
Write-Host ""

# Check Redis
Write-Host "   [1/3] Checking Redis..." -ForegroundColor Gray
$redisAvailable = $false
try {
    $redisCmd = 'import redis; r = redis.Redis(host="localhost", port=6379); r.ping(); print("OK")'
    $redisCheck = python -c $redisCmd 2>&1
    if ($redisCheck -match "OK") {
        Write-Host "         Redis: AVAILABLE" -ForegroundColor Green
        $redisAvailable = $true
    } else {
        Write-Host "         Redis: NOT RUNNING" -ForegroundColor Yellow
    }
} catch {
    Write-Host "         Redis: NOT AVAILABLE" -ForegroundColor Yellow
}

# Check database
Write-Host "   [2/3] Checking Database..." -ForegroundColor Gray
$dbOk = $false
try {
    $dbCheck = python manage.py check --database default 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "         Database: CONNECTED" -ForegroundColor Green
        $dbOk = $true
    } else {
        Write-Host "         Database: ISSUES DETECTED" -ForegroundColor Red
        Write-Host ""
        Write-Host "ERROR: Database is not accessible!" -ForegroundColor Red
        Write-Host "Please check your database configuration and try again." -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "         Database: CANNOT CONNECT" -ForegroundColor Red
    Write-Host ""
    Write-Host "ERROR: Database connection failed!" -ForegroundColor Red
    exit 1
}

# Check Celery configuration
Write-Host "   [3/3] Checking Celery Mode..." -ForegroundColor Gray
$celeryCmd = 'from django.conf import settings; import django; django.setup(); print(settings.CELERY_TASK_ALWAYS_EAGER)'
$celeryMode = python -c $celeryCmd 2>&1

Write-Host ""
Write-Host "================================================================" -ForegroundColor Gray
Write-Host ""

# ============================================================================
# Determine startup mode
# ============================================================================
$useAsyncMode = $false
$needsRedis = $false

if ($redisAvailable) {
    Write-Host "STARTUP MODE: ASYNC (with Redis)" -ForegroundColor Green
    Write-Host "   Redis is available - using full async mode" -ForegroundColor Gray
    Write-Host "   Features: Automatic retries, Background tasks, Celery Beat" -ForegroundColor Gray
    $useAsyncMode = $true
    $needsRedis = $true
    
    # Update settings to use async mode
    Write-Host ""
    Write-Host "   Configuring async mode..." -ForegroundColor Gray
    $configCmd = @'
import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings.development')
django.setup()
from django.conf import settings
# Force async mode
settings.CELERY_TASK_ALWAYS_EAGER = False
print("Async mode enabled")
'@
    python -c $configCmd 2>&1 | Out-Null
    $env:CELERY_ASYNC_MODE = "True"
    
} else {
    Write-Host "STARTUP MODE: EAGER (without Redis)" -ForegroundColor Yellow
    Write-Host "   Redis not available - using synchronous mode" -ForegroundColor Gray
    Write-Host "   Features: Immediate execution, No automatic retries" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   To enable automatic retries:" -ForegroundColor Cyan
    Write-Host "   1. Install Redis: https://github.com/microsoftarchive/redis/releases" -ForegroundColor Cyan
    Write-Host "   2. Run: redis-server" -ForegroundColor Cyan
    Write-Host "   3. Restart this script" -ForegroundColor Cyan
    $useAsyncMode = $false
    $env:CELERY_ASYNC_MODE = "False"
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Gray
Write-Host ""

# ============================================================================
# Start services
# ============================================================================
Write-Host "Starting services..." -ForegroundColor Cyan
Write-Host ""

# Always start Daphne
Write-Host "   [1/3] Daphne ASGI Server" -ForegroundColor Magenta
Write-Host "         -> http://localhost:8000" -ForegroundColor Gray
Write-Host "         -> ws://localhost:8000/ws/notifications/" -ForegroundColor Gray

# Leer REDIS_URL del .env si existe
$redisUrl = ""
if (Test-Path "$PSScriptRoot\.env") {
    $envContent = Get-Content "$PSScriptRoot\.env" -Raw
    if ($envContent -match 'REDIS_URL=([^\r\n]+)') {
        $redisUrl = $matches[1].Trim()
        if ($redisUrl.StartsWith('#')) {
            $redisUrl = ""
        }
    }
}

$daphneJob = Start-Job -ScriptBlock {
    param($path, $asyncMode, $redisUrl)
    Set-Location $path
    $env:PYTHONPATH = $path
    $env:DJANGO_SETTINGS_MODULE = "settings.development"
    $env:CELERY_ASYNC_MODE = $asyncMode
    if ($redisUrl) {
        $env:REDIS_URL = $redisUrl
    }
    python -m daphne -b 0.0.0.0 -p 8000 asgi:application
} -ArgumentList $PSScriptRoot, $env:CELERY_ASYNC_MODE, $redisUrl

Start-Sleep -Seconds 2

# Start Celery Worker (only if Redis available)
$celeryWorkerJob = $null
$celeryBeatJob = $null

if ($useAsyncMode) {
    Write-Host "   [2/3] Celery Worker" -ForegroundColor Magenta
    Write-Host "         -> Processing async tasks & RCON jobs" -ForegroundColor Gray
    $celeryWorkerJob = Start-Job -ScriptBlock {
        param($path)
        Set-Location $path
        $env:PYTHONPATH = $path
        $env:DJANGO_SETTINGS_MODULE = "settings.development"
        python -m celery -A celery_app worker --loglevel=info --pool=solo
    } -ArgumentList $PSScriptRoot

    Start-Sleep -Seconds 2

    Write-Host "   [3/3] Celery Beat Scheduler" -ForegroundColor Magenta
    Write-Host "         -> Periodic tasks (RCON queue every 60s)" -ForegroundColor Gray
    $celeryBeatJob = Start-Job -ScriptBlock {
        param($path)
        Set-Location $path
        $env:PYTHONPATH = $path
        $env:DJANGO_SETTINGS_MODULE = "settings.development"
        python -m celery -A celery_app beat --loglevel=info
    } -ArgumentList $PSScriptRoot

    Start-Sleep -Seconds 2
} else {
    Write-Host "   [2/3] Celery Worker" -ForegroundColor DarkGray
    Write-Host "         -> SKIPPED (Redis not available)" -ForegroundColor DarkGray
    Write-Host "   [3/3] Celery Beat" -ForegroundColor DarkGray
    Write-Host "         -> SKIPPED (Redis not available)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Gray
Write-Host ""

# ============================================================================
# Service status
# ============================================================================
Write-Host "All services started!" -ForegroundColor Green
Write-Host ""
Write-Host "Service Status:" -ForegroundColor Cyan
Write-Host "   Daphne:        Job ID $($daphneJob.Id) - RUNNING" -ForegroundColor Gray

if ($useAsyncMode) {
    Write-Host "   Celery Worker: Job ID $($celeryWorkerJob.Id) - RUNNING" -ForegroundColor Gray
    Write-Host "   Celery Beat:   Job ID $($celeryBeatJob.Id) - RUNNING" -ForegroundColor Gray
} else {
    Write-Host "   Celery Worker: DISABLED (no Redis)" -ForegroundColor DarkGray
    Write-Host "   Celery Beat:   DISABLED (no Redis)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Gray
Write-Host ""
Write-Host "Monitoring logs (Ctrl+C to stop all services)..." -ForegroundColor Yellow
Write-Host ""

# ============================================================================
# Monitor services
# ============================================================================
try {
    while ($true) {
        # Check if Daphne is still running
        $daphneRunning = (Get-Job -Id $daphneJob.Id).State -eq 'Running'
        
        # Display logs from Daphne
        $daphneOutput = Receive-Job -Id $daphneJob.Id 2>&1
        
        if ($daphneOutput) {
            $daphneOutput | ForEach-Object {
                if ($_ -match "ERROR|error|Error") {
                    Write-Host "[DAPHNE] $_" -ForegroundColor Red
                } elseif ($_ -match "WARNING|warning|Warning") {
                    Write-Host "[DAPHNE] $_" -ForegroundColor Yellow
                } else {
                    Write-Host "[DAPHNE] $_" -ForegroundColor Blue
                }
            }
        }
        
        # Monitor Celery services if running
        if ($useAsyncMode) {
            $workerRunning = (Get-Job -Id $celeryWorkerJob.Id).State -eq 'Running'
            $beatRunning = (Get-Job -Id $celeryBeatJob.Id).State -eq 'Running'
            
            $workerOutput = Receive-Job -Id $celeryWorkerJob.Id 2>&1
            $beatOutput = Receive-Job -Id $celeryBeatJob.Id 2>&1
            
            if ($workerOutput) {
                $workerOutput | ForEach-Object {
                    if ($_ -match "ERROR|error|Error") {
                        Write-Host "[WORKER] $_" -ForegroundColor Red
                    } elseif ($_ -match "WARNING|warning|Warning") {
                        Write-Host "[WORKER] $_" -ForegroundColor Yellow
                    } elseif ($_ -match "SUCCESS|success|Success|Task.*succeeded") {
                        Write-Host "[WORKER] $_" -ForegroundColor Green
                    } else {
                        Write-Host "[WORKER] $_" -ForegroundColor Cyan
                    }
                }
            }
            
            if ($beatOutput) {
                $beatOutput | ForEach-Object {
                    if ($_ -match "Scheduler|Sending due task") {
                        Write-Host "[BEAT] $_" -ForegroundColor Magenta
                    } else {
                        Write-Host "[BEAT] $_" -ForegroundColor DarkMagenta
                    }
                }
            }
            
            # Check if any Celery job failed
            if (-not $workerRunning) {
                Write-Host ""
                Write-Host "Celery Worker stopped unexpectedly!" -ForegroundColor Red
                break
            }
            if (-not $beatRunning) {
                Write-Host ""
                Write-Host "Celery Beat stopped unexpectedly!" -ForegroundColor Red
                break
            }
        }
        
        # Check if Daphne failed
        if (-not $daphneRunning) {
            Write-Host ""
            Write-Host "Daphne stopped unexpectedly!" -ForegroundColor Red
            break
        }
        
        Start-Sleep -Milliseconds 500
    }
} finally {
    # Cleanup on exit
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Yellow
    Write-Host "Stopping all services..." -ForegroundColor Yellow
    Write-Host ""
    
    Stop-Job -Id $daphneJob.Id -ErrorAction SilentlyContinue
    Remove-Job -Id $daphneJob.Id -Force -ErrorAction SilentlyContinue
    Write-Host "   Daphne stopped" -ForegroundColor Gray
    
    if ($useAsyncMode) {
        Stop-Job -Id $celeryWorkerJob.Id -ErrorAction SilentlyContinue
        Remove-Job -Id $celeryWorkerJob.Id -Force -ErrorAction SilentlyContinue
        Write-Host "   Celery Worker stopped" -ForegroundColor Gray
        
        Stop-Job -Id $celeryBeatJob.Id -ErrorAction SilentlyContinue
        Remove-Job -Id $celeryBeatJob.Id -Force -ErrorAction SilentlyContinue
        Write-Host "   Celery Beat stopped" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "All services stopped successfully" -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Gray
}

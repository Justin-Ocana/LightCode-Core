# ============================================================================
# lightcode Backend Production Startup Script
# Optimized for production deployment with Redis and full async mode
# ============================================================================

param(
    [string]$Host = "0.0.0.0",
    [int]$Port = 8000,
    [int]$Workers = 4,
    [switch]$SkipChecks = $false
)

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "          lightcode BACKEND - PRODUCTION MODE                      " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Set Python path and Django settings for PRODUCTION
$env:PYTHONPATH = "$PSScriptRoot"
$env:DJANGO_SETTINGS_MODULE = "settings.production"

# Check virtual environment
if (-not $env:VIRTUAL_ENV) {
    Write-Host "WARNING: Virtual environment not detected" -ForegroundColor Yellow
    Write-Host "   It's recommended to use a virtual environment in production" -ForegroundColor Yellow
    Write-Host ""
}

# Change to backend directory
Set-Location $PSScriptRoot

# ============================================================================
# Pre-flight checks
# ============================================================================
if (-not $SkipChecks) {
    Write-Host "Running pre-flight checks..." -ForegroundColor Cyan
    Write-Host ""

    # Check Redis (REQUIRED in production)
    Write-Host "   [1/4] Checking Redis..." -ForegroundColor Gray
    $redisAvailable = $false
    try {
        $redisUrl = python -c "from decouple import config; print(config('REDIS_URL', default='redis://localhost:6379/0'))" 2>&1
        $redisCmd = "import redis; r = redis.from_url('$redisUrl'); r.ping(); print('OK')"
        $redisCheck = python -c $redisCmd 2>&1
        if ($redisCheck -match "OK") {
            Write-Host "         Redis: AVAILABLE" -ForegroundColor Green
            $redisAvailable = $true
        } else {
            Write-Host "         Redis: NOT RUNNING" -ForegroundColor Red
            Write-Host ""
            Write-Host "ERROR: Redis is REQUIRED for production!" -ForegroundColor Red
            Write-Host "Please start Redis and try again." -ForegroundColor Yellow
            exit 1
        }
    } catch {
        Write-Host "         Redis: NOT AVAILABLE" -ForegroundColor Red
        Write-Host ""
        Write-Host "ERROR: Redis connection failed!" -ForegroundColor Red
        Write-Host "Redis is required for production deployment." -ForegroundColor Yellow
        exit 1
    }

    # Check database
    Write-Host "   [2/4] Checking Database..." -ForegroundColor Gray
    try {
        $dbCheck = python manage.py check --database default 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "         Database: CONNECTED" -ForegroundColor Green
        } else {
            Write-Host "         Database: ISSUES DETECTED" -ForegroundColor Red
            Write-Host ""
            Write-Host "ERROR: Database is not accessible!" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "         Database: CANNOT CONNECT" -ForegroundColor Red
        Write-Host ""
        Write-Host "ERROR: Database connection failed!" -ForegroundColor Red
        exit 1
    }

    # Check migrations
    Write-Host "   [3/4] Checking Migrations..." -ForegroundColor Gray
    try {
        $migrationsCheck = python manage.py showmigrations --plan 2>&1 | Select-String "\[ \]"
        if ($migrationsCheck) {
            Write-Host "         Migrations: PENDING" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "WARNING: There are pending migrations!" -ForegroundColor Yellow
            Write-Host "Run: python manage.py migrate" -ForegroundColor Cyan
            Write-Host ""
            $response = Read-Host "Continue anyway? (y/N)"
            if ($response -ne "y" -and $response -ne "Y") {
                exit 1
            }
        } else {
            Write-Host "         Migrations: UP TO DATE" -ForegroundColor Green
        }
    } catch {
        Write-Host "         Migrations: CHECK FAILED" -ForegroundColor Yellow
    }

    # Check environment variables
    Write-Host "   [4/4] Checking Environment..." -ForegroundColor Gray
    $envVars = @('SECRET_KEY', 'DATABASE_URL', 'REDIS_URL', 'ALLOWED_HOSTS')
    $missingVars = @()
    
    foreach ($var in $envVars) {
        $value = python -c "from decouple import config; print(config('$var', default=''))" 2>&1
        if (-not $value -or $value -eq "") {
            $missingVars += $var
        }
    }
    
    if ($missingVars.Count -gt 0) {
        Write-Host "         Environment: INCOMPLETE" -ForegroundColor Red
        Write-Host ""
        Write-Host "ERROR: Missing required environment variables:" -ForegroundColor Red
        foreach ($var in $missingVars) {
            Write-Host "   - $var" -ForegroundColor Yellow
        }
        Write-Host ""
        Write-Host "Please configure these in your .env file" -ForegroundColor Yellow
        exit 1
    } else {
        Write-Host "         Environment: CONFIGURED" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Gray
    Write-Host ""
}

# ============================================================================
# Production Configuration
# ============================================================================
Write-Host "PRODUCTION MODE: ASYNC with Redis" -ForegroundColor Green
Write-Host "   Configuration:" -ForegroundColor Gray
Write-Host "   - Host: $Host" -ForegroundColor Gray
Write-Host "   - Port: $Port" -ForegroundColor Gray
Write-Host "   - Celery Workers: $Workers" -ForegroundColor Gray
Write-Host "   - Redis: Enabled" -ForegroundColor Gray
Write-Host "   - WebSockets: Enabled" -ForegroundColor Gray
Write-Host "   - Background Tasks: Enabled" -ForegroundColor Gray
Write-Host "   - Automatic Retries: Enabled" -ForegroundColor Gray
Write-Host ""

# Force async mode
$env:CELERY_TASK_ALWAYS_EAGER = "False"

Write-Host "================================================================" -ForegroundColor Gray
Write-Host ""

# ============================================================================
# Collect static files
# ============================================================================
Write-Host "Collecting static files..." -ForegroundColor Cyan
try {
    python manage.py collectstatic --noinput --clear 2>&1 | Out-Null
    Write-Host "   Static files collected successfully" -ForegroundColor Green
} catch {
    Write-Host "   WARNING: Failed to collect static files" -ForegroundColor Yellow
}
Write-Host ""

# ============================================================================
# Start services
# ============================================================================
Write-Host "Starting production services..." -ForegroundColor Cyan
Write-Host ""

# Start Daphne (ASGI Server)
Write-Host "   [1/3] Daphne ASGI Server" -ForegroundColor Magenta
Write-Host "         -> http://${Host}:${Port}" -ForegroundColor Gray
Write-Host "         -> ws://${Host}:${Port}/ws/notifications/" -ForegroundColor Gray
$daphneJob = Start-Job -ScriptBlock {
    param($path, $host, $port)
    Set-Location $path
    $env:PYTHONPATH = $path
    $env:DJANGO_SETTINGS_MODULE = "settings.production"
    $env:CELERY_TASK_ALWAYS_EAGER = "False"
    python -m daphne -b $host -p $port asgi:application
} -ArgumentList $PSScriptRoot, $Host, $Port

Start-Sleep -Seconds 3

# Start Celery Worker
Write-Host "   [2/3] Celery Worker ($Workers workers)" -ForegroundColor Magenta
Write-Host "         -> Processing async tasks & RCON jobs" -ForegroundColor Gray
$celeryWorkerJob = Start-Job -ScriptBlock {
    param($path, $workers)
    Set-Location $path
    $env:PYTHONPATH = $path
    $env:DJANGO_SETTINGS_MODULE = "settings.production"
    
    # Use prefork pool on Linux/Mac, solo on Windows
    if ($IsWindows) {
        python -m celery -A celery_app worker --loglevel=info --pool=solo --concurrency=$workers
    } else {
        python -m celery -A celery_app worker --loglevel=info --pool=prefork --concurrency=$workers
    }
} -ArgumentList $PSScriptRoot, $Workers

Start-Sleep -Seconds 3

# Start Celery Beat Scheduler
Write-Host "   [3/3] Celery Beat Scheduler" -ForegroundColor Magenta
Write-Host "         -> Periodic tasks (RCON queue, cleanup, etc.)" -ForegroundColor Gray
$celeryBeatJob = Start-Job -ScriptBlock {
    param($path)
    Set-Location $path
    $env:PYTHONPATH = $path
    $env:DJANGO_SETTINGS_MODULE = "settings.production"
    python -m celery -A celery_app beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler
} -ArgumentList $PSScriptRoot

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "================================================================" -ForegroundColor Gray
Write-Host ""

# ============================================================================
# Service status
# ============================================================================
Write-Host "All production services started!" -ForegroundColor Green
Write-Host ""
Write-Host "Service Status:" -ForegroundColor Cyan
Write-Host "   Daphne:        Job ID $($daphneJob.Id) - RUNNING" -ForegroundColor Gray
Write-Host "   Celery Worker: Job ID $($celeryWorkerJob.Id) - RUNNING" -ForegroundColor Gray
Write-Host "   Celery Beat:   Job ID $($celeryBeatJob.Id) - RUNNING" -ForegroundColor Gray
Write-Host ""
Write-Host "================================================================" -ForegroundColor Gray
Write-Host ""
Write-Host "Production server is running!" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop all services..." -ForegroundColor Yellow
Write-Host ""

# ============================================================================
# Monitor services
# ============================================================================
try {
    while ($true) {
        # Check service health
        $daphneRunning = (Get-Job -Id $daphneJob.Id).State -eq 'Running'
        $workerRunning = (Get-Job -Id $celeryWorkerJob.Id).State -eq 'Running'
        $beatRunning = (Get-Job -Id $celeryBeatJob.Id).State -eq 'Running'
        
        # Display logs
        $daphneOutput = Receive-Job -Id $daphneJob.Id 2>&1
        $workerOutput = Receive-Job -Id $celeryWorkerJob.Id 2>&1
        $beatOutput = Receive-Job -Id $celeryBeatJob.Id 2>&1
        
        if ($daphneOutput) {
            $daphneOutput | ForEach-Object {
                if ($_ -match "ERROR|error|Error|CRITICAL") {
                    Write-Host "[DAPHNE] $_" -ForegroundColor Red
                } elseif ($_ -match "WARNING|warning|Warning") {
                    Write-Host "[DAPHNE] $_" -ForegroundColor Yellow
                } else {
                    Write-Host "[DAPHNE] $_" -ForegroundColor Blue
                }
            }
        }
        
        if ($workerOutput) {
            $workerOutput | ForEach-Object {
                if ($_ -match "ERROR|error|Error|CRITICAL") {
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
        
        # Check for failures
        if (-not $daphneRunning) {
            Write-Host ""
            Write-Host "CRITICAL: Daphne stopped unexpectedly!" -ForegroundColor Red
            break
        }
        if (-not $workerRunning) {
            Write-Host ""
            Write-Host "CRITICAL: Celery Worker stopped unexpectedly!" -ForegroundColor Red
            break
        }
        if (-not $beatRunning) {
            Write-Host ""
            Write-Host "CRITICAL: Celery Beat stopped unexpectedly!" -ForegroundColor Red
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
    
    Stop-Job -Id $celeryWorkerJob.Id -ErrorAction SilentlyContinue
    Remove-Job -Id $celeryWorkerJob.Id -Force -ErrorAction SilentlyContinue
    Write-Host "   Celery Worker stopped" -ForegroundColor Gray
    
    Stop-Job -Id $celeryBeatJob.Id -ErrorAction SilentlyContinue
    Remove-Job -Id $celeryBeatJob.Id -Force -ErrorAction SilentlyContinue
    Write-Host "   Celery Beat stopped" -ForegroundColor Gray
    
    Write-Host ""
    Write-Host "All services stopped successfully" -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Gray
}

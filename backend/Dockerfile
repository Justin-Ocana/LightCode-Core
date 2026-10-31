# Multi-stage build for production
FROM python:3.11-slim AS base

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DJANGO_SETTINGS_MODULE=settings.production

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copy backend contents directly to /app
COPY . .

# Copy production data
COPY production_data.json .

# Create logs directory
RUN mkdir -p logs

# Collect static files (Usamos una clave dummy solo para el build para que no falle)
RUN SECRET_KEY=dummy_key_for_build_purposes python manage.py collectstatic --noinput || true

# Expose port
EXPOSE 10000

# Default command (Web Service - Daphne)
# Render usa la variable $PORT, pero por defecto es 10000
CMD python manage.py migrate && \
    python manage.py create_initial_data && \
    python quick_check.py && \
    daphne -b 0.0.0.0 -p ${PORT:-10000} asgi:application

# ── Stage 1: Builder ─────────────────────────────────────────────────
FROM python:3.11-slim AS builder
WORKDIR /build
COPY app/requirements.txt .
RUN pip install --no-cache-dir --target=/build/deps -r requirements.txt

# ── Stage 2: Runtime (Target < 100 MB) ──────────────────────────────
FROM python:3.11-slim AS runtime

# Triple-1000 user setup
RUN addgroup --gid 1000 appgroup && \
    adduser --uid 1000 --gid 1000 --disabled-password --gecos "" appuser

WORKDIR /app
COPY --from=builder /build/deps /usr/local/lib/python3.11/site-packages/
COPY app/ .

# Prevent __pycache__ writes on read-only FS
ENV PYTHONDONTWRITEBYTECODE=1

USER 1000:1000
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]

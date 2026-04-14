"""
Hardened FastAPI Microservice
- Structured JSON logging
- Graceful SIGTERM shutdown
- Health & Metrics endpoints
"""
import os
import signal
import asyncio
import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pythonjsonlogger import jsonlogger
from prometheus_fastapi_instrumentator import Instrumentator
# ── Structured JSON Logging ──────────────────────────────────────────
logger = logging.getLogger("app")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter(
    fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
    rename_fields={"asctime": "timestamp", "levelname": "level"},
)
handler.setFormatter(formatter)
logger.handlers = [handler]
# ── Graceful Shutdown ────────────────────────────────────────────────
shutdown_event = asyncio.Event()


def _handle_sigterm(*_):
    logger.info("SIGTERM received, starting graceful shutdown")
    shutdown_event.set()


signal.signal(signal.SIGTERM, _handle_sigterm)


@asynccontextmanager
async def lifespan(application: FastAPI):
    logger.info(
        "Application starting",
        extra={
            "version": os.getenv("APP_VERSION", "3.0.0"),
            "environment": os.getenv("APP_ENV", "production"),
        },
    )
    yield
    logger.info("Draining in-flight connections…")
    await asyncio.sleep(5)  # let K8s remove from service endpoints
    logger.info("Shutdown complete")
# ── FastAPI App ──────────────────────────────────────────────────────
app = FastAPI(
    title="Hardened Microservice",
    version="3.0.0",
    lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)
# Prometheus metrics instrumentation
Instrumentator().instrument(app).expose(app, endpoint="/metrics")
# ── Middleware: request logging ──────────────────────────────────────


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response: Response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "request",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": round(duration_ms, 2),
        },
    )
    return response
# ── Endpoints ────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "version": os.getenv("APP_VERSION", "3.0.0"),
        "environment": os.getenv("APP_ENV", "production"),
    }


@app.get("/")
async def root():
    return {"service": "hardened-microservice", "version": "3.0.0"}


@app.get("/security/identity")
async def identity():
    """Return process UID/GID for the Identity Monitor card."""
    return {
        "uid": os.getuid(),
        "gid": os.getgid(),
        "user": os.getenv(
            "USER",
            "unknown")}
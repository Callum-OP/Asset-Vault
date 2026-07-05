"""FastAPI application entrypoint for LocalAsset Vault."""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import assets, auth, categories, folders, health, tags
from app.core.config import get_settings
from app.services.storage import get_storage

settings = get_settings()

app = FastAPI(
    title="LocalAsset Vault API",
    description="Digital Asset Manager for 2D & 3D creative assets.",
    version="0.1.0",
)


@app.middleware("http")
async def limit_upload_size(request: Request, call_next):
    """Reject oversized request bodies up front via the Content-Length header.

    This spares the server from buffering a huge upload into memory before the
    route's own size check runs. The per-asset limit is the effective ceiling
    for any request body in this app.
    """
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            if int(content_length) > settings.max_upload_bytes:
                return JSONResponse(
                    status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                    content={
                        "detail": (
                            f"Request body exceeds maximum size of "
                            f"{settings.max_upload_bytes} bytes"
                        )
                    },
                )
        except ValueError:
            pass
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(assets.router)
app.include_router(categories.router)
app.include_router(folders.router)
app.include_router(tags.router)

# Serve uploaded files & generated thumbnails. Stored filenames are random
# UUIDs, so paths act as unguessable capability URLs for this local app.
app.mount("/storage", StaticFiles(directory=get_storage().base_dir), name="storage")


@app.get("/", tags=["root"])
def root() -> dict[str, str]:
    """Basic landing endpoint pointing to the docs."""
    return {"message": "LocalAsset Vault API. See /docs for Swagger UI."}

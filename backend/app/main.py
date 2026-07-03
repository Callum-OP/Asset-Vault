"""FastAPI application entrypoint for LocalAsset Vault."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import assets, auth, categories, health, tags
from app.core.config import get_settings
from app.services.storage import get_storage

settings = get_settings()

app = FastAPI(
    title="LocalAsset Vault API",
    description="Digital Asset Manager for 2D & 3D creative assets.",
    version="0.1.0",
)

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
app.include_router(tags.router)

# Serve uploaded files & generated thumbnails. Stored filenames are random
# UUIDs, so paths act as unguessable capability URLs for this local app.
app.mount("/storage", StaticFiles(directory=get_storage().base_dir), name="storage")


@app.get("/", tags=["root"])
def root() -> dict[str, str]:
    """Basic landing endpoint pointing to the docs."""
    return {"message": "LocalAsset Vault API. See /docs for Swagger UI."}

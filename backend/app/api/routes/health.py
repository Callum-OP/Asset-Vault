"""Health-check endpoint used to verify the service and database are reachable."""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check(db: Session = Depends(get_db)) -> dict[str, str]:
    """Return service status and database connectivity."""
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:  # noqa: BLE001 - report any DB failure as degraded
        db_status = "unavailable"

    return {
        "status": "ok",
        "service": "assetvault-backend",
        "database": db_status,
    }

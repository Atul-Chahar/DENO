"""Deno Founder GTM Workspace FastAPI Server."""

import uuid
import json
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.app.config import settings
from backend.app.models.schemas import (
    Project,
    ProjectStatus,
    IdeaIntakeRequest,
    StoryBankEntry,
    StoryBankCategory,
    Platform,
    BanRiskAudit,
)
from backend.app.db.storage import storage
from backend.app.agents.validation_pipeline import validation_pipeline
from backend.app.agents.content_pipeline import content_pipeline
from backend.app.engine.ban_risk import BanRiskEvaluator
from backend.app.engine.stylometry import StylometryEngine

app = FastAPI(
    title="Deno Founder GTM Workspace API",
    description="Multi-agent validation DAG, Ban Risk Score, and Voice-matched anti-slop distribution engine.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory progress tracking for live SSE stream
project_progress: Dict[str, Dict[str, Any]] = {}


class AuditRequest(BaseModel):
    text: str = Field(min_length=5)
    platform: Platform = Platform.REDDIT
    target_community: str = "r/SaaS"
    first_comment: Optional[str] = None


class VoiceProfileRequest(BaseModel):
    sample_text: str = Field(min_length=30)


@app.get("/health")
async def health_check() -> Dict[str, Any]:
    return {
        "status": "healthy",
        "service": "Deno GTM Backbone",
        "model": settings.nvidia_nim_model,
        "database": "sqlite (idempotent)",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/projects/intake", response_model=Project)
async def intake_idea(req: IdeaIntakeRequest) -> Project:
    """US-001: Accepts free text or URL, creates unique project in DRAFT status with zero friction."""
    project_id = f"proj-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()

    # Extract initial concise title
    preview_title = req.raw_idea.strip().split("\n")[0][:60]
    if len(preview_title) < 5:
        preview_title = "Untitled Startup Concept"

    project = Project(
        id=project_id,
        title=preview_title,
        raw_input=req.raw_idea,
        author_handle=req.author_handle,
        status=ProjectStatus.DRAFT,
        created_at=now,
        updated_at=now,
    )
    storage.create_project(project)
    project_progress[project_id] = {"message": "Project drafted", "percent": 0}
    return project


@app.get("/api/projects/{project_id}", response_model=Project)
async def get_project(project_id: str) -> Project:
    project = storage.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.post("/api/projects/{project_id}/validate", response_model=Project)
async def validate_project(project_id: str, background_tasks: BackgroundTasks) -> Project:
    """US-002, US-003, US-004, US-005: Runs multi-agent validation pipeline."""
    project = storage.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.status = ProjectStatus.VALIDATING
    storage.update_project(project)

    async def run_pipeline_task(p: Project):
        async def on_progress(msg: str, pct: int):
            project_progress[p.id] = {"message": msg, "percent": pct}

        try:
            pipeline = validation_pipeline
            pipeline.notify = on_progress
            report = await pipeline.run(p.raw_input)
            p.validation_report = report
            p.status = ProjectStatus.VALIDATED
            storage.update_project(p)
            project_progress[p.id] = {"message": "Validation complete", "percent": 100}
        except Exception as exc:
            p.status = ProjectStatus.VALIDATION_FAILED
            storage.update_project(p)
            project_progress[p.id] = {"message": f"Validation failed: {str(exc)}", "percent": -1}

    # Run directly or background
    await run_pipeline_task(project)
    return storage.get_project(project_id) or project


@app.get("/api/projects/{project_id}/stream")
async def stream_progress(project_id: str):
    """Server-Sent Events (SSE) streaming live agent reasoning progression to founder client."""
    async def event_generator():
        last_pct = -99
        while True:
            info = project_progress.get(project_id, {"message": "Initializing...", "percent": 0})
            if info["percent"] != last_pct:
                last_pct = info["percent"]
                yield f"data: {json.dumps(info)}\n\n"
            if info["percent"] in (100, -1):
                break
            await asyncio.sleep(0.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/api/projects/{project_id}/story-bank")
async def add_story_bank_entry(project_id: str, entry: StoryBankEntry):
    """US-006: Populates Founder Story Bank with scars, turning points, and concrete receipts."""
    project = storage.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    storage.save_story_bank_entry(project_id, entry)
    return {"status": "saved", "entry_id": entry.id}


@app.post("/api/projects/{project_id}/voice-fingerprint")
async def compute_voice_profile(project_id: str, req: VoiceProfileRequest):
    """US-006 & US-008: Extracts 50-dimensional stylometric fingerprint from founder writing sample."""
    project = storage.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    fp = StylometryEngine.extract_fingerprint(req.sample_text)
    project.voice_fingerprint = fp
    project.status = ProjectStatus.VOICE_READY
    storage.update_project(project)
    return {"status": "updated", "fingerprint": fp}


@app.post("/api/projects/{project_id}/calendar")
async def generate_calendar(project_id: str, days: int = 7):
    """US-007, US-008, US-009: Generates multi-platform 30-day calendar with Ban Risk scoring."""
    project = storage.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    assets = await content_pipeline.generate_calendar(project, days=days)
    for a in assets:
        storage.save_content_asset(a)

    project.content_calendar = assets
    project.status = ProjectStatus.CONTENT_READY
    storage.update_project(project)
    return {"status": "generated", "total_assets": len(assets), "calendar": assets}


@app.post("/api/audit/ban-risk", response_model=BanRiskAudit)
async def audit_text(req: AuditRequest) -> BanRiskAudit:
    """US-009 & US-013: Standalone Ban Risk and Anti-Slop Evaluator."""
    return BanRiskEvaluator.evaluate(
        text=req.text,
        platform=req.platform,
        target_community=req.target_community,
        first_comment=req.first_comment or ""
    )

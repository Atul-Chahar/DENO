"""Integration Test for Live Validation Pipeline with NVIDIA NIM."""

import pytest
import asyncio
from backend.app.agents.validation_pipeline import validation_pipeline
from backend.app.models.schemas import Verdict


@pytest.mark.asyncio
async def test_validation_pipeline_execution():
    raw_idea = "A B2B developer tool that automatically detects AI slop and ban-risk in social posts before founders publish."
    
    progress_updates = []
    async def track_progress(msg: str, pct: int):
        progress_updates.append((msg, pct))

    pipeline = validation_pipeline
    pipeline.notify = track_progress

    report = await pipeline.run(raw_idea)

    assert report.verdict in (Verdict.BUILD, Verdict.PIVOT, Verdict.KILL)
    assert 0.0 <= report.confidence_score <= 1.0
    assert len(report.top_reasons) == 3
    assert report.tam_sam_som.tam_usd > 0
    assert len(report.target_communities) >= 5
    assert len(report.source_ledger) >= 1
    assert len(progress_updates) >= 3

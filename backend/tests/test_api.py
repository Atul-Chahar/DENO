"""Integration Tests for FastAPI Endpoints and Persistence."""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.models.schemas import Platform

client = TestClient(app)


def test_health_check_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "model" in data


def test_project_intake_creates_draft():
    payload = {
        "raw_idea": "A CRM for solo indie creators to track early beta testers without monthly subscription bloat.",
        "author_handle": "indie_builder"
    }
    response = client.post("/api/projects/intake", json=payload)
    assert response.status_code == 200
    project = response.json()
    assert project["id"].startswith("proj-")
    assert project["status"] == "DRAFT"
    assert project["author_handle"] == "indie_builder"

    # Verify retrieval
    get_res = client.get(f"/api/projects/{project['id']}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == project["id"]


def test_audit_ban_risk_endpoint():
    payload = {
        "text": "It's not about the model. It's about distribution. The key: an adversarial agent.",
        "platform": "REDDIT",
        "target_community": "r/SaaS"
    }
    response = client.post("/api/audit/ban-risk", json=payload)
    assert response.status_code == 200
    audit = response.json()
    assert "ban_risk_score" in audit
    assert len(audit["deductions"]) >= 2
    # Verify Peter Yang's Binary Contrast and Colon Reveal are caught
    pattern_names = [d["pattern_name"] for d in audit["deductions"]]
    assert "Binary Contrast" in pattern_names
    assert "Colon Dramatic Reveal" in pattern_names

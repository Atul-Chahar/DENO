"""Unit Tests for 2026 AI Vocabulary and Grammar Tell Scorer."""

import pytest
from backend.app.engine.density_scorer import DensityScorer


def test_flags_high_density_vocabulary():
    slop_paragraph = (
        "In this dynamic landscape, it is crucial to foster a robust ecosystem. "
        "We must streamline and leverage actionable insights to elevate our products."
    )
    deductions = DensityScorer.audit(slop_paragraph)
    assert any("High AI Vocabulary Density" in d.pattern_name for d in deductions)
    assert any(d.point_deduction == 15 for d in deductions)


def test_permits_low_density_vocabulary():
    clean_paragraph = (
        "We reviewed the user feedback yesterday. "
        "It provided a crucial lesson about why onboarding failed."
    )
    deductions = DensityScorer.audit(clean_paragraph)
    # 1 marker is acceptable human baseline usage
    assert not any("High AI Vocabulary Density" in d.pattern_name for d in deductions)


def test_flags_sentence_opening_participles():
    text = (
        "Building software requires persistence.\n"
        "Shipping features is only the first step.\n"
        "Testing code carefully prevents outages in production."
    )
    deductions = DensityScorer.audit(text)
    assert any("Sentence-Opening Participle Tells" in d.pattern_name for d in deductions)

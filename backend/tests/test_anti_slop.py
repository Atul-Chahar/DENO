"""Unit Tests for Peter Yang's 18 Anti-Slop Structural Detection Rules."""

import pytest
from backend.app.engine.anti_slop import AntiSlopDetector


def test_detects_binary_contrast():
    sample = "It's not about the model. It's about the evaluation."
    deductions = AntiSlopDetector.audit(sample)
    pattern_names = [d.pattern_name for d in deductions]
    assert "Binary Contrast" in pattern_names
    assert any(d.point_deduction == 10 for d in deductions)


def test_detects_throat_clearing():
    sample = "Here's the thing you need to realize about organic growth."
    deductions = AntiSlopDetector.audit(sample)
    pattern_names = [d.pattern_name for d in deductions]
    assert "Throat-Clearing Opener" in pattern_names


def test_detects_faux_insight():
    sample = "What nobody tells you about launching on Reddit is the mods will ban you."
    deductions = AntiSlopDetector.audit(sample)
    pattern_names = [d.pattern_name for d in deductions]
    assert "Faux-Insight Setup" in pattern_names


def test_detects_colon_reveal():
    sample = "The key: an adversarial critic that attacks every claim."
    deductions = AntiSlopDetector.audit(sample)
    pattern_names = [d.pattern_name for d in deductions]
    assert "Colon Dramatic Reveal" in pattern_names


def test_detects_superficial_trailing_analysis():
    sample = "The founder shipped daily, highlighting their commitment to momentum."
    deductions = AntiSlopDetector.audit(sample)
    pattern_names = [d.pattern_name for d in deductions]
    assert "Superficial Trailing Analysis" in pattern_names


def test_detects_importance_puffery():
    sample = "This launch stands as a testament to open source software."
    deductions = AntiSlopDetector.audit(sample)
    pattern_names = [d.pattern_name for d in deductions]
    assert "Importance Puffery" in pattern_names


def test_detects_dramatic_fragmentation():
    sample = "Write code. Ship fast. Code. Ship. Repeat. That's it. That's the secret."
    deductions = AntiSlopDetector.audit(sample)
    pattern_names = [d.pattern_name for d in deductions]
    assert "Dramatic Staccato Fragmentation" in pattern_names


def test_detects_formatting_slop_emojis():
    sample = "🚀 Launching our new product today\nWe spent 3 months building it."
    deductions = AntiSlopDetector.audit(sample)
    pattern_names = [d.pattern_name for d in deductions]
    assert "Formatting Slop: Emoji Headers" in pattern_names


def test_clean_human_text_has_no_slop():
    clean_sample = (
        "We tested 3 cold outreach channels over 14 days. "
        "Reddit gave us 42 signups, X gave us 3, and LinkedIn gave us 18. "
        "Our cost per acquisition was $0 because we spent time answering technical questions."
    )
    deductions = AntiSlopDetector.audit(clean_sample)
    assert len(deductions) == 0

"""Unit Tests for Computational Stylometry and Burrows' Delta."""

import pytest
from backend.app.engine.stylometry import StylometryEngine


def test_extract_fingerprint_metrics():
    text = (
        "We built a prototype in two days. The result was surprising. "
        "Did users like it? Yes, but they complained about the speed!"
    )
    fp = StylometryEngine.extract_fingerprint(text)
    assert fp.mean_sentence_length > 0
    assert fp.type_token_ratio > 0
    assert "the" in fp.function_word_distribution
    assert fp.punctuation_profile["question"] > 0
    assert fp.punctuation_profile["exclamation"] > 0


def test_burrows_delta_identical_text_is_zero():
    text = "We tested three different ideas. Each was tested with ten real customers."
    fp1 = StylometryEngine.extract_fingerprint(text)
    fp2 = StylometryEngine.extract_fingerprint(text)
    delta = StylometryEngine.compute_burrows_delta(fp1, fp2)
    assert delta == 0.0


def test_burrows_delta_different_voice_is_positive():
    founder_voice = "I hate buzzwords. We build fast, break things, and talk to users directly."
    academic_voice = (
        "The empirical investigation systematically elucidates the multifaceted characteristics "
        "and pedagogical ramifications of the aforementioned methodology."
    )
    fp1 = StylometryEngine.extract_fingerprint(founder_voice)
    fp2 = StylometryEngine.extract_fingerprint(academic_voice)
    delta = StylometryEngine.compute_burrows_delta(fp1, fp2)
    assert delta > 0.5

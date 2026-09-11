"""Unit Tests for Unified Ban Risk Evaluator."""

import pytest
from backend.app.models.schemas import Platform
from backend.app.engine.ban_risk import BanRiskEvaluator


def test_clean_post_scores_high_ban_risk_safety():
    post = (
        "We spent the last 4 weeks interviewing 35 early-stage founders. "
        "Here are the 3 most common reasons their cold outreach failed:\n\n"
        "1. Mentioning pricing in the first direct message.\n"
        "2. Using generic templates that readers easily spot.\n"
        "3. Posting links without giving any initial upfront value.\n\n"
        "What has your experience been with acquiring your first 10 customers?"
    )
    audit = BanRiskEvaluator.evaluate(post, platform=Platform.REDDIT, target_community="r/SaaS")
    assert audit.ban_risk_score >= 80
    assert audit.is_safe_to_publish is True
    assert len(audit.hard_block_reasons) == 0


def test_reddit_post_with_outbound_link_is_penalized():
    post = "Check out our new tool at https://mycoolstartup.com and sign up today!"
    audit = BanRiskEvaluator.evaluate(post, platform=Platform.REDDIT, target_community="r/SaaS")
    assert audit.ban_risk_score < 70
    assert any("Reddit Outbound Link" in d.pattern_name for d in audit.deductions)
    assert any(d.suggested_fix != "" for d in audit.deductions)


def test_hard_block_on_r_startups_outbound_links():
    post = "Hey everyone, check out https://mytool.com/signup"
    audit = BanRiskEvaluator.evaluate(post, platform=Platform.REDDIT, target_community="r/startups")
    assert len(audit.hard_block_reasons) > 0
    assert audit.is_safe_to_publish is False

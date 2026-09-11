"""Unified Ban Risk Score (0-100) Evaluator and Compliance Engine."""

import re
from typing import List, Tuple
from backend.app.models.schemas import (
    Platform,
    BanRiskAudit,
    BanRiskDeduction,
)
from backend.app.engine.anti_slop import AntiSlopDetector
from backend.app.engine.density_scorer import DensityScorer


class BanRiskEvaluator:
    """Computes comprehensive Ban Risk Score (0-100) with itemized deductions and fixes."""

    @classmethod
    def evaluate(
        cls,
        text: str,
        platform: Platform,
        target_community: str = "",
        first_comment: str = ""
    ) -> BanRiskAudit:
        score = 100
        deductions: List[BanRiskDeduction] = []
        hard_blocks: List[str] = []

        # 1. Structural Anti-Slop Check (Peter Yang 18 patterns)
        slop_deductions = AntiSlopDetector.audit(text)
        deductions.extend(slop_deductions)

        # 2. 2026 Density & Grammar Tell Check (Serge Bulaev heuristics)
        density_deductions = DensityScorer.audit(text)
        deductions.extend(density_deductions)

        # 3. Platform-Specific Compliance Rules
        links_in_body = re.findall(r"https?://[^\s)]+", text)

        if platform == Platform.REDDIT:
            # Hard Reddit Rule: Direct outbound affiliate/promo links in post body
            if links_in_body:
                deductions.append(
                    BanRiskDeduction(
                        pattern_name="Reddit Outbound Link in Post Body",
                        severity="HIGH",
                        point_deduction=25,
                        offending_quote=links_in_body[0],
                        suggested_fix="Remove raw URL from post body. Direct traffic via brand mention or provide link only in replies."
                    )
                )

            # Check self-promo keyword density
            promo_words = len(re.findall(r"\b(?:buy|pricing|discount|sale|sign up|subscribe|demo)\b", text.lower()))
            total_words = max(len(re.findall(r"\b\w+\b", text)), 1)
            promo_ratio = promo_words / total_words
            if promo_ratio > 0.05:
                deductions.append(
                    BanRiskDeduction(
                        pattern_name="Reddit 9:1 Self-Promotion Violation",
                        severity="HIGH",
                        point_deduction=20,
                        offending_quote=f"Promotional word density is {promo_ratio * 100:.1f}% (exceeds allowed limit)",
                        suggested_fix="Frame as a build-in-public lesson, teardown, or resource guide rather than a direct promotion."
                    )
                )

        elif platform == Platform.LINKEDIN:
            # LinkedIn Algorithm Penalty: Outbound links in main post body reduce reach by 40-60%
            if links_in_body:
                deductions.append(
                    BanRiskDeduction(
                        pattern_name="LinkedIn Algorithm Reach Penalty (Link in Post)",
                        severity="HIGH",
                        point_deduction=20,
                        offending_quote=links_in_body[0],
                        suggested_fix="Move link to 'first_comment'. Keep main post 100% native value."
                    )
                )

            # Length sweet spot: 900 - 1,300 characters
            char_count = len(text)
            if char_count < 400:
                deductions.append(
                    BanRiskDeduction(
                        pattern_name="LinkedIn Length Sub-Optimal (Too Short)",
                        severity="LOW",
                        point_deduction=5,
                        offending_quote=f"Length is {char_count} chars (sweet spot is 900-1300 chars)",
                        suggested_fix="Expand with a concrete turning point or operational breakdown from your Story Bank."
                    )
                )
            elif char_count > 2200:
                deductions.append(
                    BanRiskDeduction(
                        pattern_name="LinkedIn Length Excessive",
                        severity="LOW",
                        point_deduction=5,
                        offending_quote=f"Length is {char_count} chars (risks scroll fatigue)",
                        suggested_fix="Trim secondary points; keep post focused on a single thesis."
                    )
                )

        # 4. Compute Final Deductions
        total_penalties = sum(d.point_deduction for d in deductions)
        final_score = max(0, min(100, score - total_penalties))

        # Check for hard blocks
        if "r/startups" in target_community and links_in_body:
            hard_blocks.append("r/startups imposes an instant permanent ban for outbound links in top-level posts.")

        # AI Detection Probability Estimate (calibrated from slop tell density)
        ai_prob = min(1.0, round(total_penalties / 60.0, 2))

        return BanRiskAudit(
            ban_risk_score=final_score,
            is_safe_to_publish=(final_score >= 70 and len(hard_blocks) == 0),
            ai_detection_probability=ai_prob,
            deductions=deductions,
            hard_block_reasons=hard_blocks,
        )

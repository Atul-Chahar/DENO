"""2026 AI Vocabulary and Grammar Tell Density Scoring Engine."""

import re
from typing import List, Tuple
from backend.app.models.schemas import BanRiskDeduction


class DensityScorer:
    """Evaluates paragraph-level AI vocabulary density and grammatical tell distributions."""

    # 2026 durable AI vocabulary markers
    AI_MARKERS = {
        "significant", "crucial", "notably", "comprehensive", "insights",
        "robust", "leverage", "foster", "landscape", "nuanced",
        "multifaceted", "holistic", "streamline", "elevate", "empower",
        "delve", "tapestry", "realm", "beacon", "catalyst"
    }

    @classmethod
    def audit(cls, text: str) -> List[BanRiskDeduction]:
        deductions: List[BanRiskDeduction] = []

        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        total_words = len(re.findall(r"\b\w+\b", text))

        # 1. Paragraph-Level Marker Density Check
        for idx, para in enumerate(paragraphs):
            words = set(re.findall(r"\b[a-z]+\b", para.lower()))
            matches = words.intersection(cls.AI_MARKERS)
            count = len(matches)

            if count >= 3:
                deductions.append(
                    BanRiskDeduction(
                        pattern_name="High AI Vocabulary Density (2026 Marker)",
                        severity="HIGH",
                        point_deduction=15,
                        offending_quote=f"Paragraph {idx + 1} contains {count} synthetic vocabulary markers: {', '.join(matches)}",
                        suggested_fix="Rewrite paragraph using plain everyday terms instead of corporate AI buzzwords."
                    )
                )
            elif count == 2:
                deductions.append(
                    BanRiskDeduction(
                        pattern_name="Elevated AI Vocabulary Density",
                        severity="MEDIUM",
                        point_deduction=6,
                        offending_quote=f"Paragraph {idx + 1} has 2 AI markers: {', '.join(matches)}",
                        suggested_fix="Substitute at least one marker with a simpler synonym."
                    )
                )

        # 2. Sentence-Opening "-ing" Clause Check
        ing_openers = re.findall(r"(?m)^\s*[A-Z][a-z]+ing\b", text)
        if len(ing_openers) >= 3:
            deductions.append(
                BanRiskDeduction(
                    pattern_name="Sentence-Opening Participle Tells",
                    severity="MEDIUM",
                    point_deduction=8,
                    offending_quote=f"Found {len(ing_openers)} sentences opening with '-ing' verbs: {', '.join(ing_openers[:3])}",
                    suggested_fix="Convert participial openers into active subject-verb clauses."
                )
            )

        # 3. Em Dash Density Check
        em_dash_count = len(re.findall(r"(?:—|--)", text))
        if total_words > 0:
            em_dash_ratio = (em_dash_count / total_words) * 100
            if em_dash_ratio > 1.2:
                deductions.append(
                    BanRiskDeduction(
                        pattern_name="Excessive Em Dash Density",
                        severity="LOW",
                        point_deduction=5,
                        offending_quote=f"{em_dash_count} em dashes in {total_words} words ({em_dash_ratio:.1f} per 100 words)",
                        suggested_fix="Cap em dashes to max 1 per 100 words; replace extra dashes with commas or colons."
                    )
                )

        return deductions

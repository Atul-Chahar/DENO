"""Anti-Slop Pattern Detection Engine based on Peter Yang's 18 Structural Patterns."""

import re
from typing import List, Dict, Any
from backend.app.models.schemas import BanRiskDeduction


class AntiSlopDetector:
    """Detects 18 structural AI writing tells with exact match locations and suggested fixes."""

    PATTERNS: List[Dict[str, Any]] = [
        {
            "name": "Binary Contrast",
            "regex": r"(?i)\b(?:it(?:'s| is)|the (?:question|point|challenge) (?:isn(?:'t| not)|is not))\s+([^.]+?)\.\s*(?:it(?:'s| is)|the (?:question|point) is)\s+([^.]+)",
            "penalty": 10,
            "fix": "State the direct thesis directly without the theatrical negation framing."
        },
        {
            "name": "Throat-Clearing Opener",
            "regex": r"(?i)^(?:here(?:'s| is) the thing|here(?:'s| is) what I mean|let me be (?:honest|clear)|the uncomfortable truth is|truth be told)\b",
            "penalty": 6,
            "fix": "Cut the conversational setup and lead directly with the core fact or observation."
        },
        {
            "name": "Faux-Insight Setup",
            "regex": r"(?i)\b(?:what (?:nobody|most people) (?:tells you|gets wrong)|the part (?:everyone|most people) (?:misses|skips))\b",
            "penalty": 10,
            "fix": "Eliminate the self-flattering pedestal; let your insight stand on its factual merits."
        },
        {
            "name": "Colon Dramatic Reveal",
            "regex": r"(?i)(?:the (?:detail|secret|key|catch|best part|kicker)):\s*([a-z][^.]+)",
            "penalty": 8,
            "fix": "Convert into a natural declarative sentence instead of using a colon for fake drama."
        },
        {
            "name": "Superficial Trailing Analysis",
            "regex": r"(?i),\s*(?:highlighting|underscoring|reflecting|showcasing|demonstrating)\s+(?:the|their|its)\s+([^.,]+)",
            "penalty": 7,
            "fix": "Replace the trailing participle clause with a concrete cause and verified outcome."
        },
        {
            "name": "Importance Puffery",
            "regex": r"(?i)\b(?:stands as a testament|marks a pivotal moment|plays a vital role|solidifies its position|underscores its significance)\b",
            "penalty": 12,
            "fix": "State the plain historical fact and let the reader determine its importance."
        },
        {
            "name": "Interpretive Metadiscourse",
            "regex": r"(?i)\b(?:that (?:last part|detail) matters more than it sounds|as you can see|the key point here is|in other words|this distinction matters)\b",
            "penalty": 5,
            "fix": "Delete authorial coaching; let the facts carry the intended weight."
        },
        {
            "name": "Weasel Attribution",
            "regex": r"(?i)\b(?:experts agree|industry reports suggest|many argue|widely regarded as|studies show)\b",
            "penalty": 10,
            "fix": "Cite the exact study, researcher, or institution, or omit the claim."
        },
        {
            "name": "Fake-Strong Verb Construction",
            "regex": r"(?i)\b(?:serves as (?:a|an)|has the ability to|is designed to function as)\b",
            "penalty": 5,
            "fix": "Use direct, punchy verbs (e.g. 'can', 'is', 'does', 'tracks')."
        },
        {
            "name": "Negative Listing",
            "regex": r"(?i)\b(?:not (?:a|an)\s+[^.,]+,\s*not (?:a|an)\s+[^.,]+,\s*(?:but|a)\s+[^.,]+)\b",
            "penalty": 8,
            "fix": "State what the product is directly without the repetitive triple negation."
        },
        {
            "name": "Dramatic Staccato Fragmentation",
            "regex": r"(?i)\b(?:that(?:'s| is) it\. that(?:'s| is) the whole (?:thing|secret|story)|short\. punchy\. done|code\. ship\. repeat)\b",
            "penalty": 12,
            "fix": "Restore natural sentence flow; avoid LinkedIn-influencer fragmentation."
        },
        {
            "name": "Rhetorical Question Theatrics",
            "regex": r"(?i)\b(?:what if I told you|think about it:|plot twist:)\b",
            "penalty": 8,
            "fix": "Remove theatrical staging; explain the concept straightforwardly."
        },
        {
            "name": "Fake-Profound Kicker",
            "regex": r"(?i)(?:at the end of the day|products don't ship themselves|the future belongs to those who)\.\s*$",
            "penalty": 8,
            "fix": "End on a concrete operational takeaway or next step rather than an aphorism."
        },
        {
            "name": "Summary-Recap Ending",
            "regex": r"(?i)\b(?:in conclusion|ultimately, the key takeaway is|to wrap things up|in summary)\b",
            "penalty": 6,
            "fix": "Cut the summary paragraph; finish on your final concrete point."
        },
        {
            "name": "Formatting Slop: Emoji Headers",
            "regex": r"(?m)^[\s]*[🚀🔥💡✨🎯📌⚡👉✅]\s*[A-Z]",
            "penalty": 10,
            "fix": "Remove decorative emojis from headers; platforms like Reddit immediately flag this as AI."
        },
        {
            "name": "Excessive Em Dash Clumping",
            "regex": r"(?:—|--).*?(?:—|--).*?(?:—|--)",
            "penalty": 8,
            "fix": "Cap em-dash usage to at most 1 per 100 words; replace excess with commas or parentheses."
        }
    ]

    @classmethod
    def audit(cls, text: str) -> List[BanRiskDeduction]:
        """Scans the text for all structural slop patterns and generates itemized deductions."""
        deductions: List[BanRiskDeduction] = []

        for rule in cls.PATTERNS:
            matches = list(re.finditer(rule["regex"], text))
            if matches:
                # Deduct per unique pattern found
                first_match = matches[0].group(0).strip()
                deductions.append(
                    BanRiskDeduction(
                        pattern_name=rule["name"],
                        severity="HIGH" if rule["penalty"] >= 10 else "MEDIUM",
                        point_deduction=rule["penalty"],
                        offending_quote=first_match[:120],
                        suggested_fix=rule["fix"],
                    )
                )

        return deductions

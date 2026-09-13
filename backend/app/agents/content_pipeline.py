"""Content Engine: 30-Day Calendar Planner, Hook Selection, and Anti-Slop Refinement."""

import uuid
from datetime import datetime, timezone
from typing import List, Optional
from backend.app.models.schemas import (
    Platform,
    PostArchetype,
    AssetStatus,
    ContentAsset,
    StoryBankEntry,
    StylometricFingerprint,
    Project,
)
from backend.app.engine.ban_risk import BanRiskEvaluator
from backend.app.engine.stylometry import StylometryEngine
from backend.app.agents.llm_client import llm_client

HOOK_FORMULAS = [
    "Anaphora: Repetitive structural cadence emphasizing an undeniable trend",
    "Year-over-Year Pivot: 'In 2024 we X. In 2026 X died. Here is what we changed:'",
    "Curiosity Gap with Receipt: 'We spent $1,400 testing 5 distribution channels. 4 returned zero.'",
    "Controlled A/B Teardown: 'Side-by-side breakdown of the highest converting post vs the one that got banned.'",
    "Emotional Cold-Open: 'The exact email that made us cancel our paid ads and go 100% organic.'",
    "Resource Dump with Mechanism: 'The 7 community rules every technical founder overlooks before posting.'",
    "Genuine Question with Vulnerability: 'What was your biggest surprise when acquiring your first 10 paying customers?'"
]


class ContentPipeline:
    """Generates 30-day calendar posts conditioned on Story Bank and refined against slop."""

    @classmethod
    async def generate_calendar(
        cls, project: Project, days: int = 7
    ) -> List[ContentAsset]:
        """Generates multi-platform posts for the calendar with anti-slop refinement."""
        assets: List[ContentAsset] = []

        story_receipts = [
            f"{entry.category.value}: {entry.headline} ({', '.join(entry.concrete_numbers)})"
            for entry in project.story_bank
        ]
        story_context = "\n".join(story_receipts) if story_receipts else "Bootstrapped builder with 0 marketing budget and 42 days to launch."

        # Target plan across platforms
        schedule = [
            (1, Platform.REDDIT, "r/SideProject", PostArchetype.BUILD_IN_PUBLIC, "Building Deno in public: why we abandoned ChatGPT for marketing"),
            (2, Platform.LINKEDIN, "B2B Founders & SaaS Leaders", PostArchetype.TEARDOWN, "Why generic AI content triggers a 40% distribution penalty in 2026"),
            (3, Platform.TWITTER, "#buildinpublic", PostArchetype.RESOURCE_DUMP, "7 exact subreddits every bootstrapped founder should bookmark"),
            (4, Platform.REDDIT, "r/SaaS", PostArchetype.POST_MORTEM, "Post-mortem: How our first 3 launch posts were flagged and how we fixed it"),
            (5, Platform.LINKEDIN, "B2B Founders & SaaS Leaders", PostArchetype.GENUINE_QUESTION, "To founders who got their first 100 users for $0: what was your primary channel?"),
            (6, Platform.TWITTER, "#buildinpublic", PostArchetype.TEARDOWN, "Comparing Reddit's spam filter against human moderation signals"),
            (7, Platform.REDDIT, "r/microSaaS", PostArchetype.BUILD_IN_PUBLIC, "Day 7 update: First 10 validation runs and the biggest surprise we saw"),
        ]

        baseline_fp = project.voice_fingerprint or StylometryEngine.extract_fingerprint(
            "I write directly, using short factual sentences. I prefer real metrics over hype. I test everything before speaking."
        )

        for day, platform, community, archetype, title in schedule[:days]:
            prompt = f"""Write a high-converting, 100% human-sounding {platform.value} post.

Project Idea: {project.raw_input}
Title/Topic: {title}
Archetype: {archetype.value}
Target Community: {community}
Founder Story Bank Receipts:
{story_context}

CRITICAL ANTI-SLOP CONSTRAINTS (PETER YANG & SERGE BULAEV RULES):
- NO binary contrasts ("It's not X. It's Y.").
- NO throat-clearing ("Here's the thing", "Let me be honest").
- NO faux-insight setups ("What nobody tells you").
- NO colon dramatic reveals ("The key: ...").
- NO trailing -ing participial clauses ("highlighting the need").
- NO importance puffery ("stands as a testament").
- NO emojis in headings or decorative bolding.
- If platform is REDDIT: ZERO outbound links in the post body. Must be pure native value.
- If platform is LINKEDIN: Keep length between 900-1300 characters. Provide any outbound link in a separate 'first_comment' string.
- Provide concrete numbers and grounded mechanisms.

Return JSON:
{{"content": "Full post copy here...", "first_comment": "Link or additional note for first comment..."}}
"""
            draft_res = await llm_client.generate_json(
                system_prompt="You are an elite founder-marketer who writes with zero AI slop and authentic vulnerability.",
                user_prompt=prompt,
                temperature=0.4,
            )

            raw_content = draft_res.get("content", "")
            first_comment = draft_res.get("first_comment", None)

            # Audit against Ban Risk & Anti-Slop Engine
            audit = BanRiskEvaluator.evaluate(
                text=raw_content,
                platform=platform,
                target_community=community,
                first_comment=first_comment or ""
            )

            # Measure Stylometric Distance
            candidate_fp = StylometryEngine.extract_fingerprint(raw_content)
            voice_dist = StylometryEngine.compute_burrows_delta(candidate_fp, baseline_fp)

            asset_status = AssetStatus.SCORED
            if audit.is_safe_to_publish:
                asset_status = AssetStatus.APPROVED
            elif audit.hard_block_reasons:
                asset_status = AssetStatus.BLOCKED
            else:
                asset_status = AssetStatus.NEEDS_REVISION

            asset = ContentAsset(
                id=f"asset-{uuid.uuid4().hex[:8]}",
                project_id=project.id,
                day_number=day,
                platform=platform,
                target_community=community,
                archetype=archetype,
                title=title,
                content=raw_content,
                first_comment=first_comment,
                voice_distance=voice_dist,
                ban_risk=audit,
                status=asset_status,
                created_at=datetime.now(timezone.utc).isoformat(),
            )
            assets.append(asset)

        return assets


content_pipeline = ContentPipeline()

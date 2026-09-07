"""Pydantic Data Schemas and Domain Types for Deno."""

from enum import Enum
from typing import List, Optional, Dict
from datetime import datetime
from pydantic import BaseModel, Field


# --- Enums ---

class ProjectStatus(str, Enum):
    DRAFT = "DRAFT"
    VALIDATING = "VALIDATING"
    VALIDATED = "VALIDATED"
    VOICE_READY = "VOICE_READY"
    CONTENT_READY = "CONTENT_READY"
    PUBLISHING = "PUBLISHING"
    TRACKED = "TRACKED"
    VALIDATION_FAILED = "VALIDATION_FAILED"
    VOICE_CAPTURE_FAILED = "VOICE_CAPTURE_FAILED"
    GENERATION_FAILED = "GENERATION_FAILED"


class Verdict(str, Enum):
    BUILD = "BUILD"
    PIVOT = "PIVOT"
    KILL = "KILL"


class Platform(str, Enum):
    REDDIT = "REDDIT"
    LINKEDIN = "LINKEDIN"
    TWITTER = "TWITTER"


class PostArchetype(str, Enum):
    TEARDOWN = "TEARDOWN"
    BUILD_IN_PUBLIC = "BUILD_IN_PUBLIC"
    POST_MORTEM = "POST_MORTEM"
    RESOURCE_DUMP = "RESOURCE_DUMP"
    GENUINE_QUESTION = "GENUINE_QUESTION"


class AssetStatus(str, Enum):
    GENERATED = "GENERATED"
    SCORED = "SCORED"
    NEEDS_REVISION = "NEEDS_REVISION"
    APPROVED = "APPROVED"
    PUBLISHED = "PUBLISHED"
    BLOCKED = "BLOCKED"


class StoryBankCategory(str, Enum):
    SCAR = "SCAR"
    METRIC = "METRIC"
    TURNING_POINT = "TURNING_POINT"
    DEFENDED_OPINION = "DEFENDED_OPINION"
    CUSTOMER_QUOTE = "CUSTOMER_QUOTE"


# --- Validation Models ---

class SourceLedgerItem(BaseModel):
    id: str = Field(description="Unique claim source identifier")
    claim: str = Field(description="The specific claim or metric being grounded")
    url: str = Field(description="Verified URL of source")
    title: str = Field(description="Title of source publication or thread")
    retrieval_date: str = Field(description="ISO date when claim was verified")


class CompetitorIntel(BaseModel):
    name: str
    url: str
    pricing: str
    strengths: List[str]
    exploitable_gaps: List[str]
    source_url: str


class TamSamSom(BaseModel):
    tam_usd: float = Field(description="Total Addressable Market in USD")
    sam_usd: float = Field(description="Serviceable Addressable Market in USD")
    som_usd: float = Field(description="Serviceable Obtainable Market in USD")
    calculation_work: str = Field(description="Bottom-up transparent formula")


class CommunityTarget(BaseModel):
    platform: Platform
    name: str
    member_count: int
    karma_age_gate: str
    self_promo_rule: str
    ai_content_policy: str
    max_posting_frequency: str
    last_refreshed: str


class ValidationReport(BaseModel):
    verdict: Verdict
    confidence_score: float = Field(ge=0.0, le=1.0, description="Calibrated confidence")
    top_reasons: List[str] = Field(min_length=3, max_length=3, description="Top 3 supporting arguments")
    market_breakdown: str
    tam_sam_som: TamSamSom
    competitors: List[CompetitorIntel]
    pain_point_quotes: List[str]
    source_ledger: List[SourceLedgerItem]
    target_communities: List[CommunityTarget]
    created_at: str


# --- Story Bank & Stylometry Models ---

class StoryBankEntry(BaseModel):
    id: str
    category: StoryBankCategory
    headline: str
    details: str
    concrete_numbers: List[str]
    tags: List[str]
    created_at: str


class StylometricFingerprint(BaseModel):
    function_word_distribution: Dict[str, float]
    mean_sentence_length: float
    sentence_length_variance: float
    punctuation_profile: Dict[str, float]
    type_token_ratio: float
    yules_k: float


# --- Ban Risk & Content Models ---

class BanRiskDeduction(BaseModel):
    pattern_name: str
    severity: str
    point_deduction: int
    offending_quote: str
    suggested_fix: str


class BanRiskAudit(BaseModel):
    ban_risk_score: int = Field(ge=0, le=100, description="0 = dangerous ban, 100 = completely safe")
    is_safe_to_publish: bool
    ai_detection_probability: float
    deductions: List[BanRiskDeduction]
    hard_block_reasons: List[str]


class ContentAsset(BaseModel):
    id: str
    project_id: str
    day_number: int = Field(ge=1, le=30)
    platform: Platform
    target_community: str
    archetype: PostArchetype
    title: str
    content: str
    first_comment: Optional[str] = None
    voice_distance: float
    ban_risk: BanRiskAudit
    status: AssetStatus
    created_at: str


# --- Request / Response Models ---

class IdeaIntakeRequest(BaseModel):
    raw_idea: str = Field(min_length=5, description="Free text startup idea or existing product URL")
    author_handle: Optional[str] = Field(default=None, description="Optional public X or Reddit handle")


class Project(BaseModel):
    id: str
    title: str
    raw_input: str
    author_handle: Optional[str] = None
    status: ProjectStatus
    validation_report: Optional[ValidationReport] = None
    story_bank: List[StoryBankEntry] = Field(default_factory=list)
    voice_fingerprint: Optional[StylometricFingerprint] = None
    content_calendar: List[ContentAsset] = Field(default_factory=list)
    created_at: str
    updated_at: str

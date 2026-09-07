"""Durable Storage Layer with Idempotent Schema and Transactional Integrity."""

import sqlite3
import json
from pathlib import Path
from typing import Optional, List
from datetime import datetime, timezone
from backend.app.config import ROOT_DIR
from backend.app.models.schemas import (
    Project,
    ProjectStatus,
    ValidationReport,
    StoryBankEntry,
    StylometricFingerprint,
    ContentAsset,
)

DB_PATH = ROOT_DIR / "deno_workspace.db"


class StorageManager:
    """Manages SQLite database operations with transactional guarantees and auto-cleanup."""

    def __init__(self, db_file: Path = DB_PATH) -> None:
        self.db_file = db_file
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_file))
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        """Idempotently initializes all relational tables."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    raw_input TEXT NOT NULL,
                    author_handle TEXT,
                    status TEXT NOT NULL,
                    validation_report_json TEXT,
                    voice_fingerprint_json TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS story_bank (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    category TEXT NOT NULL,
                    headline TEXT NOT NULL,
                    details TEXT NOT NULL,
                    concrete_numbers_json TEXT NOT NULL,
                    tags_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS content_assets (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    day_number INTEGER NOT NULL,
                    platform TEXT NOT NULL,
                    target_community TEXT NOT NULL,
                    archetype TEXT NOT NULL,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    first_comment TEXT,
                    voice_distance REAL NOT NULL,
                    ban_risk_json TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
                )
                """
            )
            conn.commit()

    def create_project(self, project: Project) -> Project:
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO projects (
                    id, title, raw_input, author_handle, status,
                    validation_report_json, voice_fingerprint_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    project.id,
                    project.title,
                    project.raw_input,
                    project.author_handle,
                    project.status.value,
                    project.validation_report.model_dump_json() if project.validation_report else None,
                    project.voice_fingerprint.model_dump_json() if project.voice_fingerprint else None,
                    now,
                    now,
                ),
            )
            conn.commit()
        return project

    def update_project(self, project: Project) -> Project:
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE projects SET
                    title = ?,
                    status = ?,
                    validation_report_json = ?,
                    voice_fingerprint_json = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    project.title,
                    project.status.value,
                    project.validation_report.model_dump_json() if project.validation_report else None,
                    project.voice_fingerprint.model_dump_json() if project.voice_fingerprint else None,
                    now,
                    project.id,
                ),
            )
            conn.commit()
        return project

    def get_project(self, project_id: str) -> Optional[Project]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
            row = cursor.fetchone()
            if not row:
                return None

            val_report = None
            if row["validation_report_json"]:
                val_report = ValidationReport.model_validate_json(row["validation_report_json"])

            voice_fp = None
            if row["voice_fingerprint_json"]:
                voice_fp = StylometricFingerprint.model_validate_json(row["voice_fingerprint_json"])

            # Fetch story bank entries
            cursor.execute("SELECT * FROM story_bank WHERE project_id = ? ORDER BY created_at DESC", (project_id,))
            sb_rows = cursor.fetchall()
            story_bank = [
                StoryBankEntry(
                    id=sb["id"],
                    category=sb["category"],
                    headline=sb["headline"],
                    details=sb["details"],
                    concrete_numbers=json.loads(sb["concrete_numbers_json"]),
                    tags=json.loads(sb["tags_json"]),
                    created_at=sb["created_at"],
                )
                for sb in sb_rows
            ]

            # Fetch content calendar assets
            cursor.execute("SELECT * FROM content_assets WHERE project_id = ? ORDER BY day_number ASC", (project_id,))
            asset_rows = cursor.fetchall()
            content_calendar = [
                ContentAsset(
                    id=ca["id"],
                    project_id=ca["project_id"],
                    day_number=ca["day_number"],
                    platform=ca["platform"],
                    target_community=ca["target_community"],
                    archetype=ca["archetype"],
                    title=ca["title"],
                    content=ca["content"],
                    first_comment=ca["first_comment"],
                    voice_distance=ca["voice_distance"],
                    ban_risk=json.loads(ca["ban_risk_json"]),
                    status=ca["status"],
                    created_at=ca["created_at"],
                )
                for ca in asset_rows
            ]

            return Project(
                id=row["id"],
                title=row["title"],
                raw_input=row["raw_input"],
                author_handle=row["author_handle"],
                status=ProjectStatus(row["status"]),
                validation_report=val_report,
                story_bank=story_bank,
                voice_fingerprint=voice_fp,
                content_calendar=content_calendar,
                created_at=row["created_at"],
                updated_at=row["updated_at"],
            )

    def save_story_bank_entry(self, project_id: str, entry: StoryBankEntry) -> None:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO story_bank (
                    id, project_id, category, headline, details, concrete_numbers_json, tags_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    entry.id,
                    project_id,
                    entry.category.value,
                    entry.headline,
                    entry.details,
                    json.dumps(entry.concrete_numbers),
                    json.dumps(entry.tags),
                    entry.created_at,
                ),
            )
            conn.commit()

    def save_content_asset(self, asset: ContentAsset) -> None:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO content_assets (
                    id, project_id, day_number, platform, target_community, archetype,
                    title, content, first_comment, voice_distance, ban_risk_json, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    asset.id,
                    asset.project_id,
                    asset.day_number,
                    asset.platform.value,
                    asset.target_community,
                    asset.archetype.value,
                    asset.title,
                    asset.content,
                    asset.first_comment,
                    asset.voice_distance,
                    asset.ban_risk.model_dump_json(),
                    asset.status.value,
                    asset.created_at,
                ),
            )
            conn.commit()


storage = StorageManager()

"""Studio (docs/18): brand kits, studio items/versions, licence ledger, review notes, the calling AI app on runs,
plans and drafts, studio taste on profiles, and the private `studio` Storage bucket.

ADDITIVE ONLY: new tables, new nullable columns, one bucket row. Dev and prod share one database (docs/17), so
nothing here alters or drops existing data.

Revision ID: 0006
Revises: 0005
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: str | Sequence[str] | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NEW_TENANT_TABLES = ("brand_kits", "studio_items", "studio_versions", "studio_assets", "review_notes")
JSONB_EMPTY_OBJ = sa.text("'{}'::jsonb")
JSONB_EMPTY_LIST = sa.text("'[]'::jsonb")


def _enum(name: str, *values: str) -> sa.Enum:
    return sa.Enum(*values, name=name, native_enum=False, create_constraint=True, length=32)


def _tenant_cols() -> list[sa.Column]:  # type: ignore[type-arg]
    return [
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
    ]


def _timestamps() -> list[sa.Column]:  # type: ignore[type-arg]
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    ]


BUCKET = """
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('studio', 'studio', false, 52428800, ARRAY[
      'video/mp4', 'image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'application/zip',
      'application/json', 'text/vtt', 'application/x-subrip', 'text/plain'
    ])
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$
"""


def upgrade() -> None:
    # The AI app that made a row through the MCP (NULL = the web app).
    for table in ("validation_runs", "content_plans", "content_drafts"):
        op.add_column(table, sa.Column("client_name", sa.String(length=64), nullable=True))
    op.add_column(
        "profiles", sa.Column("studio_prefs", postgresql.JSONB(), server_default=JSONB_EMPTY_OBJ, nullable=False)
    )

    op.create_table(
        "brand_kits",
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("data", postgresql.JSONB(), server_default=JSONB_EMPTY_OBJ, nullable=False),
        *_tenant_cols(),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["project_id"], ["projects.id"], name=op.f("fk_brand_kits_project_id_projects"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_brand_kits")),
        sa.UniqueConstraint("project_id", name=op.f("uq_brand_kits_project_id")),
    )
    op.create_index(op.f("ix_brand_kits_user_id"), "brand_kits", ["user_id"], unique=False)

    op.create_table(
        "studio_items",
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("brief_id", sa.UUID(), nullable=True),
        sa.Column("kind", _enum("studiokind", "video", "still"), server_default="video", nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column(
            "status",
            _enum("studiostatus", "draft", "in_review", "approved", "archived"),
            server_default="draft",
            nullable=False,
        ),
        sa.Column("current_version", sa.Integer(), server_default="0", nullable=False),
        sa.Column("client_name", sa.String(length=64), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        *_tenant_cols(),
        *_timestamps(),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["project_id"], ["projects.id"], name=op.f("fk_studio_items_project_id_projects"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["brief_id"],
            ["content_briefs.id"],
            name=op.f("fk_studio_items_brief_id_content_briefs"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_studio_items")),
    )
    op.create_index(op.f("ix_studio_items_project_id"), "studio_items", ["project_id"], unique=False)
    op.create_index(op.f("ix_studio_items_user_id"), "studio_items", ["user_id"], unique=False)
    op.create_index(
        "ix_studio_items_user_active",
        "studio_items",
        ["user_id", "updated_at"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    op.create_table(
        "studio_versions",
        sa.Column("item_id", sa.UUID(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("manifest", postgresql.JSONB(), server_default=JSONB_EMPTY_OBJ, nullable=False),
        sa.Column("files", postgresql.JSONB(), server_default=JSONB_EMPTY_OBJ, nullable=False),
        sa.Column("checks", postgresql.JSONB(), server_default=JSONB_EMPTY_LIST, nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("duration", sa.Float(), nullable=True),
        sa.Column("client_name", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        *_tenant_cols(),
        sa.ForeignKeyConstraint(
            ["item_id"], ["studio_items.id"], name=op.f("fk_studio_versions_item_id_studio_items"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_studio_versions")),
        sa.UniqueConstraint("item_id", "version", name="uq_studio_versions_item_version"),
    )
    op.create_index(op.f("ix_studio_versions_item_id"), "studio_versions", ["item_id"], unique=False)
    op.create_index(op.f("ix_studio_versions_user_id"), "studio_versions", ["user_id"], unique=False)

    op.create_table(
        "studio_assets",
        sa.Column("item_id", sa.UUID(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("asset_id", sa.String(length=200), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("source", sa.String(length=64), server_default="", nullable=False),
        sa.Column("license", sa.String(length=64), nullable=False),
        sa.Column("credit", sa.String(length=300), server_default="", nullable=False),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("commercial", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        *_tenant_cols(),
        sa.ForeignKeyConstraint(
            ["item_id"], ["studio_items.id"], name=op.f("fk_studio_assets_item_id_studio_items"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_studio_assets")),
    )
    op.create_index(op.f("ix_studio_assets_item_id"), "studio_assets", ["item_id"], unique=False)
    op.create_index(op.f("ix_studio_assets_user_id"), "studio_assets", ["user_id"], unique=False)

    op.create_table(
        "review_notes",
        sa.Column("item_id", sa.UUID(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("frame", sa.Integer(), nullable=True),
        sa.Column("t", sa.Float(), nullable=True),
        sa.Column("t_end", sa.Float(), nullable=True),
        sa.Column("x", sa.Float(), nullable=True),
        sa.Column("y", sa.Float(), nullable=True),
        sa.Column("page", sa.Integer(), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("tags", postgresql.JSONB(), server_default=JSONB_EMPTY_LIST, nullable=False),
        sa.Column(
            "status", _enum("notestatus", "open", "fixed", "wontfix", "resolved"), server_default="open", nullable=False
        ),
        sa.Column("reply", sa.Text(), nullable=True),
        sa.Column("fixed_in", sa.Integer(), nullable=True),
        sa.Column("clip_id", sa.String(length=64), nullable=True),
        sa.Column("chapter_id", sa.String(length=64), nullable=True),
        sa.Column("author", sa.String(length=16), server_default="founder", nullable=False),
        *_tenant_cols(),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["item_id"], ["studio_items.id"], name=op.f("fk_review_notes_item_id_studio_items"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_review_notes")),
    )
    op.create_index(op.f("ix_review_notes_item_id"), "review_notes", ["item_id"], unique=False)
    op.create_index(op.f("ix_review_notes_user_id"), "review_notes", ["user_id"], unique=False)

    # Same RLS as every tenant table (0001): owners only through the Data API; the API connects as a bypass role.
    for table in NEW_TENANT_TABLES:
        op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY owner_all ON public.{table} FOR ALL TO authenticated "
            "USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)"
        )

    op.execute(BUCKET)


def downgrade() -> None:
    for table in reversed(NEW_TENANT_TABLES):
        op.drop_table(table)
    op.drop_column("profiles", "studio_prefs")
    for table in ("content_drafts", "content_plans", "validation_runs"):
        op.drop_column(table, "client_name")
    # The storage bucket is left in place on purpose (it may hold the founder's files).

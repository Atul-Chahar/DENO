"""Application Configuration for Deno Backend."""

import os
from pathlib import Path
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Locate and load the root .env file
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = ROOT_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH)


class Settings(BaseModel):
    # NVIDIA NIM API Settings
    nvidia_nim_api_key: str = Field(
        default_factory=lambda: os.getenv("NVIDIA_NIM_API_KEY", "")
    )
    nvidia_nim_base_url: str = Field(
        default_factory=lambda: os.getenv(
            "NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1"
        )
    )
    nvidia_nim_model: str = Field(
        default_factory=lambda: os.getenv(
            "NVIDIA_NIM_MODEL", "meta/llama-3.2-11b-vision-instruct"
        )
    )

    # Server Settings
    backend_host: str = Field(
        default_factory=lambda: os.getenv("BACKEND_HOST", "127.0.0.1")
    )
    backend_port: int = Field(
        default_factory=lambda: int(os.getenv("BACKEND_PORT", "8000"))
    )
    gateway_port: int = Field(
        default_factory=lambda: int(os.getenv("GATEWAY_PORT", "8080"))
    )

    # Database
    database_url: str = Field(
        default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///./deno_workspace.db")
    )
    environment: str = Field(
        default_factory=lambda: os.getenv("ENVIRONMENT", "development")
    )
    log_level: str = Field(
        default_factory=lambda: os.getenv("LOG_LEVEL", "info")
    )


settings = Settings()

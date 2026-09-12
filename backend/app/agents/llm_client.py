"""High-Performance Async NVIDIA NIM Client Wrapper."""

import re
import json
import logging
from typing import Dict, Any, List, Optional
import httpx
from backend.app.config import settings

logger = logging.getLogger(__name__)


class NvidiaNimClient:
    """Async client for NVIDIA NIM API with fast raw JSON extraction and retry handling."""

    def __init__(self) -> None:
        self.api_key = settings.nvidia_nim_api_key
        self.base_url = settings.nvidia_nim_base_url.rstrip("/")
        self.model = settings.nvidia_nim_model
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 1500,
    ) -> str:
        """Dispatches an async chat completion to NVIDIA NIM."""
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self.headers,
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                return content.strip()
            except httpx.HTTPStatusError as exc:
                logger.error(f"NVIDIA NIM HTTP error: {exc.response.status_code} - {exc.response.text}")
                raise RuntimeError(f"NVIDIA NIM API error {exc.response.status_code}: {exc.response.text}")
            except Exception as exc:
                logger.error(f"NVIDIA NIM connection error: {str(exc)}")
                raise RuntimeError(f"Failed to communicate with NVIDIA NIM: {str(exc)}")

    async def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.1,
        max_tokens: int = 1500,
    ) -> Dict[str, Any]:
        """Generates and safely parses a structured JSON response."""
        enforced_system = (
            system_prompt
            + "\nCRITICAL: You MUST respond ONLY with a raw, valid JSON object. "
            "Never use markdown formatting, backticks, or text before/after."
        )

        content = await self.generate(
            system_prompt=enforced_system,
            user_prompt=user_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        # 1. Direct parse attempt
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # 2. Extract from markdown code blocks
        cleaned = content
        if "```json" in cleaned:
            cleaned = cleaned.split("```json")[1].split("```")[0].strip()
        elif "```" in cleaned:
            cleaned = cleaned.split("```")[1].split("```")[0].strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        # 3. Regex extraction for the outermost JSON object
        match = re.search(r"(\{.*\})", content, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        logger.error(f"Failed to decode JSON from NIM response: {content}")
        raise RuntimeError(f"Model response could not be parsed as JSON: {content[:100]}...")


llm_client = NvidiaNimClient()

"""Computational Stylometry Engine using Burrows' Delta and Authorship Attribution."""

import re
import math
from typing import Dict, List, Optional
import numpy as np
from backend.app.models.schemas import StylometricFingerprint


FUNCTION_WORDS = [
    "the", "of", "and", "to", "in", "that", "for", "with", "as", "by",
    "at", "from", "this", "but", "not", "on", "they", "you", "which", "or",
    "an", "were", "we", "their", "been", "have", "had", "what", "when", "if"
]


class StylometryEngine:
    """Computes quantitative stylometric vectors and Burrows' Delta distance."""

    @classmethod
    def extract_fingerprint(cls, text: str) -> StylometricFingerprint:
        words = re.findall(r"\b[a-zA-Z]+\b", text.lower())
        total_words = max(len(words), 1)

        # 1. Function Word Frequencies (normalized per 1,000 words)
        word_counts = {}
        for w in words:
            word_counts[w] = word_counts.get(w, 0) + 1

        fw_dist = {
            fw: (word_counts.get(fw, 0) / total_words) * 1000.0
            for fw in FUNCTION_WORDS
        }

        # 2. Sentence Length Mean & Variance
        raw_sentences = re.split(r"[.!?]+", text)
        sentences = [re.findall(r"\b\w+\b", s) for s in raw_sentences if s.strip()]
        sentence_lengths = [len(s) for s in sentences if len(s) > 0]

        if sentence_lengths:
            mean_length = float(np.mean(sentence_lengths))
            variance_length = float(np.var(sentence_lengths))
        else:
            mean_length = 0.0
            variance_length = 0.0

        # 3. Punctuation Profile (per 1,000 characters)
        total_chars = max(len(text), 1)
        punct_counts = {
            "comma": text.count(","),
            "semicolon": text.count(";"),
            "colon": text.count(":"),
            "em_dash": text.count("—") + text.count("--"),
            "question": text.count("?"),
            "exclamation": text.count("!"),
            "parentheses": text.count("(") + text.count(")")
        }
        punct_profile = {
            k: (v / total_chars) * 1000.0 for k, v in punct_counts.items()
        }

        # 4. Type-Token Ratio (TTR) & Yule's K
        unique_tokens = len(word_counts)
        ttr = unique_tokens / total_words

        # Yule's Characteristic K = 10^4 * (sum(f_i * i^2) - N) / N^2
        freq_spectrum: Dict[int, int] = {}
        for count in word_counts.values():
            freq_spectrum[count] = freq_spectrum.get(count, 0) + 1

        s1 = total_words
        s2 = sum(i * i * vi for i, vi in freq_spectrum.items())
        yules_k = 10000.0 * (s2 - s1) / (s1 * s1) if s1 > 1 else 0.0

        return StylometricFingerprint(
            function_word_distribution=fw_dist,
            mean_sentence_length=round(mean_length, 2),
            sentence_length_variance=round(variance_length, 2),
            punctuation_profile=punct_profile,
            type_token_ratio=round(ttr, 4),
            yules_k=round(yules_k, 2),
        )

    @classmethod
    def compute_burrows_delta(
        cls, fp_candidate: StylometricFingerprint, fp_baseline: StylometricFingerprint
    ) -> float:
        """Computes Burrows' Delta (standardized Manhattan distance over function words)."""
        deltas = []
        for fw in FUNCTION_WORDS:
            val_cand = fp_candidate.function_word_distribution.get(fw, 0.0)
            val_base = fp_baseline.function_word_distribution.get(fw, 0.0)

            # Normalization scale factor for standard deviation proxy
            scale = max(val_base, 1.0)
            deltas.append(abs(val_cand - val_base) / scale)

        return round(float(np.mean(deltas)), 3)

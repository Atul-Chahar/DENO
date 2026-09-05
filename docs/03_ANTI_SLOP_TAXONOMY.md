# Deno — Anti-Slop Taxonomy & Detection Engine

## Overview

Modern platform moderation and human readers in 2026 penalize AI writing not because of obvious buzzwords like *"delve"* or *"tapestry"*, but because of **mechanical sentence structures, artificial rhythm, and empty thought-leader tropes**.

Deno incorporates a hybrid anti-slop detection and scoring engine combining:
1. **Peter Yang's 18 Structural Slop Patterns** (`petergyang/no-ai-slop`).
2. **Serge Bulaev's 2026 Density & Tell Heuristics** (`sergebulaev/linkedin-skills`).

---

## 1. The 18 Structural Patterns to Detect & Penalize

| Pattern | Definition | Offending Example | Suggested Fix / Rewrite |
|---|---|---|---|
| **1. Binary Contrast** | "It's not X. It's Y." / "The question isn't X, it's Y." | *"It's not about the code. It's about distribution."* | State Y directly: *"Distribution matters more than code."* |
| **2. Throat-Clearing Opener** | Rhetorical filler delaying the core statement | *"Here's the thing...", "Let me be honest..."* | Cut the setup; start immediately with the action or fact. |
| **3. Faux-Insight Setup** | Self-flattering pre-framing | *"What nobody tells you about SaaS is..."* | Eliminate the pedestal; make the claim stand on its own evidence. |
| **4. Colon Reveal** | Noun phrase, colon, lowercase fake drama | *"The key: an adversarial critic agent."* | State naturally: *"An adversarial critic agent is what makes it work."* |
| **5. Superficial Analysis** | Trailing `-ing` clauses pretending to explain meaning | *"...highlighting the founder's obsession with speed"* | Replace with direct cause and concrete outcome. |
| **6. Importance Puffery** | Inflated corporate grandeur | *"Stands as a testament to modern engineering"* | Replace with objective, verifiable numbers or facts. |
| **7. Interpretive Metadiscourse** | Telling the reader how to interpret the prose | *"That last part matters more than it sounds."* | Delete authorial commentary; let facts speak for themselves. |
| **8. Weasel Attribution** | Unverified generalized consensus | *"Studies show that founders fail...", "Experts agree"* | Name the specific study/source, or remove the claim. |
| **9. Fake-Strong Verbs** | Clunky verb constructions | *"The platform serves as a central hub for..."* | Use direct verbs: *"The platform tracks..."* |
| **10. Synonym Cycling** | Rotating words unnaturally to avoid repetition | *"The agent reviews... the assistant checks... the tool audits..."* | Use the clear word consistently without artificial rotation. |
| **11. Negative Listing** | "Not an X. Not a Y. A Z." | *"Not a wrapper. Not a prompt. A full system."* | Say what it is directly: *"A full system."* |
| **12. Dramatic Fragmentation** | LinkedIn-bro one-sentence staccato bursts | *"Ship. Measure. Learn. That's it. That's the secret."* | Merge into natural, varied sentence structures. |
| **13. Robotic Rhythm** | Symmetrical sentence lengths across paragraphs | 3 consecutive paragraphs of exactly 15 words | Vary cadence, sentence length, and clause structure. |
| **14. Rhetorical Setup** | Self-answering theatrical questions | *"What if I told you validation was free? Here is how:"* | Present the proposition plainly without theatrical setups. |
| **15. Fake-Profound Kicker** | Aphorisms or mic-drop endings | *"At the end of the day, products don't ship themselves."* | End on the last concrete fact, lesson, or actionable next step. |
| **16. Summary-Recap Ending** | Restating the entire post at the end | *"In conclusion, remember these three lessons..."* | Delete the recap; the reader just read it. |
| **17. Formatting Slop** | Visual AI hallmarks | Emojis in section headers, random bolding mid-sentence | Restrict formatting to semantic paragraphs and natural bullet points. |
| **18. Em Dash Clumping** | Using em dashes (`—`) as a rhythmic crutch | 4+ em dashes in a 150-word post | Cap at max 1 per 100 words; replace excess with commas or parentheses. |

---

## 2. 2026 Density & Tell Scoring

In 2026, words like `significant`, `crucial`, `notably`, `comprehensive`, `insights`, `robust`, `leverage`, `foster`, `landscape`, `nuanced`, `streamline`, `elevate` are evaluated on **paragraph density**:
- **0–1 occurrences:** Normal human usage (0 point deduction).
- **2 occurrences:** Warning flag (-5 points).
- **3+ occurrences in a single paragraph:** Confirmed AI signature (-15 points deduction + mandatory rewrite).

### Grammar Tells
- **Nominalizations:** Converting active verbs to abstract nouns (*"the implementation of"*, *"the realization of"*).
- **Sentence-Opening `-ing` Clauses:** Runs at 5.3x human frequency in synthetic text. Flagged when > 2 per post.

---

## 3. The Portability Test

> **Rule:** *If a sentence can be transplanted unchanged into a post about an entirely different startup, it is generic slop.*

Deno enforces that every post must carry **non-portable anchor entities**:
1. Specific numbers (odd-precision metrics like "$14,280 MRR" or "42 days").
2. Verified competitor names or community references.
3. Concrete founder receipts from the **Story Bank**.

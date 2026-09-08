# Deno — Story Bank & Computational Stylometry

## 1. The Stylometric Voice Model

Traditional AI writing tools ask users for qualitative adjectives (*"witty, bold, professional"*), producing generic LLM caricatures.

Deno measures voice **quantitatively** using computational stylometry based on John Burrows' Delta method and statistical authorship attribution:

### A. Feature Extraction Vector
Given sample texts from a founder's social profile or writing samples, Deno computes a 50-dimensional stylometric fingerprint:
1. **Function Word Frequencies (30 dimensions):** Normalized frequencies of non-topical structural words (*the, of, and, to, in, that, for, with, as, by, at, from, this, but, his, not, on, they, you, which, or, an, were, we, their, been, have, had, what, when*). Function words reflect unconscious syntax rather than conscious topic choice.
2. **Sentence Length Distribution (5 dimensions):** Mean sentence length, variance, standard deviation, kurtosis, and skewness.
3. **Punctuation Profiles (8 dimensions):** Frequency of semicolons, colons, em-dashes, parentheses, ellipses, exclamation marks, question marks, and commas.
4. **Vocabulary Richness (4 dimensions):** Type-Token Ratio (TTR), Yule's Characteristic K, Simpson's D, and Hapax Legomena ratio (words occurring only once).
5. **Structural Rhythm (3 dimensions):** Paragraph length variance, dialogue/quote density, and list item ratio.

### B. Burrows' Delta Distance
To measure whether a generated post matches the founder's voice, Deno calculates the standardized Manhattan distance (Burrows' Delta):

$$\Delta(D, F) = \frac{1}{n} \sum_{i=1}^{n} \left| \frac{f_i(D) - \mu_i}{\sigma_i} - \frac{f_i(F) - \mu_i}{\sigma_i} \right|$$

Where:
- $D$ is the candidate draft.
- $F$ is the founder's baseline fingerprint.
- $\mu_i, \sigma_i$ are corpus mean and standard deviations for feature $i$.

**Convergence Threshold:**
- $\Delta \le 0.85$: Strong voice match (Accepted).
- $0.85 < \Delta \le 1.25$: Moderate voice match (Warning / Minor adjustments).
- $\Delta > 1.25$: Synthetic voice drift (Regenerate candidate; bounded to 3 attempts).

---

## 2. The Founder Story Bank

A mathematical fingerprint ensures cadence, but authentic writing requires **grounded lived experience**. The Story Bank solves the cold-start and blank-slate problem by storing structured, verifiable founder receipts.

### Story Bank Schema
```typescript
interface StoryBankEntry {
  id: string;
  category: "SCAR" | "METRIC" | "TURNING_POINT" | "DEFENDED_OPINION" | "CUSTOMER_QUOTE";
  headline: string;
  details: string;
  concrete_numbers: string[]; // e.g. ["$12,400", "4 months", "17 calls"]
  tags: string[];
  created_at: string;
}
```

### Categories & Purpose
1. **SCARS (Past Failures & Hard Lessons):** Real mistakes (*"Spent 6 months building a feature nobody clicked"*). Eliminates false vulnerability tropes.
2. **METRICS (Verifiable Receipts):** Odd-precision numbers (*"Closed 3 customers at $850/mo after 42 outbound emails"*). Beats generic puffery.
3. **TURNING POINTS (The Pivot Moment):** Exact moments of realization (*"When a user told us they only used the export button, we deleted the rest"*).
4. **DEFENDED OPINIONS (Non-Consensus Beliefs):** Stances the founder will publicly argue for (*"Why free tiers destroy early B2B feedback loops"*).

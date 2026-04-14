# Gemini Embedding 2 — Technical Documentation

> Google's first natively multimodal embedding model, powering the Knowledge & Retrieval Engine.

---

## Why Gemini Embedding 2?

Gemini Embedding 2 is the **only embedding model** that natively understands text, images, video, audio, and PDFs in a single unified vector space. For a Jordanian government knowledge platform processing Arabic legal documents (often scanned or image-heavy PDFs), this is a game-changer.

### The Key Advantage: No OCR Required

Traditional RAG pipelines for Arabic documents follow this painful path:

```
PDF → OCR (Tesseract/AWS Textract) → Fix Arabic errors → Chunk text → Embed text
```

**Our pipeline with Gemini Embedding 2:**

```
PDF → Render page as image → Embed directly (visual understanding)
```

This eliminates the entire OCR layer, which historically introduces **30-40% error rates** on Arabic documents due to ligature complexity, right-to-left rendering issues, and diacritical marks.

---

## Core Features

| Feature | Details |
|---|---|
| **Modalities** | Text, Images, Video (120s), Audio, PDFs (6 pages) |
| **Languages** | 100+ languages including **Arabic** (native support) |
| **Context Window** | 8,192 input tokens |
| **Output Dimensions** | 3,072 (full) · 1,536 (balanced) · 768 (compact) |
| **Matryoshka Support** | Flexible dimension reduction with minimal quality loss |
| **Cross-Modal Search** | Query with text → retrieve matching images, or vice versa |
| **Task Types** | Retrieval, Classification, Clustering, Similarity, Code |

### Matryoshka Representation Learning (MRL)

The model supports truncating embeddings to smaller dimensions without retraining. This allows you to trade storage costs for marginal quality loss:

| Dimension | MTEB Score | Storage per 1M chunks | Use Case |
|---|---|---|---|
| **3,072** | 68.17 | ~12 GB | Maximum accuracy |
| **1,536** | 68.17 | ~6 GB | **Recommended balance** ★ |
| **768** | 67.99 | ~3 GB | Cost-optimized, mobile |

> Our Knowledge Engine uses **768 dimensions** to optimize for speed and storage while maintaining 99.7% of the full-dimension quality.

---

## Benchmark Comparisons

### MTEB Leaderboard (Overall)

| Model | Provider | MTEB Score | Dimensions | Multimodal |
|---|---|---|---|---|
| **Gemini Embedding 2** | Google | **68.32** | 3,072 | ✅ Text + Image + Video + Audio + PDF |
| Cohere embed-v4 | Cohere | 65.20 | 1,024 | ❌ Text only |
| OpenAI text-embedding-3-large | OpenAI | 64.60 | 3,072 | ❌ Text only |
| Voyage Multimodal 3.5 | Voyage AI | ~63.0 | 1,024 | ⚠️ Text + Image only |
| Amazon Nova 2 Embeddings | AWS | ~61.0 | 1,024 | ⚠️ Text + Image only |

### Embedding Arena (Elo Ratings)

| Model | Elo Rating | Win Rate |
|---|---|---|
| **Gemini Embedding 2** | **1,605** | **59.5%** |
| zembed-1 | 1,590 | 57.2% |
| Voyage 4 | 1,575 | 55.8% |
| OpenAI text-embedding-3-large | 1,520 | 48.3% |

### Arabic-Specific Performance (ARCD Benchmark)

This is critical for our Jordanian government use case:

| Model | ARCD Win Rate | Notes |
|---|---|---|
| **Gemini Embedding 2** | **59.6%** | Best-in-class Arabic QA retrieval |
| Gemini text-embedding-004 | 42.1% | Previous generation |
| OpenAI text-embedding-3-large | ~38% | Weak Arabic understanding |

### Scientific Retrieval (SciFact)

| Model | Win Rate |
|---|---|
| **Gemini Embedding 2** | **70.6%** |
| Voyage 4 | 62.3% |
| OpenAI text-embedding-3-large | 55.1% |

### Cross-Modal Performance

Gemini Embedding 2 is the **clear leader** in multimodal tasks:

| Task | Gemini Embedding 2 | Amazon Nova 2 | Voyage MM 3.5 |
|---|---|---|---|
| Text → Image | 🥇 Best | 🥈 | 🥉 |
| Text → Video | 🥇 Best | ❌ Not supported | ❌ Not supported |
| Image → Text | 🥇 Best | 🥈 | 🥉 |
| Text → PDF | 🥇 Native support | ❌ | ❌ |

---

## Pricing Comparison

| Model | Cost per 1M Tokens | Image Cost | Free Tier |
|---|---|---|---|
| **Gemini Embedding 2** | **$0.15 – $0.20** | $0.00012/image | ✅ Yes |
| OpenAI text-embedding-3-large | $0.13 | ❌ N/A | ❌ No |
| Cohere embed-v4 | $0.10 | ❌ N/A | ⚠️ Trial only |
| Voyage Multimodal 3.5 | $0.06 | $0.00018/image | ⚠️ Trial only |

### Cost Analysis for Our Use Case

For the Jordan Policy Intelligence Platform processing **10,000 legal documents** (avg. 8 pages each = 80,000 page images):

| Model | Ingestion Cost | Can Process Arabic PDFs Natively? |
|---|---|---|
| **Gemini Embedding 2** | ~$9.60 | ✅ Yes, directly from page images |
| OpenAI + OCR pipeline | ~$6.50 + OCR costs (~$40) | ❌ Requires separate OCR first |
| Cohere + OCR pipeline | ~$5.00 + OCR costs (~$40) | ❌ Requires separate OCR first |

> **Bottom line:** Gemini Embedding 2 is **cheaper in total cost** when you factor in the eliminated OCR infrastructure, and delivers **significantly higher Arabic accuracy**.

---

## Use Cases in Our Knowledge Engine

### 1. Legal Document Ingestion
Each page of a Jordanian regulation PDF is rendered as a high-resolution image and embedded directly. The model understands Arabic legal text, headers, article numbering, and official stamps from the visual content alone.

### 2. Semantic Search
Citizens or government employees type natural language queries in Arabic. The query text is embedded and compared against the page-image embeddings using cosine similarity. The model finds semantically relevant pages even when exact keywords don't match.

### 3. Cross-Modal Retrieval
A user can search using text and find matching content from images, scanned documents, or even video content embedded in the same vector space.

### 4. Multilingual Support
Government documents that contain mixed Arabic-English content (common in technical regulations) are handled natively without language detection or switching.

---

## Technical Integration

```python
from google import genai

client = genai.Client(api_key="YOUR_KEY")

# Text embedding
result = client.models.embed_content(
    model="gemini-embedding-2-preview",
    contents="ما هي شروط الحصول على رخصة تجارية؟",
    config={"output_dimensionality": 768}
)

# Image embedding (PDF page)
from PIL import Image
page_img = Image.open("page_1.png")
result = client.models.embed_content(
    model="gemini-embedding-2-preview",
    contents=page_img,
    config={"output_dimensionality": 768}
)
```

### API Limits

| Parameter | Value |
|---|---|
| Max text tokens | 8,192 |
| Max images per request | 6 |
| Max video length | 120 seconds |
| Max PDF pages | 6 |
| Rate limit (free tier) | 1,500 RPD |
| Rate limit (paid tier) | 5,000 RPM |

---

## Why Not Other Models?

### OpenAI text-embedding-3-large
- ❌ **Text-only** — cannot embed Arabic PDF pages as images
- ❌ Requires a full OCR pipeline for scanned documents
- ❌ Weaker Arabic performance (ARCD: ~38% vs Gemini's 59.6%)
- ✅ Slightly cheaper per-token for pure text

### Cohere embed-v4
- ❌ **Text-only** — same OCR problem
- ❌ Lower MTEB score (65.2 vs 68.32)
- ✅ Cheapest per-token pricing
- ✅ Good enterprise support

### Voyage Multimodal 3.5
- ⚠️ Supports text + image only (no video, audio, or native PDF)
- ❌ Significantly lower multimodal benchmarks
- ✅ Cheapest image embedding pricing

### Amazon Nova 2
- ⚠️ Text + image only
- ❌ Lowest overall quality scores
- ❌ AWS-locked ecosystem
- ✅ Easy if already using AWS

---

## Summary

Gemini Embedding 2 is the optimal choice for our Knowledge Engine because:

1. **🇯🇴 Best Arabic Performance** — 59.6% win rate on ARCD, far ahead of competitors
2. **📄 Native PDF Understanding** — No OCR infrastructure needed, saving cost and eliminating error
3. **🔮 True Multimodal** — Text, images, video, audio, PDFs in one vector space
4. **💰 Best Total Cost** — Cheaper than competitors when OCR costs are factored in
5. **📐 Flexible Dimensions** — MRL support for optimizing storage vs. quality
6. **🏆 #1 on Leaderboard** — Elo 1,605, 59.5% overall win rate
7. **🔒 Google Cloud Ecosystem** — Aligns with government cloud sovereignty requirements

---

*Last updated: March 2026 · Model: `gemini-embedding-2-preview`*

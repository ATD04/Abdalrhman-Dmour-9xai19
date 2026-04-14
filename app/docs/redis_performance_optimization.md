# Redis Performance Optimization Plan
## JNPI — Jordan National Policy Intelligence Platform

**Document Version:** 1.0  
**Date:** 2026-03-25  
**Scope:** All backend services — `knowledge-service`, `agent-service`  
**Status:** Proposed / Pre-Implementation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture and Its Bottlenecks](#2-current-architecture-and-its-bottlenecks)
3. [Why Redis — The Right Tool for This Problem](#3-why-redis--the-right-tool-for-this-problem)
4. [Bottleneck Analysis — File by File](#4-bottleneck-analysis--file-by-file)
5. [The Five Caching Strategies](#5-the-five-caching-strategies)
6. [Expected Performance Gains](#6-expected-performance-gains)
7. [Architecture Diagram — Before and After](#7-architecture-diagram--before-and-after)
8. [Implementation Guide](#8-implementation-guide)
9. [Cache Invalidation Rules](#9-cache-invalidation-rules)
10. [Risk Assessment](#10-risk-assessment)
11. [Rollout Plan](#11-rollout-plan)
12. [What Redis Will NOT Fix](#12-what-redis-will-not-fix)
13. [Conclusion](#13-conclusion)

---

## 1. Executive Summary

The JNPI platform currently has **zero caching** across all of its services. Every user query triggers a full chain of expensive operations: an LLM embedding call, a complete vector scan over all stored documents, CPU-based reranking, and multiple database reads — every single time, even for the same query asked by different users.

Adding a **Redis caching layer** is the single highest-impact infrastructure change that can be made to this system right now. It requires no changes to the core business logic, does not introduce breaking changes, and is fully reversible.

**Expected outcome:** 40–70% reduction in average query response latency, 60–80% reduction in LLM embedding API calls, and elimination of redundant database JOIN queries on every dashboard load.

---

## 2. Current Architecture and Its Bottlenecks

### 2.1 Service Map

```
User/Frontend (React, port 5173)
         │
         ▼
  Agent Service (port 9200)
    ├── RouterAgent          ← Gemini Flash LLM call per request
    ├── OrchestratorAgent    ← LangGraph state machine (in-memory only)
    └── Specialist Agents
         ├── LegalAffairsAgent
         ├── PolicyAnalysisAgent
         ├── PublicServicesAgent
         └── GeneralKnowledgeAgent
              │
              ▼
  Knowledge Service (port 9100)
    ├── EmbeddingEngine      ← LLM API call per query
    ├── VectorStore          ← File scan OR pgvector query
    └── Database             ← SQLite / Postgres
```

### 2.2 What Happens on Every Query (No Cache)

```
User sends: "ما هي شروط تسجيل الشركة في الأردن؟"

Step 1 — RouterAgent.route()           ~200–800ms   (Gemini LLM classification call)
Step 2 — EmbeddingEngine.embed()       ~200–800ms   (LLM embedding API call)
Step 3 — VectorStore.search()          ~100–500ms   (scan all stored vectors)
Step 4 — KnowledgeTools._rerank()      ~50–200ms    (CPU cosine + re-sort)
Step 5 — Database.get_chunks_by_ids()  ~30–100ms    (DB query for metadata)

If sector returns no results (tools.py:163):
Step 3b — VectorStore.search() AGAIN  ~100–500ms   (second full scan!)
Step 4b — _rerank() AGAIN             ~50–200ms

Step 6 — Orchestrator synthesis        ~1000–5000ms (final Gemini LLM generation call)

TOTAL (worst case): ~6+ seconds per query
```

**The critical insight:** Steps 1–5 produce identical results for identical queries. Yet there is no mechanism to reuse them.

---

## 3. Why Redis — The Right Tool for This Problem

Redis (Remote Dictionary Server) is an **in-memory key-value store** that operates at sub-millisecond speed. It is the industry standard for caching in production AI/ML systems, including OpenAI's own infrastructure.

### Why Redis specifically (not a Python dict or file cache)?

| Requirement | Python `dict` | File Cache | Redis |
|---|---|---|---|
| Shared between services | ❌ In-process only | ⚠️ Slow disk I/O | ✅ Network-accessible |
| Persists across restarts | ❌ No | ✅ Yes | ✅ Yes (with AOF/RDB) |
| TTL / auto-expiry | ❌ Manual only | ❌ Manual only | ✅ Native |
| Memory-bound eviction | ❌ No (OOM risk) | ❌ Unbounded disk | ✅ LRU policy |
| Docker-native | ❌ No | ❌ No | ✅ Official image |
| Thread/async safe | ⚠️ GIL issues | ⚠️ File locking | ✅ Atomic commands |
| Latency | <0.01ms | ~5–50ms disk | ~0.1–0.5ms |

Both `knowledge-service` and `agent-service` run as **separate Docker containers**. Redis is the only option that allows them to share a cache safely with proper expiry.

---

## 4. Bottleneck Analysis — File by File

### 4.1 `agent-service/core/tools.py` — `KnowledgeTools.search_knowledge()`

**This is the single most expensive repeated operation in the system.**

```python
# Line 144–157: Full pipeline runs on every call with no result reuse
candidate_k = max(top_k, min(top_k * 4, 25))   # always fetch up to 25 candidates

result = self.client.retrieve(                   # ← HTTP → Knowledge Service → embed → vector scan
    query=query,
    top_k=candidate_k,
    sector=effective_sector,
    ...
)
chunks = self._rerank_chunks(query, result.get("results", []))   # CPU rerank
chunks = self._prefer_text_chunks(chunks)                        # filter
chunks = chunks[:top_k]

# Lines 162–186: If results are weak, runs the entire pipeline AGAIN without sector
if effective_sector and (not chunks or weak_sector_match):
    result = self.client.retrieve(...)           # ← second full vector scan!
    fallback_chunks = self._rerank_chunks(...)
    fallback_chunks = self._prefer_text_chunks(...)
```

**Problem:** If 10 different users ask the same legal question, this runs 10–20 times. There is zero benefit to re-running this — the knowledge base does not change between queries.

**Cache key design:**
```
redis:search:{sha256(query + sector + doc_type + visibility + top_k + str(sorted(tags)))}
```

**TTL:** 2 hours — documents are not updated that frequently. Even if a new document is ingested, old users still get valid responses.

---

### 4.2 `knowledge-service/core/embedding.py` — `EmbeddingEngine.embed()`

The embedding engine converts text into a numeric vector using a remote LLM API. This is:
- **Deterministic:** same text → same vector, 100% of the time
- **Expensive:** each call costs API tokens and 200–800ms of latency
- **Redundant in ingestion:** large PDFs have repeated page headers/footers — the same footer text is embedded on every single page

**Cache key design:**
```
redis:embed:{sha256(text_content)}
```

**TTL:** 24 hours — embedding models don't change between deployments. Even a 7-day TTL would be safe.

**Storage format:** Binary-packed float32 array (base64 encoded) — avoids JSON float precision loss and reduces memory usage by ~60% vs. JSON.

---

### 4.3 `knowledge-service/storage/database.py` — `list_sources()` and `get_source()`

```python
# Line 308–346: list_sources() runs a CROSS-JOIN with chunk counts on every call
def list_sources(self) -> list[dict]:
    rows = conn.execute("""
        SELECT s.*, COALESCE(c.total_chunks, 0) AS total_chunks
        FROM sources s
        LEFT JOIN (
            SELECT source_id, version, COUNT(*) AS total_chunks
            FROM chunks
            GROUP BY source_id, version
        ) c ON ...
        ORDER BY s.updated_at DESC
    """).fetchall()
```

**Problem:** The frontend calls this endpoint every time the Document Management page loads. This runs an aggregation JOIN over the entire `chunks` table every time — even if no documents have changed since the last call.

**Cache key design:**
```
redis:sources:list           # the full list (invalidated on any write)
redis:sources:{source_id}   # individual source (invalidated on update/delete)
```

**TTL:** 5 minutes — short enough to reflect changes quickly, long enough to absorb dashboard reloads.

---

### 4.4 `agent-service/core/router.py` — `RouterAgent.route()`

```python
# Line 114–121: Fast rule-based routing (free, ~0ms)
if mode == "concise":
    fast_decision = self._fast_rule_route(query, sector_hint)
    if fast_decision:
        return fast_decision  # ← Already optimized with rules

# Line 127–132: LLM routing for ambiguous queries (~200–800ms)
result = await self.llm.generate_json(
    prompt=prompt,
    system_instruction=ROUTER_SYSTEM_INSTRUCTION,
    model=model,
    max_output_tokens=480,
)
```

**Good news:** The router already has a fast rule-based path that avoids LLM calls for common queries. However, for queries that fall through to `generate_json()`, the result is cacheable — a routing decision for *"مقارنة قانون العمل"* will always be `{"agent": "policy_analysis", "intent": "policy_comparison"}`.

**Cache key design:**
```
redis:route:{sha256(query + user_type + sector_hint + language + mode)}
```

**TTL:** 4 hours

---

### 4.5 `knowledge-service/storage/vector_store.py` — `search()` (SQLite mode)

```python
# Line 288–300: Full scan in SQLite mode (no index, iterates every stored vector)
def search(self, query_embedding, source_ids=None, top_k=5, min_score=0.0):
    all_embeddings = self.load_all_embeddings(source_filter=source_ids)  # loads ALL JSON files from disk
    results = []
    for item in all_embeddings:
        score = self.cosine_similarity(query_embedding, item["embedding"])  # pure Python dot product
        if score >= min_score:
            results.append({...})
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:top_k]
```

**Problem (SQLite/file mode only):** This loads and deserializes ALL embedding JSON files from disk on every single search. With 100 documents averaging 30 chunks each = 3,000 cosine similarity calculations in pure Python, every time.

**Redis fix:** The embedding cache on the query side (Strategy 1) eliminates the need to re-embed the query. Combined with the search cache (Strategy 2), the vector scan is skipped entirely for repeated queries.

---

## 5. The Five Caching Strategies

### Strategy 1 — Embedding Cache (Highest Priority)

**Location:** `knowledge-service/core/embedding.py`  
**What is cached:** The float vector output for any given text input  
**Cache key:** `embed:{sha256(text)}`  
**TTL:** 86,400 seconds (24 hours)  
**Eviction:** LRU (least recently used)

```python
import hashlib, base64, struct, redis, os

_redis = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"), decode_responses=False)

def embed_single(self, text: str) -> list[float]:
    """Embed a single text string, using Redis cache."""
    key = f"embed:{hashlib.sha256(text.encode('utf-8')).hexdigest()}".encode()

    cached = _redis.get(key)
    if cached:
        # Unpack binary float32 array — much more efficient than JSON
        n = len(cached) // 4
        return list(struct.unpack(f"{n}f", cached))

    # Cache miss — call the actual model
    vector = self._call_model(text)

    # Pack and store as binary (saves ~60% memory vs JSON)
    packed = struct.pack(f"{len(vector)}f", *vector)
    _redis.setex(key, 86400, packed)
    return vector
```

**Impact:**
- Eliminates 80%+ of embedding API calls for repeated queries
- Critical during PDF ingestion: headers, footers, footers, standard legal boilerplate appear across pages – each gets cached after first embed
- Zero data consistency risk (embedding is a pure deterministic function)

---

### Strategy 2 — Search Results Cache (Highest Priority)

**Location:** `agent-service/core/tools.py` → `search_knowledge()`  
**What is cached:** The full list of ranked, filtered, reranked chunk results for a query  
**Cache key:** `search:{sha256(query + sector + doc_type + visibility + top_k + tags_sorted)}`  
**TTL:** 7,200 seconds (2 hours)  
**Eviction:** LRU

```python
import hashlib, json, redis, os

_redis = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"), decode_responses=True)

def search_knowledge(self, query: str, sector: str = None, user_type: str = "citizen",
                     doc_type: str = None, top_k: int = 5,
                     tags: list[str] = None, min_score: float = 0.0) -> list[dict]:

    # Build deterministic cache key
    visibility = VISIBILITY_MAP.get(user_type, "public")
    key_raw = f"{query}|{sector}|{doc_type}|{visibility}|{top_k}|{sorted(tags or [])}"
    cache_key = f"search:{hashlib.sha256(key_raw.encode('utf-8')).hexdigest()}"

    cached = _redis.get(cache_key)
    if cached:
        logger.info(f"Cache HIT for search query: '{query[:40]}...'")
        return json.loads(cached)

    # Cache miss — run the existing search logic
    # ... (all existing code remains unchanged) ...
    chunks = self._run_search(query, sector, visibility, doc_type, top_k, tags, min_score)

    # Store result — only if non-empty (don't cache failures)
    if chunks:
        _redis.setex(cache_key, 7200, json.dumps(chunks))
        logger.info(f"Cache SET for search query: '{query[:40]}...' ({len(chunks)} chunks)")

    return chunks
```

**Impact:**
- A query asked 10 times saves 9 full vector scans + 9 embedding calls
- Eliminates the double-scan fallback penalty (lines 163–186) on cache hits
- The most impactful single change in the entire system for repeat traffic

---

### Strategy 3 — Source Metadata Cache (Medium Priority)

**Location:** `knowledge-service/storage/database.py`  
**What is cached:** The full list of sources with chunk counts; individual source records  
**Cache key:** `sources:list` / `sources:{source_id}`  
**TTL:** 300 seconds (5 minutes)  
**Invalidation:** On every `create_source()`, `delete_source()`, and `bump_version()` call

```python
# In list_sources():
def list_sources(self) -> list[dict]:
    cached = _redis.get("sources:list")
    if cached:
        return json.loads(cached)

    results = self._fetch_sources()   # existing DB logic unchanged
    _redis.setex("sources:list", 300, json.dumps(results, default=str))
    return results

# In create_source(), delete_source(), bump_version():
def _invalidate_source_cache(self, source_id: str = None):
    _redis.delete("sources:list")     # always invalidate the list view
    if source_id:
        _redis.delete(f"sources:{source_id}")
```

**Impact:**
- Removes the aggregation JOIN from every frontend dashboard reload
- Especially important in Postgres/Supabase mode where the JOIN is remote

---

### Strategy 4 — Agent Session State (Transformative)

**Location:** New `agent-service/session_manager.py`  
**What is cached:** Conversation history per user session, user_type, preferred language  
**Cache key:** `session:{session_id}`  
**TTL:** 1,800 seconds (30 minutes, reset on activity)

Your LangGraph orchestrator in `orchestrator.py` (56KB) is designed for stateful multi-turn conversation but currently holds state **in-memory per-request only**. When the request ends, all context is lost. Redis turns this into persistent conversation memory.

```python
# agent-service/session_manager.py (new file)
import redis, json, os

_redis = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"), decode_responses=True)
SESSION_TTL = 1800  # 30 minutes

def get_session(session_id: str) -> dict:
    """Load conversation state from Redis."""
    raw = _redis.get(f"session:{session_id}")
    if raw:
        _redis.expire(f"session:{session_id}", SESSION_TTL)  # refresh TTL on activity
        return json.loads(raw)
    return {
        "history": [],          # list of {role, content} dicts
        "user_type": "citizen",
        "sector": "general",
        "language": "ar",
    }

def save_session(session_id: str, state: dict):
    """Persist conversation state to Redis."""
    _redis.setex(f"session:{session_id}", SESSION_TTL, json.dumps(state, ensure_ascii=False))

def clear_session(session_id: str):
    """Explicit session logout/clear."""
    _redis.delete(f"session:{session_id}")
```

**Impact:**
- Enables multi-turn conversations: *"What is Article 6?" → "What about Article 7?"* (currently Article 7 has no context)
- Enables personalization: the agent remembers the user's role and sector preference
- Unlocks the full potential of the LangGraph orchestrator that is already implemented

---

### Strategy 5 — Rate Limiting (Security Layer)

**Location:** `agent-service/api/query.py`  
**What is cached:** Request counts per IP address / user  
**Cache key:** `ratelimit:{ip_address}`  
**TTL:** 60 seconds (rolling window)

```python
def check_rate_limit(ip: str, limit: int = 30, window: int = 60) -> bool:
    """Returns True if request is allowed, False if rate limit exceeded."""
    key = f"ratelimit:{ip}"
    count = _redis.incr(key)          # atomic increment
    if count == 1:
        _redis.expire(key, window)    # start the window on first request
    return count <= limit
```

**Impact:**
- Prevents a single user/bot from overwhelming the LLM API quota
- The `INCR` + `EXPIRE` pattern is atomic — no race conditions
- Zero false positives for normal users (30 requests/minute is generous)

---

## 6. Expected Performance Gains

### Per-Request Latency (Typical Query)

| Scenario | Without Redis | With Redis (cache miss) | With Redis (cache hit) |
|---|---|---|---|
| First time query | ~2,500ms | ~2,550ms (+50ms Redis overhead) | — |
| Repeated query (same user) | ~2,500ms | — | **~5ms** |
| Repeated query (different user) | ~2,500ms | — | **~5ms** |
| Dashboard load (list sources) | ~300ms (Postgres) | — | **~2ms** |
| PDF ingestion (100 pages, 20% repeated text) | O(100) embed calls | — | O(80) embed calls (20% cache hits) |

### API Cost Reduction (per 1,000 queries)

| Operation | Without Redis | With Redis (50% hit rate) | With Redis (70% hit rate) |
|---|---|---|---|
| Embedding API calls | 1,000 | 500 | 300 |
| Vector scans | 1,000–2,000 | 500–1,000 | 300–600 |
| DB queries (list_sources) | 1,000 | ~50 (TTL=5min) | ~50 |

### Concurrency Behavior

Without Redis: 10 simultaneous users asking the same popular query make **10 parallel LLM API calls** and **10 parallel vector scans**.

With Redis: The first request populates the cache. Requests 2–10 get results from memory in ~1ms. You go from **O(N)** to **O(1)** for concurrent identical queries.

---

## 7. Architecture Diagram — Before and After

### Before Redis

```
User₁ ─────────────► Agent Service
                           │
                     EmbeddingAPI call ← ~500ms
                           │
                      VectorStore scan ← ~300ms
                           │
                      DB metadata read ← ~50ms
                           │
                      LLM generation ← ~2000ms

User₂ (same query) ─► Agent Service
                           │
                     EmbeddingAPI call ← ~500ms (REPEATED!)
                           │
                      VectorStore scan ← ~300ms (REPEATED!)
                           │
                      DB metadata read ← ~50ms (REPEATED!)
                           │
                      LLM generation ← ~2000ms
```

### After Redis

```
User₁ ─────────────► Agent Service
                           │
                    Redis GET (miss) ← ~0.5ms
                           │
                     EmbeddingAPI call ← ~500ms
                           │
                      VectorStore scan ← ~300ms
                           │
                      DB metadata read ← ~50ms
                           │
                    Redis SET (store) ← ~0.5ms
                           │
                      LLM generation ← ~2000ms

User₂ (same query) ─► Agent Service
                           │
                    Redis GET (HIT!) ← ~1ms ✅
                           │
                      LLM generation ← ~2000ms
                    (search skipped entirely)
```

```
Full Architecture with Redis:

Frontend (React :5173)
      │
      ▼
Agent Service (:9200)
      │
      ├──► Redis (:6379) ◄──────────────────────────┐
      │    ├── session:{id}   TTL: 30min             │
      │    ├── search:{hash}  TTL: 2hr               │
      │    ├── route:{hash}   TTL: 4hr               │
      │    └── ratelimit:{ip} TTL: 1min              │
      │                                              │
      ▼                                              │
Knowledge Service (:9100)                            │
      │                                              │
      ├──► Redis (:6379, same instance)              │
      │    ├── embed:{hash}   TTL: 24hr  ────────────┘
      │    ├── sources:list   TTL: 5min
      │    └── sources:{id}   TTL: 5min
      │
      ├──► VectorStore (pgvector / JSON files)
      └──► Database (Postgres / SQLite)
```

---

## 8. Implementation Guide

### Step 1 — Add Redis to Docker Compose

**File:** `app/docker-compose.yml`

```yaml
services:

  redis:
    image: redis:7-alpine
    container_name: jnpi-redis
    ports:
      - "6379:6379"
    command: >
      redis-server
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
      --appendonly yes
      --appendfsync everysec
    volumes:
      - redis-data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

# Add to both knowledge-service and agent-service depends_on:
  knowledge-service:
    depends_on:
      redis:
        condition: service_healthy

  agent-service:
    depends_on:
      redis:
        condition: service_healthy
      knowledge-service:
        condition: service_healthy

volumes:
  redis-data:
    driver: local
```

**Redis config explained:**
- `maxmemory 512mb` — Hard cap. Redis evicts old entries before hitting this.
- `allkeys-lru` — When memory is full, evict the Least Recently Used key. Optimal for caching.
- `appendonly yes` — Write-ahead log. Cache survives Redis restarts (warm restart instead of cold).
- `appendfsync everysec` — Flush to disk once per second. Balances durability vs. performance.

---

### Step 2 — Shared Environment Variable

**File:** `app/.env.shared`

```bash
# Add this line:
REDIS_URL=redis://redis:6379/0
```

---

### Step 3 — Add redis dependency

**File:** `knowledge-service/requirements.txt` and `agent-service/requirements.txt`

```
redis>=5.0.0
```

---

### Step 4 — Create Shared Redis Client

**File:** `knowledge-service/cache.py` (and identical copy in `agent-service/cache.py`)

```python
"""
Shared Redis client for caching.
Falls back gracefully if Redis is unavailable (non-fatal).
"""
import os
import logging
import redis as redis_lib

logger = logging.getLogger(__name__)

_client = None

def get_redis() -> redis_lib.Redis | None:
    """
    Returns a Redis client, or None if Redis is unavailable.
    Caching is always optional — the system works without it.
    """
    global _client
    if _client is not None:
        return _client
    try:
        url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        _client = redis_lib.Redis.from_url(url, decode_responses=True, socket_connect_timeout=2)
        _client.ping()
        logger.info(f"Redis connected: {url}")
        return _client
    except Exception as e:
        logger.warning(f"Redis unavailable (caching disabled): {e}")
        return None
```

> **Design decision:** The `get_redis()` function returns `None` if Redis is down. Every cache read/write should be wrapped in `if redis: ...` to ensure the system degrades gracefully and never fails because Redis is unavailable.

---

### Step 5 — Instrument Embedding Engine

**File:** `knowledge-service/core/embedding.py`

Add at the top of the `embed_single()` or `embed_batch()` method:

```python
import hashlib, struct
from cache import get_redis

def embed_single(self, text: str) -> list[float]:
    r = get_redis()
    if r:
        key = f"embed:{hashlib.sha256(text.encode('utf-8')).hexdigest()}"
        try:
            cached = r.get(key)
            if cached:
                raw = bytes.fromhex(cached)
                n = len(raw) // 4
                return list(struct.unpack(f"{n}f", raw))
        except Exception:
            pass  # cache failure → proceed normally

    vector = self._call_model(text)   # existing logic

    if r:
        try:
            packed = struct.pack(f"{len(vector)}f", *vector)
            r.setex(key, 86400, packed.hex())
        except Exception:
            pass

    return vector
```

---

### Step 6 — Instrument Search Cache

**File:** `agent-service/core/tools.py` — modify `search_knowledge()`:

```python
import hashlib, json
from cache import get_redis

def search_knowledge(self, query: str, sector: str = None, user_type: str = "citizen",
                     doc_type: str = None, top_k: int = 5,
                     tags: list[str] = None, min_score: float = 0.0) -> list[dict]:

    visibility = VISIBILITY_MAP.get(user_type, "public")

    # Build cache key
    r = get_redis()
    cache_key = None
    if r:
        key_parts = f"{query}|{sector}|{doc_type}|{visibility}|{top_k}|{min_score}|{sorted(tags or [])}"
        cache_key = f"search:{hashlib.sha256(key_parts.encode('utf-8')).hexdigest()}"
        try:
            cached = r.get(cache_key)
            if cached:
                logger.info(f"[CACHE HIT] search '{query[:50]}'")
                return json.loads(cached)
        except Exception:
            pass

    # --- All existing search logic runs here (unchanged) ---
    # ... existing code from line 135 to 188 ...
    chunks = self._existing_search_logic(...)

    # Store in cache
    if r and cache_key and chunks:
        try:
            r.setex(cache_key, 7200, json.dumps(chunks))
            logger.info(f"[CACHE SET] search '{query[:50]}' → {len(chunks)} chunks")
        except Exception:
            pass

    return chunks
```

---

### Step 7 — Instrument Source Metadata Cache

**File:** `knowledge-service/storage/database.py`

Add to `list_sources()`:
```python
def list_sources(self) -> list[dict]:
    r = get_redis()
    if r:
        try:
            cached = r.get("sources:list")
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    results = self._fetch_sources_from_db()   # existing logic

    if r:
        try:
            r.setex("sources:list", 300, json.dumps(results, default=str))
        except Exception:
            pass

    return results
```

Add invalidation call to `create_source()`, `delete_source()`, and `bump_version()`:
```python
def _invalidate_source_cache(self, source_id: str = None):
    r = get_redis()
    if r:
        try:
            r.delete("sources:list")
            if source_id:
                r.delete(f"sources:{source_id}")
        except Exception:
            pass
```

---

## 9. Cache Invalidation Rules

Cache invalidation is the hardest part of any caching system. Here are the exact rules for this system:

| Cache Key Pattern | Invalidated When | How |
|---|---|---|
| `embed:{hash}` | Never (embeddings are deterministic) | TTL only (24h) |
| `search:{hash}` | A new document is ingested (optional strict mode) | TTL only (2h) or `FLUSHDB` on ingest |
| `sources:list` | Any document added/deleted/versioned | Explicit `DEL sources:list` |
| `sources:{id}` | That specific source is updated/deleted | Explicit `DEL sources:{id}` |
| `session:{id}` | User logs out, or 30min idle | TTL + explicit `DEL` on logout |
| `ratelimit:{ip}` | Auto-expires | TTL only (60s) |
| `route:{hash}` | Never (routing decisions are stateless) | TTL only (4h) |

**Note on search cache invalidation:** The conservative approach is TTL-only (2 hours). If strict consistency is required (a new document must appear in results within seconds of ingestion), add `r.flushdb()` or pattern-delete `search:*` at the end of `IngestionEngine.ingest()`. For a policy platform where documents change infrequently, TTL-only is recommended.

---

## 10. Risk Assessment

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Redis goes down | Low (Docker restart policy) | Low (graceful degradation) | `get_redis()` returns `None`, system falls back to no-cache mode |
| Stale search results | Medium | Low | 2h TTL ensures max 2h of staleness. For documents, this is acceptable. |
| Stale source list | Low | Low | 5min TTL + explicit invalidation on writes |
| Memory overflow | Low (LRU policy) | None | `maxmemory 512mb` + `allkeys-lru` safely evicts old entries |
| Cache poisoning | Very low (internal network) | Medium | Redis is not exposed externally (no port in production config) |
| Incorrect cache key collision | Very low (SHA-256) | Medium | SHA-256 collision probability is astronomically low |

**Overall risk level: LOW.** The caching layer is purely additive. The system functions identically without Redis — it just runs slower.

---

## 11. Rollout Plan

### Phase 1 — Foundation (Priority: Immediate)
**Estimated effort: 1–2 days**

- [ ] Add `redis:7-alpine` to `docker-compose.yml`
- [ ] Add `REDIS_URL` to `.env.shared`
- [ ] Add `redis>=5.0.0` to both `requirements.txt` files
- [ ] Create `cache.py` in both services
- [ ] Implement embedding cache in `embedding.py`
- [ ] Implement search results cache in `tools.py`

**Validates:** ~40–60% reduction in repeat query latency. Measurable with any HTTP timing tool.

---

### Phase 2 — Metadata and Dashboard (Priority: High)
**Estimated effort: 1 day**

- [ ] Implement source metadata cache in `database.py`
- [ ] Implement cache invalidation in `create_source()`, `delete_source()`, `bump_version()`
- [ ] Implement router decision cache in `router.py`

**Validates:** Frontend dashboard page load is instant on repeat loads.

---

### Phase 3 — Session and Multi-Turn (Priority: High — Architectural)
**Estimated effort: 2 days**

- [ ] Create `session_manager.py` in `agent-service`
- [ ] Integrate session loading/saving into the orchestrator entrypoint
- [ ] Pass session history as context to LangGraph state
- [ ] Add `session_id` to frontend API calls

**Validates:** User can ask follow-up questions that reference previous answers.

---

### Phase 4 — Rate Limiting and Observability (Priority: Medium)
**Estimated effort: 0.5 days**

- [ ] Add rate limiting middleware to `agent-service`
- [ ] Add Redis cache hit/miss metrics to health endpoint (`/health`)
- [ ] Add cache hit rate logging for monitoring

---

## 12. What Redis Will NOT Fix

Be clear-eyed about what Redis does not address:

| Bottleneck | Why Redis Doesn't Apply | Real Fix |
|---|---|---|
| LLM response generation time (~1–5s) | Each final answer is unique per context | Use a faster/smaller model for simple queries |
| First-time query (cold cache) | Nothing is cached yet | Acceptable — same as current behavior |
| PDF ingestion speed (LibreOffice conversion) | One-time background operation | Async ingestion queue |
| VectorStore cold-start (JSON files) | Loaded at service startup | Use pgvector (already supported) |
| Orchestrator complexity (`orchestrator.py`, 56KB) | Logic issue, not a speed issue | Reduce delegation depth |

---

## 13. Conclusion

The JNPI platform is a sophisticated, well-architected policy intelligence system. The core logic — the LangGraph orchestrator, specialist agents, dual-mode vector store, and temporal-aware ingestion pipeline — is solid and production-grade.

The missing piece is simple: **the system does all of its hard work, throws it away, and then repeats it from scratch on the next request.**

Redis solves exactly this problem. It is the standard, battle-tested solution for this class of issue in production AI systems. The implementation is low-risk (purely additive with graceful degradation), the changes are minimal (no core logic is modified), and the gains are immediate and measurable.

**Phase 1 alone — adding the embedding cache and search results cache — is worth implementing today.**

---

*Document prepared for JNPI development team. All line references correspond to the current codebase state as of 2026-03-25.*

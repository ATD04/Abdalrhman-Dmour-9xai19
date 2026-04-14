"""
Knowledge Service — Embedding Engine
Wraps Gemini Embedding 2 with retry logic and dimension control.
"""
import time
import logging
import hashlib
import struct
from PIL import Image
from google import genai
from config import GEMINI_API_KEY, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS
from cache import get_redis

logger = logging.getLogger("knowledge-service.embedding")


class EmbeddingEngine:
    """Generates embeddings using Gemini Embedding 2."""

    def __init__(self):
        self._client = None
        self.model = EMBEDDING_MODEL
        self.dimensions = EMBEDDING_DIMENSIONS

    @property
    def client(self) -> genai.Client:
        """Lazily initialize the Gemini client."""
        if self._client is None:
            self._client = genai.Client(api_key=GEMINI_API_KEY)
        return self._client

    def embed(self, content: Image.Image | str) -> list[float]:
        """
        Embed a single piece of content (image or text).
        Returns a list of floats (the embedding vector).
        """
        r = get_redis()
        cache_key = None
        if isinstance(content, str) and r:
            cache_key = f"embed:{hashlib.sha256(content.encode('utf-8')).hexdigest()}"
            try:
                cached = r.get(cache_key)
                if cached:
                    raw = bytes.fromhex(cached)
                    n = len(raw) // 4
                    return list(struct.unpack(f"{n}f", raw))
            except Exception:
                pass  # cache failure → proceed normally

        max_retries = 3
        vector = None
        for attempt in range(max_retries):
            try:
                try:
                    response = self.client.models.embed_content(
                        model=self.model,
                        contents=content,
                        config={"output_dimensionality": self.dimensions},
                    )
                except TypeError:
                    # Backward compatibility for SDK versions without config support.
                    response = self.client.models.embed_content(
                        model=self.model,
                        contents=content,
                    )
                vector = response.embeddings[0].values
                break
            except Exception as e:
                logger.warning(f"Embedding attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff
                else:
                    raise

        if cache_key and r and vector:
            try:
                packed = struct.pack(f"{len(vector)}f", *vector)
                r.setex(cache_key, 86400, packed.hex())
            except Exception:
                pass

        return vector

    def embed_batch(self, contents: list[Image.Image | str],
                    on_progress: callable = None) -> list[list[float]]:
        """
        Embed a batch of content items sequentially.
        Calls on_progress(i, total) after each item if provided.
        """
        embeddings = []
        total = len(contents)
        for i, content in enumerate(contents):
            embedding = self.embed(content)
            embeddings.append(embedding)
            if on_progress:
                on_progress(i + 1, total)
        return embeddings

    @property
    def model_name(self) -> str:
        return self.model

    @property
    def output_dimensions(self) -> int:
        return self.dimensions

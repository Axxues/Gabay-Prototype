"""Vector store client and embedding generation using Upstash Vector and Google GenAI."""

from typing import Optional
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from upstash_vector import Index, Vector

from app.core.config import get_settings


def get_embeddings_client() -> GoogleGenerativeAIEmbeddings:
    """Instantiate and return the Google Generative AI embeddings client.

    Uses models/gemini-embedding-001 with 768-dimensional float vectors.
    """
    settings = get_settings()
    return GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001",
        google_api_key=settings.gemini_api_key,
        output_dimensionality=768,
    )


def embed_text(text: str) -> list[float]:
    """Generate a 768-dimensional float vector embedding for the input text.

    Args:
        text: Input string to embed.

    Returns:
        List of 768 floating-point numbers.
    """
    client = get_embeddings_client()
    return client.embed_query(text)


def get_upstash_index() -> Index:
    """Initialize and return an Upstash Vector Index instance using config settings.

    Returns:
        Configured Upstash Vector Index client.
    """
    settings = get_settings()
    return Index(
        url=settings.upstash_vector_rest_url,
        token=settings.upstash_vector_rest_token,
    )


def query_vector_store(
    query_text: str,
    top_k: int = 3,
    filter_str: Optional[str] = None,
    index: Optional[Index] = None,
) -> list[dict]:
    """Query Upstash Vector store with an embedded text query.

    Args:
        query_text: User search or query string.
        top_k: Number of most similar vectors to retrieve (default 3).
        filter_str: Optional metadata SQL-like filter string (e.g., "source = 'faq'").
        index: Optional Upstash Index instance (defaults to get_upstash_index()).

    Returns:
        List of dictionaries with keys:
          - 'text': Raw text payload from data field or metadata['text']
          - 'source': Source tag from metadata
          - 'metadata': Full metadata dictionary
          - 'score': Similarity score
    """
    if index is None:
        index = get_upstash_index()

    query_vector = embed_text(query_text)
    filter_arg = filter_str if filter_str is not None else ""

    raw_results = index.query(
        vector=query_vector,
        top_k=top_k,
        include_metadata=True,
        include_data=True,
        filter=filter_arg,
    )

    parsed_results: list[dict] = []
    for res in raw_results:
        if isinstance(res, dict):
            meta = res.get("metadata") or {}
            data = res.get("data")
            text = data if data is not None else meta.get("text", "")
            source = meta.get("source", "")
            score = float(res.get("score", 0.0))
        else:
            meta = getattr(res, "metadata", {}) or {}
            data = getattr(res, "data", None)
            text = data if data is not None else meta.get("text", "")
            source = meta.get("source", "")
            score = float(getattr(res, "score", 0.0))

        parsed_results.append({
            "text": text,
            "source": source,
            "metadata": meta,
            "score": score,
        })

    return parsed_results


def upsert_vector_document(
    doc_id: str,
    text: str,
    metadata: dict,
    index: Optional[Index] = None,
) -> None:
    """Embed and upsert a document into the Upstash Vector store.

    Args:
        doc_id: Unique string identifier for the vector entry.
        text: Text content to embed and store in the data payload.
        metadata: Associated metadata dictionary (e.g. source, title, chunk index).
        index: Optional Upstash Index instance (defaults to get_upstash_index()).
    """
    if index is None:
        index = get_upstash_index()

    vector = embed_text(text)
    doc_vector = Vector(
        id=doc_id,
        vector=vector,
        metadata=metadata,
        data=text,
    )
    index.upsert(vectors=[doc_vector])

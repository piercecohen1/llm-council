"""OpenRouter API client for making LLM requests."""

import httpx
from typing import List, Dict, Any, Optional
from .config import OPENROUTER_API_KEY, OPENROUTER_API_URL

# Default cap on total web search results per request (controls cost + context size).
DEFAULT_WEB_SEARCH_MAX_RESULTS = 5
DEFAULT_WEB_SEARCH_MAX_TOTAL_RESULTS = 15


def _build_web_search_tool(
    max_results: int = DEFAULT_WEB_SEARCH_MAX_RESULTS,
    max_total_results: int = DEFAULT_WEB_SEARCH_MAX_TOTAL_RESULTS,
) -> Dict[str, Any]:
    """Build the openrouter:web_search server tool config."""
    return {
        "type": "openrouter:web_search",
        "parameters": {
            # "auto" = native provider search when available, Exa as fallback.
            # Default, but pinned explicitly so future default changes don't surprise us.
            "engine": "auto",
            "max_results": max_results,
            "max_total_results": max_total_results,
        },
    }


async def query_model(
    model: str,
    messages: List[Dict[str, str]],
    timeout: float = 180.0,
    enable_web_search: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Query a single model via OpenRouter API.

    Args:
        model: OpenRouter model identifier (e.g., "openai/gpt-4o")
        messages: List of message dicts with 'role' and 'content'
        timeout: Request timeout in seconds
        enable_web_search: If True, attach the openrouter:web_search server tool so
            the model can fetch live web results. Citations come back as
            `annotations` on the assistant message.

    Returns:
        Response dict with 'content', optional 'reasoning_details', optional
        'citations' (list of url_citation annotations), and optional
        'web_search_requests' count, or None if failed.
    """
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
    }

    if enable_web_search:
        payload["tools"] = [_build_web_search_tool()]

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                OPENROUTER_API_URL,
                headers=headers,
                json=payload
            )
            response.raise_for_status()

            data = response.json()
            message = data['choices'][0]['message']

            citations = _extract_citations(message.get('annotations'))
            web_search_requests = (
                data.get('usage', {})
                    .get('server_tool_use', {})
                    .get('web_search_requests')
            )

            return {
                'content': message.get('content'),
                'reasoning_details': message.get('reasoning_details'),
                'citations': citations,
                'web_search_requests': web_search_requests,
            }

    except Exception as e:
        print(f"Error querying model {model}: {e}")
        return None


def _extract_citations(annotations: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """
    Pull url_citation annotations out of an assistant message and normalize them.

    Returns a list of {url, title, content} dicts. Empty list if none.
    """
    if not annotations:
        return []

    citations: List[Dict[str, Any]] = []
    for ann in annotations:
        if ann.get('type') != 'url_citation':
            continue
        cite = ann.get('url_citation') or {}
        url = cite.get('url')
        if not url:
            continue
        citations.append({
            'url': url,
            'title': cite.get('title') or url,
            'content': cite.get('content'),
        })
    return citations


async def query_models_parallel(
    models: List[str],
    messages: List[Dict[str, str]],
    enable_web_search: bool = False,
) -> Dict[str, Optional[Dict[str, Any]]]:
    """
    Query multiple models in parallel.

    Args:
        models: List of OpenRouter model identifiers
        messages: List of message dicts to send to each model
        enable_web_search: Forwarded to each per-model query.

    Returns:
        Dict mapping model identifier to response dict (or None if failed)
    """
    import asyncio

    tasks = [
        query_model(model, messages, enable_web_search=enable_web_search)
        for model in models
    ]
    responses = await asyncio.gather(*tasks)
    return {model: response for model, response in zip(models, responses)}

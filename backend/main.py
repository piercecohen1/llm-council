"""FastAPI backend for LLM Council."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uuid
import json
import asyncio

from . import storage
from .council import run_full_council, generate_conversation_title, stage1_collect_responses, stage2_collect_rankings, stage3_synthesize_final, calculate_aggregate_rankings
from .openrouter import list_openrouter_models
from .config import COUNCIL_MODELS as DEFAULT_COUNCIL_MODELS, CHAIRMAN_MODEL as DEFAULT_CHAIRMAN_MODEL

app = FastAPI(title="LLM Council API")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CreateConversationRequest(BaseModel):
    """Request to create a new conversation."""
    pass


class SendMessageRequest(BaseModel):
    """Request to send a message in a conversation."""
    content: str
    # Default True preserves prior behavior for any older frontend that omits the flag.
    enable_web_search: bool = True
    # When omitted, backend falls back to COUNCIL_MODELS / CHAIRMAN_MODEL from config.py.
    council_models: Optional[List[str]] = None
    chairman_model: Optional[str] = None
    # Map from model id -> OpenRouter `reasoning` config, e.g. `{"effort": "high"}`.
    # Models absent from the map use the provider default.
    reasoning_configs: Optional[Dict[str, Dict[str, Any]]] = None


class CouncilConfigRequest(BaseModel):
    """Request body for creating or updating a council config."""
    name: str
    council_models: List[str]
    chairman_model: str
    reasoning_configs: Dict[str, Dict[str, Any]] = {}


class ConversationMetadata(BaseModel):
    """Conversation metadata for list view."""
    id: str
    created_at: str
    title: str
    archived: bool = False
    message_count: int


class Conversation(BaseModel):
    """Full conversation with all messages."""
    id: str
    created_at: str
    title: str
    archived: bool = False
    messages: List[Dict[str, Any]]


class ArchiveRequest(BaseModel):
    """Request to toggle archive state on a conversation."""
    archived: bool


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "LLM Council API"}


@app.get("/api/models")
async def list_models(refresh: bool = False):
    """List available OpenRouter models (cached hourly)."""
    try:
        models = await list_openrouter_models(force_refresh=refresh)
        return {"data": models}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch models: {e}")


@app.get("/api/defaults")
async def get_defaults():
    """Return the default council + chair used when no config is selected."""
    return {
        "council_models": DEFAULT_COUNCIL_MODELS,
        "chairman_model": DEFAULT_CHAIRMAN_MODEL,
    }


def _validate_council_config(payload: CouncilConfigRequest):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="name is required")
    if not payload.council_models:
        raise HTTPException(status_code=400, detail="council_models must contain at least one model")
    if not payload.chairman_model.strip():
        raise HTTPException(status_code=400, detail="chairman_model is required")


@app.get("/api/council-configs")
async def list_council_configs():
    """List all saved council configs."""
    return storage.list_council_configs()


@app.post("/api/council-configs")
async def create_council_config(request: CouncilConfigRequest):
    """Save a new named council config."""
    _validate_council_config(request)
    return storage.create_council_config(
        name=request.name.strip(),
        council_models=request.council_models,
        chairman_model=request.chairman_model,
        reasoning_configs=request.reasoning_configs,
    )


@app.put("/api/council-configs/{config_id}")
async def update_council_config(config_id: str, request: CouncilConfigRequest):
    """Update an existing council config."""
    _validate_council_config(request)
    updated = storage.update_council_config(
        config_id,
        name=request.name.strip(),
        council_models=request.council_models,
        chairman_model=request.chairman_model,
        reasoning_configs=request.reasoning_configs,
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Council config not found")
    return updated


@app.delete("/api/council-configs/{config_id}")
async def delete_council_config(config_id: str):
    """Delete a council config."""
    ok = storage.delete_council_config(config_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Council config not found")
    return {"status": "ok"}


@app.get("/api/conversations", response_model=List[ConversationMetadata])
async def list_conversations():
    """List all conversations (metadata only)."""
    return storage.list_conversations()


@app.post("/api/conversations", response_model=Conversation)
async def create_conversation(request: CreateConversationRequest):
    """Create a new conversation."""
    conversation_id = str(uuid.uuid4())
    conversation = storage.create_conversation(conversation_id)
    return conversation


@app.get("/api/conversations/{conversation_id}", response_model=Conversation)
async def get_conversation(conversation_id: str):
    """Get a specific conversation with all its messages."""
    conversation = storage.get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@app.patch("/api/conversations/{conversation_id}/archive", response_model=ConversationMetadata)
async def set_archive_state(conversation_id: str, request: ArchiveRequest):
    """Archive or unarchive a conversation."""
    updated = storage.set_conversation_archived(conversation_id, request.archived)
    if updated is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {
        "id": updated["id"],
        "created_at": updated["created_at"],
        "title": updated.get("title", "New Conversation"),
        "archived": bool(updated.get("archived", False)),
        "message_count": len(updated.get("messages", [])),
    }


@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """Permanently delete a conversation."""
    ok = storage.delete_conversation(conversation_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "ok"}


@app.post("/api/conversations/{conversation_id}/message")
async def send_message(conversation_id: str, request: SendMessageRequest):
    """
    Send a message and run the 3-stage council process.
    Returns the complete response with all stages.
    """
    # Check if conversation exists
    conversation = storage.get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check if this is the first message
    is_first_message = len(conversation["messages"]) == 0

    # Add user message
    storage.add_user_message(conversation_id, request.content)

    # If this is the first message, generate a title
    if is_first_message:
        title = await generate_conversation_title(request.content)
        storage.update_conversation_title(conversation_id, title)

    # Run the 3-stage council process
    stage1_results, stage2_results, stage3_result, metadata = await run_full_council(
        request.content,
        enable_web_search=request.enable_web_search,
        council_models=request.council_models,
        chairman_model=request.chairman_model,
        reasoning_configs=request.reasoning_configs,
    )

    # Add assistant message with all stages
    storage.add_assistant_message(
        conversation_id,
        stage1_results,
        stage2_results,
        stage3_result
    )

    # Return the complete response with metadata
    return {
        "stage1": stage1_results,
        "stage2": stage2_results,
        "stage3": stage3_result,
        "metadata": metadata
    }


@app.post("/api/conversations/{conversation_id}/message/stream")
async def send_message_stream(conversation_id: str, request: SendMessageRequest):
    """
    Send a message and stream the 3-stage council process.
    Returns Server-Sent Events as each stage completes.
    """
    # Check if conversation exists
    conversation = storage.get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check if this is the first message
    is_first_message = len(conversation["messages"]) == 0

    async def event_generator():
        try:
            # Add user message
            storage.add_user_message(conversation_id, request.content)

            # Start title generation in parallel (don't await yet)
            title_task = None
            if is_first_message:
                title_task = asyncio.create_task(generate_conversation_title(request.content))

            # Stage 1: Collect responses
            yield f"data: {json.dumps({'type': 'stage1_start'})}\n\n"
            stage1_results = await stage1_collect_responses(
                request.content,
                enable_web_search=request.enable_web_search,
                council_models=request.council_models,
                reasoning_configs=request.reasoning_configs,
            )
            yield f"data: {json.dumps({'type': 'stage1_complete', 'data': stage1_results})}\n\n"

            # Stage 2: Collect rankings
            yield f"data: {json.dumps({'type': 'stage2_start'})}\n\n"
            stage2_results, label_to_model = await stage2_collect_rankings(
                request.content,
                stage1_results,
                council_models=request.council_models,
                reasoning_configs=request.reasoning_configs,
            )
            aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_model)
            yield f"data: {json.dumps({'type': 'stage2_complete', 'data': stage2_results, 'metadata': {'label_to_model': label_to_model, 'aggregate_rankings': aggregate_rankings}})}\n\n"

            # Stage 3: Synthesize final answer
            yield f"data: {json.dumps({'type': 'stage3_start'})}\n\n"
            stage3_result = await stage3_synthesize_final(
                request.content,
                stage1_results,
                stage2_results,
                enable_web_search=request.enable_web_search,
                chairman_model=request.chairman_model,
                reasoning_configs=request.reasoning_configs,
            )
            yield f"data: {json.dumps({'type': 'stage3_complete', 'data': stage3_result})}\n\n"

            # Wait for title generation if it was started
            if title_task:
                title = await title_task
                storage.update_conversation_title(conversation_id, title)
                yield f"data: {json.dumps({'type': 'title_complete', 'data': {'title': title}})}\n\n"

            # Save complete assistant message
            storage.add_assistant_message(
                conversation_id,
                stage1_results,
                stage2_results,
                stage3_result
            )

            # Send completion event
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"

        except Exception as e:
            # Send error event
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

"""JSON-based storage for conversations."""

import json
import os
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path
from .config import DATA_DIR

COUNCIL_CONFIGS_FILE = os.path.join(os.path.dirname(DATA_DIR), "council_configs.json")


def ensure_data_dir():
    """Ensure the data directory exists."""
    Path(DATA_DIR).mkdir(parents=True, exist_ok=True)


def get_conversation_path(conversation_id: str) -> str:
    """Get the file path for a conversation."""
    return os.path.join(DATA_DIR, f"{conversation_id}.json")


def create_conversation(conversation_id: str) -> Dict[str, Any]:
    """
    Create a new conversation.

    Args:
        conversation_id: Unique identifier for the conversation

    Returns:
        New conversation dict
    """
    ensure_data_dir()

    conversation = {
        "id": conversation_id,
        "created_at": datetime.utcnow().isoformat(),
        "title": "New Conversation",
        "archived": False,
        "messages": []
    }

    # Save to file
    path = get_conversation_path(conversation_id)
    with open(path, 'w') as f:
        json.dump(conversation, f, indent=2)

    return conversation


def get_conversation(conversation_id: str) -> Optional[Dict[str, Any]]:
    """
    Load a conversation from storage.

    Args:
        conversation_id: Unique identifier for the conversation

    Returns:
        Conversation dict or None if not found
    """
    path = get_conversation_path(conversation_id)

    if not os.path.exists(path):
        return None

    with open(path, 'r') as f:
        return json.load(f)


def save_conversation(conversation: Dict[str, Any]):
    """
    Save a conversation to storage.

    Args:
        conversation: Conversation dict to save
    """
    ensure_data_dir()

    path = get_conversation_path(conversation['id'])
    with open(path, 'w') as f:
        json.dump(conversation, f, indent=2)


def list_conversations(include_archived: bool = True) -> List[Dict[str, Any]]:
    """
    List all conversations (metadata only).

    Args:
        include_archived: If False, archived conversations are omitted. Default True
            so callers (e.g. the frontend) can partition client-side.

    Returns:
        List of conversation metadata dicts
    """
    ensure_data_dir()

    conversations = []
    for filename in os.listdir(DATA_DIR):
        if filename.endswith('.json'):
            path = os.path.join(DATA_DIR, filename)
            with open(path, 'r') as f:
                data = json.load(f)
                archived = bool(data.get("archived", False))
                if archived and not include_archived:
                    continue
                conversations.append({
                    "id": data["id"],
                    "created_at": data["created_at"],
                    "title": data.get("title", "New Conversation"),
                    "archived": archived,
                    "message_count": len(data["messages"])
                })

    # Sort by creation time, newest first
    conversations.sort(key=lambda x: x["created_at"], reverse=True)

    return conversations


def set_conversation_archived(conversation_id: str, archived: bool) -> Optional[Dict[str, Any]]:
    """
    Archive or unarchive a conversation. Returns the updated conversation or None.
    """
    conversation = get_conversation(conversation_id)
    if conversation is None:
        return None
    conversation["archived"] = bool(archived)
    save_conversation(conversation)
    return conversation


def delete_conversation(conversation_id: str) -> bool:
    """
    Permanently delete a conversation from disk. Returns True if it existed.
    """
    path = get_conversation_path(conversation_id)
    if not os.path.exists(path):
        return False
    os.remove(path)
    return True


def add_user_message(conversation_id: str, content: str):
    """
    Add a user message to a conversation.

    Args:
        conversation_id: Conversation identifier
        content: User message content
    """
    conversation = get_conversation(conversation_id)
    if conversation is None:
        raise ValueError(f"Conversation {conversation_id} not found")

    conversation["messages"].append({
        "role": "user",
        "content": content
    })

    save_conversation(conversation)


def add_assistant_message(
    conversation_id: str,
    stage1: List[Dict[str, Any]],
    stage2: List[Dict[str, Any]],
    stage3: Dict[str, Any]
):
    """
    Add an assistant message with all 3 stages to a conversation.

    Args:
        conversation_id: Conversation identifier
        stage1: List of individual model responses
        stage2: List of model rankings
        stage3: Final synthesized response
    """
    conversation = get_conversation(conversation_id)
    if conversation is None:
        raise ValueError(f"Conversation {conversation_id} not found")

    conversation["messages"].append({
        "role": "assistant",
        "stage1": stage1,
        "stage2": stage2,
        "stage3": stage3
    })

    save_conversation(conversation)


def _load_council_configs_file() -> List[Dict[str, Any]]:
    if not os.path.exists(COUNCIL_CONFIGS_FILE):
        return []
    with open(COUNCIL_CONFIGS_FILE, "r") as f:
        data = json.load(f)
    return data if isinstance(data, list) else []


def _save_council_configs_file(configs: List[Dict[str, Any]]):
    Path(os.path.dirname(COUNCIL_CONFIGS_FILE)).mkdir(parents=True, exist_ok=True)
    with open(COUNCIL_CONFIGS_FILE, "w") as f:
        json.dump(configs, f, indent=2)


def list_council_configs() -> List[Dict[str, Any]]:
    """Return all saved council configs."""
    return _load_council_configs_file()


def create_council_config(
    name: str,
    council_models: List[str],
    chairman_model: str,
    reasoning_configs: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Persist a new named council config and return it."""
    configs = _load_council_configs_file()
    config = {
        "id": str(uuid.uuid4()),
        "name": name,
        "council_models": council_models,
        "chairman_model": chairman_model,
        "reasoning_configs": reasoning_configs or {},
        "created_at": datetime.utcnow().isoformat(),
    }
    configs.append(config)
    _save_council_configs_file(configs)
    return config


def update_council_config(
    config_id: str,
    name: str,
    council_models: List[str],
    chairman_model: str,
    reasoning_configs: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Optional[Dict[str, Any]]:
    """Update an existing council config by id. Returns the updated config or None."""
    configs = _load_council_configs_file()
    for idx, cfg in enumerate(configs):
        if cfg.get("id") == config_id:
            cfg.update({
                "name": name,
                "council_models": council_models,
                "chairman_model": chairman_model,
                "reasoning_configs": reasoning_configs or {},
            })
            configs[idx] = cfg
            _save_council_configs_file(configs)
            return cfg
    return None


def delete_council_config(config_id: str) -> bool:
    """Remove a council config. Returns True if it existed."""
    configs = _load_council_configs_file()
    filtered = [c for c in configs if c.get("id") != config_id]
    if len(filtered) == len(configs):
        return False
    _save_council_configs_file(filtered)
    return True


def update_conversation_title(conversation_id: str, title: str):
    """
    Update the title of a conversation.

    Args:
        conversation_id: Conversation identifier
        title: New title for the conversation
    """
    conversation = get_conversation(conversation_id)
    if conversation is None:
        raise ValueError(f"Conversation {conversation_id} not found")

    conversation["title"] = title
    save_conversation(conversation)

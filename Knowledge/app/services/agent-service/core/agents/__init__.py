"""
Agent package – only the post-generation pipeline is imported from here now.
The LangGraph pipeline (agent_graph) replaces all orchestration and specialist
agent logic.
"""
from core.agents.orchestrator_v2 import run_post_generation_pipeline

__all__ = ["run_post_generation_pipeline"]

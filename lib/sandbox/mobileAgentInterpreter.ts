// Static Python interpreter shipped to E2B sandboxes for Mobile Agent execution.
// Accepts task + state via env vars, calls LLM, returns JSON to stdout.
// Hand-written for reliability — never use generated code for this.

export const MOBILE_AGENT_INTERPRETER = `
import os
import json
import requests

def call_llm(api_key, system, user):
    if not api_key:
        return "No API key provided for this environment."
    if api_key.startswith("gsk_"):
        resp = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": "llama-3.3-70b-versatile", "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user}
            ]},
            timeout=30
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
    elif api_key.startswith("sk-ant-"):
        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
            json={"model": "claude-haiku-4-5-20251001", "max_tokens": 1024,
                  "system": system, "messages": [{"role": "user", "content": user}]},
            timeout=30
        )
        resp.raise_for_status()
        return resp.json()["content"][0]["text"]
    elif api_key.startswith("AIza"):
        resp = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}",
            json={"contents": [{"parts": [{"text": f"{system}\\n\\n{user}"}]}]},
            timeout=30
        )
        resp.raise_for_status()
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
    else:
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": "gpt-4o-mini", "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user}
            ]},
            timeout=30
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

state = json.loads(os.environ.get("MOBILE_AGENT_STATE", "{}"))
task = os.environ.get("MOBILE_AGENT_TASK", "Complete the task")
api_key = os.environ.get("MOBILE_AGENT_API_KEY", "")
env_name = os.environ.get("MOBILE_AGENT_ENV_NAME", "Environment")

prior_results = state.get("results", {})
context_str = json.dumps(prior_results, indent=2) if prior_results else "No prior results"

system_prompt = f"You are a specialized compute agent running in environment: {env_name}. Complete the given task precisely and concisely. Use the provided context from prior migration steps."
user_message = f"Prior migration results:\\n{context_str}\\n\\nYour task: {task}"

result = call_llm(api_key, system_prompt, user_message)

state["results"] = prior_results
state["results"][env_name] = result

print(json.dumps({"output": result, "state": state}))
`.trim();

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SHARED_ENV="$ROOT_DIR/.env.shared"
AGENT_ENV="$ROOT_DIR/services/agent-service/.env"
KNOWLEDGE_ENV="$ROOT_DIR/services/knowledge-service/.env"

GEN_MODEL="gemini-2.5-flash"
EMBED_MODEL="gemini-embedding-2-preview"
API_BASE="https://generativelanguage.googleapis.com/v1beta/models"
TIMEOUT_SECONDS=20

if ! command -v curl >/dev/null 2>&1; then
  echo "[ERROR] curl is required but not found."
  exit 1
fi

extract_var() {
  local file="$1"
  local var_name="$2"

  if [[ ! -f "$file" ]]; then
    echo ""
    return 0
  fi

  local line
  line="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${var_name}=" "$file" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    echo ""
    return 0
  fi

  line="${line#export }"
  line="${line#${var_name}=}"

  # Trim comments if not quoted.
  if [[ "$line" != \"*\" && "$line" != \'.*\' ]]; then
    line="${line%%#*}"
  fi

  # Trim surrounding whitespace.
  line="$(printf '%s' "$line" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"

  # Remove matching surrounding quotes.
  if [[ "${line:0:1}" == '"' && "${line: -1}" == '"' ]]; then
    line="${line:1:${#line}-2}"
  elif [[ "${line:0:1}" == "'" && "${line: -1}" == "'" ]]; then
    line="${line:1:${#line}-2}"
  fi

  # Remove trailing CR from Windows line endings.
  line="${line%$'\r'}"

  printf '%s' "$line"
}

mask_key() {
  local key="$1"
  local len=${#key}
  if (( len <= 10 )); then
    printf '%s' "***"
    return
  fi
  printf '%s...%s' "${key:0:6}" "${key: -4}"
}

print_header() {
  echo "============================================================"
  echo "Gemini API Key Test"
  echo "Root: $ROOT_DIR"
  echo "Generation model: $GEN_MODEL"
  echo "Embedding model:  $EMBED_MODEL"
  echo "============================================================"
}

http_post_json() {
  local url="$1"
  local payload="$2"
  local body_file="$3"
  local code_file="$4"

  local code
  code="$(curl -sS --max-time "$TIMEOUT_SECONDS" \
    -X POST "$url" \
    -H 'Content-Type: application/json' \
    -d "$payload" \
    -o "$body_file" \
    -w '%{http_code}' || true)"
  printf '%s' "$code" >"$code_file"
}

extract_error_message() {
  local body_file="$1"
  local msg
  msg="$(grep -o '"message"[[:space:]]*:[[:space:]]*"[^"]*"' "$body_file" | head -n 1 | sed -E 's/^"message"[[:space:]]*:[[:space:]]*"(.*)"/\1/' || true)"
  if [[ -n "$msg" ]]; then
    printf '%s' "$msg"
  else
    printf '%s' "(no error message found)"
  fi
}

test_generation() {
  local key="$1"
  local body_file="$2"
  local code_file="$3"

  local url="${API_BASE}/${GEN_MODEL}:generateContent?key=${key}"
  local payload='{"contents":[{"parts":[{"text":"Reply with the single word: ok"}]}]}'
  http_post_json "$url" "$payload" "$body_file" "$code_file"
}

test_embedding() {
  local key="$1"
  local body_file="$2"
  local code_file="$3"

  local url="${API_BASE}/${EMBED_MODEL}:batchEmbedContents?key=${key}"
  local payload='{"requests":[{"model":"models/gemini-embedding-2-preview","content":{"parts":[{"text":"Jordan legal policy test"}]}}]}'
  http_post_json "$url" "$payload" "$body_file" "$code_file"
}

run_tests_for_env() {
  local label="$1"
  local env_file="$2"
  local key
  key="$(extract_var "$env_file" "GEMINI_API_KEY")"

  echo
  echo "[$label]"
  echo "Env file: $env_file"

  if [[ -z "$key" ]]; then
    echo "Key: MISSING"
    echo "Result: FAIL (GEMINI_API_KEY not found)"
    return
  fi

  echo "Key: $(mask_key "$key")"

  local gen_body gen_code emb_body emb_code
  gen_body="$(mktemp)"
  gen_code="$(mktemp)"
  emb_body="$(mktemp)"
  emb_code="$(mktemp)"

  test_generation "$key" "$gen_body" "$gen_code"
  test_embedding "$key" "$emb_body" "$emb_code"

  local gcode ecode
  gcode="$(cat "$gen_code")"
  ecode="$(cat "$emb_code")"

  if [[ "$gcode" == "200" ]]; then
    echo "Generation: PASS (HTTP 200)"
  else
    echo "Generation: FAIL (HTTP $gcode)"
    echo "Generation error: $(extract_error_message "$gen_body")"
  fi

  if [[ "$ecode" == "200" ]]; then
    echo "Embedding:  PASS (HTTP 200)"
  else
    echo "Embedding:  FAIL (HTTP $ecode)"
    echo "Embedding error: $(extract_error_message "$emb_body")"
  fi

  rm -f "$gen_body" "$gen_code" "$emb_body" "$emb_code"
}

compare_keys() {
  local shared_key agent_key knowledge_key
  shared_key="$(extract_var "$SHARED_ENV" "GEMINI_API_KEY")"
  agent_key="$(extract_var "$AGENT_ENV" "GEMINI_API_KEY")"
  knowledge_key="$(extract_var "$KNOWLEDGE_ENV" "GEMINI_API_KEY")"

  echo
  echo "[Comparison]"

  if [[ -n "$shared_key" && -n "$agent_key" && "$shared_key" != "$agent_key" ]]; then
    echo "shared vs agent: DIFFERENT"
  else
    echo "shared vs agent: same or unavailable"
  fi

  if [[ -n "$shared_key" && -n "$knowledge_key" && "$shared_key" != "$knowledge_key" ]]; then
    echo "shared vs knowledge: DIFFERENT"
  else
    echo "shared vs knowledge: same or unavailable"
  fi

  if [[ -n "$agent_key" && -n "$knowledge_key" && "$agent_key" != "$knowledge_key" ]]; then
    echo "agent vs knowledge: DIFFERENT"
  else
    echo "agent vs knowledge: same or unavailable"
  fi
}

print_header
run_tests_for_env "shared" "$SHARED_ENV"
run_tests_for_env "agent-service" "$AGENT_ENV"
run_tests_for_env "knowledge-service" "$KNOWLEDGE_ENV"
compare_keys

echo
echo "Done."

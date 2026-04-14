#!/usr/bin/env bash
set -euo pipefail

# End-to-end trace helper for one legal query.
# It sends the query to agent-service and dumps relevant logs from all backend services.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_DIR="$ROOT_DIR"
API_URL="${API_URL:-http://localhost:9200/query/stream}"
RETRIEVE_URL="${RETRIEVE_URL:-http://localhost:9100/retrieve}"
QUERY="${QUERY:-ما اهم مواد قانون تنظيم العمل المهني}"
LANG="${LANG:-ar}"
USER_TYPE="${USER_TYPE:-guest}"
USER_ID="${USER_ID:-debug-user}"
SESSION_ID="${SESSION_ID:-sess-trace-$(date +%s)}"
MODE="${MODE:-detailed}"
TRACE_MODE="${TRACE_MODE:-full}"
TOP_K="${TOP_K:-8}"
MIN_SCORE="${MIN_SCORE:-0.0}"
RETRIEVE_SECTOR="${RETRIEVE_SECTOR:-}"
RETRIEVE_DOC_TYPE="${RETRIEVE_DOC_TYPE:-}"
PRINT_FULL_LOGS="${PRINT_FULL_LOGS:-1}"

SERVICES=(agent-service knowledge-service governance-service workflow-service)

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] docker is required."
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "[ERROR] curl is required."
  exit 1
fi

iso_utc_now() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

extract_response_id() {
  local payload="$1"
  if command -v jq >/dev/null 2>&1; then
    local direct_id
    direct_id="$(printf '%s' "$payload" | jq -r '.response_id // empty' 2>/dev/null || true)"
    if [[ -n "$direct_id" ]]; then
      printf '%s' "$direct_id"
      return
    fi

    local metadata_json
    metadata_json="$(extract_sse_event_data "$payload" metadata | tail -n 1)"
    if [[ -n "$metadata_json" ]]; then
      local metadata_id
      metadata_id="$(printf '%s' "$metadata_json" | jq -r '.response_id // empty' 2>/dev/null || true)"
      if [[ -n "$metadata_id" ]]; then
        printf '%s' "$metadata_id"
        return
      fi
    fi

    local complete_json
    complete_json="$(extract_sse_event_data "$payload" complete | tail -n 1)"
    if [[ -n "$complete_json" ]]; then
      printf '%s' "$complete_json" | jq -r '.response_id // empty' 2>/dev/null || true
    fi
  else
    local direct_id
    direct_id="$(printf '%s' "$payload" | sed -n 's/.*"response_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
    if [[ -n "$direct_id" ]]; then
      printf '%s' "$direct_id"
      return
    fi

    local metadata_line
    metadata_line="$(extract_sse_event_data "$payload" metadata | head -n 1)"
    printf '%s' "$metadata_line" | sed -n 's/.*"response_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1
  fi
}

extract_sse_event_data() {
  local raw="$1"
  local event_name="$2"
  printf '%s\n' "$raw" | awk -v target="$event_name" '
    BEGIN { current = "" }
    /^event:[[:space:]]*/ {
      current = $0
      sub(/^event:[[:space:]]*/, "", current)
      next
    }
    /^data:[[:space:]]*/ {
      if (current == target) {
        data = $0
        sub(/^data:[[:space:]]*/, "", data)
        print data
      }
    }
  '
}

extract_stream_complete_payload() {
  local raw="$1"
  extract_sse_event_data "$raw" complete | tail -n 1
}

pretty_json() {
  local json="$1"
  if command -v jq >/dev/null 2>&1; then
    if printf '%s' "$json" | jq . >/dev/null 2>&1; then
      printf '%s' "$json" | jq .
    else
      printf '%s\n' "$json"
    fi
  else
    printf '%s\n' "$json"
  fi
}

get_visibility() {
  local user_type="${1:-guest}"
  case "$user_type" in
    admin)
      printf 'confidential'
      ;;
    employee)
      printf 'internal'
      ;;
    *)
      printf 'public'
      ;;
  esac
}

print_retrieved_text() {
  local json="$1"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$json" | jq -r '
      if (.results | length) == 0 then
        "(no chunks retrieved)"
      else
        .results[]
        | "-----\nscore=\(.score) | source=\(.source_name) | file=\(.filename) | page=\(.page) | chunk_id=\(.chunk_id)\n\(.text // "")"
      end
    '
  else
    printf '%s\n' "$json"
  fi
}

if [[ "$MODE" == "retrieval" || "$MODE" == "retrieval-only" || "$MODE" == "retrieval_only" ]]; then
  TRACE_MODE="retrieval-only"
  MODE="detailed"
fi

run_compose_logs() {
  local since_ts="$1"
  (cd "$COMPOSE_DIR" && docker compose logs --no-color --since "$since_ts" "${SERVICES[@]}" 2>&1 || true)
}

echo "============================================================"
echo "Trace: Professional Law Query"
echo "Compose dir : $COMPOSE_DIR"
echo "API URL     : $API_URL"
echo "Query       : $QUERY"
echo "Session ID  : $SESSION_ID"
echo "Mode        : $MODE"
echo "Trace mode  : $TRACE_MODE"
echo "============================================================"

START_TS="$(iso_utc_now)"

if [[ "$TRACE_MODE" == "retrieval-only" ]]; then
  VISIBILITY="$(get_visibility "$USER_TYPE")"

  if command -v jq >/dev/null 2>&1; then
    RETRIEVE_PAYLOAD="$(jq -n \
      --arg query "$QUERY" \
      --arg visibility "$VISIBILITY" \
      --argjson top_k "$TOP_K" \
      --argjson min_score "$MIN_SCORE" \
      --arg sector "$RETRIEVE_SECTOR" \
      --arg doc_type "$RETRIEVE_DOC_TYPE" \
      '{query: $query, top_k: $top_k, min_score: $min_score, visibility: $visibility}
       + (if $sector == "" then {} else {sector: $sector} end)
       + (if $doc_type == "" then {} else {doc_type: $doc_type} end)'
    )"
  else
    RETRIEVE_PAYLOAD=$(cat <<JSON
{"query":"$QUERY","top_k":$TOP_K,"min_score":$MIN_SCORE,"visibility":"$VISIBILITY"}
JSON
)
  fi

  echo
  echo "[1/2] Sending retrieval request"
  echo "Retrieve URL : $RETRIEVE_URL"
  echo "Visibility   : $VISIBILITY (from USER_TYPE=$USER_TYPE)"
  if [[ -n "$RETRIEVE_SECTOR" ]]; then
    echo "Sector filter: $RETRIEVE_SECTOR"
  fi
  if [[ -n "$RETRIEVE_DOC_TYPE" ]]; then
    echo "Doc filter   : $RETRIEVE_DOC_TYPE"
  fi

  RETRIEVE_RESPONSE="$(curl -sS -X POST "$RETRIEVE_URL" -H 'Content-Type: application/json' -d "$RETRIEVE_PAYLOAD")"

  echo
  echo "[2/2] Retrieved chunks (raw JSON)"
  pretty_json "$RETRIEVE_RESPONSE"

  echo
  echo "Retrieved text chunks"
  print_retrieved_text "$RETRIEVE_RESPONSE"

  echo
  echo "Done."
  exit 0
fi

REQUEST_PAYLOAD=$(cat <<JSON
{"query":"$QUERY","user_type":"$USER_TYPE","user_id":"$USER_ID","session_id":"$SESSION_ID","language":"$LANG","mode":"$MODE"}
JSON
)

echo
echo "[1/4] Sending request"
RAW_RESPONSE="$(curl -sS -X POST "$API_URL" -H 'Content-Type: application/json' -d "$REQUEST_PAYLOAD")"
COMPLETE_PAYLOAD="$(extract_stream_complete_payload "$RAW_RESPONSE")"

RESPONSE_ID="$(extract_response_id "$RAW_RESPONSE")"

echo
echo "[2/4] API response"
if [[ -n "$COMPLETE_PAYLOAD" ]]; then
  pretty_json "$COMPLETE_PAYLOAD"
else
  pretty_json "$RAW_RESPONSE"
fi

if [[ -z "$RESPONSE_ID" ]]; then
  echo
  echo "[WARN] response_id was not found in response; continuing with raw time-window logs."
fi

# Give services a moment to flush async logs (verification/audit)
sleep 2

echo
echo "[3/4] Collecting logs since $START_TS"
ALL_LOGS="$(run_compose_logs "$START_TS")"

if [[ "$PRINT_FULL_LOGS" == "1" ]]; then
  echo
  echo "---------------- FULL LOG DUMP (since request start) ----------------"
  printf '%s\n' "$ALL_LOGS"
  echo "---------------- END FULL LOG DUMP ---------------------------------"
fi

echo
echo "[4/4] Focused flow summary"
if [[ -n "$RESPONSE_ID" ]]; then
  echo
  echo "-- Agent trace by response_id: $RESPONSE_ID --"
  printf '%s\n' "$ALL_LOGS" | grep -F "$RESPONSE_ID" || echo "(no response_id-tagged lines found)"
fi

echo
echo "-- Retrieval and routing lines --"
printf '%s\n' "$ALL_LOGS" | grep -E "search_knowledge|Retrieved|Fallback retrieved|No chunks with sector|Embedding query|POST /retrieve|Fast-routed|dispatching son|generation:|verification|Confidence:|TIMING|POST /query(/stream)?" || echo "(no focused lines matched)"

echo
echo "Done."

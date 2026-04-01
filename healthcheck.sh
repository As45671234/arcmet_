#!/bin/bash
# ARCMET Health Check — отправляет алерт в Telegram при проблемах
# Настройка: задай TG_TOKEN и TG_CHAT_ID ниже или через env

TG_TOKEN="${TG_TOKEN:-}"
TG_CHAT_ID="${TG_CHAT_ID:-}"
BACKEND_URL="http://127.0.0.1:3001/health"
HOSTNAME_LABEL="$(hostname)"

# ─── helpers ──────────────────────────────────────────────────────────────────

send_tg() {
  local msg="$1"
  if [[ -z "$TG_TOKEN" || -z "$TG_CHAT_ID" ]]; then
    echo "[healthcheck] TG_TOKEN или TG_CHAT_ID не задан, алерт пропущен"
    return
  fi
  curl -s -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TG_CHAT_ID}" \
    --data-urlencode "text=${msg}" \
    --data-urlencode "parse_mode=HTML" \
    -o /dev/null
}

# ─── проверки ─────────────────────────────────────────────────────────────────

ERRORS=()

# 1. Backend health endpoint
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$BACKEND_URL")
if [[ "$HTTP_CODE" != "200" ]]; then
  ERRORS+=("Backend не отвечает (HTTP $HTTP_CODE на $BACKEND_URL)")
fi

# 2. PM2 процесс
PM2_STATUS=$(pm2 jlist 2>/dev/null | python3 -c "
import sys,json
procs=json.load(sys.stdin)
p=next((x for x in procs if x['name']=='arcmet-backend'),None)
print(p['pm2_env']['status'] if p else 'not_found')
" 2>/dev/null)
if [[ "$PM2_STATUS" != "online" ]]; then
  ERRORS+=("PM2 процесс arcmet-backend: $PM2_STATUS")
fi

# 3. Диск — алерт если занято больше 85%
DISK_USE=$(df / --output=pcent | tail -1 | tr -d ' %')
if [[ "$DISK_USE" -ge 85 ]]; then
  ERRORS+=("Диск заполнен на ${DISK_USE}%")
fi

# ─── отправка алерта если есть ошибки ────────────────────────────────────────

if [[ ${#ERRORS[@]} -gt 0 ]]; then
  MSG="🚨 <b>ARCMET ALERT</b> (${HOSTNAME_LABEL})%0A%0A"
  for ERR in "${ERRORS[@]}"; do
    MSG+="• ${ERR}%0A"
  done
  MSG+="%0A$(date '+%Y-%m-%d %H:%M:%S') UTC"
  send_tg "$MSG"
  echo "[healthcheck] ALERT отправлен: ${ERRORS[*]}"
  exit 1
else
  echo "[healthcheck] OK — $(date '+%H:%M:%S')"
  exit 0
fi

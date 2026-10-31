#!/usr/bin/env bash
# 타입캐스트 키별 남은 크레딧: bash scripts/tts-credits.sh  (키는 .env.local의 TYPECAST_API_KEYS 또는 TYPECAST_API_KEY)
cd "$(dirname "$0")/.."
set -a; [ -f .env.local ] && . ./.env.local; set +a
keys="${TYPECAST_API_KEYS:-$TYPECAST_API_KEY}"
[ -z "$keys" ] && { echo ".env.local에 TYPECAST_API_KEY(S)가 없어요"; exit 1; }
total=0
IFS=',' read -ra arr <<< "$keys"
for k in "${arr[@]}"; do
  k="$(echo "$k" | xargs)"
  r=$(curl -s https://api.typecast.ai/v1/users/me/subscription -H "X-API-KEY: $k")
  left=$(echo "$r" | python3 -c 'import json,sys
try:
  d=json.load(sys.stdin)["credits"]; print(d["plan_credits"]-d["used_credits"])
except Exception: print("?")')
  echo "키 ...${k: -4}: 남은 크레딧 $left"
  [[ "$left" =~ ^[0-9]+$ ]] && total=$((total + left))
done
echo "합계 약 $total (≈ 글자 수)"

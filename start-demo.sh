#!/bin/zsh
cd "$(dirname "$0")"
mkdir -p run
pkill -f "cloudflared tunnel" 2>/dev/null
lsof -ti tcp:8090 | xargs kill 2>/dev/null
sleep 1
DEMO=1 TRUST_PROXY=1 SECURE_COOKIES=1 HOST=127.0.0.1 nohup python3 server.py > run/server.log 2>&1 &
nohup cloudflared tunnel --no-autoupdate --url http://127.0.0.1:8090 > run/tunnel.log 2>&1 &
echo "Поднимаю ссылку..."
for i in {1..30}; do
  sleep 2
  if grep -q "Registered tunnel connection" run/tunnel.log; then
    URL=$(grep -o "https://[a-z0-9-]*\.trycloudflare\.com" run/tunnel.log | head -1)
    echo ""
    echo "Сайт:    $URL"
    echo "Админка: $URL/admin"
    echo "Доступ для клиники: deploy/demo-access.txt"
    echo ""
    echo "Ссылка работает, пока мак включён и не спит. Остановить: ./stop-demo.sh"
    caffeinate -i -w $(pgrep -f "cloudflared tunnel" | head -1) &
    exit 0
  fi
done
echo "Не получилось подключиться к Cloudflare. Если включён VPN (FortiClient), отключи его и запусти ещё раз."
grep -E "ERR" run/tunnel.log | tail -3

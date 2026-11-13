#!/bin/zsh
pkill -f "cloudflared tunnel" 2>/dev/null
lsof -ti tcp:8090 | xargs kill 2>/dev/null
echo "Демо-ссылка остановлена"

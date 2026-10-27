#!/usr/bin/env bash
#
# Развёртывание ARCMET на чистой Ubuntu 22.04.
#
# Писался после аварии 12.10.2026, когда повреждение ext4 на /dev/sda2 убило
# базу, а поднять сервис обратно оказалось нечем: резервных копий не было,
# документация расходилась с реальностью (другой репозиторий, другая ветка,
# другой путь к фронтенду). Поэтому здесь всё, что нужно для подъёма с нуля,
# и отдельным разделом — то, чего не хватало: swap, ротация логов, контроль
# места на диске, ежесуточный дамп базы.
#
# Запуск:
#   sudo bash provision.sh
#
# Данные восстанавливаются отдельно, скриптом restore-data.sh.

set -euo pipefail

REPO_URL="https://github.com/As45671234/arcmet_.git"
REPO_BRANCH="main"
APP_USER="ubuntu"
APP_DIR="/home/${APP_USER}/arcmet_"
WEB_ROOT="/var/www/arcmet"
DOMAIN="arcmet.kz"
BACKEND_PORT="3001"

log() { printf "\n\033[1;34m==> %s\033[0m\n" "$*"; }

if [[ $EUID -ne 0 ]]; then
  echo "Запускать через sudo" >&2
  exit 1
fi

# ----------------------------------------------------------------------------
# 1. Swap
#
# На машине 1 ГБ RAM. Swap был и до аварии, но на свежей системе его нет —
# без него сборка фронтенда (vite + esbuild) упирается в предел памяти.
# ----------------------------------------------------------------------------
log "Swap"
if ! swapon --show | grep -q swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "vm.swappiness=10" > /etc/sysctl.d/99-swappiness.conf
  sysctl -p /etc/sysctl.d/99-swappiness.conf >/dev/null
  echo "swap 2 ГБ подключён"
else
  echo "swap уже есть"
fi

# ----------------------------------------------------------------------------
# 2. Пакеты
# ----------------------------------------------------------------------------
log "Базовые пакеты"
apt-get update -qq
apt-get install -y -qq curl git gnupg ca-certificates ufw

log "Node.js 22"
# Не 18: mongoose@9, mongodb@7 и bson@7 требуют node >= 20.19.0.
# На 18 установка падает с EBADENGINE.
NODE_MAJOR=$(node --version 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/' || echo 0)
if [[ "${NODE_MAJOR:-0}" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
node --version

log "MongoDB 7.0"
if ! command -v mongod >/dev/null; then
  curl -fsSL https://pgp.mongodb.com/server-7.0.asc \
    | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
  echo "deb [arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
    > /etc/apt/sources.list.d/mongodb-org-7.0.list
  apt-get update -qq
  apt-get install -y -qq mongodb-org
fi

# На 1 ГБ RAM кэш WiredTiger по умолчанию забирает слишком много. Прижимаем,
# чтобы Node и nginx гарантированно получили своё.
#
# Проверка идёт именно по cacheSizeGB — то есть по ключу, который мы и
# вставляем. В первой версии здесь стояло wiredTigerCacheSizeGB, такого ключа
# в файле не появлялось никогда, поэтому каждый повторный запуск скрипта
# добавлял блок заново. После третьего запуска mongod отказался стартовать
# с «duplicate key: storage.wiredTiger.engineConfig.cacheSizeGB» и положил
# каталог 27.10.2026.
if ! grep -q 'cacheSizeGB' /etc/mongod.conf; then
  sed -i 's/^storage:/storage:\n  wiredTiger:\n    engineConfig:\n      cacheSizeGB: 0.25/' /etc/mongod.conf
fi
# Страховка на случай, если файл уже испорчен прошлыми прогонами.
if [ "$(grep -c 'cacheSizeGB' /etc/mongod.conf)" -gt 1 ]; then
  log "в mongod.conf несколько блоков cacheSizeGB, пересобираю файл"
  cp /etc/mongod.conf "/etc/mongod.conf.broken-$(date +%F-%H%M%S)"
  cat > /etc/mongod.conf <<'MONGOCONF'
storage:
  dbPath: /var/lib/mongodb
  wiredTiger:
    engineConfig:
      cacheSizeGB: 0.25

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

net:
  port: 27017
  bindIp: 127.0.0.1

processManagement:
  timeZoneInfo: /usr/share/zoneinfo
MONGOCONF
fi
systemctl enable --now mongod
systemctl is-active mongod

log "nginx и certbot"
apt-get install -y -qq nginx certbot python3-certbot-nginx

log "PM2"
npm install -g pm2@latest --silent

# ----------------------------------------------------------------------------
# 3. Код
# ----------------------------------------------------------------------------
log "Исходники: ${REPO_URL} (${REPO_BRANCH})"
if [[ ! -d "${APP_DIR}/.git" ]]; then
  sudo -u "${APP_USER}" git clone --branch "${REPO_BRANCH}" "${REPO_URL}" "${APP_DIR}"
else
  sudo -u "${APP_USER}" git -C "${APP_DIR}" fetch origin "${REPO_BRANCH}"
  sudo -u "${APP_USER}" git -C "${APP_DIR}" checkout "${REPO_BRANCH}"
  sudo -u "${APP_USER}" git -C "${APP_DIR}" pull origin "${REPO_BRANCH}"
fi

log "Зависимости бэкенда"
# npm ci строг и падает, если package-lock.json разошёлся с package.json.
# В репозитории сейчас именно так: sharp@0.33.5 есть в package.json, но его
# нет в lock-файле. Чиниться это должно пересборкой lock-файла и коммитом,
# а пока откатываемся на npm install, чтобы развёртывание не вставало.
sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}/backend' && \
  npm ci --omit=dev --no-audit --no-fund 2>/dev/null || { \
    echo 'ВНИМАНИЕ: package-lock.json рассинхронизирован, ставлю через npm install'; \
    npm install --omit=dev --no-audit --no-fund; }"

log "Сборка фронтенда"
# Фронтенд раздаётся nginx из ${WEB_ROOT}, а не из frontend/dist —
# в старой документации это было описано неверно.
sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}/frontend' && \
  { npm ci --no-audit --no-fund 2>/dev/null || npm install --no-audit --no-fund; } && \
  npm run build"
mkdir -p "${WEB_ROOT}"
rm -rf "${WEB_ROOT:?}/"*
cp -r "${APP_DIR}/frontend/dist/." "${WEB_ROOT}/"
chown -R www-data:www-data "${WEB_ROOT}"

# ----------------------------------------------------------------------------
# 4. nginx
#
# Против прежнего конфига добавлены две вещи, которых не хватало:
# client_max_body_size (иначе загрузка файлов упирается в дефолтный 1 МБ)
# и увеличенные таймауты на импорт Excel.
# ----------------------------------------------------------------------------
log "Конфигурация nginx"
cat > /etc/nginx/sites-available/${DOMAIN} <<NGINX
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${DOMAIN} www.${DOMAIN};

    root ${WEB_ROOT};
    index index.html;

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    gzip on;
    gzip_types text/css text/javascript application/javascript application/json image/svg+xml;
    gzip_min_length 1000;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # ^~ обязателен. Ниже есть регулярный location для кеширования статики,
    # а регулярные location в nginx приоритетнее префиксных — без ^~ запросы
    # вида /api/uploads/products/foo.jpeg уходят в него и отдают 404.

    # Импорт прайсов идёт долго и большими кусками.
    location ^~ /api/admin/import/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 300s;
        proxy_send_timeout    300s;
        proxy_read_timeout    300s;
        client_max_body_size  80m;
    }

    location ^~ /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 20m;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|webp|woff|woff2|ttf)\$ {
        expires 30d;
        add_header Cache-Control "public";
    }
}
NGINX

ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/${DOMAIN}
rm -f /etc/nginx/sites-enabled/default

# На этом шаге сертификатов ещё нет — они приезжают позже, с restore-data.sh.
# Поэтому nginx -t закономерно падает, и это не повод останавливать скрипт.
# Перечитать конфиг обязан restore-data.sh, после установки сертификатов.
if nginx -t 2>/dev/null; then
  systemctl reload nginx
  echo "конфигурация принята"
else
  echo "nginx пока не принимает конфиг (нет сертификатов) — это ожидаемо,"
  echo "перезапуск произойдёт в restore-data.sh"
fi

# ----------------------------------------------------------------------------
# 5. Запуск бэкенда
#
# ecosystem.config.js лежит в репозитории. Важен порядок: startup до save,
# иначе после перезагрузки PM2 поднимется с пустым списком — ровно это и
# случилось 12.10, когда бэкенд не вернулся сам.
# ----------------------------------------------------------------------------
log "PM2"
# Конфиг может отсутствовать в репозитории — он появился только после аварии.
# Скрипт не должен от этого падать, поэтому создаём на месте.
if [[ ! -f "${APP_DIR}/backend/ecosystem.config.js" ]]; then
  echo "ecosystem.config.js не найден в репозитории, создаю"
  cat > "${APP_DIR}/backend/ecosystem.config.js" <<ECOSYSTEM
module.exports = {
  apps: [
    {
      name: "arcmet-backend",
      script: "./src/server.js",
      cwd: "${APP_DIR}/backend",
      exec_mode: "fork",
      instances: 1,
      env: { NODE_ENV: "production", PORT: ${BACKEND_PORT} },
      max_memory_restart: "400M",
      autorestart: true,
      restart_delay: 5000,
      error_file: "/home/${APP_USER}/.pm2/logs/arcmet-backend-error.log",
      out_file: "/home/${APP_USER}/.pm2/logs/arcmet-backend-out.log",
      time: true,
      merge_logs: true,
      watch: false
    }
  ]
};
ECOSYSTEM
  chown "${APP_USER}:${APP_USER}" "${APP_DIR}/backend/ecosystem.config.js"
fi

sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}/backend' && pm2 start ecosystem.config.js --update-env || pm2 restart arcmet-backend"
env PATH=$PATH:/usr/bin pm2 startup systemd -u "${APP_USER}" --hp "/home/${APP_USER}" | tail -1 | bash || true
sudo -u "${APP_USER}" pm2 save

# ----------------------------------------------------------------------------
# 6. То, чего не было и что стоило нам аварии
# ----------------------------------------------------------------------------
log "Ротация логов"
# syslog разросся до 2.9 ГБ и забил диск на 92%.
cat > /etc/logrotate.d/arcmet <<'ROTATE'
/var/log/mongodb/mongod.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
    copytruncate
}
/home/ubuntu/.pm2/logs/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
    copytruncate
}
ROTATE
sed -i 's/^\(\s*rotate\s\+\)[0-9]\+/\17/' /etc/logrotate.d/rsyslog || true
journalctl --vacuum-size=200M >/dev/null 2>&1 || true
mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=200M\n' > /etc/systemd/journald.conf.d/size.conf
systemctl restart systemd-journald || true

log "Ежесуточный дамп базы"
mkdir -p /home/${APP_USER}/backups
cat > /usr/local/bin/arcmet-backup <<'BACKUP'
#!/usr/bin/env bash
# Бэкап arcmet.
#
# Дамп базы — каждую ночь, он весит ~42 КБ, храним 14 суток.
#
# Фотографии — отдельная история. Первая версия архивировала их тоже каждую
# ночь с хранением 7 суток: девять одинаковых архивов по 834 МБ забили диск
# на 89% и уронили сайт 27.10.2026. Фотографии меняются раз в месяц, когда
# приходит новый прайс, поэтому архивируем раз в неделю и держим две копии.
set -euo pipefail

DEST="/home/ubuntu/backups"
STAMP=$(date +%F)
UPLOADS_SRC="/home/ubuntu/arcmet_/backend"
MIN_FREE_KB=3145728   # 3 ГБ

mkdir -p "$DEST"

mongodump --db arcmet --archive="${DEST}/arcmet-${STAMP}.archive" --gzip --quiet
find "$DEST" -name 'arcmet-*.archive' -mtime +14 -delete

# Фотографии: только по воскресеньям и только если на диске есть запас.
if [ "$(date +%u)" = "7" ]; then
  FREE_KB=$(df -Pk / | awk 'NR==2 {print $4}')
  if [ "$FREE_KB" -lt "$MIN_FREE_KB" ]; then
    logger -t arcmet-backup "мало места на диске (${FREE_KB} КБ), архив фотографий пропущен"
  else
    tar czf "${DEST}/uploads-${STAMP}.tar.gz.part" -C "$UPLOADS_SRC" uploads
    mv "${DEST}/uploads-${STAMP}.tar.gz.part" "${DEST}/uploads-${STAMP}.tar.gz"
    # Оставляем две последние копии, считая по времени, а не по возрасту.
    ls -1t "$DEST"/uploads-*.tar.gz 2>/dev/null | tail -n +3 | xargs -r rm -f
  fi
fi
BACKUP
chmod +x /usr/local/bin/arcmet-backup
chown -R ${APP_USER}:${APP_USER} /home/${APP_USER}/backups
( crontab -l 2>/dev/null | grep -v arcmet-backup; echo "15 3 * * * /usr/local/bin/arcmet-backup" ) | crontab -

log "Контроль места на диске"
# Диск заполнился до 92% и никто этого не увидел.
#
# Одной записи в журнал оказалось мало: журнал никто не читает, и в октябре
# 2026 диск спокойно дошёл до 89%. Поэтому на критическом пороге скрипт сам
# сбрасывает лишние архивы фотографий — это единственное, что тут реально
# занимает место, и восстановить их можно из прайсов.
cat > /usr/local/bin/arcmet-diskcheck <<'DISK'
#!/usr/bin/env bash
set -uo pipefail

WARN=80
CRIT=90
STATE="/var/log/arcmet-disk.log"

USED=$(df -P / | awk 'NR==2 {print $5}' | tr -d '%')

if [ "$USED" -ge "$CRIT" ]; then
  logger -t arcmet-diskcheck "КРИТИЧНО: диск занят на ${USED}%, чищу старые архивы фотографий"
  ls -1t /home/ubuntu/backups/uploads-*.tar.gz 2>/dev/null | tail -n +2 | xargs -r rm -f
  USED=$(df -P / | awk 'NR==2 {print $5}' | tr -d '%')
  echo "$(date '+%F %T') КРИТИЧНО -> после чистки ${USED}%" >> "$STATE"
elif [ "$USED" -ge "$WARN" ]; then
  logger -t arcmet-diskcheck "диск занят на ${USED}%"
  echo "$(date '+%F %T') предупреждение: ${USED}%" >> "$STATE"
fi
DISK
chmod +x /usr/local/bin/arcmet-diskcheck
touch /var/log/arcmet-disk.log
( crontab -l 2>/dev/null | grep -v arcmet-diskcheck; echo "0 * * * * /usr/local/bin/arcmet-diskcheck" ) | crontab -

log "Файрвол"
ufw allow 22/tcp  >/dev/null
ufw allow 80/tcp  >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ufw status | head -6

log "ГОТОВО"
cat <<DONE

Дальше — восстановление данных:
    sudo bash restore-data.sh /путь/к/архивам

Проверка:
    pm2 status
    systemctl is-active mongod nginx
    curl -I https://${DOMAIN}
DONE

#!/usr/bin/env bash
#
# Восстановление данных ARCMET из резервной копии, снятой 13.10.2026
# с умирающего сервера.
#
# Запускать ПОСЛЕ provision.sh.
#
#   sudo bash restore-data.sh /home/ubuntu/restore
#
# В указанном каталоге ожидаются:
#   arcmet-mongodump.tar.gz   — база (128 товаров, 6 категорий, 11 заявок)
#   uploads.tar               — 1639 фотографий товаров и видео категорий
#   system-and-app.tar.gz     — /etc, сертификаты Let's Encrypt, .env

set -euo pipefail

SRC="${1:-}"
APP_USER="ubuntu"
APP_DIR="/home/${APP_USER}/arcmet_"
DOMAIN="arcmet.kz"

log() { printf "\n\033[1;34m==> %s\033[0m\n" "$*"; }

if [[ $EUID -ne 0 ]]; then
  echo "Запускать через sudo" >&2
  exit 1
fi

if [[ -z "${SRC}" || ! -d "${SRC}" ]]; then
  echo "Укажите каталог с архивами: sudo bash restore-data.sh /home/ubuntu/restore" >&2
  exit 1
fi

for f in arcmet-mongodump.tar.gz uploads.tar system-and-app.tar.gz; do
  [[ -f "${SRC}/${f}" ]] || { echo "Не найден ${SRC}/${f}" >&2; exit 1; }
done

STAGE=$(mktemp -d)
trap 'rm -rf "${STAGE}"' EXIT

# ----------------------------------------------------------------------------
# 1. Сертификаты Let's Encrypt
#
# Переносятся целиком: live/ — это симлинки на archive/, без него HTTPS
# не поднимется. renewal/ нужен, чтобы certbot продолжал продлевать сам.
# ----------------------------------------------------------------------------
log "Сертификаты"
# Архив мог быть собран как с путями etc/..., так и с ./etc/... — tar считает
# это разными шаблонами. Поэтому пробуем оба и не падаем, если не совпало.
tar xzf "${SRC}/system-and-app.tar.gz" -C "${STAGE}" etc/letsencrypt 2>/dev/null \
  || tar xzf "${SRC}/system-and-app.tar.gz" -C "${STAGE}" ./etc/letsencrypt 2>/dev/null \
  || tar xzf "${SRC}/system-and-app.tar.gz" -C "${STAGE}" 2>/dev/null \
  || true
if [[ -d "${STAGE}/etc/letsencrypt/live/${DOMAIN}" ]]; then
  cp -a "${STAGE}/etc/letsencrypt/." /etc/letsencrypt/
  chown -R root:root /etc/letsencrypt
  echo "сертификат ${DOMAIN} восстановлен, перевыпуск не нужен"
  openssl x509 -in "/etc/letsencrypt/live/${DOMAIN}/cert.pem" -noout -dates
else
  echo "ВНИМАНИЕ: сертификаты не найдены, потребуется: certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
fi

# ----------------------------------------------------------------------------
# 2. Переменные окружения
#
# .env никогда не был в git и существует только в этой копии.
# ----------------------------------------------------------------------------
log "Файлы .env"
tar xzf "${SRC}/system-and-app.tar.gz" -C "${STAGE}" \
  home/ubuntu/arcmet_/backend/.env home/ubuntu/arcmet_/frontend/.env.local 2>/dev/null \
  || tar xzf "${SRC}/system-and-app.tar.gz" -C "${STAGE}" \
       ./home/ubuntu/arcmet_/backend/.env ./home/ubuntu/arcmet_/frontend/.env.local 2>/dev/null \
  || true

if [[ -f "${STAGE}/home/ubuntu/arcmet_/backend/.env" ]]; then
  cp "${STAGE}/home/ubuntu/arcmet_/backend/.env" "${APP_DIR}/backend/.env"
  chown "${APP_USER}:${APP_USER}" "${APP_DIR}/backend/.env"
  chmod 600 "${APP_DIR}/backend/.env"
  echo "backend/.env восстановлен"
fi

if [[ -f "${STAGE}/home/ubuntu/arcmet_/frontend/.env.local" ]]; then
  cp "${STAGE}/home/ubuntu/arcmet_/frontend/.env.local" "${APP_DIR}/frontend/.env.local"
  chown "${APP_USER}:${APP_USER}" "${APP_DIR}/frontend/.env.local"
  echo "frontend/.env.local восстановлен"
fi

# ----------------------------------------------------------------------------
# 3. Загруженные файлы
#
# Единственное, что не воспроизводится ниоткуда: фотографии товаров.
# В Excel их нет, в git тоже.
# ----------------------------------------------------------------------------
log "Фотографии и видео"
tar xf "${SRC}/uploads.tar" -C "${APP_DIR}/backend/"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}/backend/uploads"
echo "файлов в products: $(find "${APP_DIR}/backend/uploads/products" -type f | wc -l)"

# ----------------------------------------------------------------------------
# 4. База
# ----------------------------------------------------------------------------
log "База данных"
systemctl is-active --quiet mongod || systemctl start mongod
tar xzf "${SRC}/arcmet-mongodump.tar.gz" -C "${STAGE}"
mongorestore --db arcmet --drop "${STAGE}/arcmet" --quiet

log "Проверка"
mongosh arcmet --quiet --eval '
  print("товаров:   " + db.products.countDocuments());
  print("категорий: " + db.categorymetas.countDocuments());
  print("заявок:    " + db.leads.countDocuments());
  print("заказов:   " + db.orders.countDocuments());
  print("настроек:  " + db.sitesettings.countDocuments());
'

log "Перезапуск nginx"
# Сертификаты появились только сейчас, поэтому до этого момента nginx работал
# без HTTPS-блока и не слушал 443.
if nginx -t 2>/dev/null; then
  systemctl restart nginx
  ss -lnt 2>/dev/null | grep -q ':443' && echo "443 слушается" || echo "ВНИМАНИЕ: 443 не слушается"
else
  nginx -t 2>&1 | tail -3
fi

log "Перезапуск бэкенда"
sudo -u "${APP_USER}" pm2 restart arcmet-backend --update-env || true
sleep 3
sudo -u "${APP_USER}" pm2 status

log "ГОТОВО"
cat <<DONE

Проверьте вручную:
    curl -s https://${DOMAIN}/api/catalog | head -c 200
    открыть https://${DOMAIN}/catalog — должно быть 128 товаров

Ожидаемые значения после восстановления:
    товаров 128, категорий 6, заявок 11, настроек 1
DONE

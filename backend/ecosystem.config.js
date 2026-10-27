// Конфигурация PM2 для бэкенда.
//
// До аварии 12.10.2026 этого файла не существовало: DEPLOYMENT.md предлагал
// создать его вручную, и он так и остался текстом в документации. Бэкенд
// запускали через `pm2 start npm`, а `pm2 startup` не настраивали — поэтому
// после перезагрузки PM2 не поднимался вовсе и сайт не возвращался сам.
//
// Запуск:  pm2 start ecosystem.config.js
// Автозапуск: pm2 startup systemd -u ubuntu --hp /home/ubuntu  (ДО pm2 save)

module.exports = {
  apps: [
    {
      name: "arcmet-backend",
      script: "./src/server.js",
      cwd: "/home/ubuntu/arcmet_/backend",

      // На сервере 1 CPU — кластер смысла не имеет, а памяти съедает вдвое.
      exec_mode: "fork",
      instances: 1,

      env: {
        NODE_ENV: "production",
        PORT: 3001
      },

      // Разбор прайсов вынесен в отдельный процесс (excelImportRunner.js),
      // поэтому основной процесс должен оставаться лёгким. Если он всё же
      // раздуется — перезапуск дешевле, чем OOM на машине с 1 ГБ.
      max_memory_restart: "400M",

      autorestart: true,
      // Без min_uptime и max_restarts: лимит попыток означает, что после
      // череды падений PM2 перестаёт поднимать процесс навсегда. Для сайта,
      // который должен работать без присмотра, это хуже бесконечных попыток.
      restart_delay: 5000,

      error_file: "/home/ubuntu/.pm2/logs/arcmet-backend-error.log",
      out_file: "/home/ubuntu/.pm2/logs/arcmet-backend-out.log",
      time: true,
      merge_logs: true,

      watch: false
    }
  ]
};

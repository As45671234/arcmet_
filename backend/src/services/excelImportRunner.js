
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { fork } = require("child_process");

const WORKER_PATH = path.join(__dirname, "excelImportWorker.js");

// Потолок кучи дочернего процесса. На машине с 1 ГБ RAM значение по умолчанию
// оставляет место под mongod и систему; при переезде на тариф пожирнее
// поднимается через переменную окружения.
const workerMaxMb = Math.max(128, Number(process.env.IMPORT_WORKER_MAX_MB || 512));
const workerTimeoutMs = Math.max(30000, Number(process.env.IMPORT_WORKER_TIMEOUT_MS || 300000));

// Разбирает .xlsx в отдельном процессе и возвращает массив товаров.
// Файл передаётся путём, а не буфером: копия на 90 МБ в памяти родителя —
// ровно то, от чего мы здесь уходим.
function runWorkbookImport({ filePath, filename, imagesDir, supplier, resolvedSupplierMeta, tmpDir }) {
  const dir = tmpDir || os.tmpdir();
  const token = crypto.randomBytes(8).toString("hex");
  const payloadPath = path.join(dir, `import-${token}.payload.json`);
  const outPath = path.join(dir, `import-${token}.out.json`);

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    payloadPath,
    JSON.stringify({ filePath, filename, imagesDir, supplier, resolvedSupplierMeta })
  );

  return new Promise((resolve, reject) => {
    const child = fork(WORKER_PATH, [payloadPath, outPath], {
      execArgv: [`--max-old-space-size=${workerMaxMb}`],
      stdio: ["ignore", "ignore", "pipe", "ipc"]
    });

    let stderr = "";
    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        if (stderr.length < 4000) stderr += String(chunk);
      });
    }

    let settled = false;

    const cleanup = () => {
      for (const p of [payloadPath, outPath]) {
        try {
          fs.unlinkSync(p);
        } catch (e) {
          // noop
        }
      }
    };

    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      fn(arg);
    };

    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch (e) {
        // noop
      }
      finish(reject, new Error(`разбор файла не уложился в ${Math.round(workerTimeoutMs / 1000)} с`));
    }, workerTimeoutMs);

    child.on("error", (err) => finish(reject, err));

    child.on("exit", (code, signal) => {
      if (settled) return;

      if (code === 0) {
        let products;
        try {
          products = JSON.parse(fs.readFileSync(outPath, "utf8"));
        } catch (e) {
          finish(reject, new Error("разбор завершился без результата"));
          return;
        }
        finish(resolve, products);
        return;
      }

      // V8 при исчерпании --max-old-space-size падает по SIGABRT, ядро при
      // нехватке памяти в системе — по SIGKILL. И то и другое для менеджера
      // значит одно: файл слишком тяжёлый для этой машины.
      const outOfMemory =
        signal === "SIGABRT" ||
        signal === "SIGKILL" ||
        /heap out of memory|allocation failed/i.test(stderr);

      if (outOfMemory) {
        finish(
          reject,
          new Error(
            `не хватило памяти на разбор файла (лимит ${workerMaxMb} МБ). ` +
            "Разделите прайс на части или увеличьте IMPORT_WORKER_MAX_MB."
          )
        );
        return;
      }

      const detail = stderr.trim() || (signal ? `процесс убит сигналом ${signal}` : `код выхода ${code}`);
      finish(reject, new Error(detail));
    });
  });
}

module.exports = { runWorkbookImport };

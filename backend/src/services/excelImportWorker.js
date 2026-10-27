
// Дочерний процесс для разбора Excel. Запускается через fork() из
// excelImportRunner.js с жёстким лимитом кучи V8.
//
// Зачем отдельный процесс: разбор крупного прайса (xlsx со встроенными
// картинками) — самая прожорливая операция в проекте. Когда она шла внутри
// основного процесса, нехватка памяти валила не импорт, а всю машину: ядро
// убивало mongod, sshd и системные службы. Теперь потолок памяти упирается
// в этот процесс, он умирает один, а backend возвращает внятную ошибку.

const fs = require("fs");
const { workbookToProducts } = require("./excelImport");

async function main() {
  const payloadPath = process.argv[2];
  const outPath = process.argv[3];

  if (!payloadPath || !outPath) {
    process.stderr.write("usage: excelImportWorker <payload.json> <out.json>\n");
    process.exit(2);
    return;
  }

  const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
  const buffer = fs.readFileSync(payload.filePath);

  const products = await workbookToProducts({
    buffer,
    filename: payload.filename,
    imagesDir: payload.imagesDir,
    supplier: payload.supplier,
    resolvedSupplierMeta: payload.resolvedSupplierMeta
  });

  fs.writeFileSync(outPath, JSON.stringify(products));
  process.exit(0);
}

main().catch((e) => {
  process.stderr.write(String(e && e.message ? e.message : e));
  process.exit(1);
});

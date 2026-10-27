
const mongoose = require("mongoose");

const RETRY_MIN_MS = 2000;
const RETRY_MAX_MS = 60000;

function isDbReady() {
  return mongoose.connection.readyState === 1;
}

// Подключается к MongoDB и не сдаётся.
//
// Раньше здесь была одна попытка, а вызывающий код при неудаче делал
// process.exit(1). Это означало, что любая недоступность базы — хоть на
// секунду — убивала backend до ручного вмешательства. Именно так сайт и
// простоял сутки 12.10.2026: mongod не поднялся, Node вышел, и поднимать
// его было некому.
async function connectDb(uri) {
  if (!uri) throw new Error("MONGODB_URI is required");

  mongoose.set("strictQuery", true);

  // Без буферизации: пока база недоступна, запросы должны падать сразу,
  // а не копиться в памяти и отваливаться по таймауту через 10 секунд.
  // Быстрый честный отказ лучше медленного невнятного.
  mongoose.set("bufferCommands", false);

  mongoose.connection.on("disconnected", () => console.warn("MongoDB: соединение потеряно"));
  mongoose.connection.on("reconnected", () => console.log("MongoDB: соединение восстановлено"));

  let delay = RETRY_MIN_MS;

  for (let attempt = 1; ; attempt++) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      console.log("MongoDB connected");
      return;
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      console.error(`MongoDB: попытка ${attempt} не удалась (${msg}), повтор через ${delay / 1000} с`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, RETRY_MAX_MS);
    }
  }
}

module.exports = { connectDb, isDbReady };

import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Look for .env in the root (3 levels up from dist/index.mjs)
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import app from "./app";
import { logger } from "./lib/logger";

if (!process.env.GEMINI_API_KEY) {
  logger.warn("GEMINI_API_KEY is not set in environment variables!");
} else {
  logger.info("GEMINI_API_KEY loaded successfully.");
}

const port = Number(process.env.PORT || "5000");


app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

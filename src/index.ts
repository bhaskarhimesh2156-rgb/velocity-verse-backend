import { createServer } from "http";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { setupSocketRelay } from "./lib/socketRelay.js";

const port = Number(process.env.PORT || 3001);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

const httpServer = createServer(app);
setupSocketRelay(httpServer);

httpServer.listen(port, () => {
  logger.info({ port }, "Velocity Verse backend listening");
});

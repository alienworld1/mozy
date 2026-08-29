import { loadWorkerEnvironment } from "./environment.js";

loadWorkerEnvironment();

await import("./runtime.js");

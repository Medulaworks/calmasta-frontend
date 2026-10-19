import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The integration test files share one disposable database and truncate it between tests,
    // so files must not run in parallel. The suite is fast enough that this costs little.
    fileParallelism: false,
  },
});

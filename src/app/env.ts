import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    MEMPOOL_URL: z.string().url(),
  },
  client: {},
  runtimeEnv: {
    MEMPOOL_URL: process.env.MEMPOOL_URL,
  },
});

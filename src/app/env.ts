import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    MEMPOOL_URL: z.string().url(),
    ORDISCAN_API_KEY: z.string().min(1),
    ORDISCAN_URL: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_BASE_URL: z.string().url(),
  },
  runtimeEnv: {
    MEMPOOL_URL: process.env.MEMPOOL_URL,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    ORDISCAN_API_KEY: process.env.ORDISCAN_API_KEY,
    ORDISCAN_URL: process.env.ORDISCAN_URL,
  },
});

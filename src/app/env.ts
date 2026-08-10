import { z } from "zod";

export const env = z
  .object({
    MEMPOOL_URL: z.string().url(),
    NEXT_PUBLIC_BASE_URL: z.string().url(),
    ORDISCAN_API_KEY: z.string().min(1),
    ORDISCAN_URL: z.string().min(1),
  })
  .parse(process.env);

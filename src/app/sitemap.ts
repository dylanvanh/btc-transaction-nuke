import { env } from "./env";
import { type MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = env.NEXT_PUBLIC_BASE_URL;

  return [
    {
      url: `${baseUrl}/`,
    },
  ];
} 
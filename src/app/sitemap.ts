import { env } from "./env";
import { type MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${env.NEXT_PUBLIC_BASE_URL}/`,
    },
  ];
}

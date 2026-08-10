const API_TIMEOUT_10_SECONDS_MS = 10_000;

export const fetchApi = async (
  url: string,
  init?: RequestInit,
): Promise<Response> => {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(API_TIMEOUT_10_SECONDS_MS),
  });

  if (!response.ok) {
    throw new Error((await response.text()) || response.statusText);
  }

  return response;
};

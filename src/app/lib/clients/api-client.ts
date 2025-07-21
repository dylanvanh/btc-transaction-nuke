import axios, { AxiosInstance, AxiosRequestConfig } from "axios";

abstract class ApiClient {
  protected api: AxiosInstance;

  protected constructor(baseURL: string, config: AxiosRequestConfig = {}) {
    this.api = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
      ...config,
    });
  }

  protected updateBaseUrl(newBaseUrl: string): void {
    this.api.defaults.baseURL = newBaseUrl;
  }
}

export default ApiClient;


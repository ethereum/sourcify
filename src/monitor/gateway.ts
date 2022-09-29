import { SourceOrigin } from "./util";

export declare interface IGateway {
  worksWith: (origin: SourceOrigin) => boolean;
  createUrl: (fetchId: string) => string;
  createFallbackUrl: (fetchId: string) => string;
  baseUrl: string;
  fallbackUrl?: string;
}

export class SimpleGateway implements IGateway {
  private origins: SourceOrigin[];
  baseUrl: string;
  fallbackUrl: string; // A backup gateway in case the local ipfs node fails.

  constructor(
    origins: SourceOrigin | SourceOrigin[],
    baseUrl: string,
    fallbackUrl?: string
  ) {
    this.origins = [].concat(origins);
    this.baseUrl = baseUrl;
    if (fallbackUrl) this.fallbackUrl = fallbackUrl;
  }

  worksWith(origin: SourceOrigin): boolean {
    return this.origins.includes(origin);
  }

  createUrl(fetchId: string): string {
    return this.baseUrl + fetchId;
  }

  createFallbackUrl(fetchId: string): string {
    return this.fallbackUrl && this.fallbackUrl + fetchId;
  }
}

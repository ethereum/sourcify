import { SourceOrigin } from "./util";

export declare interface IGateway {
    worksWith: (origin: SourceOrigin) => boolean;
    createUrl: (fetchId: string) => string;
}

export class SimpleGateway implements IGateway {
    private origins: SourceOrigin[];
    private baseUrl: string;

    constructor(origins: SourceOrigin | SourceOrigin[], baseUrl: string) {
        this.origins = [].concat(origins);
        this.baseUrl = baseUrl;
    }

    worksWith(origin: SourceOrigin): boolean {
        return this.origins.includes(origin);
    }

    createUrl(fetchId: string): string {
        return this.baseUrl + fetchId;
    }
}
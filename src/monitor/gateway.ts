import { SourceOrigin } from "./util";

export declare interface IGateway {
    worksWith: (origin: SourceOrigin) => boolean;
    createUrl: (fetchId: string) => string;
    baseUrl: string;
}

export class SimpleGateway implements IGateway {
    private origins: SourceOrigin[];
    baseUrl: string;

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
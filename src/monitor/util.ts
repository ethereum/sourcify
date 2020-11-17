import Web3 from "web3";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const multihashes = require("multihashes");

export type SourceOrigin = "ipfs" | "bzzr1" | "bzzr0";

export type FetchedFileCallback= (fetchedFile: string) => any;

interface Prefix {
    regex: RegExp,
    origin: SourceOrigin
}

const PREFIXES: Prefix[] = [
    { origin: "ipfs", regex: /dweb:\/ipfs\/{1,2}/ },
    { origin: "bzzr1", regex: /bzz-raw:\/{1,2}/ }
];

interface CborProcessor {
    origin: SourceOrigin,
    process: (bytes: number[]) => string
}

const CBOR_PROCESSORS: CborProcessor[] = [
    { origin: "ipfs", process: multihashes.toB58String },
    { origin: "bzzr0", process: (data) => Web3.utils.bytesToHex(data).slice(2) },
    { origin: "bzzr1", process: (data) => Web3.utils.bytesToHex(data).slice(2) }
]

export class SourceAddress {
    origin: SourceOrigin;
    id: string;

    constructor(origin: SourceOrigin, id: string) {
        this.origin = origin;
        this.id = id;
    }

    getUniqueIdentifier(): string {
        return this.origin + "-" + this.id;
    }

    static fromUrl(url: string): SourceAddress {
        for (const prefix of PREFIXES) {
            const attempt = url.replace(prefix.regex, "");
            if (attempt !== url) {
                return new SourceAddress(prefix.origin, attempt);
            }
        }

        return null;
    }

    static fromCborData(cborData: any): SourceAddress {
        for (const cborProcessor of CBOR_PROCESSORS) {
            const bytes = cborData[cborProcessor.origin];
            if (bytes) {
                const metadataId = cborProcessor.process(bytes);
                return new SourceAddress(cborProcessor.origin, metadataId);
            }
        }

        const msg = `Unsupported metadata file format: ${Object.keys(cborData)}`;
        throw new Error(msg);
    }
}
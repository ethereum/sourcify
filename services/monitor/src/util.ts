export type SourceOrigin = "ipfs" | "bzzr1" | "bzzr0";

export type FetchedFileCallback = (fetchedFile: string) => any;

interface Prefix {
  regex: RegExp;
  origin: SourceOrigin;
}

const PREFIXES: Prefix[] = [
  { origin: "ipfs", regex: /dweb:\/ipfs\/{1,2}/ },
  { origin: "bzzr1", regex: /bzz-raw:\/{1,2}/ },
];

const CBOR_SOURCES: SourceOrigin[] = ["ipfs", "bzzr0", "bzzr1"];

export class SourceAddress {
  origin: SourceOrigin;
  id: string;

  constructor(origin: SourceOrigin, id: string) {
    this.origin = origin;
    this.id = id;
  }

  /**
   * @returns a unique identifier of this source address of format ipfs-QmawU3NM1WNWkBauRudYCiFvuFE1tTLHB98akyBvb9UWwA
   */
  getSourceHash(): string {
    return this.origin + "-" + this.id;
  }

  static fromUrl(url: string): SourceAddress | null {
    for (const prefix of PREFIXES) {
      const hash = url.replace(prefix.regex, "");
      if (hash !== url) {
        return new SourceAddress(prefix.origin, hash);
      }
    }
    return null;
  }

  static fromCborData(cborData: any): SourceAddress {
    for (const cborSource of CBOR_SOURCES) {
      const metadataId = cborData[cborSource];
      if (metadataId) {
        return new SourceAddress(cborSource, metadataId);
      }
    }

    const msg = `Unsupported metadata file format: ${Object.keys(cborData)}`;
    throw new Error(msg);
  }
}

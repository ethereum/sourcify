import { SourceMap } from './ValidationService';
import { StringMap } from 'sourcify-core';

const STANDARD_JSON_SETTINGS_KEYS = [
        "stopAfter", "remappings", "optimizer", "evmVersion", "debug", "metadata", "libraries", "outputSelection"
];

/**
 * Abstraction of a checked solidity contract. With metadata and source (solidity) files.
 * The info property contains the information about compilation or errors encountered while validating the metadata.
 */
export default class CheckedContract {
    /** Object containing contract metadata keys and values. */
    metadata: any;

    /** SourceMap mapping the original compilation path to PathContent. */
    solidity: StringMap;

    /** Object containing the information about missing source files. */
    missing: any;

    /** Contains the invalid source files. */
    invalid: StringMap;

    /**
     * Contains the message about compilation or errors encountered while validating the metadata.
     * Should be without a trailing newline.
     */
    info: string;

    /** Object containing input for solc when used with the --standard-json flag. */
    standardJson: any;

    /** The path of the contract during compile-time. */
    compiledPath: string;

    /** The name of the contract. */
    name: string;

    /** Checks whether this contract is valid or not.
     * @returns true if no sources are missing or are invalid (malformed); false otherwise
     */
    public isValid(): boolean {
        return isEmpty(this.missing) && isEmpty(this.invalid);
    }

    private sourceMapToStringMap(input: SourceMap) {
        const ret: StringMap = {};
        for (const key in input) {
            ret[key] = input[key].content;
        }
        return ret;
    }

    public constructor(metadata: any, solidity: SourceMap, missing: any, invalid: StringMap) {
        this.metadata = JSON.parse(JSON.stringify(metadata));
        this.solidity = this.sourceMapToStringMap(solidity);
        this.missing = missing;
        this.invalid = invalid;

        const sources = this.metadata.sources;
        for (const compiledPath in sources) {
            const metadataSource = sources[compiledPath];
            const foundSource = solidity[compiledPath];
            if (!metadataSource.content && foundSource) {
                metadataSource.content = foundSource.content;
            }
            delete metadataSource.license;
        }

        const { contractPath, contractName } = this.getPathAndName();
        this.compiledPath = contractPath;
        this.name = contractName;

        this.info = this.isValid() ? this.composeSuccessMessage() : this.composeErrorMessage();
    }

    /**
     * Returns the contract path and name as specified in the metadata provided during construction.
     */
    private getPathAndName() {
        const compilationTarget = this.metadata.settings.compilationTarget;
        const contractPath = Object.keys(compilationTarget)[0];
        const contractName = compilationTarget[contractPath];
        return { contractPath, contractName };
    }

    /**
     * Returns a JSON object compatible with solc --standard-json.
     * 
     * @param useOriginalSettings If true, the returned object will contain settings as specified
     * during the original compilation; otherwise no settings will be imposed.
     */
    public getStandardJson(useOriginalSettings: boolean = true) {
        const standardJson: any = {
            language: "Solidity",
            sources: this.metadata.sources
        };

        if (useOriginalSettings && this.metadata.settings) {
            standardJson.settings = {};
            standardJson.settings.outputSelection = { "*": { "*": [ "evm.bytecode", "abi" ] } };
            for (const key of STANDARD_JSON_SETTINGS_KEYS) {
                if (this.metadata.settings.hasOwnProperty(key)) {
                    standardJson.settings[key] = this.metadata.settings[key];
                }
            }
        }

        return standardJson;
    }

    /**
     * Constructs the message to be displayed in case of a successful finding
     * of source files related to the provided metadata file.
     */
    private composeSuccessMessage(): string {
        const compilerVersionDetailed = this.metadata.compiler.version;
        const compilerVersion = compilerVersionDetailed.split("+")[0];
        const msgLines: string[] = [];
        msgLines.push(`${this.name} (${this.compiledPath}):`);
        msgLines.push("  Success!");
        msgLines.push(`  Compiled with Solidity ${compilerVersion}`);
        msgLines.push(`  https://solc-bin.ethereum.org/wasm/soljson-v${compilerVersionDetailed}.js`);
        msgLines.push(`  https://solc-bin.ethereum.org/linux-amd64/solc-linux-amd64-v${compilerVersionDetailed}`);
        return msgLines.join("\n");
    }

    /**
     * Constructs the message to be displayed in case the contract is not valid.
     * The structure of the message is as follows:
     * 
     * path: name
     * 
     *   missing sources
     * 
     *   invalid sources
     * 
     *   number of found sources
     */
    private composeErrorMessage(): string {
        const msgLines: string[] = [];
        msgLines.push(`${this.name} (${this.compiledPath}):`);

        if (!isEmpty(this.missing)) {
            msgLines.push("  Error: Missing sources:");
            msgLines.push("  The following files were not provided (or were altered, so their hash doesn't match the one in the metadata).");
            msgLines.push("  Please retrieve the files (potentially via ipfs) and re-run the script.");
        }

        for (const missingSourceName in this.missing) {
            msgLines.push(`    ${missingSourceName}:`);
            const missingSourceProps = this.missing[missingSourceName];
            for (const prop in missingSourceProps) {
                const propValue = missingSourceProps[prop];
                if (Array.isArray(propValue)) {
                    propValue.forEach((elem: string) => {
                        msgLines.push(`      ${elem}`);
                    });
                } else {
                    msgLines.push(`      ${prop}: ${propValue}`);
                }
            }
        }

        if (!isEmpty(this.invalid)) {
            msgLines.push("  Error: Invalid sources:");
        }

        for (const invalidSourceName in this.invalid) {
            msgLines.push(`    ${invalidSourceName}:`);
            msgLines.push(`      ${this.invalid[invalidSourceName]}`);
        }

        const foundSourcesNumber = Object.keys(this.solidity).length;
        if (foundSourcesNumber) {
            msgLines.push(`  ${foundSourcesNumber} other source files found successfully.`);
        }

        return msgLines.join("\n");
    }
}

/**
 * Checks whether the provided object contains any keys or not.
 * @param obj The object whose emptiness is tested.
 * @returns true if any keys present; false otherwise
 */
function isEmpty(obj: object): boolean {
    return !Object.keys(obj).length;
}
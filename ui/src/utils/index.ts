import {CHAIN_OPTIONS as chainOptions} from "../common/constants";

export const getChainIds = (): string => {
    const chainsIdsArray: string[] = chainOptions.reduce((acc, cur) => {
        return [...acc, cur.id];
    }, []);

    return chainsIdsArray.join(',');
}
export type GlobalState = {
    notification: {
        isActive: boolean,
        content: any,
        type?: "default" | "error" | "success"
    }
}

export type GlobalStateActions = {
    type: "SHOW_NOTIFICATION" | "REMOVE_NOTIFICATION",
    payload?: any
}

export type VerifierState = {
    loading: boolean,
    address: string,
    chain: Chain | {},
    sourcifyChainMap: ChainMap,
    sourcifyChains: Chain[] | [],
    files: [],
    incorrectAddresses: object,
    isValidationError: boolean,
    verifyAddressLoading: boolean,
    chosenContract?: number,
    contractsToChoose?: ContractToChoose[];
}

export type VerifierActions = {
    type: "SET_ADDRESS" | "SET_CHAIN" | "SET_SOURCIFY_CHAIN_MAP" | "SET_SOURCIFY_CHAINS" | "SET_FILES" | "CLEAR_FILES" | "SET_LOADING" | "SET_INCORRECT_ADDRESSES" |
        "SET_IS_VALIDATION_ERROR" | "SET_VERIFY_ADDRESS_LOADING" | "SET_CHOSEN_CONTRACT" | "SET_CONTRACTS_TO_CHOOSE",
    payload?: any
}

export type ContractToChoose = {
    path: string,
    name: string
}


export type Chain = {
  name: string,
  title?: string, // Longer name for some networks
  chainId: number,
  shortName: string,
  network: string,
  networkId: number,
  supported?: boolean,
  monitored?: boolean
};

export type ChainMap = {
    [id: number]: Chain 
}
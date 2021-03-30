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
    chain: any,
    files: [],
    incorrectAddresses: object,
    isValidationError: boolean,
    verifyAddressLoading: boolean
}

export type VerifierActions = {
    type: "SET_ADDRESS" | "SET_CHAIN" | "SET_FILES" | "CLEAR_FILES" | "SET_LOADING" | "SET_INCORRECT_ADDRESSES" |
        "SET_IS_VALIDATION_ERROR" | "SET_VERIFY_ADDRESS_LOADING",
    payload?: any
}
export type VerifierState = {
    address: string,
    files: []
}

export type VerifierActions = {
    type: "SET_ADDRESS" | "SET_FILES" | "CLEAR_FILES",
    payload?: any
}
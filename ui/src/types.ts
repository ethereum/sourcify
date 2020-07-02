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
    address: string,
    files: []
}

export type VerifierActions = {
    type: "SET_ADDRESS" | "SET_FILES" | "CLEAR_FILES",
    payload?: any
}
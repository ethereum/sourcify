import {VerifierActions, VerifierState} from "../types";

export const verifierReducer = (state: VerifierState, action: VerifierActions) => {
    switch (action.type) {
        case "SET_ADDRESS":
            return {
                ...state,
                address: action.payload
            };
        case "SET_CHAIN":
            return {
                ...state,
                chain: action.payload
            }
        case "SET_FILES":
            return {
                ...state,
                files: [...state.files, ...action.payload]
            };
        case "CLEAR_FILES":
            return {
                ...state,
                files: []
            };
        case "SET_LOADING":
            return {
                ...state,
                loading: action.payload
            };
        default:
            return state;
    }
}
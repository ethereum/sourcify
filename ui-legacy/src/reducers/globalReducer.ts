import {GlobalState, GlobalStateActions} from "../types";

export const globalReducer = (state: GlobalState, action: GlobalStateActions) => {
    switch (action.type) {
        case "SHOW_NOTIFICATION":
            return {
                ...state,
                notification: {
                    isActive: true,
                    content: action.payload.content,
                    type: action.payload.type || "default"
                }
            };
        case "REMOVE_NOTIFICATION":
            return {
                ...state,
                notification: {
                    isActive: false,
                    content: "",
                    type: ""
                }
            }
        default:
            return state;
    }
}
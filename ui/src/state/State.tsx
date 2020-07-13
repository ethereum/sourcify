import React, {createContext, useContext, useReducer} from "react";
import {createPortal} from "react-dom";
import Notification from "../components/Notification";
import {GlobalState, GlobalStateActions} from "../types";
import {globalReducer} from "../reducers/globalReducer";

const initialState: GlobalState = {
    notification: {
        isActive: false,
        content: "",
        type: "default"
    }
}

const StateContext = createContext<GlobalState>(initialState);
const DispatchContext = createContext((() => {
}) as React.Dispatch<GlobalStateActions>)


export const StateProvider: React.FC = ({children}) => {
    const [state, dispatch] = useReducer(globalReducer, initialState);

    return (
        <DispatchContext.Provider value={dispatch}>
            <StateContext.Provider value={state}>
                {children}
                {state.notification.isActive && createPortal(<Notification/>, document.body)}
            </StateContext.Provider>
        </DispatchContext.Provider>
    )
}

export const useGlobalStateContext = () => useContext(StateContext);
export const useDispatchContext = () => useContext(DispatchContext);
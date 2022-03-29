import React from "react";
import { useDispatchContext, useGlobalStateContext } from "../state/State";
import { CheckCircleIcon, XCircleIcon, XIcon } from "./icons";

const Notification: React.FC = () => {
    const globalState = useGlobalStateContext();
    const dispatch = useDispatchContext();

    const handleOnClose = () => {
        dispatch({ type: "REMOVE_NOTIFICATION" });
    };

    return (
        <div
            className={`notification notification--${globalState.notification.type}`}>
            <div className="notification__content">
                {
                    globalState.notification.type === "error" &&
                    <XCircleIcon/> || globalState.notification.type === "success" && <CheckCircleIcon/>
                }
                {
                    typeof globalState.notification.content === "string" ?
                        <p>{globalState.notification.content}</p> : globalState.notification.content()
                }
                <span role="button" onClick={handleOnClose}>
                  <XIcon/>
                </span>
            </div>
        </div>
    )
}

export default Notification;
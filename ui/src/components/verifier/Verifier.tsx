import React, {useReducer} from "react";
import {FileUpload, AddressInput} from "./form";
import {verifierReducer} from "../../reducers/verifierReducer";
import {VerifierState} from "../../types";

const Verifier: React.FC = () => {
    const initialState: VerifierState = {
        address: "",
        files: []
    }

    const [state, dispatch] = useReducer(verifierReducer, initialState);

    const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch(
            {type: "SET_ADDRESS", payload: e.target.value}
        )
    }

    const handleFiles = (files: []) => {
        dispatch(
            {type: "SET_FILES", payload: files}
        )
    }

    const clearFiles = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
        event.preventDefault();
        dispatch(
            {type: "CLEAR_FILES"}
        );
    }

    const onSubmit = () => {
        //TODO
        console.log("SUBMIT")
    }


    return (
        <form className="form" onSubmit={onSubmit}>
            <AddressInput onChange={handleAddressChange}/>
            {
                state.files.length > 0 && <div className="form__file-upload-header">
                    <span>FILES ({state.files.length})</span>
                    <button onClick={clearFiles}>CLEAR ALL</button>
                </div>
            }
            <FileUpload handleFiles={handleFiles} files={state.files}/>
            <button type="submit" className="form__submit-btn">VERIFY</button>
        </form>
    )
}

export default Verifier;
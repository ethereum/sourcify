import React, {useReducer} from "react";
import {verifierReducer} from "../../reducers/verifierReducer";
import {VerifierState} from "../../types";
import {CHAIN_OPTIONS as chainOptions} from "../../common/constants";
import {FileUpload, AddressInput} from "./form";
import Dropdown from "../Dropdown";
import LoadingOverlay from "../LoadingOverlay";

const initialState: VerifierState = {
    loading: false,
    address: "",
    files: []
}

const Verifier: React.FC = () => {
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

    const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        //TODO
        event.preventDefault();
        console.log("SUBMIT");
    }

    return (
        <div className="form-container">
            {state.loading && <LoadingOverlay/>}
            <div className="form-container__header">
                <h3>VERIFIER</h3>
            </div>
            <div className="form-container__middle">
                <form className="form" onSubmit={onSubmit}>
                    <Dropdown items={chainOptions} initialValue={chainOptions[0]}/>
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
            </div>
        </div>
    )
}

export default Verifier;
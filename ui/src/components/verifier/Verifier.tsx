import React, {useReducer} from "react";
import {FileUpload, AddressInput} from "./form";
import {verifierReducer} from "../../reducers/verifierReducer";
import {VerifierState} from "../../types";
import Dropdown from "../Dropdown";
import LoadingOverlay from "../LoadingOverlay";
import {useDispatchContext} from "../../state/State";

// TODO
// move to constants
export const chainOptions = [
    {value: "mainnet", label: "Ethereum Mainnet", id: 1},
    {value: "ropsten", label: "Ropsten", id: 3},
    {value: "rinkeby", label: "Rinkeby", id: 4},
    {value: "kovan", label: "Kovan", id: 42},
    {value: "goerli", label: "Görli", id: 5},
];

const initialState: VerifierState = {
    loading: false,
    address: "",
    files: []
}

const Verifier: React.FC = () => {
    const [state, dispatch] = useReducer(verifierReducer, initialState);
    const globalDispatch = useDispatchContext();

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
            { state.loading && <LoadingOverlay /> }
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
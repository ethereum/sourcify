import React, {useReducer} from "react";
import {verifierReducer} from "../../reducers/verifierReducer";
import {VerifierState} from "../../types";
import {
    CHAIN_OPTIONS as chainOptions,
    REPOSITORY_URL_FULL_MATCH,
    REPOSITORY_URL_PARTIAL_MATCH
} from "../../common/constants";
import {FileUpload, AddressInput} from "./form";
import Dropdown from "../Dropdown";
import LoadingOverlay from "../LoadingOverlay";
import {useDispatchContext} from "../../state/State";
import {verify} from "../../api/verifier";

const initialState: VerifierState = {
    loading: false,
    address: "",
    chain: chainOptions[0],
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

    const handleOnSelect = (chain: any) => {
        dispatch(
            {type: "SET_CHAIN", payload: chain}
        )
    }

    const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        globalDispatch({type: "REMOVE_NOTIFICATION"});

        dispatch({type: "SET_LOADING", payload: true})

        const formData = new FormData();
        formData.append("address", state.address);
        formData.append("chain", state.chain.id.toString());

        if (state.files.length > 0) {
            state.files.forEach(file => formData.append('files', file));
        }

        const data = await verify(formData);

        if (data.error) {
            globalDispatch({type: "SHOW_NOTIFICATION", payload: {type: "error", content: data.error}});
            dispatch({type: "SET_LOADING", payload: false});
            return;
        }

        if (data.status === 'partial') {
            globalDispatch({
                type: "SHOW_NOTIFICATION", payload: {
                    type: "success",
                    content: () => <p>Contract partially verified! View the assets in the <a
                        target="_blank"
                        rel="noopener noreferrer"
                        href={`${REPOSITORY_URL_PARTIAL_MATCH}/${state.chain.id}/${data.address}`}>file explorer.</a>
                    </p>
                }
            });
            dispatch({type: "SET_LOADING", payload: false});
            return;
        }

        globalDispatch({
            type: "SHOW_NOTIFICATION", payload: {
                type: "success",
                content: () => <p>Contract successfully verified! View the assets in the <a
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`${REPOSITORY_URL_FULL_MATCH}/${state.chain.id}/${data.address}`}>file explorer.</a>
                </p>
            }
        });

        dispatch({type: "SET_LOADING", payload: false});
    }

    return (
        <div className="form-container">
            {state.loading && <LoadingOverlay/>}
            <div className="form-container__header">
                <h3>VERIFIER</h3>
            </div>
            <div className="form-container__middle">
                <form className="form" onSubmit={onSubmit}>
                    <Dropdown items={chainOptions} initialValue={chainOptions[0]} onSelect={handleOnSelect}/>
                    <AddressInput onChange={handleAddressChange}/>
                    {
                        state.files.length > 0 && <div className="form__file-upload-header">
                            <span>FILES ({state.files.length})</span>
                            <button onClick={clearFiles}>CLEAR ALL</button>
                        </div>
                    }
                    <FileUpload handleFiles={handleFiles} files={state.files}/>
                    <button type="submit" className={`form__submit-btn ${!state.address ? `form__submit-btn--disabled` : ""}`}
                            disabled={!state.address}>VERIFY
                    </button>
                </form>
            </div>
        </div>
    )
}

export default Verifier;
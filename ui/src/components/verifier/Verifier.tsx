import React, { useEffect, useReducer } from "react";
import Web3 from "web3-utils";
import { checkAddresses, ServersideAddressCheck, verify } from "../../api/verifier";
import {
    CHAIN_IDS_STR, CHAIN_OPTIONS as chainOptions, ID_TO_CHAIN, REPOSITORY_URL_FULL_MATCH,
    REPOSITORY_URL_PARTIAL_MATCH
} from "../../common/constants";
import { verifierReducer } from "../../reducers/verifierReducer";
import { useDispatchContext } from "../../state/State";
import { VerifierState } from "../../types";
import Dropdown from "../Dropdown";
import LoadingOverlay from "../LoadingOverlay";
import Spinner from "../Spinner";
import { AddressInput, FileUpload } from "./form";

const verificationState = {
    PARTIAL: 'partial',
    PERFECT: 'perfect'
}

const initialState: VerifierState = {
    loading: false,
    address: "",
    chain: chainOptions[0],
    files: [],
    incorrectAddresses: new Set(),
    isValidationError: false,
    verifyAddressLoading: false,
    contractsToChoose: [],
}

const Verifier: React.FC = () => {
    const [state, dispatch] = useReducer(verifierReducer, initialState);
    const globalDispatch = useDispatchContext();

    useEffect(() => {
        // reset values
        state.incorrectAddresses.clear();
        dispatch({type: "SET_INCORRECT_ADDRESSES", payload: state.incorrectAddresses});
        dispatch({type: "SET_VERIFY_ADDRESS_LOADING", payload: false});
        globalDispatch({type: "REMOVE_NOTIFICATION"});

        // check if input is empty
        if (state.address.length > 0) {
            const addresses = state.address.split(',');

            // check if inputted addresses are valid
            addresses.forEach(address => {
                if (!Web3.isAddress(address)) {
                    state.incorrectAddresses.add(address)
                    dispatch({type: "SET_INCORRECT_ADDRESSES", payload: state.incorrectAddresses});
                }
            });

            // check if there is any address that doesn't pass validation
            if (state.incorrectAddresses.size >= 1) {
                dispatch({type: "SET_IS_VALIDATION_ERROR", payload: true})
                return;
            }

            dispatch({type: "SET_IS_VALIDATION_ERROR", payload: false})
            dispatch({type: "SET_VERIFY_ADDRESS_LOADING", payload: true});

            checkAddresses(addresses.join(','), CHAIN_IDS_STR).then(data => {
                console.log(data.error)
                if (data.error) {
                    globalDispatch({
                        type: "SHOW_NOTIFICATION",
                        payload: {
                            type: "error",
                            content: data.error
                        }
                    });
                    return;
                }

                // if there are addresses that doesn't exist in repo
                if (data.unsuccessful.length > 0) {
                    globalDispatch({
                        type: "SHOW_NOTIFICATION",
                        payload: {
                            type: "error",
                            content: `${data.unsuccessful.join(", ")} ${data.unsuccessful.length > 1 ? "are" : "is"} not yet verified`
                        }
                    });
                } else {
                    globalDispatch({
                        type: "SHOW_NOTIFICATION",
                        payload: {
                            type: "success",
                            content: () => <div>{data.successful.map(checkResultToElement)}</div>
                        }
                    });
                }
                dispatch({type: "SET_VERIFY_ADDRESS_LOADING", payload: false});
            });
        }
    }, [state.address])

    /**
     * Sort of JSX equivalent of arr.join(sep).
     * Copied from https://stackoverflow.com/a/23619085
    */
    function intersperse(arr: any[], sep: any) {
        if (arr.length === 0) {
            return [];
        }
    
        return arr.slice(1).reduce(function(xs, x) {
            return xs.concat([sep, x]);
        }, [arr[0]]);
    }

    const checkResultToElement = (checkResult: ServersideAddressCheck) => {
        const fullMatches = checkResult.chainIds.filter(chain => chain.status === verificationState.PERFECT)
        const partialMatches = checkResult.chainIds.filter(chain => chain.status === verificationState.PARTIAL)
        return (
            <>
                <p key={checkResult.address}>{checkResult.address}</p>
                { fullMatches.length > 0 && 
                    <p>Fully verified on: {
                        intersperse(
                            fullMatches.map(chainId => chainToLink(chainId.chainId, checkResult.address)), 
                            ", "
                        )
                    }
                    </p>
                }
                { partialMatches.length > 0 &&
                    <p key={checkResult.address}>Partially verified on: {
                        intersperse(
                            partialMatches.map(chainId => chainToLink(chainId.chainId, checkResult.address, verificationState.PARTIAL)), 
                            ", "
                        )
                    }
                    </p>
                }
            </>
        )
    }

    const chainToLink = (chainId: string, address: string, type = verificationState.PERFECT): JSX.Element => {
        const path = type === verificationState.PERFECT ? REPOSITORY_URL_FULL_MATCH : REPOSITORY_URL_PARTIAL_MATCH;
        const chain = ID_TO_CHAIN[chainId];
        const label = chain ? chain.label : "Unknown chain";
        return <a
            target="_blank"
            rel="noopener noreferrer"
            href={`${path}/${chainId}/${address}`}
            style={ { wordBreak: "break-word" } }
            key={chainId}
        >{label}</a>;
    }

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
        state.chosenContract && formData.append("chosenContract", state.chosenContract);
        
        if (state.files.length > 0) {
            state.files.forEach(file => formData.append('files', file));
        }

        const data = await verify(formData);

        if (data.error) {
            if (data.contractsToChoose){
                globalDispatch({type: "SHOW_NOTIFICATION", payload: {type: "error", content: data.error}});
                dispatch({type: "SET_LOADING", payload: false});
                dispatch({type: "SET_CONTRACTS_TO_CHOOSE", payload: data.contractsToChoose});
                return;
            }
            globalDispatch({type: "SHOW_NOTIFICATION", payload: {type: "error", content: data.error}});
            dispatch({type: "SET_LOADING", payload: false});
            return;
        }

        if (data.status === verificationState.PARTIAL) {
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

    const handleChooseContract = (i: number) => {
        dispatch({type: "SET_CHOSEN_CONTRACT", payload: i});

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
                    <div className="input-wrapper">
                        <AddressInput onChange={handleAddressChange}/>
                        {state.verifyAddressLoading && <Spinner small={true}/>}
                    </div>
                    {state.isValidationError && (() => {
                        return state.incorrectAddresses.size > 1 ?
                            <span className="validation validation--error">Some of the addresses are not valid</span> :
                            <span className="validation validation--error">Address is not valid</span>
                    })()}
                    {
                        state.files.length > 0 && <div className="form__file-upload-header">
                            <span>FILES ({state.files.length})</span>
                            <button onClick={clearFiles}>CLEAR ALL</button>
                        </div>
                    }
                    <FileUpload handleFiles={handleFiles} files={state.files}/>
                    <div>
                        {state.contractsToChoose.length>0 && <div className="choose-contract-title">Choose the main contract you want to verify</div>}
                        {
                            state.contractsToChoose.map((contract, i)=> <div className={`choose-contract-item ${state.chosenContract === i && 'choose-contract-item__chosen'}`} onClick={() => handleChooseContract(i)}> &bull; <span className="choose-contract-item-name">{contract.name}</span>: {contract.path}</div>)
                        }
                    </div>
                    <button type="submit"
                            className={`form__submit-btn ${!state.address ? `form__submit-btn--disabled` : ""}`}
                            disabled={!state.address}>VERIFY
                    </button>
                </form>
            </div>
        </div>
    )
}

export default Verifier;
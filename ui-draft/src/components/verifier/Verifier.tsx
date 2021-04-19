import React from "react";
import { SESSION_DATA_URL, ADD_FILES_URL, RESTART_SESSION_URL, VERIFY_VALIDATED_URL } from "../../common/constants";
import Contract, { ContractModel } from "../Contract";
import FileUpload from "./form/FileUpload";
import CollapsableList from "./CollapsableList";
import LoadingOverlay from "../LoadingOverlay";

export class VerifierState {
    contracts: ContractModel[];
    unused: string[];
    fetching: boolean;
}

const INITIAL_STATE: VerifierState = {
    contracts: [],
    unused: [],
    fetching: false,
};

function isJson(res: Response): boolean {
    const contentType = res.headers.get("content-type");
    return contentType && contentType.indexOf("application/json") !== -1;
}

class Verifier extends React.Component<{}, VerifierState> {
    constructor(props: undefined) {
        super(props);
        this.state = INITIAL_STATE;
    }

    private customFetch = async (url: string, options: { method?: "GET" | "POST", headers?: any, body?: any } = {}) => {
        this.setState({ fetching: true });

        fetch(url, {
            credentials: "include",
            method: options.method,
            headers: options.headers,
            body: options.body
        }).then(res => {
            if (res.ok && isJson(res)) {
                res.json().then((sessionData: VerifierState) => {
                    this.setState({
                        contracts: sessionData.contracts,
                        unused: sessionData.unused
                    })
                });
            } else {
                res.text().then(msg => {
                    console.log(msg);
                });
            }
        }).catch(err => {
            console.log("Fetch error", err);
        }).finally(() => this.setState({ fetching: false }));
    }

    componentDidMount() {
        this.customFetch(SESSION_DATA_URL, {});
    }

    private uploadFiles = (files: any[]) => {
        if (files.length === 0) {
            console.log("Nothing to upload");
            return;
        }

        const formData = new FormData();
        files.forEach(file => formData.append("files", file));
        this.customFetch(ADD_FILES_URL, { method: "POST", body: formData });
    }

    private anythingUploaded(): boolean {
        return (this.state.contracts && this.state.contracts.length > 0) ||
               (this.state.unused && this.state.unused.length > 0);
    }

    private restartSession = (): void => {
        this.setState(INITIAL_STATE);
        this.customFetch(RESTART_SESSION_URL, { method: "POST" });
    }

    private verifyValidated = (sendable: {verificationId: string, address: string, chainId: string}) => {
        this.customFetch(VERIFY_VALIDATED_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contracts: [sendable]
            })
        })
    }

    render() {
        const contracts = this.state.contracts;
        const unused = this.state.unused;

        // TODO button should probably not be inside h3; try flex instead
        return <div className="form-container__middle" style={{ marginTop: "10px", position: "relative" }}>
            { this.state.fetching && <LoadingOverlay/> }
            <h3>Verifier
                {
                    this.anythingUploaded() &&
                        <button style={{float: "right", borderRadius: "5px", cursor: "pointer" }} onClick={this.restartSession}>
                            Restart session
                        </button>
                }
            </h3>

            <FileUpload handleFiles={this.uploadFiles} files={[]}/>

            {
                (contracts.length === 0 && unused.length > 0) &&
                    <h3 style={{ textAlign: "center", marginTop: "15px", marginBottom: "15px", color: "#c41111" }}> No metadata files uploaded </h3>
            }
            {
                contracts.length > 0 &&
                    contracts.map((contractModel, i) => <Contract
                        key={i}
                        setAddress={address => this.verifyValidated({ // TODO perhaps the callback should pass the verification id
                            verificationId: contractModel.verificationId,
                            address,
                            chainId: contractModel.chainId
                        })}
                        setChainId={chainId => this.verifyValidated({
                            verificationId: contractModel.verificationId,
                            address: contractModel.address,
                            chainId
                        })}
                        contractModel={contractModel}
                    />)
            }
            {
                unused.length > 0 && <CollapsableList title="Unused uploads" items={unused}/>
            }
        </div>
    }
}

export default Verifier;
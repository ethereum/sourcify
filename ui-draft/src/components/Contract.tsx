import React, { ChangeEventHandler } from "react";
import { CHAIN_GROUPS } from "../common/constants";
import CollapsableList from "./verifier/CollapsableList";
import Web3 from "web3-utils";

export type Status = "perfect" | "partial" | "error";

type ContractMeta = {
    compiledPath?: string,
    name?: string
    compilerVersion?: string,
    address?: string,
    chainId?: string,
    status?: Status,
    statusMessage?: string,
    storageTimestamp?: Date
}

export type ContractModel =
    ContractMeta & {
    files: {
        found: string[],
        missing: string[]
    },
    verificationId?: string
}

interface ContractProps {
    contractModel: ContractModel;
    setAddress: (address: string) => void;
    setChainId: (chainId: string) => void;
}

interface ContractState {
    addressMessage: string;
    addressMessageClass: string;
}

class Contract extends React.Component<ContractProps, ContractState> {
    constructor(props: ContractProps) {
        super(props);
        this.state = {
            addressMessage: "",
            addressMessageClass: "address-valid"
        }
    }

    private updateAddress: ChangeEventHandler<HTMLInputElement> = (e) => {
        const address = e.target.value;
        let addressMessage: string;
        let addressMessageClass: string;

        if (Web3.isAddress(address)) {
            addressMessage = "";
            addressMessageClass = "";

            if (address !== this.props.contractModel.address) {
                this.props.setAddress(address);
            }

        } else {
            addressMessage = "Invalid address";
            addressMessageClass = "address-invalid";
        }

        this.setState({
            addressMessage,
            addressMessageClass
        });
    }

    private updateChainId: ChangeEventHandler<HTMLSelectElement> = (e) => {
        this.props.setChainId(e.target.value);
    }

    private displayStatus() {
        switch(this.props.contractModel.status) {
            case "perfect":
                return "Fully verified";
            case "partial":
                return "Partially verified";
            default:
                return "Not verified";
        }
    }

    private displayStatusMessage() {
        return this.props.contractModel.statusMessage;
    }

    private getStatusClass() {
        switch(this.props.contractModel.status) {
            case "perfect":
                return "contract-status-perfect";
            case "partial":
                return "contract-status-partial";
            default:
                return "contract-status-error";
        }
    }

    
    render() {
        const defaultChainOption = <option key={-1} disabled value="dummy"> -- select -- </option>;
        const chainOptions = CHAIN_GROUPS.map(group => <optgroup key={group.label} label={group.label}>{
            group.chains.map(chain => <option key={chain.id} value={chain.id}>{chain.label}</option>)
        }</optgroup>);

        chainOptions.unshift(defaultChainOption);

        const displayableStatusMessage = this.displayStatusMessage();

        return <div className="contract">
            <div className="contract-row">
                <p className="contract-left">Contract:</p>
                <p className="contract-right"><strong>{this.props.contractModel.name}</strong></p>
            </div>

            <div className="contract-row">
                <p className="contract-left">Status:</p>
                <p className={`contract-right ${this.getStatusClass()}`}>{this.displayStatus()}</p>
            </div>

            {
                !!displayableStatusMessage && <div className="contract-row">
                    <p>{displayableStatusMessage}</p>
                </div>
            }

            <div className="contract-row">
                <p className="contract-left">Address:</p>
                <div className="contract-right">
                    <input defaultValue={this.props.contractModel.address} onChange={this.updateAddress} placeholder="0x00..."/>
                    <p className={this.state.addressMessageClass}>
                        {this.state.addressMessage}
                    </p>
                </div>
            </div>

            <div className="contract-row">
                <p className="contract-left">Chain:</p>
                <select className="contract-right" defaultValue={this.props.contractModel.chainId || "dummy"} onChange={this.updateChainId}>
                    { chainOptions }
                </select>
            </div>

            <CollapsableList title="Found sources" items={this.props.contractModel.files.found} />
            <CollapsableList title="Missing sources" items={this.props.contractModel.files.missing} />
        </div>
    }
}

export default Contract;

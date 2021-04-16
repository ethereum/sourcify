import React, { ChangeEventHandler } from "react";
import { CHAIN_GROUPS } from "../common/constants";
import Web3 from "web3-utils";
import { ChevronDownIcon, ChevronUpIcon } from "./icons";

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

const DUMMY_CHAIN = "dummy";
const CHECK_SYMBOL = String.fromCharCode(9989);
const X_SYMBOL = String.fromCharCode(10060);

interface ContractProps {
    contractModel: ContractModel;
    setAddress: (address: string) => void;
    setChainId: (chainId: string) => void;
}

interface ContractState {
    addressMessage: string;
    addressMessageClass: string;
    collapsed: boolean;
}

class Contract extends React.Component<ContractProps, ContractState> {
    constructor(props: ContractProps) {
        super(props);
        this.state = {
            addressMessage: "",
            addressMessageClass: "address-valid",
            collapsed: false
        }
    }

    private updateAddress: ChangeEventHandler<HTMLInputElement> = (e) => {
        const address = e.target.value;
        let addressMessage: string;
        let addressMessageClass: string;

        if (!address || Web3.isAddress(address)) {
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
                return <>
                    <span>Partially verified </span>
                    <a href='https://blog.soliditylang.org/2020/06/25/sourcify-faq/#what-are-full-matches'
                        target="_blank"
                        rel="noopener noreferrer">
                        <small>(What does that mean?)</small>
                    </a>
                </>;
            default:
                return "Not verified";
        }
    }

    private displayStatusMessage() {
        let message = this.props.contractModel.statusMessage;
        if (!message) {
            const missingData = [];
            if (!this.props.contractModel.address) {
                missingData.push("address");
            }
            if (!this.props.contractModel.chainId) {
                missingData.push("chain");
            }
            if (this.props.contractModel.files.missing.length) {
                missingData.push("source files");
            }

            if (missingData.length) {
                return `Cannot verify because there is data missing: ${missingData.join(", ")}`;
            }
            return "";
        }
        message = message.replace(/^Contract name: .*?\. /, "");
        // message = message.replace(/at 0x\d{40}./, "at the provided address.");
        return message;
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

    private file2ListItem(file: string, i: number, symbol: string) {
        return <li className="collapsable-list-item" key={i}>{file} {symbol}</li>;
    }

    render() {
        const storageTimestamp = this.props.contractModel.storageTimestamp;
        const defaultChainOption = <option key={-1} disabled value={DUMMY_CHAIN}> -- select -- </option>;
        const chainOptions = CHAIN_GROUPS.map(group => <optgroup key={group.label} label={group.label}>{
            group.chains.map(chain => <option key={chain.id} value={chain.id}>{chain.label}</option>)
        }</optgroup>);

        chainOptions.unshift(defaultChainOption);

        const displayableStatusMessage = this.displayStatusMessage();

        const files = this.props.contractModel.files;

        const addressInputClass = this.props.contractModel.address ? "" : "missing-input";
        const chainSelectorClass = this.props.contractModel.chainId ? "" : "missing-input";

        return <div className="contract">
            <div className="contract-row">
                <p className="contract-left">Contract:</p>
                <p className="contract-right">
                    <strong>{this.props.contractModel.name}</strong>
                </p>
            </div>

            <div className="contract-row">
                <p className="contract-left">Status:</p>
                <p className={`contract-right ${this.getStatusClass()}`}>
                    <strong>{this.displayStatus()}</strong>
                    {!!storageTimestamp && ` on ${new Date(storageTimestamp).toUTCString()}` }
                </p>
            </div>

            {
                !!displayableStatusMessage && <div className="contract-row">
                    <p>{displayableStatusMessage}</p>
                </div>
            }

            <div className="contract-row">
                <p className="contract-left">Address:</p>
                <div className="contract-right">
                    <input
                        defaultValue={this.props.contractModel.address}
                        onChange={this.updateAddress}
                        placeholder="0x00..."
                        className={addressInputClass}
                    />
                    <p className={this.state.addressMessageClass}>
                        {this.state.addressMessage}
                    </p>
                </div>
            </div>

            <div className="contract-row">
                <p className="contract-left">Chain:</p>
                <select className={`contract-right ${chainSelectorClass}`} defaultValue={this.props.contractModel.chainId || DUMMY_CHAIN} onChange={this.updateChainId}>
                    { chainOptions }
                </select>
            </div>

            <div className="collapsable-list-container">
                <button
                    onClick={() => this.setState({ collapsed: !this.state.collapsed })}
                >
                    Sources ({files.found.length}/{files.found.length + files.missing.length}) { files.missing.length ? X_SYMBOL : CHECK_SYMBOL}
                    <div className="chevron-holder">
                        { this.state.collapsed ? <ChevronDownIcon/> : <ChevronUpIcon/> }
                    </div>
                </button>
                {
                    !this.state.collapsed && <ul className="collapsable-list">
                        {files.missing.map((file, i) => this.file2ListItem(file, i, X_SYMBOL))}
                        {files.found.map((file, i) => this.file2ListItem(file, i, CHECK_SYMBOL))}
                    </ul>
                }
            </div>
        </div>
    }
}

export default Contract;

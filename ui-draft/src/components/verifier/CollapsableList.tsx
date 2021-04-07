import React from "react";
import { ChevronUpIcon, ChevronDownIcon } from "../icons";

interface CollapsableListProps {
    title: string;
    items: string[];
}

interface CollapsableListState {
    collapsed: boolean;
}

class CollapsableList extends React.Component<CollapsableListProps, CollapsableListState> {
    constructor(props: CollapsableListProps) {
        super(props);
        this.state = {
            collapsed: this.props.items.length > 3
        }
    }

    render() {
        return <div className="collapsable-list-container">
            <button onClick={() => this.setState({ collapsed: !this.state.collapsed })}>
                {this.props.title} ({this.props.items.length})
                <div className="chevron-holder">
                    { this.state.collapsed ? <ChevronDownIcon/> : <ChevronUpIcon/> }
                </div>
            </button>
            {
                !this.state.collapsed && <ul className="collapsable-list">
                    {this.props.items.map((item, i) => <li className="collapsable-list-item" key={i}>{item}</li>)}
                </ul>
            }
        </div>
    }
}

export default CollapsableList;
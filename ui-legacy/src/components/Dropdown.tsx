import React, { useState } from "react";
import useOnclickOutside from "react-cool-onclickoutside";
import { Chain } from "../types";
import { ChevronDownIcon, ChevronUpIcon } from "./icons";


type DropdownProps = {
    items: Chain[],
    initialValue: Chain,
    onSelect: (item: any) => void
};

const Dropdown: React.FC<DropdownProps> = ({items, initialValue, onSelect}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Chain>(initialValue);

    const ref = useOnclickOutside(() => setIsOpen(false), { ignoreClass: "dropdown__header"});

    const toggleDropdown = () => setIsOpen(!isOpen);

    const handleOnClick = (item: Chain) => {
        setSelectedItem(item);
        onSelect(item);
        setIsOpen(false);
    }

    const isItemSelected = (item: Chain) => {
        return item.chainId === selectedItem.chainId
          ? `dropdown-list__item--selected`
          : "";
    }

    return (
        <div className="dropdown">
            <div className="dropdown__header" tabIndex={0} role="button" onKeyPress={toggleDropdown}
                 onClick={toggleDropdown}>
                <span>{selectedItem.title || selectedItem.name}</span>
                <div className="dropdown-header__indicator">
                    {isOpen ? <ChevronUpIcon/> : <ChevronDownIcon/>}
                </div>
            </div>
            {
                isOpen && (
                    <ul className="dropdown__list" ref={ref}>
                        {items.map((item: Chain) => (
                            <li className={`dropdown-list__item ${isItemSelected(item)}`} key={item.chainId}>
                                <button type="button" onClick={() => handleOnClick(item)}>
                                    <span>{item.title || item.name}</span>
                                </button>
                            </li>
                        ))
                        }
                    </ul>
                )
            }
        </div>
    )
}

export default Dropdown;
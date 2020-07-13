import React, {useState} from "react";
import {ChevronDownIcon, ChevronUpIcon} from "./icons";
import useOnclickOutside from "react-cool-onclickoutside";

type Item = {
    value: string,
    label: string,
    id: number
}

type DropdownProps = {
    items: Item[],
    initialValue: Item,
    onSelect: (item: any) => void
};

const Dropdown: React.FC<DropdownProps> = ({items, initialValue, onSelect}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Item>(initialValue);

    const ref = useOnclickOutside(() => setIsOpen(false), { ignoreClass: "dropdown__header"});

    const toggleDropdown = () => setIsOpen(!isOpen);

    const handleOnClick = (item: Item) => {
        setSelectedItem(item);
        onSelect(item);
        setIsOpen(false);
    }

    const isItemSelected = (item: Item) => {
        return item.id === selectedItem.id ? `dropdown-list__item--selected` : ""
    }

    return (
        <div className="dropdown">
            <div className="dropdown__header" tabIndex={0} role="button" onKeyPress={toggleDropdown}
                 onClick={toggleDropdown}>
                <span>{selectedItem.label}</span>
                <div className="dropdown-header__indicator">
                    {isOpen ? <ChevronUpIcon/> : <ChevronDownIcon/>}
                </div>
            </div>
            {
                isOpen && (
                    <ul className="dropdown__list" ref={ref}>
                        {items.map((item: Item) => (
                            <li className={`dropdown-list__item ${isItemSelected(item)}`} key={item.id}>
                                <button type="button" onClick={() => handleOnClick(item)}>
                                    <span>{item.label}</span>
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
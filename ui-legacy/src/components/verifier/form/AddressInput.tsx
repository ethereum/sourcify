import React from "react";

type AddressInputProps = {
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

const AddressInput: React.FC<AddressInputProps> = ({onChange}) => {
    return (
        <input type="text" placeholder="Contract Address*" onChange={onChange}/>
    )
}

export default AddressInput;
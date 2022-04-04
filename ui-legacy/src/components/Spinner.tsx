import React from "react";

type SpinnerProps = {
    small: boolean
};

const Spinner: React.FC<SpinnerProps> = ({small}) => {
    return (
        <div className={`spinner ${small ? "spinner--small" : ""}`}>
            <span/>
            <span/>
            <span/>
            <span/>
        </div>
    );
};

export default Spinner;
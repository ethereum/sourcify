import React from "react";

const LoadingOverlay: React.FC = () => {
    return (
        <div className="loading-overlay">
            <div className="spinner">
                <span/>
                <span/>
                <span/>
                <span/>
            </div>
        </div>
    );
};

export default LoadingOverlay;
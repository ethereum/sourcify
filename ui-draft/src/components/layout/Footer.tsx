import React from "react";

const Footer: React.FC = () => {
    return (
        <footer className="footer">
            <p>Sourcify Team • {new Date().getFullYear()} • sourcify.eth </p>
        </footer>
    );
};

export default Footer;

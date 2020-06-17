import React from 'react';

const MainLayout: React.FC = ({ children}) => {
    return (
        <>
            <header className="header">
                <a href="">
                    <img src="../../../public/logo.png" alt="logo"/>
                </a>
                <div className="header__social-icons">
                    <a href="">
                        <img src="../../../public/twitter.svg" alt=""/>
                    </a>
                    <a href="">
                        <img src="../../../public/github.svg" alt=""/>
                    </a>
                </div>
            </header>
            <main className="main">
                Main
                {children}
            </main>
            <footer className="footer">
                Footer
            </footer>
        </>
    )
}

export default MainLayout;
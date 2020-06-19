import React from 'react';
import Header from './Header';

const MainLayout: React.FC = ({ children}) => {
    return (
        <>
            <Header />
            <main className="main">
                {children}
            </main>
            <footer className="footer">
                Footer
            </footer>
        </>
    )
}

export default MainLayout;
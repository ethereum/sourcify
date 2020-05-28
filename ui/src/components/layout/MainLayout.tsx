import React from 'react';
import Header from './Header';
import Footer from "./Footer";

const MainLayout: React.FC = ({ children}) => {
    return (
        <>
            <Header />
            <main className="main">
                {children}
            </main>
            <Footer />
        </>
    )
}

export default MainLayout;
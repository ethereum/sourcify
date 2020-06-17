import React from 'react';

import './styles/app.scss';
import MainLayout from "./components/layout/MainLayout";

const App: React.FC = () => {
    return (
        <div id="app" className="grid">
            <MainLayout>
                <h1>Main</h1>
            </MainLayout>
        </div>
    );
}

export default App;
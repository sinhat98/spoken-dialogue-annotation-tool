import React from 'react';
import { SnackbarProvider } from 'notistack';
import App from './App';

const AppWrapper: React.FC = () => (
    <SnackbarProvider maxSnack={3}>
        <App />
    </SnackbarProvider>
);

export default AppWrapper; 
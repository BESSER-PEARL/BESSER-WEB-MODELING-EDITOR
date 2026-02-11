import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { diagramReducer } from '../../services/diagram/diagramSlice';
import { projectReducer } from '../../services/project/projectSlice';

import { errorReducer } from '../../services/error-management/errorManagementSlice';

const store = configureStore({
  reducer: {
    diagram: diagramReducer,
    project: projectReducer,
    errors: errorReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
  devTools: !import.meta.env.PROD,
});

interface Props {
  children: React.ReactNode;
}

export const ApplicationStore: React.FC<Props> = ({ children }) => {
  return <Provider store={store}>{children}</Provider>;
};

export type AppDispatch = typeof store.dispatch;

export type RootState = ReturnType<typeof store.getState>;

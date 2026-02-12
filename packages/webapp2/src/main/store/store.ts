import { configureStore } from '@reduxjs/toolkit';
import { diagramReducer } from '../services/diagram/diagramSlice';
import { projectReducer } from '../services/project/projectSlice';
import { errorReducer } from '../services/error-management/errorManagementSlice';

export const store = configureStore({
  reducer: {
    diagram: diagramReducer,
    project: projectReducer,
    errors: errorReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
  devTools: !import.meta.env.PROD,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 

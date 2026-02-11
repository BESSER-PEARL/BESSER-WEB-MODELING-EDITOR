import React from 'react';

import { ErrorMessage } from './error-message';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { dismissError } from '../../services/error-management/errorManagementSlice';

export const ErrorPanel: React.FC = () => {
  const errors = useAppSelector((state) => state.errors);
  const dispatch = useAppDispatch();

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[99998] flex w-[min(420px,calc(100vw-1.5rem))] flex-col gap-2 sm:right-4 sm:top-4">
      {errors.map((error) => (
        <div className="pointer-events-auto" key={error.id}>
          <ErrorMessage error={error} onClose={(apollonError) => dispatch(dismissError(apollonError.id))} />
        </div>
      ))}
    </div>
  );
};

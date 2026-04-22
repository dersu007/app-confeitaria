/**
 * Logger function for Error Boundary
 */
export const logErrorToBackend = (error: Error, info: { componentStack: string }) => {
  // Silence is golden for the end-user, but we log for developers
  console.group('%c 🛡️ Error Boundary caught an error', 'background: #fee2e2; color: #991b1b; padding: 4px; border-radius: 4px;');
  console.error(error);
  console.info('Component Stack:', info.componentStack);
  console.groupEnd();
  
  // Future implementation: Send to Sentry, LogRocket, or custom API
  // sendToSentry(error, info);
};

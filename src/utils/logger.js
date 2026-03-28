export function logError(context, error) {
  if (import.meta.env.DEV) {
    console.error(`[${context}]`, error);
  }
}

export function userErrorMessage(fallback = 'Ha ocurrido un error. Inténtalo de nuevo.') {
  return fallback;
}

export const escapeIlikePattern = (value: string): string => {
  return value.replace(/[%_\\]/g, '\\$&');
};

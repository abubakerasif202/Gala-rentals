// Vercel's Windows builder reads PATH from a plain object, where Path and PATH
// are different keys. Normalize before launching the CLI, without changing the
// user's global PATH or patching Vercel's installed code.
export const normalizeProcessEnvironment = (environment, platform = process.platform) => {
  if (platform !== 'win32') return { ...environment };
  const pathKey = Object.keys(environment).find(key => key.toUpperCase() === 'PATH');
  const normalized = Object.fromEntries(Object.entries(environment).filter(([key]) => key.toUpperCase() !== 'PATH'));
  if (pathKey) normalized.PATH = environment[pathKey];
  return normalized;
};

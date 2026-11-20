const ALLOWED_TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.csv', '.ts', '.tsx', '.js', '.jsx',
  '.py', '.html', '.css', '.xml', '.log', '.yml', '.yaml', '.toml', '.sql',
]);

const BLOCKED_DIRECTORY_NAMES = new Set([
  'node_modules', '.git', '.svn', '.hg', '.ssh', '.aws', '.azure',
  '.config', '.cache', '.next', '.nuxt', 'dist', 'build', 'coverage',
  'vendor', '.venv', 'venv', '__pycache__',
]);

const SENSITIVE_FILE_NAME = /(^|[._-])(secret|secrets|credential|credentials|password|passwd|token|private|id_rsa|id_ed25519|keystore|wallet)([._-]|$)|^\.env($|\.)/i;

export function isSafeWorkspaceDirectory(relativePath: string): boolean {
  if (!relativePath || relativePath.length > 1024 || relativePath.startsWith('/') || relativePath.includes('\\')) return false;
  const segments = relativePath.split('/');
  return !segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.startsWith('.') || BLOCKED_DIRECTORY_NAMES.has(segment.toLowerCase()));
}

export function isSafeWorkspacePath(relativePath: string): boolean {
  if (!relativePath || relativePath.length > 1024 || relativePath.startsWith('/') || relativePath.includes('\\')) return false;
  const segments = relativePath.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.startsWith('.'))) return false;
  if (segments.slice(0, -1).some((segment) => BLOCKED_DIRECTORY_NAMES.has(segment.toLowerCase()))) return false;
  const fileName = segments[segments.length - 1];
  if (SENSITIVE_FILE_NAME.test(fileName)) return false;
  const extension = fileName.includes('.') ? '.' + fileName.split('.').pop()!.toLowerCase() : '';
  return ALLOWED_TEXT_EXTENSIONS.has(extension);
}

export const WORKSPACE_FILE_SIZE_LIMIT = 500_000;

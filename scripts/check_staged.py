"""Read-only pre-commit check. Never print matching secret values."""
from pathlib import Path
import re
import subprocess


def git(*args):
    return subprocess.check_output(['git', *args])


branch = git('branch', '--show-current').decode().strip()
if branch != 'mvp':
    raise SystemExit('Commit detenido: la rama debe ser mvp.')
names = git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z').decode().split('\0')
patterns = [
    r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    r'eyJ[A-Za-z0-9_-]{20,}[.][A-Za-z0-9_-]{10,}[.][A-Za-z0-9_-]{10,}',
    r'GOCSPX-[A-Za-z0-9_-]{15,}',
    r'AIza[A-Za-z0-9_-]{30,}',
    r'sb_secret_[A-Za-z0-9_-]{20,}',
    r'gh[pousr]_[A-Za-z0-9]{30,}',
    r'AKIA[A-Z0-9]{16}',
]
violations = []
for name in filter(None, names):
    path = Path(name)
    if (path.name.startswith('.env') and path.name != '.env.example') or path.suffix.lower() in ('.pdf', '.eml', '.msg', '.xlsx'):
        violations.append((name, 'archivo privado o no permitido'))
        continue
    data = git('show', ':' + name)
    if b'\x00' in data:
        continue
    text = data.decode('utf-8-sig', errors='replace')
    if any(re.search(pattern, text) for pattern in patterns):
        violations.append((name, 'posible secreto'))
subprocess.run(['git', 'diff', '--cached', '--check'], check=True)
if violations:
    for name, reason in violations:
        print(f'{name}: {reason}')
    raise SystemExit(1)
print(f'Rama mvp; {len(list(filter(None,names)))} archivos revisados sin coincidencias de secretos ni documentos privados. Revisar también manualmente.')

"""Scan reachable Git history without exposing matching secret values."""
import re
import subprocess

patterns = [
    rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    rb'eyJ[A-Za-z0-9_-]{20,}[.][A-Za-z0-9_-]{10,}[.][A-Za-z0-9_-]{10,}',
    rb'GOCSPX-[A-Za-z0-9_-]{15,}', rb'AIza[A-Za-z0-9_-]{30,}',
    rb'sb_secret_[A-Za-z0-9_-]{20,}', rb'gh[pousr]_[A-Za-z0-9]{30,}', rb'AKIA[A-Z0-9]{16}',
]
objects = subprocess.check_output(['git','rev-list','--objects','--all']).decode().splitlines()
seen = set()
findings = []
for entry in objects:
    oid, _, name = entry.partition(' ')
    if not name or oid in seen:
        continue
    seen.add(oid)
    kind = subprocess.check_output(['git','cat-file','-t',oid]).strip()
    if kind != b'blob':
        continue
    blob = subprocess.check_output(['git','cat-file','blob',oid])
    if b'\x00' in blob:
        continue
    if any(re.search(pattern, blob) for pattern in patterns):
        findings.append(name)
print(f'Objetos revisados: {len(seen)}. Archivos con patrones de credenciales: {sorted(set(findings))}')
raise SystemExit(bool(findings))

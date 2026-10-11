#!/usr/bin/env python3
"""Lock the password-protected case studies.

Run from the portfolio folder:

    python3 tools/lock.py

It asks for the password (nothing is shown or saved), then for every page in
tools/protected.json it:

  1. reads the readable original from private/ (git ignores that folder),
  2. shrinks its images and packs them in with the page,
  3. encrypts the bundle with the password -> locked/<slug>.bin,
  4. writes the public page <slug>.html (nav, password box, footer).

Only locked/<slug>.bin and <slug>.html get published. lock.js in the browser
decrypts the bundle once the visitor enters the password.

To protect a new case study (e.g. a Betterment project):
  - put its page in private/<slug>/page.html with images in private/<slug>/images/
    (the case study content goes inside <main id="main" class="cs"> ... </main>),
  - add an entry to tools/protected.json,
  - run this script again with the same password.

Uses the Mac's built-in tools (openssl, sips). If the Pillow library is installed
(python3 -m pip install --user pillow), images are packed as WebP, about half the
size of JPEG at the same visual quality; without it they fall back to JPEG.
"""

import base64
import getpass
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ITERATIONS = 310000          # must match lock.js
MAX_WIDTH = 2000             # images wider than this get scaled down
MIME = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
        '.svg': 'image/svg+xml', '.webp': 'image/webp'}


def ask_password():
    if os.environ.get('LOCKPW'):
        return os.environ['LOCKPW']
    first = getpass.getpass('Password for the protected case studies: ')
    if len(first) < 8:
        sys.exit('Please use at least 8 characters.')
    if getpass.getpass('Type it again: ') != first:
        sys.exit("Those didn't match, nothing was changed.")
    return first


def sips_info(path):
    out = subprocess.run(['sips', '-g', 'pixelWidth', path], capture_output=True, text=True).stdout
    match = re.search(r'pixelWidth: (\d+)', out)
    return int(match.group(1)) if match else 0


try:  # WebP keeps screenshots crisp at about half the size of JPEG (needs Pillow)
    from PIL import Image as _PIL
    from io import BytesIO as _BytesIO
except ImportError:
    _PIL = None


def shrink(path, workdir):
    """Return (mime, bytes) for an image: WebP when Pillow is installed, else JPEG via sips."""
    ext = os.path.splitext(path)[1].lower()
    if _PIL and ext in ('.png', '.jpg', '.jpeg', '.webp'):
        im = _PIL.open(path)
        if im.width > MAX_WIDTH:
            im = im.resize((MAX_WIDTH, round(im.height * MAX_WIDTH / im.width)), _PIL.LANCZOS)
        buf = _BytesIO()
        im.save(buf, 'WEBP', quality=85, method=6)
        return 'image/webp', buf.getvalue()
    if ext in ('.png', '.jpg', '.jpeg'):
        out = os.path.join(workdir, 'img.jpg')
        cmd = ['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '82']
        if sips_info(path) > MAX_WIDTH:
            cmd += ['--resampleWidth', str(MAX_WIDTH)]
        subprocess.run(cmd + [path, '--out', out], capture_output=True, check=True)
        with open(out, 'rb') as f:
            data = f.read()
        if len(data) < os.path.getsize(path):
            return 'image/jpeg', data
    with open(path, 'rb') as f:
        return MIME.get(ext, 'application/octet-stream'), f.read()


def build_bundle(entry, workdir):
    source = os.path.join(ROOT, entry['source'])
    with open(source, encoding='utf-8') as f:
        page = f.read()
    page = re.sub(r'<!--.*?-->', '', page, flags=re.S)  # comments (incl. preview notes) never get published
    match = re.search(r'<main[^>]*>(.*)</main>', page, re.S)
    if not match:
        sys.exit(f"{entry['source']}: couldn't find <main> ... </main>")
    content = match.group(1)
    base = os.path.dirname(source)
    assets, ids = {}, {}

    def swap(m):
        src = m.group(2)
        path = os.path.normpath(os.path.join(base, src))
        if not os.path.isfile(path):
            print(f'  ! missing image, left as is: {src}')
            return m.group(0)
        if path not in ids:
            ids[path] = f'a{len(ids)}'
            mime, data = shrink(path, workdir)
            assets[ids[path]] = {'type': mime, 'data': base64.b64encode(data).decode('ascii')}
        return f'{m.group(1)}data-asset="{ids[path]}"'

    content = re.sub(r'(<img\b[^>]*?)src="([^"]+)"', swap, content)
    size = sum(len(a['data']) for a in assets.values()) * 3 // 4
    fmt = 'WebP' if _PIL else 'JPEG (install Pillow for WebP)'
    print(f"  {len(assets)} images, {size / 1e6:.1f} MB after shrinking, as {fmt}")
    return {'check': 'unlocked', 'title': entry['title'], 'html': content, 'assets': assets}


def encrypt(bundle, password, out_path, workdir):
    plain = os.path.join(workdir, 'bundle.json')
    with open(plain, 'w', encoding='utf-8') as f:
        json.dump(bundle, f)
    env = dict(os.environ, LOCKPW=password)
    base = ['openssl', 'enc', '-aes-256-cbc', '-pbkdf2', '-iter', str(ITERATIONS), '-md', 'sha256', '-pass', 'env:LOCKPW']
    # write next to the bundle first, so a failed run never leaves a half-written file behind
    tmp_out = os.path.join(workdir, 'bundle.bin')
    subprocess.run(base + ['-salt', '-in', plain, '-out', tmp_out], env=env, check=True)
    # round trip, so a broken bundle never gets published
    check = subprocess.run(base + ['-d', '-in', tmp_out], env=env, capture_output=True, check=True).stdout
    if json.loads(check)['check'] != 'unlocked':
        sys.exit('Encryption check failed, nothing published.')
    shutil.move(tmp_out, out_path)
    os.remove(plain)


def shell(entry):
    """The public page: the site's nav and footer around a password box."""
    with open(os.path.join(ROOT, 'about.html'), encoding='utf-8') as f:
        about = f.read()
    header = about[about.index('  <header class="nav"'):about.index('  </header>') + len('  </header>')]
    header = header.replace(' aria-current="page"', '')
    footer = about[about.index('  <footer class="footer">'):about.index('  </footer>') + len('  </footer>')]
    scripts = ''.join(f'  <script src="{s}"></script>\n' for s in entry.get('scripts', []))
    title = html.escape(entry['title'])
    label = html.escape(entry.get('label', entry['title']))
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <title>{title} · Allison Patacsil</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#FAF8F3">
  <meta name="robots" content="noindex">
  <link rel="icon" href="images/favicon.png">

  <!-- set theme before paint so there's no flash -->
  <script>
    document.documentElement.classList.add('js');
    try {{
      var savedTheme = localStorage.getItem('theme');
      if (savedTheme) document.documentElement.dataset.theme = savedTheme;
    }} catch (e) {{}}
  </script>

  <!--css-->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="home.css">
  <link rel="stylesheet" href="casestudy.css">
</head>
<body>
  <!-- generated by tools/lock.py; edit private/ and re-run instead of editing this file -->
  <div class="wash" aria-hidden="true"></div>
  <div class="grain" aria-hidden="true"></div>

  <a class="skip-link" href="#main">Skip to content</a>

  <!--navbar-->
{header}

  <main id="main" class="cs" data-locked="locked/{entry['slug']}.bin">
    <div class="gate">
      <div class="gate-card">
        <p class="mono-label">{label}</p>
        <h1>This one's password protected</h1>
        <p>Enter the password to view this case study.</p>
        <form class="gate-form" id="lock-form">
          <label class="sr-only" for="lock-password">Password</label>
          <input type="password" id="lock-password" autocomplete="current-password" required>
          <button class="btn" type="submit">View</button>
        </form>
        <p class="gate-error" id="lock-error" role="alert"></p>
      </div>
    </div>
  </main>

{footer}

  <script src="home.js"></script>
{scripts}  <script src="lock.js"></script>
</body>
</html>
'''


def main():
    with open(os.path.join(ROOT, 'tools', 'protected.json'), encoding='utf-8') as f:
        pages = json.load(f)['pages']
    password = ask_password()
    os.makedirs(os.path.join(ROOT, 'locked'), exist_ok=True)
    workdir = tempfile.mkdtemp()
    try:
        for entry in pages:
            print(f"Locking {entry['title']} ...")
            bundle = build_bundle(entry, workdir)
            encrypt(bundle, password, os.path.join(ROOT, 'locked', entry['slug'] + '.bin'), workdir)
            with open(os.path.join(ROOT, entry['slug'] + '.html'), 'w', encoding='utf-8') as f:
                f.write(shell(entry))
            print(f"  wrote locked/{entry['slug']}.bin and {entry['slug']}.html")
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
    print('Done. Only the files above need to be published.')


if __name__ == '__main__':
    main()

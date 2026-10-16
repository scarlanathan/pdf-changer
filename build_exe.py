"""Construit l'application Windows : dist/PDF Changer/PDF Changer.exe

    python build_exe.py

Prérequis (une seule fois) : pip install -r requirements.txt pyinstaller pywebview
Le dossier dist/PDF Changer se copie tel quel sur un autre PC Windows 10/11
(aucune installation de Python nécessaire).
"""

import os
import shutil
import subprocess
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
NAME = "PDF Changer"
ICON = os.path.join(HERE, "assets", "pdf_changer.ico")


def make_icon():
    """Le logo de l'application (page indigo et trois lignes), en .ico multi-tailles."""
    from PIL import Image, ImageDraw
    big = 256
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = big / 32
    d.rounded_rectangle([4 * s, 2 * s, 28 * s, 30 * s], radius=5 * s, fill=(79, 70, 229, 255))
    for y, x1 in ((12, 22), (17, 22), (22, 17)):
        d.line([10 * s, y * s, x1 * s, y * s], fill="white", width=int(2.6 * s))
        for x in (10, x1):  # bouts arrondis
            r = 1.3 * s
            d.ellipse([x * s - r, y * s - r, x * s + r, y * s + r], fill="white")
    os.makedirs(os.path.dirname(ICON), exist_ok=True)
    img.save(ICON, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])


VENV = os.path.join(HERE, "build", "venv")


def in_build_venv():
    return os.path.normcase(os.path.abspath(sys.prefix)) == os.path.normcase(VENV)


def build_venv():
    """Environnement Python propre, avec seulement ce dont l'application a besoin :
    sans lui, PyInstaller embarque tout ce qui est installé sur la machine
    (pandas, pyarrow…) et l'application pèse plus de 300 Mo."""
    py = os.path.join(VENV, "Scripts", "python.exe")
    if not os.path.exists(py):
        subprocess.run([sys.executable, "-m", "venv", VENV], check=True)
    subprocess.run([py, "-m", "pip", "install", "--quiet", "--disable-pip-version-check",
                    "-r", os.path.join(HERE, "requirements.txt"), "pyinstaller", "pywebview", "pillow"], check=True)
    return py


def main():
    if not in_build_venv():
        py = build_venv()
        sys.exit(subprocess.run([py, os.path.abspath(__file__)] + sys.argv[1:]).returncode)
    if not os.path.exists(ICON):
        make_icon()
    sep = ";" if os.name == "nt" else ":"
    cmd = [
        sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean",
        "--name", NAME, "--windowed", "--icon", ICON,
        "--add-data", os.path.join(HERE, "static") + sep + "static",
        # OCR de Windows : modules chargés dynamiquement
        "--collect-all", "winrt",
        "--collect-all", "pymupdf",
        "--hidden-import", "fitz",
        # fenêtre native (Edge WebView2)
        "--collect-all", "webview",
        "--exclude-module", "tkinter", "--exclude-module", "PIL",
        "--distpath", os.path.join(HERE, "dist"),
        "--workpath", os.path.join(HERE, "build"),
        "--specpath", os.path.join(HERE, "build"),
        os.path.join(HERE, "desktop.py"),
    ]
    print(" ".join('"%s"' % c if " " in c else c for c in cmd))
    subprocess.run(cmd, check=True, cwd=HERE)
    out = os.path.join(HERE, "dist", NAME)
    # archive prête à copier sur un autre PC
    archive = os.path.join(HERE, "dist", NAME + " (Windows).zip")
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(out):
            for f in files:
                p = os.path.join(root, f)
                z.write(p, os.path.relpath(p, os.path.dirname(out)))
    print("\nTerminé :\n  %s\n  %s" % (os.path.join(out, NAME + ".exe"), archive))


if __name__ == "__main__":
    main()

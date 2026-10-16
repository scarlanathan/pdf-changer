# Mentions des tiers — PDF Changer

PDF Changer (© 2026 Nathan Han) est distribué sous licence GNU AGPL-3.0 (fichier `LICENSE`).
Il réutilise les travaux suivants, chacun sous sa propre licence.

## Inclus dans le code source

### Icônes : Feather Icons et Lucide

Plusieurs icônes de l'interface (`static/app.js`, objet `ICONS` : télécharger, envoyer, modifier, copier,
image, rechercher, corbeille, pivoter, annuler, rétablir…) reprennent ou adaptent les tracés de
[Feather Icons](https://feathericons.com) et de [Lucide](https://lucide.dev).

**Lucide** — ISC License

```
Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

**Feather Icons** — MIT License

```
Copyright (c) 2013-2023 Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Le logo de PDF Changer (`assets/pdf_changer.ico`, icône de la page) est une création originale.

## Bibliothèques utilisées (et embarquées dans l'application Windows)

Les textes complets de ces licences accompagnent l'application Windows, dans les dossiers
`_internal/*.dist-info` (ou à l'adresse indiquée).

| Composant | Licence | Titulaire |
| --- | --- | --- |
| [PyMuPDF](https://github.com/pymupdf/PyMuPDF) et MuPDF | AGPL-3.0 (ou licence commerciale Artifex) | Artifex Software, Inc. |
| [Flask](https://flask.palletsprojects.com), Werkzeug, Click, ItsDangerous, MarkupSafe | BSD-3-Clause | Pallets |
| [NumPy](https://numpy.org) | BSD-3-Clause (+ 0BSD, MIT, Zlib, CC0 pour des parties) | NumPy Developers |
| [pywebview](https://pywebview.flowrl.com) | BSD-3-Clause | Roman Sirokov |
| [pythonnet](https://github.com/pythonnet/pythonnet), clr_loader | MIT | .NET Foundation et contributeurs |
| [winrt / PyWinRT](https://github.com/pywinrt/pywinrt) | MIT | contributeurs PyWinRT |
| Microsoft WebView2 SDK (`Microsoft.Web.WebView2.*.dll`, `WebView2Loader.dll`) | BSD-3-Clause | Microsoft Corporation |
| [Python](https://www.python.org) 3.13 | Python Software Foundation License | Python Software Foundation |
| [OpenSSL](https://www.openssl.org) 3 (`libssl`, `libcrypto`) | Apache-2.0 | The OpenSSL Project |
| libffi | MIT | Anthony Green, Red Hat et contributeurs |
| Microsoft Visual C++ Runtime (`VCRUNTIME140*.dll`, `MSVCP140.dll`, `ucrtbase.dll`, `api-ms-win-*.dll`) | Fichiers redistribuables Microsoft | Microsoft Corporation |
| setuptools (partie vendue avec PyInstaller) | MIT | Python Packaging Authority |
| [PyInstaller](https://pyinstaller.org) (chargeur de l'exécutable) | GPL-2.0 avec exception d'amorçage (sans effet sur la licence du programme) | PyInstaller Development Team |

## Utilisés sans être distribués

- **Polices Windows** (Arial, Calibri, Times New Roman, Segoe UI, Microsoft YaHei…) : lues sur
  l'ordinateur de l'utilisateur, jamais incluses dans PDF Changer. Quand un texte est ajouté, seuls les
  caractères utilisés sont intégrés au PDF produit, ce que toutes ces polices autorisent (droit
  d'intégration « modifiable », OS/2 fsType = 0x0008).
- **Reconnaissance de texte (OCR) de Windows** et **moteur Edge WebView2** : composants du système,
  appelés par leurs interfaces publiques.

« PDF » est le nom d'un format normalisé (ISO 32000). Les marques citées appartiennent à leurs
propriétaires respectifs ; PDF Changer n'est affilié à aucun d'eux.

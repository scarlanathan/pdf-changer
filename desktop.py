"""PDF Changer en application de bureau.

Le serveur local (app.py) tourne en arrière-plan et l'interface s'affiche dans
une fenêtre Windows native (moteur Edge WebView2, déjà présent dans Windows 10
et 11).  Rien ne sort de l'ordinateur.

    python desktop.py [fichier.pdf]
"""

import logging
import os
import socket
import sys
import threading
from urllib.parse import parse_qs

APP_NAME = "PDF Changer"


def data_dir():
    d = os.path.join(os.environ.get("LOCALAPPDATA") or os.path.expanduser("~"), APP_NAME)
    os.makedirs(d, exist_ok=True)
    return d


def setup_logging():
    """Sans console (application fenêtrée), sys.stdout/stderr valent None :
    tout part dans un journal, utile en cas de problème."""
    log = os.path.join(data_dir(), "journal.txt")
    try:  # garde le journal court
        if os.path.getsize(log) > 2_000_000:
            os.replace(log, log + ".ancien")
    except OSError:
        pass
    stream = open(log, "a", encoding="utf-8", buffering=1)
    if sys.stdout is None:
        sys.stdout = stream
    if sys.stderr is None:
        sys.stderr = stream
    logging.basicConfig(stream=stream, level=logging.WARNING,
                        format="%(asctime)s %(name)s %(levelname)s %(message)s")
    logging.getLogger("werkzeug").setLevel(logging.WARNING)  # pas une ligne par requête


setup_logging()

import webview  # noqa: E402
from werkzeug.serving import make_server  # noqa: E402

import app as core  # noqa: E402


def free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Api:
    """Fonctions appelées par la page (window.pywebview.api.*)."""

    def __init__(self):
        self._window = None  # « _ » : pywebview ne l'expose pas à la page
        self._dirty = False

    def set_dirty(self, dirty):
        self._dirty = bool(dirty)

    def save_pdf(self, sid, query, name):
        """Enregistre le PDF via la boîte de dialogue de Windows.
        query : paramètres d'export (pages, compress), comme pour /download."""
        s = core.SESSIONS.get(sid)
        if not s or s.closed:
            return {"error": "Document introuvable : rechargez-le."}
        q = {k: v[0] for k, v in parse_qs(query or "").items()}
        try:
            with s.lock:
                pages = core.parse_pages(q.get("pages"), s.doc.page_count)
        except core.OpError as e:
            return {"error": str(e)}
        res = self._window.create_file_dialog(
            webview.SAVE_DIALOG, save_filename=core.safe_name(name, s.name + "-modifie.pdf"),
            file_types=("Document PDF (*.pdf)",))
        if not res:
            return {"cancelled": True}
        path = res if isinstance(res, str) else res[0]
        if not path.lower().endswith(".pdf"):
            path += ".pdf"
        try:
            data = core.export_pdf(s, pages, q.get("compress") == "1")
            tmp = path + ".tmp"
            with open(tmp, "wb") as f:  # jamais de fichier à moitié écrit
                f.write(data)
            os.replace(tmp, path)
        except PermissionError:
            return {"error": "Impossible d'écrire ce fichier : il est peut-être ouvert dans un autre logiciel."}
        except OSError as e:
            return {"error": "Enregistrement impossible : %s" % e.strerror}
        return {"ok": True, "name": os.path.basename(path), "size": len(data)}


def open_argument():
    """PDF passé en argument (double-clic sur un .pdf « ouvert avec » l'application)."""
    for arg in sys.argv[1:]:
        if os.path.isfile(arg):
            try:
                with open(arg, "rb") as f:
                    pdf = core.to_pdf_bytes(f.read(), os.path.basename(arg))
                name = os.path.splitext(os.path.basename(arg))[0] or "document"
                return core.new_session(pdf, name).id
            except Exception:
                logging.exception("ouverture de %s", arg)
    return None


def main():
    port = free_port()
    server = make_server("127.0.0.1", port, core.app, threaded=True)
    threading.Thread(target=server.serve_forever, daemon=True).start()

    sid = open_argument()
    url = "http://127.0.0.1:%d/%s" % (port, "?sid=" + sid if sid else "")
    api = Api()
    window = webview.create_window(APP_NAME, url, js_api=api, width=1360, height=880,
                                   min_size=(420, 500), text_select=True)
    api._window = window

    def on_closing():
        if not api._dirty:
            return True
        return window.create_confirmation_dialog(
            "Modifications non enregistrées",
            "Le document a des modifications qui n'ont pas été enregistrées.\n\nFermer quand même ?")

    window.events.closing += on_closing
    webview.start(private_mode=False, storage_path=os.path.join(data_dir(), "navigateur"))
    server.shutdown()


if __name__ == "__main__":
    main()

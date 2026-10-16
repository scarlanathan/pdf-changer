"""PDF Changer — serveur local d'édition de PDF.

Lance un serveur web (Flask) qui expose une API d'édition basée sur PyMuPDF
et sert l'interface située dans ./static.  Tout reste sur la machine.
"""

import base64
import contextlib
import difflib
import hashlib
import io
import math
import os
import re
import secrets
import socket
import sys
import threading
import time
import uuid
import webbrowser

import fitz  # PyMuPDF
from flask import Flask, Response, abort, jsonify, request, send_file

# dans l'application emballée (PyInstaller), les fichiers sont dans sys._MEIPASS
BASE = getattr(sys, "_MEIPASS", None) or os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(BASE, "static")

app = Flask(__name__, static_folder=STATIC, static_url_path="/static")
app.config["MAX_CONTENT_LENGTH"] = 256 * 1024 * 1024

MAX_HISTORY = 80
MAX_SESSIONS = 8          # documents ouverts gardés en mémoire (les plus anciens sont fermés)
SESSION_IDLE = 12 * 3600  # un document inutilisé depuis 12 h est fermé
MAX_PATHS = 1500  # au-delà, les tracés vectoriels sont regroupés
CACHE_PAGES = 60  # pages dont l'analyse reste en mémoire
MAX_RENDER_PX = 24e6      # plafond de pixels d'un rendu de page
MAX_IMAGE_PX = 100e6      # image insérée : au-delà, refusée (bombe de décompression)
SESSIONS = {}
SESSIONS_LOCK = threading.Lock()

# Jeton propre à ce lancement : seule la page servie par l'application le connaît,
# un site tiers ouvert dans le navigateur ne peut donc pas piloter l'API.
TOKEN = secrets.token_urlsafe(24)
LOCAL_HOSTS = {"127.0.0.1", "localhost", "[::1]"}


R_IMG_NONE = fitz.PDF_REDACT_IMAGE_NONE
R_IMG_REMOVE = fitz.PDF_REDACT_IMAGE_REMOVE
R_IMG_PIXELS = fitz.PDF_REDACT_IMAGE_PIXELS
R_ART_NONE = fitz.PDF_REDACT_LINE_ART_NONE
R_ART_COVERED = fitz.PDF_REDACT_LINE_ART_REMOVE_IF_COVERED
R_TXT_REMOVE = fitz.PDF_REDACT_TEXT_REMOVE
R_TXT_NONE = fitz.PDF_REDACT_TEXT_NONE


class OpError(Exception):
    pass


COORD_MAX = 14400.0  # 200 pouces : la plus grande page admise par le format PDF


def num(v, lo=-COORD_MAX, hi=COORD_MAX, default=None, what="valeur"):
    """Nombre fini et borné venu du client (NaN, infini ou absurde : refusé)."""
    if v is None or v == "":
        if default is None:
            raise OpError("Valeur manquante : %s." % what)
        return default
    try:
        f = float(v)
    except (TypeError, ValueError):
        raise OpError("Valeur invalide : %s." % what)
    if not math.isfinite(f):
        raise OpError("Valeur invalide : %s." % what)
    return min(max(f, lo), hi)


def nums(v, n, what="coordonnées"):
    if not isinstance(v, (list, tuple)) or len(v) != n:
        raise OpError("Valeur invalide : %s." % what)
    return [num(x, what=what) for x in v]


@contextlib.contextmanager
def unrotated(page):
    """Le temps de dessiner, la page est remise à l'endroit : les coordonnées
    natives sont alors exactes même si la page est pivotée ET rognée (CropBox ou
    MediaBox décalées), cas où le dessin direct atterrissait au mauvais endroit.
    Donne la rotation d'origine (pour redresser les images)."""
    r0 = page.rotation
    if r0:
        page.set_rotation(0)
    try:
        yield r0
    finally:
        if r0:
            page.set_rotation(r0)


# --------------------------------------------------------------------------
# Polices
# --------------------------------------------------------------------------

WIN_FONTS = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts")

# famille -> (nom affiché, famille CSS, [regular, bold, italic, bold-italic])
# Une entrée de style est soit un nom de police Base-14, soit un fichier TTF.
FONT_FAMILIES = {
    "helv": ("Helvetica", "Helvetica, Arial, sans-serif", ["helv", "hebo", "heit", "hebi"]),
    "tiro": ("Times", "'Times New Roman', Times, serif", ["tiro", "tibo", "tiit", "tibi"]),
    "cour": ("Courier", "'Courier New', Courier, monospace", ["cour", "cobo", "coit", "cobi"]),
}
_SYSTEM_CANDIDATES = [
    ("arial", "Arial", "Arial, sans-serif", ["arial.ttf", "arialbd.ttf", "ariali.ttf", "arialbi.ttf"]),
    ("calibri", "Calibri", "Calibri, sans-serif", ["calibri.ttf", "calibrib.ttf", "calibrii.ttf", "calibriz.ttf"]),
    ("segoe", "Segoe UI", "'Segoe UI', sans-serif", ["segoeui.ttf", "segoeuib.ttf", "segoeuii.ttf", "segoeuiz.ttf"]),
    ("verdana", "Verdana", "Verdana, sans-serif", ["verdana.ttf", "verdanab.ttf", "verdanai.ttf", "verdanaz.ttf"]),
    ("georgia", "Georgia", "Georgia, serif", ["georgia.ttf", "georgiab.ttf", "georgiai.ttf", "georgiaz.ttf"]),
    ("times", "Times New Roman", "'Times New Roman', serif", ["times.ttf", "timesbd.ttf", "timesi.ttf", "timesbi.ttf"]),
    ("comic", "Comic Sans MS", "'Comic Sans MS', cursive", ["comic.ttf", "comicbd.ttf", "comici.ttf", "comicz.ttf"]),
    ("consolas", "Consolas", "Consolas, monospace", ["consola.ttf", "consolab.ttf", "consolai.ttf", "consolaz.ttf"]),
]
for _key, _label, _css, _files in _SYSTEM_CANDIDATES:
    _paths = [os.path.join(WIN_FONTS, f) for f in _files]
    if os.path.exists(_paths[0]):
        FONT_FAMILIES[_key] = (_label, _css, [p if os.path.exists(p) else _paths[0] for p in _paths])

# Police de secours Unicode pour les caractères hors WinAnsi.
UNICODE_FALLBACK = None
for _f in ("arial.ttf", "segoeui.ttf", "calibri.ttf"):
    if os.path.exists(os.path.join(WIN_FONTS, _f)):
        UNICODE_FALLBACK = os.path.join(WIN_FONTS, _f)
        break

# Polices essayées dans l'ordre quand la police voulue n'a pas les caractères
# (symboles, grec/cyrillique étendus, chinois, japonais, coréen, indien…).
FALLBACK_FONTS = [p for p in (os.path.join(WIN_FONTS, f) for f in (
    "arial.ttf", "segoeui.ttf", "seguisym.ttf", "msyh.ttc", "YuGothM.ttc", "msgothic.ttc",
    "malgun.ttf", "Nirmala.ttc", "ebrima.ttf", "gadugi.ttf", "simsun.ttc", "seguiemj.ttf")) if os.path.exists(p)]

# Écriture de droite à gauche (hébreu, arabe) : PyMuPDF n'en fait ni l'ordre ni les
# formes contextuelles, le texte serait écrit à l'envers.
RTL = re.compile("[֐-ࣿיִ-﷿ﹰ-﻿]")
RTL_MSG = ("Le texte écrit de droite à gauche (hébreu, arabe) ne peut pas encore être réécrit : "
           "il serait inversé. Le texte d'origine est laissé tel quel.")

_font_obj_cache = {}


def font_object(spec):
    """Objet fitz.Font pour un nom Base-14 ou un chemin de fichier."""
    if spec not in _font_obj_cache:
        if is_font_file(spec):
            _font_obj_cache[spec] = fitz.Font(fontfile=spec)
        else:
            _font_obj_cache[spec] = fitz.Font(spec)
    return _font_obj_cache[spec]


def text_width(font, text, size):
    """Largeur d'un texte.  Font.text_length de PyMuPDF encode chaque caractère par
    un appel Python : beaucoup trop lent pour remettre en forme ou remplacer sur
    des centaines de lignes.  On garde l'avance de chaque caractère par police."""
    adv = getattr(font, "_adv", None)
    if adv is None:
        adv = font._adv = {}
    w = 0.0
    for c in text:
        a = adv.get(c)
        if a is None:
            a = adv[c] = font.glyph_advance(ord(c))
        w += a
    return w * size


def missing_glyphs(font, text):
    return sum(1 for c in set(text) if not c.isspace() and not font.has_glyph(ord(c)))


def winansi_ok(text):
    # Les polices Base-14 de PyMuPDF sont encodées en Latin-1 (pas de €, œ, ’…)
    try:
        text.encode("latin-1")
        return True
    except UnicodeEncodeError:
        return False


def is_font_file(spec):
    return os.path.sep in spec or spec.lower().endswith((".ttf", ".ttc", ".otf"))


def effective_spec(spec, text):
    """Police réellement utilisée : une Base-14 ne sait pas écrire €, œ, ’…
    on bascule alors sur une police système équivalente (même graisse/style),
    puis, si des caractères manquent encore (chinois, symboles…), sur la
    première police de Windows qui les contient tous."""
    if is_font_file(spec):
        if not missing_glyphs(font_object(spec), text):
            return spec
        cand = spec
    else:
        if winansi_ok(text):
            return spec
        idx = (1 if spec in ("hebo", "hebi", "tibo", "tibi", "cobo", "cobi") else 0) + \
              (2 if spec in ("heit", "hebi", "tiit", "tibi", "coit", "cobi") else 0)
        fam = "times" if spec.startswith("ti") else "consolas" if spec.startswith("co") else "arial"
        cand = FONT_FAMILIES[fam][2][idx] if fam in FONT_FAMILIES else (UNICODE_FALLBACK or spec)
        if not is_font_file(cand) or not missing_glyphs(font_object(cand), text):
            return cand
    best, best_miss = cand, missing_glyphs(font_object(cand), text)
    for fb in FALLBACK_FONTS:
        miss = missing_glyphs(font_object(fb), text)
        if miss < best_miss:
            best, best_miss = fb, miss
            if not miss:
                break
    return best


def register_font(page, spec, text, sess=None):
    """Rend la police utilisable sur la page et retourne son nom de ressource."""
    spec = effective_spec(spec, text)
    if is_font_file(spec):
        name = "F" + hashlib.md5(spec.encode()).hexdigest()[:8]
        if spec.lower().endswith(".ttc"):
            embed_font(sess, page, name, fontbuffer=font_object(spec).buffer)
        else:
            embed_font(sess, page, name, fontfile=spec)
        return name
    return spec


def embed_font(sess, page, name, **source):
    """Ajoute une police (fichier ou tampon) aux ressources de la page.  Une
    police déjà embarquée pour une autre page est simplement référencée : sans
    cela, chaque page modifiée embarquerait sa propre copie (~1 Mo)."""
    key = (page.number, name)
    if sess is not None and key in sess.registered:
        return
    xref = (sess.font_xrefs.get(name) or sess.find_font(name)) if sess is not None else None
    if not (xref and add_font_ref(page, name, xref)):
        page.insert_font(fontname=name, **source)
        if sess is not None:
            xref = next((f[0] for f in page.get_fonts() if f[4] == name), None)
            if xref:
                sess.font_xrefs[name] = xref
    if sess is not None:
        sess.registered.add(key)


def add_font_ref(page, name, xref):
    """Référence la police `xref` sous le nom `name` dans les ressources de la page."""
    doc = page.parent
    try:
        if any(f[4] == name for f in page.get_fonts()):
            return True
        target, path = page.xref, "Resources"
        kind, val = doc.xref_get_key(target, path)
        if kind == "xref":
            target, path = int(val.split()[0]), ""
        elif kind != "dict":
            # ressources héritées d'un nœud /Pages : en créer ici les masquerait
            # (polices et images d'origine perdues) ; PyMuPDF sait gérer ce cas
            return False
        fpath = (path + "/" if path else "") + "Font"
        kind, val = doc.xref_get_key(target, fpath)
        if kind == "xref":
            target, fpath = int(val.split()[0]), ""
        elif kind != "dict":
            doc.xref_set_key(target, fpath, "<<>>")
        doc.xref_set_key(target, (fpath + "/" if fpath else "") + name, "%d 0 R" % xref)
        return any(f[4] == name for f in page.get_fonts())
    except Exception:
        return False


def family_spec(family, bold, italic):
    fam = FONT_FAMILIES.get(family) or FONT_FAMILIES["helv"]
    return fam[2][(1 if bold else 0) + (2 if italic else 0)]


def base14_for(span):
    name = span.get("font", "").lower()
    flags = span.get("flags", 0)
    bold = bool(flags & 16) or any(k in name for k in ("bold", "black", "heavy", "semibold"))
    italic = bool(flags & 2) or "italic" in name or "oblique" in name
    if flags & 8 or "courier" in name or "mono" in name or "consol" in name:
        fam = "cour"
    elif (flags & 4 or "times" in name or "serif" in name or "georgia" in name
          or "garamond" in name or "cambria" in name) and "sans" not in name:
        fam = "tiro"
    else:
        fam = "helv"
    return FONT_FAMILIES[fam][2][(1 if bold else 0) + (2 if italic else 0)]


# --------------------------------------------------------------------------
# Session (document + historique)
# --------------------------------------------------------------------------


def write_increment(doc, stream_len):
    """Les modifications du document, écrites à la suite du PDF d'origine (mode
    incrémental, en mémoire).  MuPDF produit « PDF d'origine + ajout » : on ne
    garde que l'ajout.  Rien ne passe par le disque (l'antivirus de Windows
    analyserait le fichier entier à chaque fois : ~0,5 s pour 40 Mo)."""
    import pymupdf
    from pymupdf import mupdf, _as_pdf_document
    pdf = _as_pdf_document(doc)
    for helper in ("JM_embedded_clean", "JM_ensure_identity"):  # comme Document.save
        if hasattr(pymupdf, helper):
            getattr(pymupdf, helper)(pdf)
    opts = mupdf.PdfWriteOptions()
    opts.do_incremental = 1
    opts.do_compress = 1  # contenus de page compressés : historique ~8 fois plus léger
    opts.do_encrypt = mupdf.PDF_ENCRYPT_KEEP
    buf = mupdf.fz_new_buffer(stream_len + 65536)
    out = mupdf.FzOutput(buf)
    mupdf.pdf_write_document(pdf, out, opts)
    out.fz_close_output()
    data = buf.fz_buffer_extract()
    if len(data) < stream_len:
        raise RuntimeError("écriture incrémentale incomplète")
    return data[stream_len:]


def allow_increment(doc):
    """Après une suppression de texte (redaction), MuPDF refuse l'écriture
    incrémentale : l'ancien contenu resterait lisible dans le fichier.  C'est sans
    objet pour l'historique, en mémoire ; le PDF exporté, lui, est réécrit
    entièrement (export_pdf) et ne garde rien de ce qui a été supprimé."""
    try:
        from pymupdf import _as_pdf_document
        _as_pdf_document(doc).m_internal.redacted = 0
    except Exception:
        pass


def release_memory():
    """Rend au système la mémoire du cache de MuPDF (images décodées…), qui
    sinon garde des centaines de Mo même après la fermeture des documents."""
    try:
        fitz.TOOLS.store_shrink(100)
    except Exception:
        pass


def merge_changed(a, b):
    """Union de deux listes de pages modifiées (None = toute la structure)."""
    if a is None or b is None:
        return None
    return sorted(set(a) | set(b))


class Session:
    """Un document ouvert et son historique d'annulation.

    L'historique tient dans un tampon : le PDF d'origine suivi des ajouts
    incrémentaux de chaque modification.  Une étape n'est qu'une longueur de ce
    tampon — le début d'un PDF enregistré par ajouts successifs est lui-même un
    PDF valide, celui de l'étape correspondante.  Annuler = rouvrir un début du
    tampon ; une modification ne coûte que la taille de ce qui a changé."""

    def __init__(self, data, name):
        self.lock = threading.RLock()
        self.name = name
        self.id = uuid.uuid4().hex[:12]
        self.data = bytearray(data)
        self.history = [{"buf": self.data, "size": len(data), "changed": None}]
        self.pos = 0
        self.version = 1
        self.cache = {}
        self.tcache = {}
        self.font_buffers = {}
        self.font_objs = {}
        self.font_xrefs = {}
        self.registered = set()
        self.doc = None
        self.geom = None
        self.closed = False
        self._open(self.history[0])
        self.last_used = time.time()

    def _open(self, entry, keep_fonts=False):
        """Ouvre l'étape `entry` (keep_fonts : même état, polices toujours valables)."""
        old = self.doc
        self.stream = bytes(memoryview(entry["buf"])[:entry["size"]])  # une seule copie
        self.doc = fitz.open("pdf", self.stream)
        if old is not None:
            try:
                old.close()
            except Exception:
                pass
        if not keep_fonts:
            self.registered.clear()
            self.font_xrefs.clear()

    def find_font(self, name):
        """Police déjà embarquée sous ce nom (après une annulation, le registre est
        vidé : sans cette recherche elle serait embarquée une seconde fois)."""
        for page in self.doc.pages(0, min(self.doc.page_count, 3000)):
            for f in page.get_fonts():
                if f[4] == name:
                    self.font_xrefs[name] = f[0]
                    return f[0]
        return None

    def invalidate(self, changed):
        if changed is None:
            self.geom = None
            self.cache.clear()
            self.tcache.clear()
            self.font_buffers.clear()
            self.font_objs.clear()
            return
        for p in changed:
            self.drop(p)
            for k in [k for k in self.font_buffers if k[0] == p]:
                del self.font_buffers[k]

    def drop(self, pno):
        """Oublie ce qui a été lu d'une page (elle vient d'être modifiée)."""
        self.cache.pop(pno, None)
        self.tcache.pop(pno, None)

    # -- historique ------------------------------------------------------------
    def prepare(self):
        """(Rien à préparer : l'historique est en mémoire.)"""

    def commit(self, changed, amend=False):
        """Valide l'état du document comme nouvelle étape.  amend : remplace la
        dernière étape (ex. OCR page par page = une seule annulation)."""
        if changed is not None:  # les opérations de pages n'ajoutent pas de police
            fix_tounicode(self.doc, changed)
        allow_increment(self.doc)
        cur = self.history[self.pos]
        tail = None
        if self.doc.can_save_incrementally():
            try:
                tail = write_increment(self.doc, len(self.stream))
            except Exception:
                app.logger.exception("écriture incrémentale")
        if tail is not None:
            if cur["buf"] is self.data:
                del self.data[cur["size"]:]  # les étapes « rétablir » sont abandonnées
            else:
                self.data = bytearray(cur["buf"][:cur["size"]])
            self.data += tail
            keep = True
        else:  # cas rare (document réparé…) : on repart d'une copie complète
            self.data = bytearray(self.doc.tobytes(garbage=1))
            keep = False
        del self.history[self.pos + 1:]
        if amend and self.pos > 0:
            changed = merge_changed(self.history.pop()["changed"], changed)
        entry = {"buf": self.data, "size": len(self.data), "changed": changed}
        self.history.append(entry)
        if len(self.history) > MAX_HISTORY:
            self.history.pop(0)
        self.pos = len(self.history) - 1
        # rouvert sur le tampon complet : le prochain ajout se placera à la suite.
        # Pages réordonnées : les clés (page, police) du registre ne valent plus.
        self._open(entry, keep_fonts=keep and changed is not None)
        self.invalidate(changed)
        self.version += 1

    def rollback(self):
        """Abandonne une opération qui a échoué en cours de route."""
        self._open(self.history[self.pos])
        self.invalidate(None)
        self.version += 1

    def undo(self):
        """Revient à l'étape précédente ; retourne les pages qui changent (None = toutes)."""
        if self.pos == 0:
            return []
        changed = self.history[self.pos]["changed"]
        self.pos -= 1
        self._open(self.history[self.pos])
        self.invalidate(changed)
        self.version += 1
        return changed

    def redo(self):
        if self.pos >= len(self.history) - 1:
            return []
        self.pos += 1
        changed = self.history[self.pos]["changed"]
        self._open(self.history[self.pos])
        self.invalidate(changed)
        self.version += 1
        return changed

    def close(self):
        self.closed = True
        try:
            self.doc.close()
        except Exception:
            pass
        self.history = []
        self.data = bytearray()
        self.stream = b""
        self.cache.clear()
        self.tcache.clear()
        self.font_objs.clear()
        release_memory()

    def info(self):
        if self.geom is None:  # recalculé seulement quand la structure change
            self.geom = []
            for page in self.doc:
                r = page.rect
                self.geom.append({"w": round(r.width, 3), "h": round(r.height, 3), "rot": page.rotation})
        pages = self.geom
        return {
            "sid": self.id,
            "name": self.name,
            "version": self.version,
            "pages": pages,
            "canUndo": self.pos > 0,
            "canRedo": self.pos < len(self.history) - 1,
            "ocrAvailable": OCR_AVAILABLE,
        }

    # -- polices embarquées du document ------------------------------------
    def span_font(self, page, span, text, src=None):
        """(nom de ressource, fitz.Font) pour réécrire `text` dans le style de `span`.
        src : page d'où vient le texte (copie vers une autre page)."""
        name, font = self.original_font(page, span, text, src)
        if name:
            return name, font
        eff = effective_spec(base14_for(span), text)
        return register_font(page, eff, text, self), font_object(eff)

    def original_font(self, page, span, text, src=None):
        """Essaie de réutiliser la police d'origine (si elle contient les glyphes)."""
        src = src or page
        fname = span.get("font", "")
        key = (src.number, fname)
        if key not in self.font_buffers:
            buf = None
            for xref, ext, ftype, basefont, *_ in src.get_fonts():
                if basefont.split("+")[-1] != fname or ext in ("n/a", "") or ftype == "Type3":
                    continue
                try:
                    buf = self.doc.extract_font(xref)[3] or None
                    if buf:
                        fitz.Font(fontbuffer=buf)  # valide la police
                except Exception:
                    buf = None
                if buf:
                    break
            self.font_buffers[key] = buf
        buf = self.font_buffers[key]
        if not buf:
            return None, None
        try:
            digest = hashlib.md5(buf).hexdigest()[:8]
            f = self.font_objs.get(digest)
            if f is None:
                f = self.font_objs[digest] = fitz.Font(fontbuffer=buf)
            if missing_glyphs(f, text):
                return None, None
            name = "R" + digest
            embed_font(self, page, name, fontbuffer=buf)
            return name, f
        except Exception:
            return None, None

    def font_for_span(self, page, span, text, src=None):
        return self.span_font(page, span, text, src)[0]


def get_session(sid):
    s = SESSIONS.get(sid)
    if not s or s.closed:
        abort(404, "Document introuvable : il a été fermé (serveur redémarré ou trop de documents ouverts).")
    s.last_used = time.time()
    return s


def new_session(data, name):
    s = Session(data, name)
    with SESSIONS_LOCK:
        # ferme les documents inutilisés depuis longtemps, puis les plus anciens
        now = time.time()
        old = [k for k, v in SESSIONS.items() if now - v.last_used > SESSION_IDLE]
        while len(SESSIONS) - len(old) >= MAX_SESSIONS:
            rest = [k for k in SESSIONS if k not in old]
            old.append(min(rest, key=lambda k: SESSIONS[k].last_used))
        for k in old:
            v = SESSIONS.pop(k)
            with v.lock:
                v.close()
        if old:
            release_memory()
        SESSIONS[s.id] = s
    return s


def fix_tounicode(doc, pages):
    """Les polices TrueType insérées par PyMuPDF associent le glyphe de l'espace à
    U+00A0 et celui du tiret à U+00AD : copier-coller et recherche échouent alors
    dans les autres lecteurs.  On corrige la table quand l'espace ou le tiret
    normal n'y figure pas déjà."""
    seen = set()
    for pno in pages:
        if not 0 <= pno < doc.page_count:
            continue
        for f in doc[pno].get_fonts():
            xref = f[0]
            if xref in seen or f[2] != "Type0":
                continue
            seen.add(xref)
            kind, val = doc.xref_get_key(xref, "ToUnicode")
            if kind != "xref":
                continue
            try:
                tu = int(val.split()[0])
                cmap = doc.xref_stream(tu)
            except Exception:
                continue
            if not cmap or b"<00a0>" not in cmap.lower() and b"<00ad>" not in cmap.lower():
                continue
            new = patch_cmap(cmap)
            if new != cmap:
                doc.update_stream(tu, new)


_BFCHAR = re.compile(rb"^(<[0-9a-fA-F]{4}>\s+)<([0-9a-fA-F]{4})>\s*$", re.M)
_BFRANGE = re.compile(rb"^<([0-9a-fA-F]{4})>\s+<([0-9a-fA-F]{4})>\s+<([0-9a-fA-F]{4})>\s*$", re.M)


def patch_cmap(cmap):
    covered = set()
    for m in _BFCHAR.finditer(cmap):
        covered.add(int(m.group(2), 16))
    for m in _BFRANGE.finditer(cmap):
        lo, hi, dst = (int(g, 16) for g in m.groups())
        if hi - lo < 4096:
            covered.update(range(dst, dst + hi - lo + 1))
    swap = {}
    if 0x20 not in covered:
        swap[0xA0] = 0x20
    if 0x2D not in covered:
        for u in (0xAD, 0x2010, 0x2011):
            if u in covered:
                swap[u] = 0x2D
                break

    def sub(m):
        u = int(m.group(2), 16)
        if u in swap:
            return m.group(1) + b"<%04x>" % swap[u]
        return m.group(0)

    return _BFCHAR.sub(sub, cmap) if swap else cmap


def to_pdf_bytes(data, filename, password=None):
    """Ouvre n'importe quel fichier supporté et retourne des octets PDF non chiffrés."""
    ext = os.path.splitext(filename or "")[1].lower().lstrip(".") or "pdf"
    try:
        doc = fitz.open(stream=data, filetype=ext)
    except Exception:
        try:
            doc = fitz.open(stream=data, filetype="pdf")
        except Exception:
            raise OpError("Ce fichier n'est pas un PDF (ou une image) lisible.")
    if doc.needs_pass:
        if not password or not doc.authenticate(password):
            raise OpError("PASSWORD")
    try:
        if not doc.is_pdf:
            check_image_size(data)
            pdf = doc.convert_to_pdf()
            doc.close()
            doc = fitz.open("pdf", pdf)
        if doc.page_count < 1:
            raise OpError("Ce PDF ne contient aucune page.")
        for page in doc:  # arbre des pages en boucle, page illisible…
            page.rect
        out = doc.tobytes(encryption=fitz.PDF_ENCRYPT_NONE, garbage=1)
    except OpError:
        raise
    except Exception:
        raise OpError("Ce PDF est endommagé et ne peut pas être ouvert.")
    finally:
        doc.close()
    return out


def image_dims(data):
    """(largeur, hauteur) d'une image sans la décoder (image_profile ne marche
    plus avec PyMuPDF 1.27)."""
    try:
        from pymupdf import mupdf
        img = mupdf.fz_new_image_from_buffer(mupdf.fz_new_buffer_from_copied_data(data))
        return img.w(), img.h()
    except Exception:
        return 0, 0


def check_image_size(data):
    w, h = image_dims(data)
    if w * h > MAX_IMAGE_PX:
        raise OpError("Image trop grande (%d × %d pixels) : réduisez-la avant de l'insérer." % (w, h))


# --------------------------------------------------------------------------
# Géométrie (le client travaille dans l'espace "affiché", donc pivoté)
# --------------------------------------------------------------------------


def disp_rect(page, r):
    if not page.rotation:  # cas courant : rien à transformer
        return fitz.Rect(r)
    return fitz.Rect(r) * page.rotation_matrix


def native_rect(page, r):
    return fitz.Rect(r) * page.derotation_matrix


def native_point(page, p):
    return fitz.Point(p) * page.derotation_matrix


def rlist(r):
    return [round(r.x0, 2), round(r.y0, 2), round(r.x1, 2), round(r.y1, 2)]


def rgb(color):
    """'#rrggbb' ou entier sRGB -> tuple 0..1 ; None reste None."""
    if color is None or color == "" or color == "none":
        return None
    if isinstance(color, int):
        return ((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255
    if isinstance(color, (list, tuple)):
        return tuple(color)
    c = color.lstrip("#")
    if len(c) == 3:
        c = "".join(ch * 2 for ch in c)
    return int(c[0:2], 16) / 255, int(c[2:4], 16) / 255, int(c[4:6], 16) / 255


def hexcolor(color):
    if isinstance(color, int):
        return "#%06x" % color
    if isinstance(color, (list, tuple)) and len(color) >= 3:
        return "#%02x%02x%02x" % tuple(int(round(v * 255)) for v in color[:3])
    return "#000000"


def iou(a, b):
    a, b = fitz.Rect(a), fitz.Rect(b)
    inter = fitz.Rect(a) & b
    ia = max(inter.width, 0) * max(inter.height, 0)
    ua = max(a.width, 0.5) * max(a.height, 0.5) + max(b.width, 0.5) * max(b.height, 0.5) - ia
    if ua <= 0:
        return 0
    # tolère les rectangles plats (traits)
    if ia == 0:
        d = max(abs(a.x0 - b.x0), abs(a.y0 - b.y0), abs(a.x1 - b.x1), abs(a.y1 - b.y1))
        return 0.95 if d < 0.6 else 0
    return ia / ua


def angle_from_dir(d):
    a = math.degrees(math.atan2(-d[1], d[0])) % 360
    r = int(round(a / 90.0)) * 90 % 360
    return r, abs(a - round(a / 90.0) * 90) < 2


def unit(d):
    ln = math.hypot(d[0], d[1]) or 1
    return fitz.Point(d[0] / ln, d[1] / ln)


def dot(p, q):
    return p.x * q.x + p.y * q.y


def ccw_angle(d):
    """Angle (degrés, sens trigonométrique à l'écran) d'une direction de texte."""
    return math.degrees(math.atan2(-d[1], d[0])) % 360


def angle_diff(a, b):
    return abs((a - b + 180) % 360 - 180)


def mapper(old, new):
    """Fonction qui projette un point de l'ancien rectangle vers le nouveau."""
    sx = new.width / old.width if old.width > 0.01 else 1
    sy = new.height / old.height if old.height > 0.01 else 1

    def m(p):
        p = fitz.Point(p)
        return fitz.Point(new.x0 + (p.x - old.x0) * sx, new.y0 + (p.y - old.y0) * sy)

    return m, sx, sy


# --------------------------------------------------------------------------
# Extraction des éléments d'une page
# --------------------------------------------------------------------------


def path_signature(p):
    r = p["rect"]
    return (round(r.x0, 1), round(r.y0, 1), round(r.x1, 1), round(r.y1, 1),
            len(p["items"]), str(p.get("fill")), str(p.get("color")))


def extract(sess, pno):
    if pno in sess.cache:
        return sess.cache[pno]
    page = sess.doc[pno]
    prect = page.rect
    els = []

    # Texte : une ligne = un élément, puis regroupement en paragraphes.
    # (ligatures dépliées : « ﬁ » est relu « fi », sinon la recherche échoue)
    lines = sess.tcache.pop(pno, None) or read_lines(page)
    els += lines
    paras = []
    for i, grp in enumerate(group_paragraphs(lines)):
        info = para_info(page, "p%d" % i, grp)
        for el in grp:
            el["para"] = info["id"]
        paras.append(info)

    # Images (sans les décoder : xrefs=True calcule une empreinte des pixels,
    # ~40 ms par page scannée, et un PDF piégé y épuiserait la mémoire)
    try:
        infos = page.get_image_info(hashes=False, xrefs=False)
    except Exception:
        infos = []
    for i, info in enumerate(infos):
        r = fitz.Rect(info["bbox"])
        dr = disp_rect(page, r) & prect
        if dr.is_empty or dr.width < 1 or dr.height < 1:
            continue
        els.append({"id": "i%d" % i, "type": "image", "native": r, "xref": info.get("xref", 0),
                    "w": info.get("width"), "h": info.get("height"), "_tf": info.get("transform")})

    # Tracés vectoriels (get_drawings inclut l'apparence des annotations : on
    # les lit alors sur une copie de la page sans ses annotations)
    paths = page_drawings(sess.doc, page)
    visible = []
    native_page = page.rect * page.derotation_matrix  # la page, en coordonnées des tracés
    px0, py0, px1, py1 = native_page.x0, native_page.y0, native_page.x1, native_page.y1
    for p in paths:
        x0, y0, x1, y1 = p["rect"]
        w, h = x1 - x0, y1 - y0
        if w <= 0 and h <= 0:
            continue
        if p.get("fill") is None and p.get("color") is None:
            continue
        if (x1 <= px0 or x0 >= px1 or y1 <= py0 or y0 >= py1) and w > 0 and h > 0:
            continue  # hors de la page
        visible.append(p)
    if len(visible) <= MAX_PATHS:
        for i, p in enumerate(visible):
            els.append({"id": "d%d" % i, "type": "drawing", "native": fitz.Rect(p["rect"]), "_paths": [p],
                        "color": hexcolor(p["color"]) if p.get("color") else None,
                        "fill": hexcolor(p["fill"]) if p.get("fill") else None})
    else:
        for i, (r, members) in enumerate(cluster_paths(visible)):
            els.append({"id": "g%d" % i, "type": "drawing", "native": r, "group": True, "_paths": members})

    # Annotations & champs de formulaire
    for a in page.annots():
        els.append({"id": "a%d" % a.xref, "type": "annot", "native": fitz.Rect(a.rect),
                    "xref": a.xref, "subtype": a.type[1]})
    for w in page.widgets():
        els.append(widget_info(w))

    for el in els:
        el["bbox"] = rlist(disp_rect(page, el["native"]))
    # Page scannée : une grande image et aucun texte (visible ou OCR)
    page_area = max(prect.width * prect.height, 1)
    img_area = max([(disp_rect(page, e["native"]) & prect).get_area() for e in els if e["type"] == "image"] or [0])
    scan = not lines and img_area > 0.45 * page_area
    result = {"els": els, "by_id": {e["id"]: e for e in els}, "paths": paths, "paras": paras,
              "paras_by_id": {p["id"]: p for p in paras}, "scan": scan,
              "ocr": any(e["ocr"] for e in lines)}
    sess.cache[pno] = result
    while len(sess.cache) > CACHE_PAGES:  # les pages lues le plus anciennement sont oubliées
        sess.cache.pop(next(iter(sess.cache)))
    return result


def read_lines(page):
    """Lignes de texte de la page (morceaux d'une même ligne recollés)."""
    d = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE | fitz.TEXT_MEDIABOX_CLIP)
    raw = []
    for b in d["blocks"]:
        if b.get("type") != 0:
            continue
        for ln in b["lines"]:
            for s in ln["spans"]:
                s["text"] = s["text"].translate(TEXT_NORM)
            spans = [s for s in ln["spans"] if s["text"].strip()]
            if not spans:
                continue
            raw.append(text_line(page, ln["dir"], spans, "".join(s["text"] for s in ln["spans"]).strip()))
    lines = merge_fragments(page, raw)
    for i, el in enumerate(lines):
        el["id"] = "t%d" % i
        el["bbox"] = rlist(disp_rect(page, el["native"]))
    return lines


def text_lines(sess, pno):
    """Lignes de texte seules, pour la recherche : sans lire images et tracés
    (une page de plans ou de schémas peut en compter des dizaines de milliers)."""
    if pno in sess.cache:
        return [e for e in sess.cache[pno]["els"] if e["type"] == "text"]
    if pno not in sess.tcache:
        sess.tcache[pno] = read_lines(sess.doc[pno])
        while len(sess.tcache) > 4 * CACHE_PAGES:
            sess.tcache.pop(next(iter(sess.tcache)))
    return sess.tcache[pno]


def page_drawings(doc, page):
    try:
        if not page.first_annot:
            return page.get_drawings()
        tmp = fitz.open()
        tmp.insert_pdf(doc, from_page=page.number, to_page=page.number, annots=False, links=False)
        paths = tmp[0].get_drawings()
        tmp.close()
        return paths
    except Exception:
        try:
            return page.get_drawings()
        except Exception:
            return []


# MuPDF relit l'espace et le tiret d'une police TrueType comme U+00A0 / U+00AD
# (glyphes partagés) : on normalise, à longueur égale, pour la recherche.
TEXT_NORM = str.maketrans({"\xa0": " ", "\xad": "-", "‐": "-", "‑": "-"})

FIELD_KIND = {fitz.PDF_WIDGET_TYPE_TEXT: "text", fitz.PDF_WIDGET_TYPE_CHECKBOX: "checkbox",
              fitz.PDF_WIDGET_TYPE_RADIOBUTTON: "radio", fitz.PDF_WIDGET_TYPE_COMBOBOX: "combo",
              fitz.PDF_WIDGET_TYPE_LISTBOX: "list", fitz.PDF_WIDGET_TYPE_SIGNATURE: "signature",
              fitz.PDF_WIDGET_TYPE_BUTTON: "button"}


def widget_info(w):
    """Champ de formulaire : de quoi le remplir directement dans la page."""
    kind = FIELD_KIND.get(w.field_type, "other")
    flags = w.field_flags or 0
    value = w.field_value
    if kind in ("checkbox", "radio"):
        on = w.on_state()
        value = bool(value) and value not in ("Off", False) and (value is True or value == on or on is False)
    el = {"id": "w%d" % w.xref, "type": "widget", "native": fitz.Rect(w.rect), "xref": w.xref,
          "subtype": w.field_type_string, "label": w.field_name, "kind": kind,
          "value": value if isinstance(value, (bool, str, int, float)) else (value or ""),
          "readonly": bool(flags & 1), "tooltip": w.field_label or ""}
    if kind in ("combo", "list"):
        # choix : [valeur enregistrée, libellé affiché]
        el["choices"] = [[c, c] if isinstance(c, str) else [c[0], c[-1]] for c in (w.choice_values or [])]
    if kind == "text":
        el["multiline"] = bool(flags & 4096)
        el["maxlen"] = w.text_maxlen or 0
    return el


BULLET = re.compile(r"^\s*([•\-–—▪◦●■□➢►✓*]|\(?\d{1,3}[.)]|\(?[a-zA-Z][.)])\s")


def text_line(page, direction, spans, text):
    """Élément « ligne de texte » avec sa géométrie dans le repère du texte :
    u = position le long de la ligne, v = position vers la ligne suivante."""
    r = fitz.Rect(spans[0]["bbox"])
    for s in spans[1:]:
        r |= s["bbox"]
    dv = unit(direction)
    nv = fitz.Point(-dv.y, dv.x)
    rot, _ = angle_from_dir(direction)
    s0 = max(spans, key=lambda s: len(s["text"]))
    origin = fitz.Point(spans[0]["origin"])
    proj = []
    for s in spans:
        bb = fitz.Rect(s["bbox"])
        proj += [dot(c, dv) for c in (bb.tl, bb.tr, bb.bl, bb.br)]
    # direction et origine telles qu'affichées (page pivotée)
    lead = len(spans[0]["text"]) - len(spans[0]["text"].lstrip())
    if lead:  # l'origine est celle des espaces de tête : on la place sur le premier caractère
        origin = origin + dv * (lead * 0.278 * spans[0]["size"])
    m = page.rotation_matrix
    ddir = fitz.Point(dv) * m - fitz.Point(0, 0) * m
    dorg = origin * m
    fname = s0["font"]
    return {
        "id": None, "type": "text", "native": r, "text": text,
        "size": round(s0["size"], 2), "color": hexcolor(s0["color"]),
        "font": fname, "bold": bool(s0["flags"] & 16) or "bold" in fname.lower(),
        "italic": bool(s0["flags"] & 2) or "italic" in fname.lower(),
        "editable": True,
        "ocr": all(s.get("alpha", 255) == 0 for s in spans),
        "angle": round(ccw_angle(ddir), 2),
        "origin": [round(dorg.x, 2), round(dorg.y, 2)],
        "asc": round(min(max(s0.get("ascender", 0.9), 0.6), 1.2), 3),
        "_spans": spans, "_rot": rot, "_angle": ccw_angle(dv), "_d": dv, "_n": nv,
        "_origin": origin, "_u0": dot(origin, dv), "_u1": max(proj), "_v": dot(origin, nv),
    }


def merge_fragments(page, raw):
    """Recolle les morceaux d'une même ligne écrits séparément (mot à mot, texte
    justifié, ligne déjà modifiée…).  L'ordre d'origine est conservé."""
    order = sorted(range(len(raw)), key=lambda i: (round(raw[i]["_angle"]), raw[i]["_v"]))
    # rangées : éléments de même orientation sur la même ligne de base
    rows = []
    for i in order:
        b = raw[i]
        if rows:
            a = raw[rows[-1][0]]
            if angle_diff(a["_angle"], b["_angle"]) < 1 and abs(a["_v"] - b["_v"]) < 0.2 * a["size"]:
                rows[-1].append(i)
                continue
        rows.append([i])
    merged = []  # [(premier index, [éléments])]
    for row in rows:
        row.sort(key=lambda i: raw[i]["_u0"])
        start = len(merged)
        for i in row:
            b = raw[i]
            if len(merged) > start:
                first_i, parts = merged[-1]
                a = parts[-1]
                s = max(a["size"], b["size"])
                gap = b["_u0"] - a["_u1"]
                if (abs(a["size"] - b["size"]) < 0.06 * s and a["ocr"] == b["ocr"]
                        and -0.3 * s < gap < 0.9 * s):
                    parts.append(b)
                    merged[-1] = (min(first_i, i), parts)
                    continue
            merged.append((i, [b]))
    merged = join_justified(raw, merged)
    out = []
    for first_i, parts in sorted(merged, key=lambda m: m[0]):
        if len(parts) == 1:
            out.append(parts[0])
            continue
        text = parts[0]["text"]
        for a, b in zip(parts, parts[1:]):
            text += (" " if b["_u0"] - a["_u1"] > 0.12 * a["size"] and not text.endswith(" ") else "") + b["text"]
        spans = [s for p in parts for s in p["_spans"]]
        el = text_line(page, parts[0]["_d"], spans, text)
        el["ocr"] = parts[0]["ocr"]
        out.append(el)
    return out


class LineGroup(list):
    """Lignes d'un paragraphe en construction ; garde ses bornes à jour
    (u0 : début des lignes hors première, u1 : fin la plus à droite)."""

    def __init__(self, first):
        super().__init__([first])
        self.u0 = first["_u0"]
        self.u1 = first["_u1"]

    def add(self, ln):
        self.u0 = ln["_u0"] if len(self) == 1 else min(self.u0, ln["_u0"])
        self.u1 = max(self.u1, ln["_u1"])
        self.append(ln)


def join_justified(raw, merged):
    """Ligne justifiée très étirée : ses mots restent en morceaux séparés par de
    grands blancs (et la réécriture du paragraphe les perdait).  On les réunit
    quand les écarts sont réguliers et qu'une ligne voisine, d'un seul tenant,
    couvre la même largeur (ce n'est donc pas un tableau)."""
    singles = [parts[0] for _, parts in merged if len(parts) == 1]
    rows = {}
    for idx, (first_i, parts) in enumerate(merged):
        p0 = parts[0]
        rows.setdefault((round(p0["_angle"]), round(p0["_v"] / max(p0["size"] * 0.2, 0.5))), []).append(idx)
    drop, out = set(), list(merged)
    for key, idxs in rows.items():
        if len(idxs) < 3:
            continue
        frags = sorted((merged[i] for i in idxs), key=lambda m: m[1][0]["_u0"])
        s = max(f[1][0]["size"] for f in frags)
        if any(abs(f[1][0]["size"] - s) > 0.06 * s or f[1][0]["ocr"] for f in frags):
            continue
        gaps = [b[1][0]["_u0"] - a[1][-1]["_u1"] for a, b in zip(frags, frags[1:])]
        if not gaps or min(gaps) <= 0 or max(gaps) > 3 * s or max(gaps) > 1.8 * min(gaps):
            continue
        u0, u1 = frags[0][1][0]["_u0"], frags[-1][1][-1]["_u1"]
        v = frags[0][1][0]["_v"]
        if not any(0.85 * s <= abs(o["_v"] - v) <= 2.2 * s and abs(o["_u0"] - u0) < s and abs(o["_u1"] - u1) < 1.5 * s
                   and angle_diff(o["_angle"], frags[0][1][0]["_angle"]) < 1 for o in singles):
            continue
        parts = [p for f in frags for p in f[1]]
        first = min(f[0] for f in frags)
        for i in idxs:
            drop.add(i)
        out.append((first, parts))
    return [m for i, m in enumerate(out) if i not in drop]


def line_joins(grp, b):
    """La ligne b continue-t-elle le paragraphe grp ?"""
    a = grp[-1]
    if angle_diff(a["_angle"], b["_angle"]) > 1 or a["ocr"] != b["ocr"]:
        return False
    s = max(a["size"], b["size"])
    if abs(a["size"] - b["size"]) > (0.25 if a["ocr"] else 0.12) * s:
        return False
    if not a["ocr"] and (a["bold"] != b["bold"] or a["color"] != b["color"]):
        return False
    dv = b["_v"] - a["_v"]
    if not 0.85 * s <= dv <= 2.1 * s:
        return False
    if len(grp) >= 2:
        sp = (a["_v"] - grp[0]["_v"]) / (len(grp) - 1)
        if abs(dv - sp) > 0.22 * s:
            return False
    if BULLET.match(b["text"]):
        return False
    u0, u1 = grp.u0, grp.u1
    if b["_u0"] > u1 or b["_u1"] < u0 - s:
        return False
    tol = 1.2 * s
    left = abs(b["_u0"] - u0) < tol or (len(grp) == 1 and 0 < a["_u0"] - b["_u0"] < 5 * s)
    center = abs((b["_u0"] + b["_u1"]) / 2 - (a["_u0"] + a["_u1"]) / 2) < tol
    right = abs(b["_u1"] - a["_u1"]) < tol
    return left or center or right


def group_paragraphs(lines):
    """Chaîne chaque ligne au paragraphe juste au-dessus d'elle (indépendant de
    l'ordre d'écriture dans le PDF, compatible avec plusieurs colonnes)."""
    groups = []
    for ln in sorted(lines, key=lambda l: (round(l["_angle"]), l["_v"], l["_u0"])):
        best, best_ov = None, 0
        for g in groups[-40:]:
            a = g[-1]
            if not line_joins(g, ln):
                continue
            ov = min(a["_u1"], ln["_u1"]) - max(a["_u0"], ln["_u0"])
            if best is None or ov > best_ov:
                best, best_ov = g, ov
        if best is not None:
            best.add(ln)
        else:
            groups.append(LineGroup(ln))
    return groups


def para_info(page, pid, grp):
    first = grp[0]
    d, n = first["_d"], first["_n"]
    body = grp[1:] or grp
    u0 = min(min(l["_u0"] for l in body), first["_u0"])
    indent = max(0.0, first["_u0"] - u0) if len(grp) > 1 else 0.0
    u1 = max(l["_u1"] for l in grp)
    width = max(u1 - u0, 1)
    size = sorted(l["size"] for l in grp)[len(grp) // 2]
    spacing = (grp[-1]["_v"] - first["_v"]) / (len(grp) - 1) if len(grp) > 1 else size * 1.2
    tol = 0.6 * size
    align = "left"
    if len(grp) > 1:
        lefts = all(abs(l["_u0"] - u0) < tol for l in body)
        centers = all(abs((l["_u0"] + l["_u1"]) / 2 - (u0 + u1) / 2) < tol for l in grp)
        rights = all(abs(l["_u1"] - u1) < tol for l in grp)
        if lefts and len(grp) >= 3 and all(abs(l["_u1"] - u1) < tol for l in grp[:-1]):
            align = "justify"
        elif not lefts and centers:
            align = "center"
        elif not lefts and rights:
            align = "right"
    # Reconstitue le texte : retour à la ligne « dur » seulement si la ligne
    # s'arrêtait alors que le mot suivant aurait tenu.
    text = first["text"]
    flow = False
    for i in range(1, len(grp)):
        a, b = grp[i - 1], grp[i]
        avail = width - (indent if i == 1 else 0)
        aw = a["_u1"] - a["_u0"]
        avg = aw / max(len(a["text"]), 1)
        word = (b["text"].split() or [""])[0]
        soft = aw + (len(word) + 1) * avg * 0.9 > avail
        if soft:
            flow = True
            if (text.endswith("-") and len(text) > 1 and text[-2].isalpha() and word[:1].islower()):
                text = text[:-1] + b["text"]
            else:
                text += " " + b["text"]
        else:
            text += "\n" + b["text"]
    r = fitz.Rect(grp[0]["native"])
    for l in grp[1:]:
        r |= l["native"]
    anchor = (d * u0 + n * first["_v"]) * page.rotation_matrix
    return {
        "id": pid, "lines": [l["id"] for l in grp], "bbox": rlist(disp_rect(page, r)),
        "text": text, "align": align, "flow": flow, "size": size, "width": round(width, 2),
        "spacing": round(spacing, 3), "indent": round(indent, 2), "angle": first["angle"],
        "anchor": [round(anchor.x, 2), round(anchor.y, 2)], "asc": first["asc"],
        "color": first["color"], "font": first["font"], "bold": first["bold"],
        "italic": first["italic"], "ocr": first["ocr"],
        "_u0": u0, "_v0": first["_v"],
    }


def public(el):
    return {k: v for k, v in el.items() if not k.startswith("_") and k != "native"}


def resolve(sess, pno, item):
    """Retrouve un élément à partir de sa description client (robuste aux renumérotations)."""
    data = extract(sess, pno)
    typ = item.get("type")
    eid = item.get("id", "")
    if typ in ("annot", "widget"):
        return data["by_id"].get(eid)
    bbox = item.get("bbox")
    el = data["by_id"].get(eid)
    if el and el["type"] == typ and (not bbox or iou(el["bbox"], bbox) > 0.9):
        return el
    if not bbox:
        return None
    best, score = None, 0.6
    for e in data["els"]:
        if e["type"] != typ:
            continue
        sc = iou(e["bbox"], bbox)
        if typ == "text" and item.get("text") and e["text"] != item["text"]:
            sc -= 0.2
        if sc > score:
            best, score = e, sc
    return best


# --------------------------------------------------------------------------
# Suppression / ré-insertion d'éléments
# --------------------------------------------------------------------------


def text_redact_rect(r):
    h = r.height
    return fitz.Rect(r.x0 + 0.3, r.y0 + h * 0.3, r.x1 - 0.3, r.y1 - h * 0.3)


def text_redact_area(el):
    """Zone de suppression d'une ligne : rectangle, ou quadrilatère si le texte est incliné."""
    if angle_diff(el["_angle"], round(el["_angle"] / 90) * 90) < 1:
        return text_redact_rect(el["native"])
    d, n, s = el["_d"], el["_n"], el["size"]
    a = el["_origin"] + d * (el["_u0"] - dot(el["_origin"], d) + 0.3)
    b = el["_origin"] + d * (el["_u1"] - dot(el["_origin"], d) - 0.3)
    up, dn = n * (-0.45 * s), n * (-0.15 * s)
    return fitz.Quad(a + up, b + up, a + dn, b + dn)


class PagePixels:
    """Rendu de la page (orientation affichée) pour lire les couleurs d'un scan."""

    def __init__(self, page):
        import numpy as np
        self.np = np
        self.page = page
        r = page.rect
        self.SCALE = min(2.0, math.sqrt(MAX_RENDER_PX / max(r.width * r.height, 1)))
        pix = page.get_pixmap(matrix=fitz.Matrix(self.SCALE, self.SCALE), alpha=False,
                              colorspace=fitz.csRGB)
        self.arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3]

    def box(self, native, pad=0):
        r = disp_rect(self.page, native)
        h, w = self.arr.shape[:2]
        k = self.SCALE
        x0 = int(max(0, min(w - 1, r.x0 * k - pad)))
        y0 = int(max(0, min(h - 1, r.y0 * k - pad)))
        x1 = int(max(x0 + 1, min(w, r.x1 * k + pad)))
        y1 = int(max(y0 + 1, min(h, r.y1 * k + pad)))
        return x0, y0, x1, y1

    def colors(self, native):
        """(couleur du fond, couleur du texte) autour / dans la zone."""
        np = self.np
        x0, y0, x1, y1 = self.box(native)
        X0, Y0, X1, Y1 = self.box(native, pad=4)
        a = self.arr
        ring = np.concatenate([a[Y0:y0, X0:X1].reshape(-1, 3), a[y1:Y1, X0:X1].reshape(-1, 3),
                               a[Y0:Y1, X0:x0].reshape(-1, 3), a[Y0:Y1, x1:X1].reshape(-1, 3)])
        if not len(ring):
            ring = a[y0:y1, x0:x1].reshape(-1, 3)
        bg = np.median(ring, axis=0)
        inside = a[y0:y1, x0:x1].reshape(-1, 3).astype(float)
        dist = np.abs(inside - bg).sum(axis=1)
        ink = inside[dist > max(90, dist.max() * 0.55)] if len(inside) else inside
        fg = np.median(ink, axis=0) if len(ink) else np.array([20, 20, 20])
        return tuple(float(v) / 255 for v in bg), tuple(float(v) / 255 for v in fg)

    def crop(self, native):
        x0, y0, x1, y1 = self.box(native)
        sub = self.np.ascontiguousarray(self.arr[y0:y1, x0:x1])
        return fitz.Pixmap(fitz.csRGB, sub.shape[1], sub.shape[0], sub.tobytes(), False)


def cover(page, native, color, pad=0.8):
    """Peint un rectangle de la couleur du fond (efface les pixels d'un scan)."""
    with unrotated(page):
        shape = page.new_shape()
        shape.draw_rect(fitz.Rect(native) + (-pad, -pad, pad, pad))
        shape.finish(color=None, fill=color, width=0)
        shape.commit()


def redraw_paths(page, paths, m=None):
    if not paths:
        return
    with unrotated(page):
        _redraw_paths(page, paths, m)


def _redraw_paths(page, paths, m=None):
    m = m or (lambda p: fitz.Point(p))
    shape = page.new_shape()
    for p in paths:
        for item in p["items"]:
            k = item[0]
            if k == "l":
                shape.draw_line(m(item[1]), m(item[2]))
            elif k == "c":
                shape.draw_bezier(m(item[1]), m(item[2]), m(item[3]), m(item[4]))
            elif k == "re":
                r = item[1]
                shape.draw_rect(fitz.Rect(m(r.tl), m(r.br)))
            elif k == "qu":
                q = item[1]
                shape.draw_quad(fitz.Quad(m(q.ul), m(q.ur), m(q.ll), m(q.lr)))
        lc = p.get("lineCap") or (0,)
        shape.finish(
            fill=p.get("fill"),
            color=p.get("color"),
            dashes=p.get("dashes") or None,
            even_odd=p.get("even_odd", False),
            closePath=p.get("closePath", False),
            lineCap=int(max(lc) if isinstance(lc, (list, tuple)) else lc),
            width=p.get("width") or 1,
            stroke_opacity=p.get("stroke_opacity", 1) if p.get("stroke_opacity") is not None else 1,
            fill_opacity=p.get("fill_opacity", 1) if p.get("fill_opacity") is not None else 1,
        )
    shape.commit()


def cluster_paths(paths, cell=12.0):
    """Regroupe les tracés voisins (qui partagent une case de `cell` points).
    Union-find sur une grille, linéaire : cluster_drawings de PyMuPDF prend
    plusieurs secondes sur une page de plan (des dizaines de milliers de tracés)."""
    boxes = [tuple(p["rect"]) for p in paths]
    parent = list(range(len(boxes)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    grid = {}
    for i, (x0, y0, x1, y1) in enumerate(boxes):
        for gx in range(int(x0 // cell), int(x1 // cell) + 1):
            for gy in range(int(y0 // cell), int(y1 // cell) + 1):
                j = grid.setdefault((gx, gy), i)
                if j != i:
                    a, b = find(i), find(j)
                    if a != b:
                        parent[a] = b
    groups = {}
    for i in range(len(boxes)):
        groups.setdefault(find(i), []).append(i)
    out = []
    for members in groups.values():
        x0 = min(boxes[k][0] for k in members)
        y0 = min(boxes[k][1] for k in members)
        x1 = max(boxes[k][2] for k in members)
        y1 = max(boxes[k][3] for k in members)
        out.append((fitz.Rect(x0, y0, x1, y1), [paths[k] for k in members]))
    return out


def link_key(ln):
    r = fitz.Rect(ln["from"])
    return (ln.get("kind"), round(r.x0), round(r.y0), round(r.x1), round(r.y1),
            ln.get("uri"), ln.get("page"), ln.get("file"), ln.get("name"))


def restore_links(page, links, zone=None):
    """apply_redactions supprime les liens qui touchent la zone traitée : on remet
    ceux qui ont disparu (sauf ceux entièrement dans `zone`, effacés exprès)."""
    if not links:
        return
    now = {link_key(ln) for ln in page.get_links()}
    for ln in links:
        if link_key(ln) in now or (zone is not None and zone.contains(ln["from"])):
            continue
        ln = {k: v for k, v in ln.items() if k not in ("xref", "id")}
        try:
            page.insert_link(ln)
        except Exception:
            pass


def apply_redact(page, rects, images=R_IMG_NONE, graphics=R_ART_NONE, text=R_TXT_NONE):
    links = page.get_links()
    for r in rects:
        page.add_redact_annot(r, fill=False)
    page.apply_redactions(images=images, graphics=graphics, text=text)
    restore_links(page, links)


def redact_areas(sess, page, texts):
    """Zones à effacer pour ces lignes.  Les lignes d'un même paragraphe sont
    réunies en un seul rectangle quand aucune autre ligne ne s'y trouve : MuPDF
    traite un paragraphe de 1000 lignes en 0,1 s au lieu de 35 s."""
    areas = [text_redact_area(e) for e in texts]
    if len(texts) < 6:
        return areas
    try:
        lines = [e for e in extract(sess, page.number)["els"] if e["type"] == "text"]
    except Exception:
        return areas
    ids = {e["id"] for e in texts}
    others = [text_redact_rect(e["native"]) for e in lines if e["id"] not in ids]
    groups = {}
    for e, ar in zip(texts, areas):
        key = e.get("para") if isinstance(ar, fitz.Rect) else None
        groups.setdefault(key, []).append(ar)
    out = []
    for key, rects in groups.items():
        if key is None or len(rects) < 3:
            out += rects
            continue
        u = fitz.Rect(rects[0])
        for r in rects[1:]:
            u |= r
        if any(o.intersects(u) for o in others):
            out += rects
        else:
            out.append(u)
    return out


def remove_elements(sess, page, targets):
    """Supprime réellement les éléments ciblés du contenu de la page."""
    pno = page.number
    # la suppression peut retirer des ressources de la page (polices…)
    sess.registered = {k for k in sess.registered if k[0] != pno}
    texts = [e for e in targets if e["type"] == "text"]
    images = [e for e in targets if e["type"] == "image"]
    draws = [e for e in targets if e["type"] == "drawing"]
    annot_x = {e["xref"] for e in targets if e["type"] == "annot"}
    widget_x = {e["xref"] for e in targets if e["type"] == "widget"}

    if annot_x:
        for a in [a for a in page.annots() if a.xref in annot_x]:
            page.delete_annot(a)
    if widget_x:
        for w in [w for w in page.widgets() if w.xref in widget_x]:
            page.delete_widget(w)

    if texts:
        scanned = [e for e in texts if e.get("ocr")]
        bgs = []
        if scanned:
            px = PagePixels(page)
            bgs = [(e["native"], px.colors(e["native"])[0], 1 + 0.12 * e["size"]) for e in scanned]
        apply_redact(page, redact_areas(sess, page, texts), text=R_TXT_REMOVE)
        for r, bg, pad in bgs:
            cover(page, r, bg, pad)

    if images:
        all_imgs = [e for e in extract(sess, pno)["els"] if e["type"] == "image"]
        for e in images:
            others = [o for o in all_imgs if o is not e and o not in images
                      and o["native"].intersects(e["native"])]
            if not others:
                r = e["native"]
                inner = fitz.Rect(r.x0 + r.width * 0.25, r.y0 + r.height * 0.25,
                                  r.x1 - r.width * 0.25, r.y1 - r.height * 0.25)
                apply_redact(page, [inner], images=R_IMG_REMOVE)
            else:
                # Une autre image chevauche : on efface seulement les pixels de la zone
                apply_redact(page, [e["native"]], images=R_IMG_PIXELS)

    if draws:
        before = page.get_drawings()
        target_paths = []
        for e in draws:
            target_paths += e["_paths"]
        target_sigs = {path_signature(p) for p in target_paths}
        apply_redact(page, [e["native"] + (-1, -1, 1, 1) for e in draws], graphics=R_ART_COVERED)
        # Restaure les tracés effacés par erreur (ceux qui n'étaient pas visés)
        after = {}
        for p in page.get_drawings():
            s = path_signature(p)
            after[s] = after.get(s, 0) + 1
        lost = []
        for p in before:
            s = path_signature(p)
            if after.get(s, 0) > 0:
                after[s] -= 1
            elif s not in target_sigs:
                lost.append(p)
        redraw_paths(page, lost)
    sess.drop(pno)


def image_rotation(tf):
    """Quart de tour d'une image d'après sa matrice (même convention que insert_image)."""
    if not tf:
        return 0
    a, b = tf[0], tf[1]
    if abs(a) >= abs(b):
        return 0 if a >= 0 else 180
    return 90 if b < 0 else 270


def image_xref(page, el):
    """xref d'une image de la page (calcul coûteux : fait au déplacement seulement,
    et jamais sur une image géante)."""
    try:
        if any((x[2] or 0) * (x[3] or 0) > MAX_IMAGE_PX for x in page.get_images(full=True)):
            return 0
        best, score = 0, 0.8
        for info in page.get_image_info(xrefs=True):
            sc = iou(info["bbox"], el["native"])
            if sc > score and info.get("xref"):
                best, score = info["xref"], sc
        return best
    except Exception:
        return 0


def capture(sess, page, el):
    """Mémorise ce qu'il faut pour redessiner un élément ailleurs."""
    if el["type"] == "text":
        cap = {"spans": el["_spans"], "rot": el["_rot"], "angle": el["_angle"], "ocr": el.get("ocr"),
               "src": page, "src_rot": page.rotation, "src_rm": page.rotation_matrix}
        if el.get("ocr"):
            cap["pixmap"] = PagePixels(page).crop(el["native"])
        return cap
    if el["type"] == "image":
        xref = el.get("xref") or image_xref(page, el)
        rot = image_rotation(el.get("_tf"))
        if xref:
            return {"xref": xref, "rotate": rot, "src_rot": page.rotation, "src_rm": page.rotation_matrix}
        pix = page.get_pixmap(matrix=fitz.Matrix(3, 3), clip=disp_rect(page, el["native"]))
        return {"pixmap": pix, "rotate": page.rotation, "src_rot": page.rotation, "src_rm": page.rotation_matrix}
    if el["type"] == "drawing":
        return {"paths": el["_paths"], "src_rot": page.rotation, "src_rm": page.rotation_matrix}
    return {}


def reinsert(sess, page, el, cap, new_native):
    """Redessine un élément capturé dans `new_native` (sur `page`, qui peut être
    une autre page que celle d'origine)."""
    old = el["native"]
    m, sx, sy = mapper(old, new_native)
    # vers une page d'une autre rotation : on garde l'orientation affichée
    turn = (page.rotation - cap.get("src_rot", page.rotation)) % 360
    if turn:
        src_rm = cap["src_rm"]
        md, sx, sy = mapper(fitz.Rect(old) * src_rm, fitz.Rect(new_native) * page.rotation_matrix)

        def m(p):
            return md(fitz.Point(p) * src_rm) * page.derotation_matrix
    if el["type"] == "text":
        scale = (sy if cap["rot"] in (0, 180) else sx) if not turn else math.sqrt(abs(sx * sy))
        if cap.get("ocr"):
            # scan : on déplace les pixels, et la couche de texte invisible avec
            with unrotated(page) as r0:
                page.insert_image(new_native, pixmap=cap["pixmap"], keep_proportion=False, rotate=r0)
        src = cap.get("src")
        sh = page.new_shape()
        for s in cap["spans"]:
            fname = sess.font_for_span(page, s, s["text"], src)
            put_line(sh, m(s["origin"]), s["text"], s["size"] * scale, fname, rgb(s["color"]),
                     (cap["angle"] + turn) % 360, invisible=bool(cap.get("ocr")))
        sh.commit()
    elif el["type"] == "image":
        rot = (cap["rotate"] + turn) % 360
        with unrotated(page):
            if "xref" in cap:
                page.insert_image(new_native, xref=cap["xref"], keep_proportion=False, rotate=rot)
            else:
                page.insert_image(new_native, pixmap=cap["pixmap"], keep_proportion=False, rotate=rot)
    elif el["type"] == "drawing":
        redraw_paths(page, cap["paths"], m)


# Clés d'une annotation qui contiennent des coordonnées (espace PDF)
ANNOT_POINT_KEYS = ("L", "Vertices", "QuadPoints", "CL")


def _pdf_numbers(s):
    return [float(v) for v in re.findall(r"-?\d*\.?\d+(?:[eE][-+]?\d+)?", s)]


def _fmt(v):
    return ("%.3f" % v).rstrip("0").rstrip(".")


def transform_annot(doc, page, xref, m):
    """Applique la projection m (coordonnées MuPDF de la page) à la géométrie d'une
    annotation : rectangle, sommets, encre…  L'apparence existante est conservée
    (le lecteur l'adapte au nouveau rectangle)."""
    to_mu = page.transformation_matrix
    to_pdf = ~to_mu

    def mp(x, y):
        q = m(fitz.Point(x, y) * to_mu) * to_pdf
        return q.x, q.y

    kind, val = doc.xref_get_key(xref, "Rect")
    if kind == "array":
        x0, y0, x1, y1 = _pdf_numbers(val)[:4]
        ax, ay = mp(x0, y0)
        bx, by = mp(x1, y1)
        doc.xref_set_key(xref, "Rect", "[%s %s %s %s]" % tuple(
            _fmt(v) for v in (min(ax, bx), min(ay, by), max(ax, bx), max(ay, by))))
    for key in ANNOT_POINT_KEYS:
        kind, val = doc.xref_get_key(xref, key)
        if kind != "array":
            continue
        nums = _pdf_numbers(val)
        out = []
        for i in range(0, len(nums) - 1, 2):
            out += mp(nums[i], nums[i + 1])
        doc.xref_set_key(xref, key, "[" + " ".join(_fmt(v) for v in out) + "]")
    kind, val = doc.xref_get_key(xref, "InkList")
    if kind == "array":
        strokes = []
        for part in re.findall(r"\[([^\[\]]*)\]", val):
            nums = _pdf_numbers(part)
            pts = []
            for i in range(0, len(nums) - 1, 2):
                pts += mp(nums[i], nums[i + 1])
            strokes.append("[" + " ".join(_fmt(v) for v in pts) + "]")
        doc.xref_set_key(xref, "InkList", "[" + " ".join(strokes) + "]")


def move_annot(sess, page, el, new_native, copy=False):
    """Déplace (ou copie) une annotation ou un champ.  Retourne la page rechargée."""
    doc = sess.doc
    m, _, _ = mapper(el["native"], new_native)
    if el["type"] == "widget":
        if copy:
            return page  # un champ porte un nom unique : pas de copie
        for w in page.widgets():
            if w.xref == el["xref"]:
                w.rect = new_native
                w.update()
                break
        return page
    xref = el["xref"]
    if copy:
        new = doc.get_new_xref()
        doc.update_object(new, doc.xref_object(xref, compressed=True))
        for k in ("Popup", "IRT", "Parent"):
            doc.xref_set_key(new, k, "null")
        doc.xref_set_key(new, "P", "%d 0 R" % page.xref)
        doc.xref_set_key(new, "NM", fitz.get_pdf_str(uuid.uuid4().hex))
        kind, annots = doc.xref_get_key(page.xref, "Annots")
        if kind == "array":
            doc.xref_set_key(page.xref, "Annots", annots.rstrip("]").rstrip() + " %d 0 R]" % new)
        elif kind == "xref":
            arr = int(annots.split()[0])
            doc.update_object(arr, doc.xref_object(arr).rstrip().rstrip("]") + " %d 0 R]" % new)
        else:
            doc.xref_set_key(page.xref, "Annots", "[%d 0 R]" % new)
        xref = new
    transform_annot(doc, page, xref, m)
    return doc.reload_page(page)


# --------------------------------------------------------------------------
# Opérations
# --------------------------------------------------------------------------


def check_page(sess, p):
    try:
        p = int(p)
    except (TypeError, ValueError):
        raise OpError("Numéro de page invalide.")
    if not 0 <= p < sess.doc.page_count:
        raise OpError("Cette page n'existe pas (le document en compte %d)." % sess.doc.page_count)
    return p


def group_items(sess, items):
    by_page = {}
    for it in items:
        by_page.setdefault(check_page(sess, it.get("page")), []).append(it)
    return by_page


def op_delete(sess, a):
    changed = set()
    for pno, items in group_items(sess, a.get("items", [])).items():
        page = sess.doc[pno]
        targets = [e for e in (resolve(sess, pno, it) for it in items) if e]
        if targets:
            remove_elements(sess, page, targets)
            changed.add(pno)
    return {"changed": sorted(changed)}


def op_move(sess, a):
    """Déplace / redimensionne / duplique des éléments. items: [{page,id,type,bbox,to,dest?}]
    dest : page d'arrivée (copier-coller ou couper-coller vers une autre page)."""
    copy = bool(a.get("copy"))
    changed, select = set(), []
    for pno, items in group_items(sess, a.get("items", [])).items():
        page = sess.doc[pno]
        jobs = []
        for it in items:
            el = resolve(sess, pno, it)
            if not el:
                continue
            dest = check_page(sess, it.get("dest", pno))
            if dest != pno and el["type"] not in ("text", "image", "drawing"):
                continue
            new_native = native_rect(sess.doc[dest] if dest != pno else page, nums(it.get("to"), 4))
            if new_native.width < 0.5 and el["native"].width >= 0.5:
                continue
            jobs.append((el, new_native, it["to"], dest))
        content = [j for j in jobs if j[0]["type"] in ("text", "image", "drawing")]
        annots = [j for j in jobs if j[0]["type"] in ("annot", "widget")]
        caps = [capture(sess, page, j[0]) for j in content]
        if not copy and content:
            remove_elements(sess, page, [j[0] for j in content])
        if not copy and content:
            changed.add(pno)
        for (el, nn, to, dest), cap in zip(content, caps):
            reinsert(sess, page if dest == pno else sess.doc[dest], el, cap, nn)
            select.append({"page": dest, "bbox": to, "type": el["type"]})
            changed.add(dest)
        for el, nn, to, _ in annots:
            if copy and el["type"] == "widget":
                continue
            page = move_annot(sess, page, el, nn, copy)
            select.append({"page": pno, "bbox": to, "type": el["type"]})
            changed.add(pno)
    return {"changed": sorted(changed), "select": select}


def write_text_block(page, x, y, text, size, color, fontname_fn, rot_display=0, align="left",
                     line_height=1.2, opacity=1, box_width=None):
    """Écrit un texte multi-lignes dont le coin haut-gauche (affiché) est (x, y)."""
    lines = text.split("\n")
    widths = []
    total_w = 0
    fonts = []
    for ln in lines:
        fname, fobj = fontname_fn(ln or " ")
        fonts.append(fname)
        w = text_width(fobj, ln, size)
        widths.append(w)
        total_w = max(total_w, w)
    if box_width:
        total_w = max(total_w, box_width)
    asc = fontname_fn("A")[1].ascender or 0.8
    for i, ln in enumerate(lines):
        if not ln.strip():
            continue
        dx = 0
        if align == "center":
            dx = (total_w - widths[i]) / 2
        elif align == "right":
            dx = total_w - widths[i]
        elif align == "justify" and i < len(lines) - 1 and lines[i + 1].strip() and " " in ln.strip():
            # justifié : mot par mot (le PDF ne sait pas étirer les espaces d'une police TrueType)
            words = ln.split()
            _, fobj = fontname_fn(ln)
            gap = (total_w - sum(text_width(fobj, w, size) for w in words)) / (len(words) - 1)
            if gap < 0.85 * size:
                cx = x
                for w in words:
                    p = fitz.Point(cx, y + size * asc + i * size * line_height)
                    page.insert_text(native_point(page, p), w, fontsize=size, fontname=fonts[i], color=color,
                                     rotate=(page.rotation + rot_display) % 360, fill_opacity=opacity)
                    cx += text_width(fobj, w, size) + gap
                continue
        base = fitz.Point(x + dx, y + size * asc + i * size * line_height)
        page.insert_text(native_point(page, base), ln, fontsize=size, fontname=fonts[i],
                         color=color, rotate=(page.rotation + rot_display) % 360,
                         fill_opacity=opacity)
    return fitz.Rect(x, y, x + total_w, y + size * line_height * len(lines))


def family_fontname_fn(page, family, bold, italic, sess=None):
    spec = family_spec(family, bold, italic)

    def fn(text):
        eff = effective_spec(spec, text)
        return register_font(page, eff, text, sess), font_object(eff)

    return fn


def op_add_text(sess, a):
    pno = check_page(sess, a.get("page"))
    page = sess.doc[pno]
    text = (a.get("text") or "").replace("\r", "")
    if not text.strip():
        return {"changed": []}
    size = num(a.get("size"), 1, 1000, 14, "taille")
    fn = family_fontname_fn(page, a.get("font", "helv"), a.get("bold"), a.get("italic"), sess)
    width = None
    if a.get("width"):
        # largeur imposée : retour à la ligne automatique
        width = num(a["width"], 5, COORD_MAX, what="largeur")
        rows = wrap_text(text, width, lambda t: text_width(fn(t)[1], t, size))
        text = "\n".join(r for r, _ in rows)
    y = num(a["y"], what="position") if "y" in a else num(a.get("by"), what="position") - size * (fn("A")[1].ascender or 0.9)
    r = write_text_block(page, num(a.get("x"), what="position"), y, text, size, rgb(a.get("color") or "#000"),
                         fn, align=a.get("align", "left"), opacity=num(a.get("opacity"), 0, 1, 1, "opacité"),
                         box_width=width)
    return {"changed": [pno], "select": [{"page": pno, "bbox": rlist(r), "type": "text", "zone": True}]}


def put_line(page, origin, text, size, fontname, color, angle, invisible=False, sx=1.0, opacity=1.0):
    """Écrit une ligne à partir de sa ligne de base, avec un angle quelconque.
    `page` peut aussi être une Shape (plusieurs lignes validées en une fois)."""
    if not invisible and RTL.search(text):
        raise OpError(RTL_MSG)
    kw = {"fontsize": size, "fontname": fontname, "color": color or (0, 0, 0),
          "render_mode": 3 if invisible else 0}
    if opacity < 1:
        kw["fill_opacity"] = opacity
    r = int(round(angle / 90.0)) * 90 % 360
    origin = fitz.Point(origin)
    if angle_diff(angle, r) < 0.3 and abs(sx - 1) < 1e-3:
        page.insert_text(origin, text, rotate=r, **kw)
    else:
        page.insert_text(origin, text, morph=(origin, fitz.Matrix(sx, 1) * fitz.Matrix(angle)), **kw)


def wrap_text(text, width, measure, first_indent=0.0):
    """Coupe le texte en lignes tenant dans `width`.  Retourne [(ligne, fin_de_paragraphe)]."""
    out = []
    for seg in text.split("\n"):
        words = seg.split()
        if not words:
            out.append(("", True))
            continue
        cur = ""
        for w in words:
            avail = width - (first_indent if not out else 0)
            cand = (cur + " " + w) if cur else w
            if cur and measure(cand) > avail:
                out.append((cur, False))
                cur = w
            else:
                cur = cand
        out.append((cur, True))
    return out


def style_of(el):
    spans = el["_spans"]
    return max(spans, key=lambda s: len(s["text"]))


def style_key(s):
    return (s.get("font"), round(s.get("size", 0), 1), s.get("color"), s.get("flags", 0) & 22)


def write_styled_line(sess, page, el, text):
    """Réécrit une ligne au style mixte (« Total : » en gras puis le montant,
    exposant…) : chaque caractère garde le style du caractère d'origine qui lui
    correspond, les caractères ajoutés prennent celui de leur voisin."""
    spans = el["_spans"]
    old = "".join(s["text"] for s in spans)
    owner = [i for i, s in enumerate(spans) for _ in s["text"]]
    style = [0] * len(text)
    sm = difflib.SequenceMatcher(None, old, text, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        for j in range(j1, j2):
            if tag == "equal":
                style[j] = owner[i1 + j - j1]
            elif tag == "replace":
                style[j] = owner[min(i1 + j - j1, i2 - 1)]
            else:  # insertion
                style[j] = owner[i1 - 1] if i1 > 0 else owner[0]
    runs = []
    for c, si in zip(text, style):
        if runs and runs[-1][0] == si:
            runs[-1][1] += c
        else:
            runs.append([si, c])
    d, n = el["_d"], el["_n"]
    o0 = fitz.Point(spans[0]["origin"])
    x, top, bottom = 0.0, 0.0, 0.0
    sh = page.new_shape()
    for si, t in runs:
        s = spans[si]
        dv = dot(fitz.Point(s["origin"]) - o0, n)  # exposant / indice
        name, f = sess.span_font(page, s, t)
        if t.strip():
            put_line(sh, o0 + d * x + n * dv, t, s["size"], name, rgb(s["color"]), el["_angle"])
        x += text_width(f, t, s["size"])
        top = max(top, (f.ascender or 0.9) * s["size"] - dv)
        bottom = max(bottom, abs(f.descender or 0.25) * s["size"] + dv)
    sh.commit()
    pts = [o0 - n * top, o0 + n * bottom, o0 + d * x - n * top, o0 + d * x + n * bottom]
    zone = fitz.Rect(pts[0], pts[0])
    for p in pts[1:]:
        zone |= p
    return zone


def rewrite_block(sess, page, els, text, a, para=None, removed=False, px=None):
    """Remplace une ou plusieurs lignes par `text` en gardant leur style et leur position.
    Avec `para`, le texte est remis en forme (retour à la ligne automatique, alignement).
    removed : les lignes ont déjà été supprimées (px = rendu de la page d'avant)."""
    first = els[0]
    s0 = style_of(first)
    d, n = first["_d"], first["_n"]
    angle = first["_angle"]
    ocr = any(e.get("ocr") for e in els)
    base_size = para["size"] if para else s0["size"]
    size = num(a.get("size"), 1, 1000, base_size, "taille")
    k = size / base_size if base_size else 1
    spacing = (para["spacing"] if para else base_size * 1.2) * k
    if ocr:
        px = px or PagePixels(page)
        fg = px.colors(first["native"])[1]
        color = rgb(a.get("color")) if a.get("color") else fg
    else:
        color = rgb(a.get("color")) if a.get("color") else rgb(s0["color"])
    bold = a.get("bold", first["bold"])
    italic = a.get("italic", first["italic"])
    font = a.get("font") or ("helv" if ocr else None)
    if not font and (bold != first["bold"] or italic != first["italic"]):
        b14 = base14_for(s0)
        font = "tiro" if b14.startswith("ti") else "cour" if b14.startswith("co") else "helv"
    if font:
        fn = family_fontname_fn(page, font, bold, italic, sess)
    else:
        def fn(t):
            return sess.span_font(page, s0, t)

    text = text.replace("\r", "")
    if text.strip() and not ocr and RTL.search(text):
        raise OpError(RTL_MSG)
    if not removed:
        remove_elements(sess, page, els)
    sess.drop(page.number)
    if not text.strip():
        return None

    plain = not para and len(els) == 1 and not ocr and "\n" not in text and \
        not any(a.get(key) for key in ("font", "size", "color", "align")) and \
        bold == first["bold"] and italic == first["italic"]
    if plain and len({style_key(s) for s in first["_spans"]}) > 1:
        return write_styled_line(sess, page, first, text)

    _, fobj = fn(text)

    def measure(t):
        return text_width(fn(t)[1], t, size)

    align = a.get("align") or (para["align"] if para else "left")
    if para:
        width = float(a.get("width") or para["width"])
        indent = para["indent"] * k if not a.get("width") else para["indent"]
        u0, v0 = para["_u0"], para["_v0"]
        rows = wrap_text(text, width, measure, indent)
    else:
        width, indent = None, 0
        u0, v0 = first["_u0"], first["_v"]
        rows = [(t, True) for t in text.split("\n")]
        if align != "left":
            width = max(measure(t) for t, _ in rows)

    asc = fobj.ascender or 0.9
    desc = abs(fobj.descender or 0.25)
    pts = []
    sh = page.new_shape()
    for i, (row, last) in enumerate(rows):
        base = d * u0 + n * (v0 + i * spacing)
        off = indent if i == 0 else 0
        w = measure(row) if row else 0
        if width:
            if align == "right":
                off = width - w
            elif align == "center":
                off = (width - w) / 2
        if row.strip():
            name, _ = fn(row)
            words = row.split()
            gap = ((width - off - sum(measure(x) for x in words)) / (len(words) - 1)
                   if width and len(words) > 1 else 0)
            # une ligne trop creuse n'est pas justifiée (elle resterait illisible)
            if align == "justify" and not last and len(words) > 1 and gap < 0.85 * size:
                x = off
                for wd in words:
                    put_line(sh, base + d * x, wd, size, fn(wd)[0], color, angle)
                    x += measure(wd) + gap
                w = width - off
            else:
                put_line(sh, base + d * off, row, size, name, color, angle)
        p0 = base + d * off
        pts += [p0 - n * (size * asc), p0 + n * (size * desc),
                p0 + d * w - n * (size * asc), p0 + d * w + n * (size * desc)]
    sh.commit()
    zone = fitz.Rect(pts[0], pts[0])
    for p in pts[1:]:
        zone |= p
    return zone


def op_edit_text(sess, a):
    """Remplace le texte d'une ligne existante en gardant (au mieux) son style."""
    pno = check_page(sess, a.get("page"))
    page = sess.doc[pno]
    el = resolve(sess, pno, a)
    if not el:
        raise OpError("Élément de texte introuvable — réessayez.")
    zone = rewrite_block(sess, page, [el], a.get("text") or "", a)
    if zone is None:
        return {"changed": [pno]}
    return {"changed": [pno], "select": [{"page": pno, "bbox": rlist(disp_rect(page, zone)),
                                          "type": "text", "zone": True}]}


def resolve_para(sess, pno, a):
    data = extract(sess, pno)
    p = data["paras_by_id"].get(a.get("para"))
    bbox = a.get("bbox")
    if p and (not bbox or iou(p["bbox"], bbox) > 0.85):
        return p
    best, score = None, 0.6
    for q in data["paras"]:
        sc = iou(q["bbox"], bbox) if bbox else 0
        if sc > score:
            best, score = q, sc
    return best


def op_edit_para(sess, a):
    """Réécrit un paragraphe entier, remis en forme dans sa largeur."""
    pno = check_page(sess, a.get("page"))
    page = sess.doc[pno]
    para = resolve_para(sess, pno, a)
    if not para:
        raise OpError("Paragraphe introuvable — réessayez.")
    by_id = extract(sess, pno)["by_id"]
    els = [by_id[i] for i in para["lines"]]
    zone = rewrite_block(sess, page, els, a.get("text") or "", a, para=para)
    if zone is None:
        return {"changed": [pno]}
    return {"changed": [pno], "select": [{"page": pno, "bbox": rlist(disp_rect(page, zone)),
                                          "type": "text", "zone": True}]}


# --------------------------------------------------------------------------
# Rechercher / remplacer
# --------------------------------------------------------------------------


def search_regex(query, case=False, whole=False):
    pat = re.escape(query)
    if whole:
        pat = r"(?<!\w)" + pat + r"(?!\w)"
    return re.compile(pat, 0 if case else re.IGNORECASE)


def find_matches(sess, rx, pages=None):
    out = []
    for pno in (pages if pages is not None else range(sess.doc.page_count)):
        for el in text_lines(sess, pno):
            hits = list(rx.finditer(el["text"]))
            if not hits:
                continue
            b, n = el["bbox"], max(len(el["text"]), 1)
            rects = []
            for h in hits:
                f0, f1 = h.start() / n, h.end() / n
                w, ht = b[2] - b[0], b[3] - b[1]
                a = el["angle"]
                if angle_diff(a, 0) < 1:
                    rects.append([round(b[0] + w * f0, 2), b[1], round(b[0] + w * f1, 2), b[3]])
                elif angle_diff(a, 180) < 1:
                    rects.append([round(b[2] - w * f1, 2), b[1], round(b[2] - w * f0, 2), b[3]])
                elif angle_diff(a, 270) < 1:  # texte qui descend
                    rects.append([b[0], round(b[1] + ht * f0, 2), b[2], round(b[1] + ht * f1, 2)])
                elif angle_diff(a, 90) < 1:  # texte qui monte
                    rects.append([b[0], round(b[3] - ht * f1, 2), b[2], round(b[3] - ht * f0, 2)])
                else:
                    rects.append(b)
            out.append({"page": pno, "id": el["id"], "bbox": b, "text": el["text"], "count": len(hits),
                        "rects": rects, "spans": [[h.start(), h.end()] for h in hits]})
    return out


def span_replacements(el, rx, repl):
    """Nouveau texte de chaque morceau (span) d'une ligne.  Les occurrences sont
    cherchées sur la ligne entière (« mot entier » compris) ; None si l'une
    d'elles est à cheval sur deux morceaux ou si la ligne n'en contient pas
    telle qu'écrite (morceaux recollés)."""
    spans = el["_spans"]
    full = "".join(s["text"] for s in spans)
    hits = list(rx.finditer(full))
    if not hits:
        return None
    out, pos = [], 0
    for s in spans:
        b0, b1 = pos, pos + len(s["text"])
        pos = b1
        new, cur = "", b0
        for h in hits:
            if h.start() >= b1 or h.end() <= b0:
                continue
            if h.start() < b0 or h.end() > b1:
                return None
            new += full[cur:h.start()] + repl
            cur = h.end()
        out.append((s, new + full[cur:b1]))
    return out


def plan_inline(sess, page, el, parts):
    """Mesure l'allongement de chaque morceau (avant la suppression de la ligne)."""
    d = el["_d"]
    plan, growth = [], 0.0
    for s, new in parts:
        bb = fitz.Rect(s["bbox"])
        old_adv = max(dot(c, d) for c in (bb.tl, bb.tr, bb.bl, bb.br)) - dot(fitz.Point(s["origin"]), d)
        growth += text_width(sess.span_font(page, s, new)[1], new, s["size"]) - old_adv
        plan.append((s, new, old_adv))
    return plan, growth


def write_inline(sess, page, el, plan, growth, align, sh):
    """Réécrit une ligne morceau par morceau (dans la Shape `sh`) ; une ligne
    centrée (ou alignée à droite) le reste après le remplacement."""
    d = el["_d"]
    shift = -growth / 2 if align == "center" else -growth if align == "right" else 0.0
    for s, new, old_adv in plan:
        name, fobj = sess.span_font(page, s, new)
        if new.strip():
            put_line(sh, fitz.Point(s["origin"]) + d * shift, new, s["size"], name, rgb(s["color"]), el["_angle"])
        shift += text_width(fobj, new, s["size"]) - old_adv


def op_replace(sess, a):
    query = a.get("query") or ""
    if not query:
        return {"changed": []}
    rx = search_regex(query, a.get("case"), a.get("whole"))
    repl = (a.get("replacement") or "").replace("\r", "").replace("\n", " ")
    only = {(check_page(sess, t.get("page")), t.get("id")) for t in a["targets"]} if "targets" in a else None
    pages = sorted({p for p, _ in only}) if only else range(sess.doc.page_count)
    changed, count, skipped = [], 0, 0
    for pno in pages:
        page = sess.doc[pno]
        data = extract(sess, pno)
        targets = [e for e in data["els"]
                   if e["type"] == "text" and rx.search(e["text"]) and (not only or (pno, e["id"]) in only)]
        if not targets:
            continue
        aligns = {e["id"]: data["paras_by_id"][e["para"]]["align"] for e in targets if e.get("para")}
        jobs = []
        for el in targets:
            n = len(rx.findall(el["text"]))
            if not el.get("ocr") and (RTL.search(el["text"]) or RTL.search(repl)):
                skipped += n
                continue
            parts = None if el.get("ocr") else span_replacements(el, rx, repl)
            if parts is None:
                jobs.append((el, None, rx.sub(lambda m: repl, el["text"])))
            else:
                jobs.append((el, plan_inline(sess, page, el, parts), None))
            count += n
        if not jobs:
            continue
        # une seule suppression pour toute la page (c'est l'étape coûteuse)
        px = PagePixels(page) if any(el.get("ocr") for el, _, _ in jobs) else None
        remove_elements(sess, page, [el for el, _, _ in jobs])
        sh = page.new_shape()
        for el, plan, text in jobs:
            if plan is not None:
                write_inline(sess, page, el, plan[0], plan[1], aligns.get(el["id"], "left"), sh)
        sh.commit()
        for el, plan, text in jobs:
            if plan is None:
                rewrite_block(sess, page, [el], text, {}, removed=True, px=px)
        changed.append(pno)
        sess.drop(pno)
    if not changed:
        return {"changed": [], "count": 0, "skipped": skipped}
    return {"changed": changed, "count": count, "skipped": skipped}


# --------------------------------------------------------------------------
# Reconnaissance de texte (OCR) — moteur intégré à Windows
# --------------------------------------------------------------------------


def _winocr():
    try:
        from winrt.windows.media.ocr import OcrEngine  # noqa: F401
        return True
    except Exception:
        return False


OCR_AVAILABLE = _winocr()


def ocr_image(png):
    """Lignes reconnues dans une image PNG : [(texte, (x0, y0, x1, y1) en pixels)]."""
    import asyncio
    from winrt.windows.globalization import Language
    from winrt.windows.graphics.imaging import BitmapDecoder
    from winrt.windows.media.ocr import OcrEngine
    from winrt.windows.storage.streams import DataWriter, InMemoryRandomAccessStream

    async def run():
        stream = InMemoryRandomAccessStream()
        w = DataWriter(stream)
        w.write_bytes(png)
        await w.store_async()
        await w.flush_async()
        w.detach_stream()
        stream.seek(0)
        bmp = await (await BitmapDecoder.create_async(stream)).get_software_bitmap_async()
        eng = OcrEngine.try_create_from_user_profile_languages()
        if eng is None:
            eng = OcrEngine.try_create_from_language(Language("fr-FR"))
        if eng is None:
            raise OpError("Aucune langue de reconnaissance de texte n'est installée dans Windows.")
        res = await eng.recognize_async(bmp)
        out = []
        for ln in res.lines:
            words = list(ln.words)
            if not words:
                continue
            x0 = min(wd.bounding_rect.x for wd in words)
            y0 = min(wd.bounding_rect.y for wd in words)
            x1 = max(wd.bounding_rect.x + wd.bounding_rect.width for wd in words)
            y1 = max(wd.bounding_rect.y + wd.bounding_rect.height for wd in words)
            out.append((" ".join(wd.text for wd in words), (x0, y0, x1, y1)))
        return out

    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(run())
    finally:
        loop.close()


ASCENDERS = set("bdfhklt0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇàâäéèêëîïôöùûüç%&?!/()[]{}|'\"€$£#@")
DESCENDERS = set("gjpqyQ,;()[]{}|/ç")


def op_ocr(sess, a):
    if not OCR_AVAILABLE:
        raise OpError("La reconnaissance de texte nécessite le module winrt "
                      "(pip install -r requirements.txt) et Windows 10/11.")
    changed = []
    for pno in a.get("pages", []):
        pno = check_page(sess, pno)
        if extract(sess, pno)["ocr"] and not a.get("force"):
            continue  # déjà reconnue : la couche de texte serait doublée
        page = sess.doc[pno]
        lines, k, scale, W, H = ocr_page_oriented(page)
        fn = family_fontname_fn(page, "helv", False, False, sess)
        # angle du texte à l'écran : l'image a été tournée de k quarts de tour pour le redresser
        angle = (page.rotation - 90 * k) % 360
        sh = page.new_shape()
        for text, (x0, y0, x1, y1) in lines:
            if x1 - x0 < scale or y1 - y0 < scale or not text.strip():
                continue
            top = 0.72 if set(text) & ASCENDERS else 0.52
            bottom = 0.21 if set(text) & DESCENDERS else 0.0
            size = max((y1 - y0) / scale / (top + bottom), 3)
            name, fobj = fn(text)
            sx = min(max((x1 - x0) / scale / max(text_width(fobj, text, size), 1), 0.4), 2.5)
            bx, by = unrotate_point(x0, y1 - bottom * size * scale, k, W, H)
            base = native_point(page, (bx / scale, by / scale))
            put_line(sh, base, text, size, name, (0, 0, 0), angle, invisible=True, sx=sx)
        sh.commit()
        sess.drop(pno)
        changed.append(pno)
    return {"changed": changed}


def unrotate_point(x, y, k, W, H):
    """Point d'une image tournée par numpy.rot90(k) -> point de l'image d'origine (W x H)."""
    if k == 1:
        return W - y, x
    if k == 2:
        return W - x, H - y
    if k == 3:
        return y, H - x
    return x, y


def ocr_score(lines):
    return sum(len(w) for t, _ in lines for w in re.findall(r"[^\W\d_]{3,}", t))


def ocr_page_oriented(page):
    """OCR de la page affichée ; essaie les autres orientations si presque rien n'est lu."""
    import numpy as np
    r = page.rect
    scale = min(250 / 72, 9000 / max(r.width, r.height))  # 250 ppp : aussi fiable que 300, plus rapide
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False, colorspace=fitz.csRGB)
    arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    best = None
    for k in (0, 1, 3, 2):
        if k:
            rot = np.ascontiguousarray(np.rot90(arr, k))
            png = fitz.Pixmap(fitz.csRGB, rot.shape[1], rot.shape[0], rot.tobytes(), False).tobytes("png")
        else:
            png = pix.tobytes("png")
        lines = ocr_image(png)
        sc = ocr_score(lines)
        if best is None or sc > best[0] * 1.3:
            best = (sc, lines, k)
        if k == 0 and sc >= 40:
            break
    return best[1], best[2], scale, pix.width, pix.height


def decode_data_url(s):
    if "," in s and s.startswith("data:"):
        s = s.split(",", 1)[1]
    return base64.b64decode(s)


def op_fill_field(sess, a):
    """Remplit un champ de formulaire (texte, case à cocher, bouton radio, liste)."""
    pno = check_page(sess, a.get("page"))
    page = sess.doc[pno]
    xref = int(a.get("xref") or 0)
    target = next((w for w in page.widgets() if w.xref == xref), None)
    if target is None:
        raise OpError("Champ introuvable — réessayez.")
    if (target.field_flags or 0) & 1:
        raise OpError("Ce champ est en lecture seule.")
    kind = FIELD_KIND.get(target.field_type, "other")
    value = a.get("value")
    if kind == "radio":
        # un seul bouton coché dans le groupe
        for w in page.widgets():
            if w.field_name == target.field_name and w.field_type == target.field_type:
                w.field_value = (w.xref == xref) and bool(value)
                w.update()
    elif kind == "checkbox":
        target.field_value = bool(value)
        target.update()
    elif kind in ("text", "combo", "list"):
        value = "" if value is None else str(value)
        pairs = [(c, c) if isinstance(c, str) else (c[0], c[-1]) for c in (target.choice_values or [])]
        exports = [e for e, _ in pairs]
        if value and value not in exports:  # libellé reçu : on enregistre sa valeur
            value = next((e for e, lbl in pairs if lbl == value), value)
        if kind == "list" and value and value not in exports:
            raise OpError("Ce choix n'existe pas dans la liste.")
        if kind == "text" and target.text_maxlen and len(value) > target.text_maxlen:
            value = value[:target.text_maxlen]
        target.field_value = value
        target.update()
    else:
        raise OpError("Ce type de champ ne se remplit pas ici.")
    return {"changed": [pno]}


def op_add_image(sess, a):
    pno = check_page(sess, a.get("page"))
    page = sess.doc[pno]
    try:
        data = decode_data_url(a["data"])
    except Exception:
        raise OpError("Image illisible.")
    check_image_size(data)
    r = native_rect(page, nums(a.get("bbox"), 4))
    # rotate : redresse l'image sur les pages pivotées
    with unrotated(page) as r0:
        try:
            page.insert_image(r, stream=data, keep_proportion=False, rotate=r0)
        except Exception:
            try:  # formats exotiques : on passe par Pixmap
                pix = fitz.Pixmap(data)
            except Exception:
                raise OpError("Image illisible ou endommagée.")
            page.insert_image(r, pixmap=pix, keep_proportion=False, rotate=r0)
    return {"changed": [pno], "select": [{"page": pno, "bbox": a["bbox"], "type": "image"}]}


def op_add_shape(sess, a):
    pno = check_page(sess, a.get("page"))
    page = sess.doc[pno]
    kind = a.get("kind", "rect")
    stroke = rgb(a.get("stroke"))
    fill = rgb(a.get("fill"))
    width = num(a.get("width"), 0, 200, 2, "épaisseur")
    opacity = num(a.get("opacity"), 0, 1, 1, "opacité")
    if kind in ("line", "arrow"):
        p1 = native_point(page, nums(a.get("p1"), 2))
        p2 = native_point(page, nums(a.get("p2"), 2))
    else:
        r = native_rect(page, nums(a.get("bbox"), 4))
    with unrotated(page):
        shape = page.new_shape()
        sel_bbox = draw_shape(shape, a, kind, stroke, fill, width, opacity, p1 if kind in ("line", "arrow") else None,
                              p2 if kind in ("line", "arrow") else None, None if kind in ("line", "arrow") else r)
        shape.commit()
    return {"changed": [pno], "select": [{"page": pno, "bbox": sel_bbox, "type": "drawing", "zone": True}]}


def draw_shape(shape, a, kind, stroke, fill, width, opacity, p1, p2, r):
    if kind in ("line", "arrow"):
        shape.draw_line(p1, p2)
        shape.finish(color=stroke or (0, 0, 0), width=width, lineCap=1, stroke_opacity=opacity)
        if kind == "arrow":
            v = p2 - p1
            ln = math.hypot(v.x, v.y) or 1
            u = fitz.Point(v.x / ln, v.y / ln)
            nrm = fitz.Point(-u.y, u.x)
            head = max(8, width * 4)
            b = p2 - u * head
            shape.draw_polyline([b + nrm * (head * 0.5), p2, b - nrm * (head * 0.5)])
            shape.finish(color=stroke or (0, 0, 0), fill=stroke or (0, 0, 0), width=width,
                         closePath=True, stroke_opacity=opacity, fill_opacity=opacity)
        x0, x1 = sorted([a["p1"][0], a["p2"][0]])
        y0, y1 = sorted([a["p1"][1], a["p2"][1]])
        return [x0, y0, x1, y1]
    if kind == "ellipse":
        shape.draw_oval(r)
    else:
        shape.draw_rect(r)
    shape.finish(color=stroke, fill=fill, width=width if stroke else 0,
                 stroke_opacity=opacity, fill_opacity=opacity)
    return a["bbox"]


def op_add_ink(sess, a):
    pno = check_page(sess, a.get("page"))
    page = sess.doc[pno]
    color = rgb(a.get("color") or "#000")
    width = num(a.get("width"), 0.1, 200, 2, "épaisseur")
    opacity = num(a.get("opacity"), 0, 1, 1, "opacité")
    strokes = []
    for stroke in (a.get("strokes") or [])[:500]:
        pts = [native_point(page, nums(p, 2)) for p in stroke[:20000]]
        if len(pts) == 1:
            pts.append(pts[0] + (0.1, 0.1))
        if len(pts) >= 2:
            strokes.append(pts)
    if not strokes:
        return {"changed": []}
    with unrotated(page):
        shape = page.new_shape()
        for pts in strokes:
            shape.draw_polyline(pts)
        # un seul tracé pour tous les traits : une signature se sélectionne et se
        # déplace d'un bloc
        shape.finish(color=color, width=width, lineCap=1, closePath=False,
                     stroke_opacity=opacity)
        shape.commit()
    return {"changed": [pno]}


def op_add_highlight(sess, a):
    pno = check_page(sess, a.get("page"))
    page = sess.doc[pno]
    x0, y0, x1, y1 = nums(a.get("bbox"), 4)
    q = fitz.Quad(*(native_point(page, p) for p in ((x0, y0), (x1, y0), (x0, y1), (x1, y1))))
    annot = page.add_highlight_annot(q)
    annot.set_colors(stroke=rgb(a.get("color") or "#ffeb3b"))
    annot.update()
    return {"changed": [pno]}


def op_erase(sess, a):
    """Gomme : efface tout ce qui se trouve dans la zone (texte, images, tracés)."""
    pno = check_page(sess, a.get("page"))
    page = sess.doc[pno]
    r = native_rect(page, nums(a.get("bbox"), 4))
    for an in [an for an in page.annots() if r.contains(an.rect)]:
        page.delete_annot(an)
    sess.registered = {k for k in sess.registered if k[0] != pno}
    links = page.get_links()
    page.add_redact_annot(r, fill=False)
    page.apply_redactions(images=R_IMG_PIXELS, graphics=R_ART_COVERED, text=R_TXT_REMOVE)
    restore_links(page, links, zone=r)
    return {"changed": [pno]}


def op_page_delete(sess, a):
    pages = sorted({check_page(sess, p) for p in a.get("pages", [])})
    if not pages:
        return {"changed": []}
    if len(pages) >= sess.doc.page_count:
        raise OpError("Impossible de supprimer toutes les pages.")
    sess.doc.delete_pages(pages)
    return {"changed": None}


def op_page_rotate(sess, a):
    angle = int(a.get("angle", 90))
    if angle % 90:
        raise OpError("Une page ne peut pivoter que par quart de tour.")
    pages = sorted({check_page(sess, p) for p in a.get("pages", [])})
    if not pages or angle % 360 == 0:
        return {"changed": []}
    for p in pages:
        page = sess.doc[p]
        page.set_rotation((page.rotation + angle) % 360)
    return {"changed": None}


def op_page_move(sess, a):
    src, dst = int(a["from"]), int(a["to"])  # dst = index final souhaité
    n = sess.doc.page_count
    if src == dst or not (0 <= src < n) or not (0 <= dst < n):
        return {"changed": []}
    order = list(range(n))
    order.insert(dst, order.pop(src))
    sess.doc.select(order)
    return {"changed": None}


def op_page_duplicate(sess, a):
    pages = sorted({check_page(sess, p) for p in (a.get("pages") or [a.get("page")])}, reverse=True)
    for p in pages:  # de la fin vers le début : les numéros restent valables
        # fullcopy_page n'accepte pas « après la dernière page » : -1 = à la fin
        sess.doc.fullcopy_page(p, p + 1 if p + 1 < sess.doc.page_count else -1)
    return {"changed": None}


def op_page_blank(sess, a):
    at = min(max(int(a.get("at", sess.doc.page_count)), 0), sess.doc.page_count)
    ref = sess.doc[min(max(at - 1, 0), sess.doc.page_count - 1)]
    r = ref.rect
    sess.doc.new_page(at, width=r.width, height=r.height)
    return {"changed": None}


OPS = {
    "delete": op_delete,
    "move": op_move,
    "add_text": op_add_text,
    "edit_text": op_edit_text,
    "edit_para": op_edit_para,
    "replace": op_replace,
    "ocr": op_ocr,
    "add_image": op_add_image,
    "fill_field": op_fill_field,
    "add_shape": op_add_shape,
    "add_ink": op_add_ink,
    "add_highlight": op_add_highlight,
    "erase": op_erase,
    "page_delete": op_page_delete,
    "page_rotate": op_page_rotate,
    "page_move": op_page_move,
    "page_duplicate": op_page_duplicate,
    "page_blank": op_page_blank,
}


def resolve_selection(sess, hints):
    out = []
    for h in hints or []:
        pno = h["page"]
        if pno >= sess.doc.page_count:
            continue
        els = extract(sess, pno)["els"]
        hb = fitz.Rect(h["bbox"])
        if h.get("zone"):
            zone = hb + (-3, -3, 3, 3)
            harea = max(hb.width * hb.height, 1)
            for e in els:
                if h.get("type") and e["type"] != h["type"]:
                    continue
                eb = fitz.Rect(e["bbox"])
                c = fitz.Point((eb.x0 + eb.x1) / 2, (eb.y0 + eb.y1) / 2)
                if zone.contains(c) and eb.width * eb.height <= harea * 2 + 50:
                    out.append({"page": pno, "id": e["id"]})
        else:
            best, sc = None, 0.5
            for e in els:
                if h.get("type") and e["type"] != h["type"]:
                    continue
                s = iou(e["bbox"], hb)
                if s > sc:
                    best, sc = e, s
            if best:
                out.append({"page": pno, "id": best["id"]})
    # dédoublonne
    seen, res = set(), []
    for o in out:
        k = (o["page"], o["id"])
        if k not in seen:
            seen.add(k)
            res.append(o)
    return res


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------


@app.errorhandler(OpError)
def handle_op_error(e):
    return jsonify({"error": str(e)}), 400


@app.errorhandler(404)
def not_found(e):
    if request.path.startswith("/api/"):
        return jsonify({"error": getattr(e, "description", None) or "Introuvable."}), 404
    return e


@app.errorhandler(500)
def server_error(e):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Erreur interne du serveur : réessayez, ou rechargez la page."}), 500
    return e


@app.errorhandler(413)
def too_large(_e):
    return jsonify({"error": "Fichier trop volumineux (%d Mo au maximum)."
                    % (app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024))}), 413


def request_host():
    host = request.host or ""
    if host.startswith("["):
        return host.split("]")[0] + "]"
    return host.rsplit(":", 1)[0]


@app.before_request
def guard():
    """N'accepte que les requêtes de la page de l'application.
    - En-tête Host local : bloque le « DNS rebinding » (un site qui se ferait
      passer pour 127.0.0.1).
    - Jeton propre au lancement sur toute l'API : un autre site ouvert dans le
      navigateur ne peut ni lire ni modifier les documents (CSRF)."""
    if request_host() not in LOCAL_HOSTS:
        abort(403)
    if not request.path.startswith("/api/"):
        return None
    origin = request.headers.get("Origin")
    if origin and origin != "null":
        o = origin.split("//", 1)[-1]
        o = o.split("]")[0] + "]" if o.startswith("[") else o.rsplit(":", 1)[0]
        if o not in LOCAL_HOSTS:
            abort(403)
    # Les images de page sont chargées par <img> (pas d'en-tête possible) : un
    # autre site peut les afficher mais pas les lire (pas de CORS), et il lui
    # faudrait deviner l'identifiant du document.
    if request.method == "GET" and request.path.endswith(".png"):
        return None
    if request.headers.get("X-PDF-Changer") != TOKEN:
        return jsonify({"error": "Accès refusé : rechargez la page de PDF Changer."}), 403
    return None


@app.after_request
def secure_headers(resp):
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Referrer-Policy"] = "no-referrer"
    resp.headers["Content-Security-Policy"] = (
        "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; "
        "script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
    return resp


@app.get("/")
def index():
    with open(os.path.join(STATIC, "index.html"), encoding="utf-8") as f:
        html = f.read().replace("{{TOKEN}}", TOKEN)
    resp = Response(html, mimetype="text/html")
    resp.headers["Cache-Control"] = "no-store"
    return resp


@app.get("/api/fonts")
def fonts():
    return jsonify([{"key": k, "label": v[0], "css": v[1]} for k, v in FONT_FAMILIES.items()])


@app.post("/api/open")
def open_doc():
    f = request.files.get("file")
    if not f:
        raise OpError("Aucun fichier reçu.")
    data = f.read()
    pdf = to_pdf_bytes(data, f.filename, request.form.get("password"))
    name = os.path.splitext(os.path.basename(f.filename or "document"))[0] or "document"
    s = new_session(pdf, name)
    try:
        return jsonify(s.info())
    except Exception:
        with SESSIONS_LOCK:
            SESSIONS.pop(s.id, None)
        s.close()
        raise OpError("Ce PDF est endommagé et ne peut pas être ouvert.")


@app.post("/api/new")
def new_doc():
    doc = fitz.open()
    doc.new_page(width=595.28, height=841.89)
    s = new_session(doc.tobytes(), "nouveau-document")
    return jsonify(s.info())


@app.get("/api/doc/<sid>/info")
def doc_info(sid):
    s = get_session(sid)
    with s.lock:
        alive(s)
        return jsonify(s.info())


@app.get("/api/doc/<sid>/page/<int:pno>.png")
def render_page(sid, pno):
    s = get_session(sid)
    try:
        scale = float(request.args.get("s", 1.5))
    except ValueError:
        scale = 1.5
    if not math.isfinite(scale):
        scale = 1.5
    scale = min(max(scale, 0.05), 8)
    with s.lock:
        alive(s)
        if not 0 <= pno < s.doc.page_count:
            abort(404)
        page = s.doc[pno]
        r = page.rect
        scale = min(scale, math.sqrt(MAX_RENDER_PX / max(r.width * r.height, 1)))
        pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    data = pix.tobytes("png")  # encodage hors du verrou : les autres requêtes avancent
    return send_file(io.BytesIO(data), mimetype="image/png", max_age=3600)


@app.get("/api/doc/<sid>/page/<int:pno>/elements")
def page_elements(sid, pno):
    s = get_session(sid)
    with s.lock:
        alive(s)
        if not 0 <= pno < s.doc.page_count:
            abort(404)
        data = extract(s, pno)
        return jsonify({"version": s.version, "elements": [public(e) for e in data["els"]],
                        "paras": [public(p) for p in data["paras"]],
                        "scan": data["scan"], "ocr": data["ocr"]})


@app.get("/api/doc/<sid>/scans")
def scanned_pages(sid):
    """Pages qui ne sont que des images (à passer à l'OCR)."""
    s = get_session(sid)
    with s.lock:
        alive(s)
        out = []
        for page in s.doc:
            r = page.rect
            area = max(r.width * r.height, 1)
            try:  # d'abord la grande image (rapide), ensuite seulement le texte
                big = any(fitz.Rect(i["bbox"]).get_area() > 0.45 * area for i in page.get_image_info())
            except Exception:
                big = False
            if big and not page.get_text("text").strip():
                out.append(page.number)
        return jsonify({"pages": out, "available": OCR_AVAILABLE})


@app.get("/api/doc/<sid>/search")
def search(sid):
    s = get_session(sid)
    q = request.args.get("q", "")
    if not q.strip():
        return jsonify({"matches": []})
    rx = search_regex(q, request.args.get("case") == "1", request.args.get("whole") == "1")
    with s.lock:
        alive(s)
        return jsonify({"matches": find_matches(s, rx)[:2000]})


def alive(s):
    """À appeler sous s.lock : le document a pu être fermé entre-temps."""
    if s.closed:
        abort(404, "Document introuvable : il a été fermé (trop de documents ouverts).")


def reply(s, changed, extra=None):
    out = s.info()
    out["changed"] = changed
    out.update(extra or {})
    return jsonify(out)


def friendly_error(e):
    """Message compréhensible pour une erreur imprévue (souvent en anglais, de MuPDF)."""
    msg = str(e).lower()
    if "image" in msg or "png" in msg or "jpeg" in msg or "jpx" in msg:
        return "L'opération a échoué : une image est illisible ou endommagée."
    if "font" in msg:
        return "L'opération a échoué : une police du document est inutilisable."
    if "memory" in msg or isinstance(e, MemoryError):
        return "L'opération a échoué : mémoire insuffisante."
    return "L'opération a échoué (%s). Elle a été annulée, le document est intact." % (str(e)[:120] or type(e).__name__)


@app.post("/api/doc/<sid>/op")
def do_op(sid):
    s = get_session(sid)
    a = request.get_json(silent=True)  # Content-Type JSON obligatoire
    if not isinstance(a, dict):
        raise OpError("Requête invalide.")
    fn = OPS.get(a.get("op"))
    if not fn:
        raise OpError("Opération inconnue : %s" % a.get("op"))
    with s.lock:
        alive(s)
        try:
            s.prepare()
            res = fn(s, a) or {}
        except OpError:
            s.rollback()
            raise
        except Exception as e:  # on ne laisse jamais un document à moitié modifié
            s.rollback()
            app.logger.exception("op %s", a.get("op"))
            raise OpError(friendly_error(e))
        extra = {k: res[k] for k in ("count", "skipped") if k in res}
        if res.get("changed") == []:  # rien n'a changé : pas de nouvelle étape
            if s.doc.is_dirty:
                s.rollback()
            return reply(s, [], extra)
        s.commit(res.get("changed"), amend=bool(a.get("amend")))
        try:
            extra["select"] = resolve_selection(s, res.get("select"))
        except Exception:
            app.logger.exception("sélection")
            extra["select"] = []
        if a.get("op") == "ocr":
            release_memory()
        return reply(s, res.get("changed"), extra)


@app.post("/api/doc/<sid>/merge")
def merge(sid):
    s = get_session(sid)
    f = request.files.get("file")
    if not f:
        raise OpError("Aucun fichier reçu.")
    pdf = to_pdf_bytes(f.read(), f.filename, request.form.get("password"))
    with s.lock:
        alive(s)
        try:
            at = min(max(int(request.form.get("at", s.doc.page_count)), 0), s.doc.page_count)
            s.prepare()
            src = fitz.open("pdf", pdf)
            s.doc.insert_pdf(src, start_at=at)
            src.close()
        except Exception as e:
            s.rollback()
            raise OpError("Fusion impossible : %s" % e)
        s.commit(None)
        return reply(s, None)


@app.post("/api/doc/<sid>/undo")
def undo(sid):
    s = get_session(sid)
    with s.lock:
        alive(s)
        return reply(s, s.undo())


@app.post("/api/doc/<sid>/redo")
def redo(sid):
    s = get_session(sid)
    with s.lock:
        alive(s)
        return reply(s, s.redo())


def parse_pages(spec, count):
    """« 1-3, 5 » -> [0, 1, 2, 4] (numéros affichés à partir de 1)."""
    out = []
    for part in (spec or "").replace(" ", "").split(","):
        if not part:
            continue
        m = re.fullmatch(r"(\d+)(?:-(\d+))?", part)
        if not m:
            raise OpError("Pages à exporter illisibles : « %s » (exemple : 1-3, 5)." % part)
        a = int(m.group(1))
        b = int(m.group(2) or a)
        if a > b:
            a, b = b, a
        if a < 1 or b > count:
            raise OpError("Le document n'a que %d page%s." % (count, "s" if count > 1 else ""))
        out += [p for p in range(a - 1, b) if p not in out]
    return out


def safe_name(name, default):
    name = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', "_", name or "").strip(" .")[:150] or default
    return name if name.lower().endswith(".pdf") else name + ".pdf"


def export_pdf(s, pages=None, compress=False):
    """PDF final : pages choisies, images éventuellement recompressées, polices
    réduites aux caractères utilisés (une police complète pèse ~1 Mo)."""
    with s.lock:
        alive(s)
        data = s.doc.tobytes(garbage=1)
    out = fitz.open("pdf", data)
    try:
        if pages and pages != list(range(out.page_count)):  # extrait ou nouvel ordre
            out.select(pages)
        if compress and any(out[i].get_images() for i in range(out.page_count)):
            try:  # images ré-échantillonnées à 150 ppp, en JPEG
                out.rewrite_images(dpi_threshold=200, dpi_target=150, quality=75, lossy=True, lossless=True)
                # réécrit et rouvert avant la suite : sinon le nettoyage final peut
                # confondre une police ajoutée avec une police Type3 (texte illisible)
                data = out.tobytes(garbage=1)
                out.close()
                out = fitz.open("pdf", data)
            except Exception:
                app.logger.exception("compression des images")
        try:
            out.subset_fonts()
        except Exception:
            app.logger.exception("sous-ensemble des polices")
        # garbage=4 (doublons) est très lent sur les gros documents pour un gain nul
        garbage = 4 if out.xref_length() < 3000 else 2
        return out.tobytes(garbage=garbage, deflate=True, deflate_images=True, deflate_fonts=True, use_objstms=1)
    finally:
        out.close()
        release_memory()


@app.get("/api/doc/<sid>/download")
def download(sid):
    s = get_session(sid)
    with s.lock:
        alive(s)
        pages = parse_pages(request.args.get("pages"), s.doc.page_count)
    result = export_pdf(s, pages, request.args.get("compress") == "1")
    name = safe_name(request.args.get("name"), s.name + "-modifie.pdf")
    return send_file(io.BytesIO(result), mimetype="application/pdf", as_attachment=True,
                     download_name=name)


def free_port(preferred=5173):
    for port in [preferred] + list(range(5174, 5200)):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            if sock.connect_ex(("127.0.0.1", port)) != 0:
                return port
    return 0


if __name__ == "__main__":
    port = int(os.environ.get("PORT") or free_port())
    url = "http://127.0.0.1:%d" % port
    print("\n  PDF Changer est prêt : %s\n  (Ctrl+C pour arrêter)\n" % url)
    if "--no-browser" not in sys.argv:
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    app.run(host="127.0.0.1", port=port, threaded=True, debug=False)

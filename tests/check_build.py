#!/usr/bin/env python3
"""Prüft die ausgelieferte Datei, nicht nur ihre Vorlage."""

import argparse
import base64
import hashlib
import io
import json
import re
import subprocess
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent


class Document(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.blocks = {}
        self.images = {}
        self.current = None
        self.resources = []
        self.lang = None
        self.csp = None

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "html":
            self.lang = attrs.get("lang")
        if tag == "meta" and attrs.get("http-equiv") == "Content-Security-Policy":
            self.csp = attrs["content"]
        for attribute in ("src", "href", "srcset", "action"):
            if attrs.get(attribute):
                self.resources.append(attrs[attribute])
        if tag == "script":
            key = attrs.get("data-image-id") or attrs.get("id")
            assert key, "Jeder Daten-/Codeblock muss eindeutig identifizierbar sein."
            collection = self.images if "data-image-id" in attrs else self.blocks
            assert key not in collection, f"Doppelter Block: {key}"
            collection[key] = ""
            self.current = collection, key

    def handle_data(self, data):
        if self.current:
            collection, key = self.current
            collection[key] += data

    def handle_endtag(self, tag):
        if tag == "script":
            self.current = None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", type=Path, help="Eingebettete Bildbeispiele zur Sichtprüfung in einen vorhandenen Ordner schreiben.")
    args = parser.parse_args()
    raw = (ROOT / "index.html").read_bytes()
    html = raw.decode("utf-8")
    source = json.loads((ROOT / "angebote_basel-landschaft.json").read_text(encoding="utf-8"))
    report = json.loads((ROOT / "bildpruefung.json").read_text(encoding="utf-8"))
    document = Document()
    document.feed(html)
    book = json.loads(document.blocks["book-data"])
    highlights = json.loads(document.blocks["highlights-data"])
    fields = ("nr", "id", "firma", "angebot", "typ", "kategorie")
    assert book["angebote"] == [{key: item[key] for key in fields} for item in source["angebote"]]
    assert book["region"] == source["region"]
    assert book["hinweis"] == source["hinweis"]
    assert book["anzahl"] == len(book["angebote"]) == 128
    assert len({offer["id"] for offer in book["angebote"]}) == 128
    assert len({offer["firma"] for offer in book["angebote"]}) == 118
    assert set(document.images) == {offer["id"] for offer in book["angebote"]}
    assert document.lang == "de-CH"
    assert "connect-src 'none'" in document.csp
    assert all(url.startswith(("#", "data:")) for url in document.resources), document.resources
    assert "https://2f1.ch" not in html
    assert not re.search(r"\b(?:fetch|XMLHttpRequest|WebSocket)\b", document.blocks["application-code"])
    assert "gutscheinbuch:design:v1" in document.blocks["theme-init"]
    assert "const themeKey = 'gutscheinbuch:design:v1';" in document.blocks["application-code"]
    assert "@@" not in html
    for block in ("theme-init", "application-code"):
        subprocess.run(["node", "--check"], input=document.blocks[block], text=True, check=True)
    print("OK: Alle 128 Angebote unverändert enthalten; IDs, Region, Schreibweise und Offline-Ressourcen geprüft.")

    counts = Counter()
    missing = []
    byte_count = 0
    decoded_images = {}
    for offer in source["angebote"]:
        pictures = json.loads(document.images[offer["id"]])
        for key in ("angebotsbild", "vorderseite", "rueckseite"):
            if key not in pictures:
                missing.append((offer["nr"], key))
                continue
            picture = pictures[key]
            prefix, encoded = picture["src"].split(",", 1)
            assert prefix == "data:image/webp;base64"
            content = base64.b64decode(encoded, validate=True)
            assert content[:4] == b"RIFF" and content[8:12] == b"WEBP"
            with Image.open(io.BytesIO(content)) as image:
                image.load()
                assert image.size == (picture["width"], picture["height"])
                if key == "rueckseite":
                    assert image.size == (1206, 1700), "Rückseitentexte behalten ihre volle Auflösung."
                if key == "vorderseite":
                    assert image.height == 1500
                if key == "angebotsbild":
                    assert image.width == 480
            counts[key] += 1
            byte_count += len(content)
            if args.samples and offer["nr"] in (69, 112, 119, 127):
                decoded_images[f"optimiert-{offer['nr']:03}-{key}.webp"] = content
    assert counts == {"angebotsbild": 128, "vorderseite": 128, "rueckseite": 125}, counts
    assert missing == [(70, "rueckseite"), (71, "rueckseite"), (121, "rueckseite")], missing
    assert sum(counts.values()) == report["kompression"]["eingebettete_bilder"] == 381
    assert byte_count == report["kompression"]["optimierte_bildbytes"]
    assert len(raw) == report["html_bytes"]
    assert hashlib.sha256(raw).hexdigest() == report["html_sha256"]
    assert len(book["bildhinweise"]) == 3
    assert report["jpgs_mit_gueltigen_magic_bytes"] == 382
    assert report["nicht_zugeordnete_bilder"] == []
    if args.samples:
        assert args.samples.is_dir()
        for name, content in decoded_images.items():
            (args.samples / name).write_bytes(content)
    print("OK: 381 eingebettete Bilder vollständig dekodiert; genau die drei bestätigten Ersatz-Rückseiten.")

    assert [pick["nr"] for pick in highlights] == [126, 45, 119, 61, 17, 53, 103]
    by_id = {offer["id"]: offer for offer in book["angebote"]}
    assert len({pick["id"] for pick in highlights}) == 7
    for pick in highlights:
        assert by_id[pick["id"]]["nr"] == pick["nr"]
        assert all(pick[field].strip() for field in ("ort", "leistung", "beschreibung", "einloesung", "gueltigkeit"))
    print("OK: Sieben Highlights mit gültigen Angebotsverweisen und ergänzenden Angaben. JavaScript-Syntax fehlerfrei.")
    print(f"Endgrösse: {len(raw):,} Bytes / {len(raw) / 1_000_000:.2f} MB.")


if __name__ == "__main__":
    main()

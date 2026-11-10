#!/usr/bin/env python3
"""Prüft die lokalen Quellen und erstellt die autarke Gutschein-Website.

Es werden keine URLs abgerufen. Bildformate werden anhand des Inhalts geprüft;
die Zuordnung erfolgt ausschliesslich über das Manifest und die Angebots-ID.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import html
import io
import json
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path, PurePosixPath
from zipfile import ZipFile

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "angebote_basel-landschaft.json"
ZIP_FILE = ROOT / "basel-landschaft-gutscheine-2027-bilder.zip"
PICTURE_TYPES = {
    "angebotsbild": "Angebotsbild",
    "vorderseite": "Vorderseite",
    "rueckseite": "Rückseite",
}
CATEGORIES = (
    "Essen & Trinken",
    "Ausgang & Nachtleben",
    "Freizeit & Sport",
    "Einkaufen & Dienstleistungen",
    "Wellness & Beauty",
)
OFFER_FIELDS = ("nr", "id", "firma", "angebot", "typ", "kategorie")
# Vom Nutzer nach der Struktur- und Sichtprüfung ausdrücklich bestätigt:
# Die vermeintliche Ergolz-Rückseite ist eine Kopie der Museum.BL-Vorderseite.
REJECTED_PICTURE = ("e9b4be32-c869-44fb-99df-3a2194d50e5d", "rueckseite")
IMAGE_PROFILES = {
    "angebotsbild": {"max_edge": 480, "quality": 80},
    "vorderseite": {"max_edge": 1500, "quality": 84},
    "rueckseite": {"max_edge": 1700, "quality": 88},
}


def collect_inputs():
    source = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    offers = source["angebote"]
    assert source["anzahl"] == len(offers) == 128, "Es müssen genau 128 Angebote sein."
    assert len({offer["id"] for offer in offers}) == len(offers), "Doppelte ID."
    assert sorted(offer["nr"] for offer in offers) == list(range(1, 129)), "Ungültige Nummern."
    assert set(offer["kategorie"] for offer in offers) == set(CATEGORIES)
    assert source["region"].strip(), "Der Name des Gutscheinbuchs fehlt."
    offer_by_id = {offer["id"]: offer for offer in offers}
    images = {offer["id"]: {} for offer in offers}
    report = {
        "region": source["region"],
        "angebote": len(offers),
        "firmen": len({offer["firma"] for offer in offers}),
        "kategorien": dict(Counter(offer["kategorie"] for offer in offers)),
        "dealtypen": dict(Counter(offer["typ"] for offer in offers)),
        "zuordnung": "manifest.json -> Angebots-ID -> dateien -> Bildart; Abgleich mit ID-Ordner",
        "fehlende_bilder": [],
        "nicht_zugeordnete_bilder": [],
        "sonstige_dateien": [],
        "formatfehler": [],
        "identische_bildinhalte": [],
        "abmessungen": {},
    }
    dimensions = defaultdict(Counter)
    hashes = defaultdict(list)

    with ZipFile(ZIP_FILE) as archive:
        files = [item for item in archive.infolist() if not item.is_dir()]
        names = [item.filename for item in files]
        assert len(names) == len(set(names)), "Mehrfach vorhandene ZIP-Pfade."
        manifest = json.loads(archive.read("manifest.json"))
        manifest_by_id = {item["id"]: item for item in manifest}
        assert len(manifest_by_id) == len(manifest) == len(offers)
        assert set(manifest_by_id) == set(offer_by_id), "Manifest-IDs stimmen nicht überein."
        claimed = {}
        report["zip_dateien"] = len(files)
        report["zip_bytes"] = ZIP_FILE.stat().st_size
        report["zip_entpackte_bytes"] = sum(item.file_size for item in files)
        report["ordner"] = len({PurePosixPath(name).parts[0] for name in names if "/" in name})
        report["reihenfolge"] = "Dateipfade lexikografisch sortiert" if names == sorted(names) else "nicht lexikografisch"
        report["manifest_reihenfolge"] = [item["nr"] for item in manifest] == list(range(1, 129))

        for offer in offers:
            record = manifest_by_id[offer["id"]]
            for field in OFFER_FIELDS:
                assert record[field] == offer[field], f"Manifest-Abweichung: {offer['nr']} / {field}"
            for key, label in PICTURE_TYPES.items():
                path = record.get("dateien", {}).get(key)
                if not path or path not in names:
                    report["fehlende_bilder"].append({
                        "nr": offer["nr"], "id": offer["id"], "firma": offer["firma"], "bildart": label,
                        "manifest_pfad": path,
                    })
                    continue
                parts = PurePosixPath(path).parts
                assert len(parts) == 2 and parts[0] == offer["id"], f"Uneindeutiger Bildpfad: {path}"
                assert path not in claimed, f"Bild mehrfach zugeordnet: {path}"
                claimed[path] = (offer, key)

        for item in files:
            raw = archive.read(item)
            is_jpeg = raw.startswith(b"\xff\xd8\xff")
            if item.filename not in claimed:
                report["nicht_zugeordnete_bilder" if is_jpeg else "sonstige_dateien"].append(item.filename)
                continue
            offer, key = claimed[item.filename]
            if not is_jpeg:
                report["formatfehler"].append(item.filename)
                continue
            with Image.open(io.BytesIO(raw)) as image:
                image.load()
                assert image.format == "JPEG", f"Kein lesbares JPEG: {item.filename}"
                dimensions[key][f"{image.width} × {image.height}"] += 1
                size = image.size
            images[offer["id"]][key] = {"raw": raw, "size": size, "path": item.filename}
            hashes[hashlib.sha256(raw).hexdigest()].append({
                "nr": offer["nr"], "firma": offer["firma"],
                "bildart": PICTURE_TYPES[key], "pfad": item.filename,
            })

    report["abmessungen"] = {key: dict(value) for key, value in dimensions.items()}
    report["identische_bildinhalte"] = [value for value in hashes.values() if len(value) > 1]
    report["jpgs_mit_gueltigen_magic_bytes"] = sum(len(value) for value in images.values())
    assert not report["formatfehler"], "Ungültige JPEG-Dateien; bitte Bericht prüfen."
    assert not report["nicht_zugeordnete_bilder"], "Nicht zugeordnete Bilder; bitte Bericht prüfen."
    return source, images, report


def safe_json(value, *, indent=None):
    """JSON in einem HTML-script-Datenblock sicher und unverändert ablegen."""
    return json.dumps(value, ensure_ascii=False, indent=indent, separators=None if indent else (",", ":")).replace("<", "\\u003c")


def optimize_images(images, report):
    signature = hashlib.sha256(
        (hashlib.sha256(ZIP_FILE.read_bytes()).hexdigest() + safe_json(IMAGE_PROFILES) + "webp-v1").encode()
    ).hexdigest()
    cache_file = ROOT / ".image-cache.json"
    if cache_file.exists():
        cache = json.loads(cache_file.read_text(encoding="utf-8"))
        if cache.get("signature") == signature:
            report["kompression"] = cache["report"]
            return cache["images"]
    result = {offer_id: {} for offer_id in images}
    total_before = total_after = 0
    by_type = defaultdict(lambda: {"anzahl": 0, "original_bytes": 0, "webp_bytes": 0})
    jobs = [
        (offer_id, key, picture)
        for offer_id, pictures in images.items() for key, picture in pictures.items()
        if (offer_id, key) != REJECTED_PICTURE
    ]

    def encode_picture(job):
        offer_id, key, picture = job
        profile = IMAGE_PROFILES[key]
        with Image.open(io.BytesIO(picture["raw"])) as original:
            image = ImageOps.exif_transpose(original).convert("RGB")
            image.thumbnail((profile["max_edge"], profile["max_edge"]), Image.Resampling.LANCZOS)
            buffer = io.BytesIO()
            image.save(buffer, format="WEBP", quality=profile["quality"], method=6)
            return offer_id, key, len(picture["raw"]), image.size, buffer.getvalue()

    with ThreadPoolExecutor(max_workers=4) as executor:
        for index, (offer_id, key, original_size, size, encoded) in enumerate(executor.map(encode_picture, jobs), 1):
            result[offer_id][key] = {
                "width": size[0], "height": size[1],
                "src": "data:image/webp;base64," + base64.b64encode(encoded).decode("ascii"),
            }
            total_before += original_size
            total_after += len(encoded)
            by_type[key]["anzahl"] += 1
            by_type[key]["original_bytes"] += original_size
            by_type[key]["webp_bytes"] += len(encoded)
            if index % 64 == 0:
                print(f"Bilder komprimiert: {index}/{len(jobs)}", flush=True)
    report["kompression"] = {
        "format": "WebP, Base64-Data-URIs",
        "profile": IMAGE_PROFILES,
        "original_bytes_verwendeter_bilder": total_before,
        "optimierte_bildbytes": total_after,
        "nach_bildart": dict(by_type),
        "eingebettete_bilder": sum(len(value) for value in result.values()),
    }
    cache_file.write_text(safe_json({"signature": signature, "images": result, "report": report["kompression"]}), encoding="utf-8")
    return result


def build_website(source, images, report, *, prepare_only=False):
    image_data = optimize_images(images, report)
    rejected_offer = next(offer for offer in source["angebote"] if offer["id"] == REJECTED_PICTURE[0])
    report["bestaetigte_ersatzdarstellungen"] = report["fehlende_bilder"] + [{
        "nr": rejected_offer["nr"], "id": rejected_offer["id"], "firma": rejected_offer["firma"],
        "bildart": "Rückseite", "grund": "Fälschlich enthaltene Museum.BL-Vorderseite; Ersatzdarstellung vom Nutzer bestätigt.",
    }]
    if prepare_only:
        print(json.dumps(report["kompression"], ensure_ascii=False, indent=2))
        return
    highlights = json.loads((ROOT / "src/highlights.json").read_text(encoding="utf-8"))
    offers_by_nr = {offer["nr"]: offer for offer in source["angebote"]}
    assert highlights and len({pick["nr"] for pick in highlights}) == len(highlights)
    for pick in highlights:
        assert all(pick[field].strip() for field in ("ort", "leistung", "beschreibung", "einloesung", "gueltigkeit"))
        pick["id"] = offers_by_nr[pick["nr"]]["id"]
    book_data = {
        "anzahl": source["anzahl"], "region": source["region"], "hinweis": source["hinweis"],
        "angebote": [{field: offer[field] for field in OFFER_FIELDS} for offer in source["angebote"]],
        "bildhinweise": {
            item["id"]: {"rueckseite": "Die passende Rückseite fehlt im Bildarchiv."}
            for item in report["fehlende_bilder"]
        },
    }
    book_data["bildhinweise"][rejected_offer["id"]] = {
        "rueckseite": "Im Bildarchiv ist hier ein Bild eines anderen Angebots abgelegt. Die passende Rückseite fehlt."
    }
    template = (ROOT / "src/seite.template.html").read_text(encoding="utf-8")
    replacements = {
        "@@BOOK_TITLE@@": html.escape(source["region"]),
        "@@BOOK_DATA@@": safe_json(book_data, indent=2),
        "@@HIGHLIGHTS_DATA@@": safe_json(highlights, indent=2),
        # Ein Datenblock je ID: erst beim tatsächlichen Zugriff parsen.
        "@@IMAGE_DATA@@": "\n".join(
            f'<script type="application/json" data-image-id="{offer_id}">{safe_json(pictures)}</script>'
            for offer_id, pictures in image_data.items()
        ),
    }
    for marker, replacement in replacements.items():
        assert template.count(marker) >= 1, f"Platzhalter fehlt: {marker}"
        template = template.replace(marker, replacement)
    assert "@@" not in template, "Nicht ersetzter Platzhalter."
    assert "https://2f1.ch" not in template, "Externe Bild-URL im Ergebnis."
    output = template.encode("utf-8")
    # Die schonende Variante mit ca. 33 MB wurde ausdrücklich gewählt.
    # Bei wesentlichem Wachstum erneut die gewünschte Kompression abstimmen.
    if len(output) > 40 * 1024 * 1024:
        raise SystemExit("Die HTML-Datei wäre grösser als 40 MiB. Bitte Kompressionsoptionen zuerst mit dem Nutzer abstimmen.")
    (ROOT / "index.html").write_bytes(output)
    report["html_bytes"] = len(output)
    report["html_sha256"] = hashlib.sha256(output).hexdigest()
    (ROOT / "bildpruefung.json").write_text(safe_json(report, indent=2) + "\n", encoding="utf-8")
    print(f"index.html: {len(output):,} Bytes ({len(output) / 1_000_000:.2f} MB / {len(output) / 1024**2:.2f} MiB)")
    print(f"{len(book_data['angebote'])} Angebote, {report['kompression']['eingebettete_bilder']} eingebettete Bilder, 3 Ersatz-Rückseiten.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--audit", action="store_true", help="Nur die Eingaben prüfen.")
    parser.add_argument("--prepare-images", action="store_true", help="Bildkompression vorbereiten, ohne HTML-Build.")
    parser.add_argument("--samples", type=Path, help="Originale zur visuellen Prüfung hier ablegen.")
    args = parser.parse_args()
    source, images, report = collect_inputs()
    if args.audit:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    if args.samples:
        assert args.samples.is_dir(), "Der Ausgabeordner muss bereits existieren."
        for nr in (1, 41, 57, 69, 70, 71, 112, 119, 121, 127):
            offer = next(offer for offer in source["angebote"] if offer["nr"] == nr)
            for key, picture in images[offer["id"]].items():
                (args.samples / f"{nr:03}-{key}.jpg").write_bytes(picture["raw"])
    if not args.audit:
        build_website(source, images, report, prepare_only=args.prepare_images)


if __name__ == "__main__":
    main()

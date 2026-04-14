"""normalize_variants.py

Script to normalize variant coordinates in the `variants` collection by
converting RefSeq/local accession coordinates (e.g. NG_007109.2:5001-62497,
or chr-like strings) into genomic coordinates and storing them in fields:
  - genomic_chr (string)
  - genomic_pos (int)

The script also creates the recommended indexes on `variants` and
`annotations` collections for fast queries.

IMPORTANT: This script assumes you have a `refseq_mappings` collection with
documents that map RefSeq accessions to genomic coordinates. Example mapping:

  {
    "accession": "NG_007109.2",
    "genomic_chr": "3",
    "genomic_start": 37034000,
    "refseq_start": 1,
    "strand": 1
  }

If you do not have mappings, the script will attempt a tiny hardcoded
fallback for MLH1 (development only). For production you must populate
`refseq_mappings` using authoritative sources (NCBI, Ensembl).
"""
import argparse
import logging
from typing import Optional
from pymongo import MongoClient, UpdateOne
from pymongo.errors import PyMongoError
import re

LOG = logging.getLogger("normalize")


MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "variomex"


def _connect():
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    db = client[DB_NAME]
    return client, db


def convert_refseq_mapping(db, chr_name: str, pos: int) -> Optional[tuple]:
    """Try to convert a RefSeq accession and local position to genomic coords.

    Returns (genomic_chr, genomic_pos) or None when conversion not possible.
    """
    accession = chr_name
    if ":" in chr_name:
        accession = chr_name.split(":", 1)[0]

    if re.match(r"^(NG|NM|NC|NR|NP)_", accession):
        mappings = db.get_collection("refseq_mappings")
        # db.get_collection always returns a Collection object; don't test its truth value
        m = mappings.find_one({"accession": accession})
        if m:
            try:
                gen_chr = str(m["genomic_chr"]) if m.get("genomic_chr") is not None else None
                gen_start = int(m.get("genomic_start"))
                refseq_start = int(m.get("refseq_start", 1))
                return gen_chr, gen_start + (int(pos) - refseq_start)
            except Exception:
                return None

        # Very small development fallback for MLH1 only
        if accession.startswith("NG_007109.2"):
            MLH1_START = 37034000
            return "3", MLH1_START + (int(pos) - 1)

    return None


def ensure_indexes(db):
    variants = db.get_collection("variants")
    annotations = db.get_collection("annotations")

    LOG.info("Creating indexes (if not present)...")
    variants.create_index([("genomic_chr", 1), ("genomic_pos", 1)], background=True)
    annotations.create_index([("chr", 1), ("pos", 1)], background=True)
    LOG.info("Indexes ensured.")


def normalize_variants(db, batch_size=500, dry_run=False, recalc_existing=False):
    variants = db.get_collection("variants")

    query = {}
    if not recalc_existing:
        query = {"$or": [{"genomic_pos": {"$exists": False}}, {"genomic_chr": {"$exists": False}}]}

    cursor = variants.find(query, batch_size=batch_size)
    ops = []
    total = 0
    updated = 0
    skipped = 0

    for doc in cursor:
        total += 1
        var_id = doc.get("_id")
        chr_name = doc.get("chr")
        pos = doc.get("pos")

        if chr_name is None or pos is None:
            LOG.warning("Skipping document %s missing chr/pos", var_id)
            skipped += 1
            continue

        conv = convert_refseq_mapping(db, str(chr_name), int(pos))
        if not conv:
            LOG.debug("No mapping for %s:%s (id=%s)", chr_name, pos, var_id)
            skipped += 1
            continue

        gen_chr, gen_pos = conv
        if dry_run:
            LOG.info("DRY RUN: would set %s -> %s:%s", var_id, gen_chr, gen_pos)
            updated += 1
            continue

        ops.append(UpdateOne({"_id": var_id}, {"$set": {"genomic_chr": gen_chr, "genomic_pos": int(gen_pos)}}))

        if len(ops) >= batch_size:
            try:
                res = variants.bulk_write(ops)
                LOG.info("Bulk wrote %s (matched=%s, modified=%s)", len(ops), res.matched_count, res.modified_count)
                updated += res.modified_count
            except PyMongoError as exc:
                LOG.exception("Bulk write failed: %s", exc)
            ops = []

    # flush remaining ops
    if ops and not dry_run:
        try:
            res = variants.bulk_write(ops)
            LOG.info("Final bulk wrote %s (matched=%s, modified=%s)", len(ops), res.matched_count, res.modified_count)
            updated += res.modified_count
        except PyMongoError as exc:
            LOG.exception("Final bulk write failed: %s", exc)

    LOG.info("Normalization complete: total=%s updated=%s skipped=%s", total, updated, skipped)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Don't persist changes; just show actions")
    parser.add_argument("--batch-size", type=int, default=500, help="Bulk batch size")
    parser.add_argument("--recalc", action="store_true", help="Recalculate even when genomic fields exist")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    client, db = _connect()

    try:
        ensure_indexes(db)
        normalize_variants(db, batch_size=args.batch_size, dry_run=args.dry_run, recalc_existing=args.recalc)
    finally:
        client.close()


if __name__ == "__main__":
    main()

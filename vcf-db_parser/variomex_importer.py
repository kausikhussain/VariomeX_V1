#!/usr/bin/env python3
"""
VariomeX VCF -> MongoDB importer

- Streams a VCF/BCF using pysam (no full-file load).
- Emits one MongoDB document per ALT allele for multiallelic records.
- Uses batch inserts for performance (insert_many with ordered=False).
- Uses environment variables for DB credentials / collection names.
- Creates helpful indexes (including a unique compound index to avoid duplicates).
- Robust logging and error handling.

Command-line:
    python variomex_importer.py --file /path/to/file.vcf.gz --genome_id 12345

Environment variables (recommended to set, or use a .env file):
    MONGODB_URI        MongoDB URI (e.g. mongodb://user:pass@host:27017)
    MONGODB_DB         Database name (default: variomex)
    MONGODB_COLLECTION Collection name (default: variants)
    BATCH_SIZE         Optional override of default batch insert size (int)

Notes:
- For performance, ensure the MongoDB deployment can accept the insert throughput.
- If you expect duplicates, this script will attempt insert_many with ordered=False
  and will tolerate duplicate-key errors caused by the unique index.
"""

from __future__ import annotations
import os
import sys
import argparse
import logging
import time
from typing import Optional

# Third-party imports
# import pysam
from pymongo import MongoClient, errors
from dotenv import load_dotenv

# Load .env if present (non-fatal)
load_dotenv()

# Setup logging
logger = logging.getLogger("variomex_importer")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
logger.addHandler(handler)


def get_env(name: str, default: Optional[str] = None) -> str:
    """Get environment variable or default, raise if not provided and default is None."""
    val = os.getenv(name, default)
    if val is None:
        raise EnvironmentError(f"Missing required environment variable: {name}")
    return val


def connect_mongo(uri: str, db_name: str, collection_name: str, create_indexes: bool = True):
    """Create a MongoDB client and return the collection. Create recommended indexes."""
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        # Trigger server selection now to fail fast if credentials/host are wrong
        client.server_info()
    except Exception as e:
        logger.exception("Failed to connect to MongoDB: %s", e)
        raise

    db = client[db_name]
    coll = db[collection_name]

    if create_indexes:
        # Create compound unique index to prevent exact duplicate variant documents:
        # (genome_id, chr, pos, ref, alt)
        try:
            coll.create_index(
                [("genome_id", 1), ("chr", 1), ("pos", 1), ("ref", 1), ("alt", 1)],
                unique=True,
                background=True,
                name="uniq_variant"
            )
            # Additional indexes for common queries
            coll.create_index([("genome_id", 1), ("chr", 1), ("pos", 1)], background=True, name="idx_genome_chr_pos")
        except Exception:
            # Index creation failure is non-fatal for running, but log it
            logger.exception("Index creation encountered an error (continuing):")

    return coll


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Import VCF variants into MongoDB (one document per ALT).")
    p.add_argument("--file", required=True, help="Path to VCF/BCF file (can be gzipped).")
    p.add_argument("--genome_id", required=True, type=int, help="Integer genome_id to attach to each variant.")
    p.add_argument("--batch_size", type=int, default=int(os.getenv("BATCH_SIZE", "1000")),
                   help="Number of documents per bulk insert (default 1000 or BATCH_SIZE env).")
    p.add_argument("--skip_index_creation", action="store_true",
                   help="Skip creating indexes (useful if already created or to speed first run).")
    p.add_argument("--report_every", type=int, default=100000,
                   help="Log progress every N VCF records (default 100000).")
    return p.parse_args()


def variant_records_from_vcf(vcf_path: str, genome_id: int):
    with open(vcf_path, 'r') as f:
        for line in f:
            if line.startswith("#"):
                continue

            parts = line.strip().split("\t")

            # Safety check
            if len(parts) < 5:
                continue

            chrom = parts[0]
            pos = int(parts[1])
            ref = parts[3]
            alt_field = parts[4]

            # Handle multiple ALT values (A,T)
            alts = alt_field.split(",")

            for alt in alts:
                yield {
                    "genome_id": genome_id,
                    "chr": chrom,
                    "pos": pos,
                    "ref": ref,
                    "alt": alt
                }


def chunked_iterable(generator, chunk_size: int):
    """Batch generator: yield lists of up to chunk_size items from the generator."""
    batch = []
    for item in generator:
        batch.append(item)
        if len(batch) >= chunk_size:
            yield batch
            batch = []
    if batch:
        yield batch


def main():
    args = parse_args()

    # Read MongoDB config from env
    mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    mongodb_db = os.getenv("MONGODB_DB", "variomex")
    mongodb_collection = os.getenv("MONGODB_COLLECTION", "variants")

    logger.info("VCF -> MongoDB importer starting")
    logger.info("VCF file: %s", args.file)
    logger.info("genome_id: %d", args.genome_id)
    logger.info("MongoDB URI: %s", mongodb_uri if "@" in mongodb_uri else "<hidden>")  # avoid credential leak

    # Connect to MongoDB collection
    coll = connect_mongo(mongodb_uri, mongodb_db, mongodb_collection, create_indexes=not args.skip_index_creation)

    inserted_count = 0
    duplicate_count = 0
    other_errors = 0
    total_records_seen = 0
    t0 = time.time()

    try:
        gen = variant_records_from_vcf(args.file, args.genome_id)
        for batch in chunked_iterable(gen, args.batch_size):
            # Batch is a list of documents
            total_records_seen += len(batch)
            try:
                # Use insert_many unordered to maximize throughput and tolerate partial failures
                result = coll.insert_many(batch, ordered=False)
                # result.inserted_ids includes only successfully inserted docs
                inserted_here = len(result.inserted_ids)
                inserted_count += inserted_here
            except errors.BulkWriteError as bwe:
                # BulkWriteError contains details; count duplicate key errors vs others
                details = bwe.details or {}
                write_errors = details.get("writeErrors", []) or []
                inserted = details.get("nInserted", 0) or 0
                inserted_count += inserted

                # Count duplicates and other errors
                dup = 0
                others = 0
                for we in write_errors:
                    # Each we likely has a 'code' and 'errmsg'
                    code = we.get("code")
                    if code == 11000:
                        dup += 1
                    else:
                        others += 1
                        logger.error("Bulk write error code=%s msg=%s", code, we.get("errmsg"))
                duplicate_count += dup
                other_errors += others

                # Log summary for this batch
                logger.debug("BulkWriteError: nInserted=%s duplicates=%s other_errors=%s", inserted, dup, others)
            except Exception as e:
                # Insert failed for another reason (network, interrupted cursor, etc.)
                other_errors += len(batch)
                logger.exception("Insert failed for current batch: %s", e)

            # Periodic progress log (every report_every records)
            if total_records_seen % args.report_every < args.batch_size:
                elapsed = time.time() - t0
                rate = total_records_seen / elapsed if elapsed > 0 else 0.0
                logger.info("Progress: seen=%d inserted=%d duplicates=%d other_errors=%d rate=%.1f recs/sec",
                            total_records_seen, inserted_count, duplicate_count, other_errors, rate)

        # End for
        elapsed = time.time() - t0
        rate = total_records_seen / elapsed if elapsed > 0 else 0.0
        logger.info(
        "Completed: seen=%d inserted=%d duplicates=%d other_errors=%d elapsed=%.1fs rate=%.1f recs/sec",
        total_records_seen,
        inserted_count,
        duplicate_count,
        other_errors,
        elapsed,
        rate
        )
        
    except KeyboardInterrupt:
        logger.warning("Interrupted by user (KeyboardInterrupt). Partial progress saved.")
    except Exception as e:
        logger.exception("Fatal error during processing: %s", e)
        sys.exit(2)

    # Exit code 0 on success, 1 if there were non-duplicate errors
    if other_errors > 0:
        logger.error("Finished with non-duplicate errors: %d", other_errors)
        sys.exit(1)
    else:
        logger.info("Finished successfully.")
        sys.exit(0)


if __name__ == "__main__":
    main()

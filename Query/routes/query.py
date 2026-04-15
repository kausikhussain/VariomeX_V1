from typing import List, Optional, Dict, Any, Tuple
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from database import get_db
from pymongo.collection import Collection
from pymongo.errors import PyMongoError
from bson import ObjectId
import re

router = APIRouter(prefix="/query", tags=["query"])

# -----------------------------
# Models
# -----------------------------

class AnnotationModel(BaseModel):
    chr: str
    pos: int
    ref: Optional[str] = None
    alt: Optional[str] = None
    disease: str
    significance: Optional[str] = None


# -----------------------------
# Helpers
# -----------------------------

def _get_collections(db) -> Tuple[Collection, Collection]:
    return db.variants, db.annotations


def _doc_to_safe(doc: Dict[str, Any]) -> Dict[str, Any]:
    if not doc:
        return {}
    out = dict(doc)
    _id = out.pop("_id", None)
    if isinstance(_id, ObjectId):
        out["_id"] = str(_id)
    return out


# -----------------------------
# Coordinate conversion
# -----------------------------

def convert_to_genomic(db, chr_name: str, pos: int):
    accession = chr_name.split(":")[0]

    mappings = db.get_collection("refseq_mappings")
    mapping = mappings.find_one({"accession": accession})

    if mapping:
        genomic_chr = str(mapping["genomic_chr"])
        genomic_start = int(mapping["genomic_start"])
        refseq_start = int(mapping.get("refseq_start", 1))
        genomic_pos = genomic_start + (pos - refseq_start)
        return genomic_chr, genomic_pos

    # fallback MLH1
    if accession.startswith("NG_007109.2"):
        return "3", 37034000 + (pos - 1)

    return chr_name, pos


# -----------------------------
# MUTATION API
# -----------------------------

@router.get("/mutation")
def mutation_query(chr: str, pos: int, ref: str, alt: str, db=Depends(get_db)):
    variants, annotations = _get_collections(db)

    gen_chr, gen_pos = convert_to_genomic(db, chr, pos)

    # check existence
    exists = variants.count_documents({
        "$or": [
            {"genomic_chr": gen_chr, "genomic_pos": gen_pos},
            {"chr": chr, "pos": pos}
        ]
    })

    # 🔥 strict match first
    annotation = annotations.find_one({
        "chr": gen_chr,
        "pos": {"$gte": gen_pos - 50, "$lte": gen_pos + 50},
        "ref": ref,
        "alt": alt,
        "significance": {"$in": ["Pathogenic", "Likely pathogenic"]}
    })

    # fallback
    if not annotation:
        annotation = annotations.find_one({
            "chr": gen_chr,
            "pos": {"$gte": gen_pos - 5000, "$lte": gen_pos + 5000},
            "significance": {"$in": ["Pathogenic", "Likely pathogenic"]}
        })

    return {
        "exists": exists > 0,
        "genomic_chr": gen_chr,
        "genomic_pos": gen_pos,
        "disease": annotation.get("disease") if annotation else None,
        "significance": annotation.get("significance") if annotation else None
    }
# -----------------------------
# ZKP MUTATION (alias)
# -----------------------------

@router.get("/zkp-mutation")
def zkp_mutation(chr: str, pos: int, ref: str, alt: str, db=Depends(get_db)):
    return mutation_query(chr, pos, ref, alt, db)


# -----------------------------
# GENE API
# -----------------------------

@router.get("/gene")
def gene_query(gene: str, db=Depends(get_db)):
    variants, _ = _get_collections(db)

    gene_map = {
        "MLH1": ("3", 37000000, 37100000)
    }

    if gene not in gene_map:
        return {"gene": gene, "count": 0, "variants": []}

    chr_name, start, end = gene_map[gene]

    cursor = variants.find({
        "genomic_chr": chr_name,
        "genomic_pos": {"$gte": start, "$lte": end}
    }).limit(100)

    results = []
    for doc in cursor:
        results.append(_doc_to_safe(doc))

    return {
        "gene": gene,
        "count": len(results),
        "variants": results[:20]
    }


# -----------------------------
# DISEASE API
# -----------------------------

@router.get("/disease", response_model=List[AnnotationModel])
def disease_query(disease: str, limit: int = 100, db=Depends(get_db)):
    _, annotations = _get_collections(db)

    cursor = annotations.find({
        "disease": {"$regex": disease, "$options": "i"},
        "significance": {"$in": ["Pathogenic", "Likely pathogenic"]}
    }).limit(min(limit, 1000))

    return [_doc_to_safe(doc) for doc in cursor]


# -----------------------------
# CHECK DISEASE (MAIN API)
# -----------------------------

@router.get("/genome/{genome_id}/check-disease")
def check_disease(genome_id: int, disease: str, db=Depends(get_db)):
    variants, annotations = _get_collections(db)

    cursor = variants.find({"genome_id": genome_id})

    results = []
    gene_summary = {}

    for var in cursor:
        gen_chr = var.get("genomic_chr")
        gen_pos = var.get("genomic_pos")

        if not gen_chr:
            gen_chr, gen_pos = convert_to_genomic(db, var["chr"], var["pos"])

        # strict allele match
        ann_cursor = annotations.find({
            "chr": gen_chr,
            "pos": {"$gte": gen_pos - 50, "$lte": gen_pos + 50},
            "ref": var.get("ref"),
            "alt": var.get("alt"),
            "disease": {"$regex": disease, "$options": "i"},
            "significance": {"$in": ["Pathogenic", "Likely pathogenic"]}
        })

        matched = list(ann_cursor)

        # fallback
        if not matched:
            ann_cursor = annotations.find({
                "chr": gen_chr,
                "pos": {"$gte": gen_pos - 5000, "$lte": gen_pos + 5000},
                "disease": {"$regex": disease, "$options": "i"},
                "significance": {"$in": ["Pathogenic", "Likely pathogenic"]}
            })
            matched = list(ann_cursor)

        if matched:
            clean_var = _doc_to_safe(var)

            for ann in matched:
                gene = ann.get("gene", "unknown")
                gene_summary[gene] = gene_summary.get(gene, 0) + 1

            results.append({
                "variant": clean_var,
                "annotations": [_doc_to_safe(a) for a in matched]
            })

    return {
        "disease": disease,
        "found": len(results) > 0,
        "total_matches": len(results),
        "gene_summary": gene_summary,
        "matches": results[:20]
    }
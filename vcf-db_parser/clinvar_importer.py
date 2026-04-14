import gzip
from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017")
db = client["variomex"]
collection = db["annotations"]

BATCH_SIZE = 5000

def parse_info(info_str):
    info_dict = {}
    for field in info_str.split(";"):
        if "=" in field:
            key, value = field.split("=", 1)
            info_dict[key] = value
    return info_dict

def import_clinvar(file_path):
    batch = []
    total = 0

    with open(file_path, "r") as f:
        for line in f:
            if line.startswith("#"):
                continue

            parts = line.strip().split("\t")
            if len(parts) < 8:
                continue

            chrom = parts[0]
            pos = int(parts[1])
            ref = parts[3]
            alt_field = parts[4]
            info = parts[7]

            info_dict = parse_info(info)

            disease = info_dict.get("CLNDN")
            significance = info_dict.get("CLNSIG")

            if not disease or not significance:
                continue

            disease = disease.replace("_", " ")

            alts = alt_field.split(",")

            for alt in alts:
                batch.append({
                    "chr": chrom,
                    "pos": pos,
                    "ref": ref,
                    "alt": alt,
                    "disease": disease,
                    "significance": significance
                })

            # 🔥 Batch insert
            if len(batch) >= BATCH_SIZE:
                collection.insert_many(batch, ordered=False)
                total += len(batch)
                print(f"Inserted {total}")
                batch = []

    # Insert remaining
    if batch:
        collection.insert_many(batch, ordered=False)
        total += len(batch)

    print(f"Done. Total inserted: {total}")

if __name__ == "__main__":
    import_clinvar("clinvar.vcf")
# VariomeX - FastAPI backend

This is a minimal, production-minded FastAPI backend for the VariomeX genomic platform.

Features
- MongoDB (pymongo) connection to database `variomex`.
- Endpoints:
  - GET /query/mutation  — check whether a mutation exists
  - GET /query/gene      — query hardcoded gene ranges (example: MLH1)
  - GET /query/frequency — compute mutation frequency across distinct genomes
  - GET /query/disease   — query the `annotations` collection
  - POST /query/batch    — batch query a list of mutations

Run locally

1. Install dependencies (recommend a virtualenv):

```powershell
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. Ensure MongoDB is running locally and contains a database named `variomex`
   with `variants` and `annotations` collections. Example documents:

variants document:
```
{
  "genome_id": 123,
  "chr": "1",
  "pos": 5010,
  "ref": "A",
  "alt": "T"
}
```

annotations document:
```
{
  "chr": "1",
  "pos": 5010,
  "ref": "A",
  "alt": "T",
  "disease": "ExampleDisease",
  "significance": "pathogenic"
}
```

3. Run the app (development reload):

```powershell
uvicorn main:app --reload
```

Open http://127.0.0.1:8000/docs for interactive API docs.

Notes
- The gene map in `routes/query.py` is intentionally tiny and hardcoded — replace
  with a real gene-to-range map for production.
- The database connection string is `mongodb://localhost:27017` per your request.

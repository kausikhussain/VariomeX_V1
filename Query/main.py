from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.query import router as query_router
from database import init_db, close_db

app = FastAPI(title="VariomeX API", version="0.1.0")

# Allow local development CORS (adjust in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    # Initialize MongoDB client and ensure connection on startup
    init_db()


@app.on_event("shutdown")
async def shutdown_event():
    # Close MongoDB client cleanly
    close_db()


# Include query routes
app.include_router(query_router)


@app.get("/health")
async def health():
    """Simple health check endpoint."""
    return {"status": "ok"}

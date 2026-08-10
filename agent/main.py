"""Lineage Marshal Agent API — FastAPI application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from agent.api.routes import router as api_router

app = FastAPI(
    title="Lineage Marshal Agent API",
    version="0.1.0",
    description="Incident investigation agent for data pipelines — DataHub integration",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/")
async def root():
    return {
        "service": "Lineage Marshal Agent",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/api/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
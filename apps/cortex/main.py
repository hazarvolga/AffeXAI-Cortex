from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import os
from langchain_ollama import OllamaLLM
from qdrant_client import QdrantClient
from qdrant_client.http import models

app = FastAPI(title="AffeXAI Cortex API", version="1.0.0")

# --- Configuration ---
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://host.docker.internal:11434")
# Hulyaekiz Sunucusu - SSH Tunnel (scripts/hybrid-tunnel.sh)
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333") 

# --- Clients ---
llm = OllamaLLM(base_url=OLLAMA_URL, model="llama3")
qdrant = QdrantClient(url=QDRANT_URL)

def init_qdrant():
    """Ensures necessary collections exist in Qdrant."""
    try:
        collections = [c.name for c in qdrant.get_collections().collections]
        for col in ["signals", "memory"]:
            if col not in collections:
                print(f"🚀 Creating Qdrant collection: {col}")
                qdrant.create_collection(
                    collection_name=col,
                    vectors_config=models.VectorParams(size=384, distance=models.Distance.COSINE),
                )
        print("✅ Qdrant collections verified/initialized.")
    except Exception as e:
        print(f"⚠️ Qdrant connection error: {str(e)}")

init_qdrant()

# --- Models ---
class Signal(BaseModel):
    tenantId: str
    source: str  # e.g., 'email', 'event'
    type: str    # e.g., 'campaign_sent', 'ticket_resolved'
    data: Dict[str, Any]
    timestamp: str

class StrategyRequest(BaseModel):
    tenantId: str
    context: str # e.g., 'email_composer'
    draftContent: Optional[str] = None

# --- Routes ---

@app.get("/health")
def health_check():
    return {"status": "active", "brain": "online", "ollama_url": OLLAMA_URL}

from sentence_transformers import SentenceTransformer
import time
import uuid

# Load Embedding Model (Lightweight, efficient)
print("🧠 Loading embedding model...")
embedder = SentenceTransformer('all-MiniLM-L6-v2')
print("✅ Cortex Brain Loaded.")

@app.post("/signals/ingest")
async def ingest_signal(signal: Signal, background_tasks: BackgroundTasks):
    """Receives operational signals from Server 1 and stores them in Qdrant (Memory)."""
    
    # 1. Create textual representation of the signal
    text_content = f"{signal.type} from {signal.source}: {str(signal.data)}"
    
    # 2. Generate Vector Embedding
    vector = embedder.encode(text_content).tolist()
    
    # 3. Store in Qdrant (Graceful Fallback)
    point_id = str(uuid.uuid4())
    
    try:
        qdrant.upsert(
            collection_name="memory",
            points=[
                models.PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={
                        "tenantId": signal.tenantId,
                        "source": signal.source,
                        "type": signal.type,
                        "data": signal.data,
                        "content": text_content,
                        "timestamp": signal.timestamp
                    }
                )
            ]
        )
        print(f"🧠 Memory Stored: {signal.type} ({point_id})")
    except Exception as e:
        print(f"⚠️ Memory Storage Failed (Qdrant): {str(e)}")
        # We process the signal anyway, just without long-term memory
        
    return {"status": "ingested", "id": point_id}

class RetrievalRequest(BaseModel):
    query: str
    limit: int = 3
    tenantId: str

@app.post("/retrieve")
async def retrieve_context(req: RetrievalRequest):
    """Semantic Search: Vector retrieval for RAG."""
    try:
        # 1. Embed Query
        vector = embedder.encode(req.query).tolist()
        
        # 2. Search Qdrant
        results = qdrant.search(
            collection_name="memory",
            query_vector=vector,
            limit=req.limit,
            query_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="tenantId",
                        match=models.MatchValue(value=req.tenantId)
                    )
                ]
            )
        )
        
        # 3. Format Results
        context = []
        for hit in results:
            context.append({
                "content": hit.payload.get("content", ""),
                "score": hit.score,
                "type": hit.payload.get("type", "unknown")
            })
            
        print(f"🔍 Retrieved {len(context)} memories for query: '{req.query}'")
        return {"results": context}
        
    except Exception as e:
        print(f"⚠️ Retrieval Failed: {str(e)}")
        # Graceful fallback: return empty list so StrategyService doesn't crash
        return {"results": []}

@app.post("/strategy/insight")
async def generate_insight(req: StrategyRequest):
    """Generates strategic advice based on context (Synapse)."""
    prompt = f"""
    You are the Strategic Brain of AffeXAI.
    Context: The user is working on {req.context}.
    Draft: {req.draftContent or 'No draft yet.'}
    
    Task: Provide 1 short, high-impact strategic suggestion based on general best practices.
    Keep it under 50 words.
    """
    
    try:
        response = llm.invoke(prompt)
        return {"insight": response, "source": "cortex-llama3"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

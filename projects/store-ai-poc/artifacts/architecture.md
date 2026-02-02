# Store AI POC - Architecture Document

## Overview

Local AI server for Computer Connection that answers questions about store operations and provides SOPs to staff. Runs entirely on-premises with no cloud dependencies.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Store Network                             │
│                                                                  │
│  ┌──────────┐      ┌─────────────────────────────────────────┐  │
│  │  Browser │──────│            AI Server                     │  │
│  │  (Staff) │      │  ┌─────────────────────────────────────┐│  │
│  └──────────┘      │  │         FastAPI Backend             ││  │
│                    │  │  ┌──────────┐  ┌─────────────────┐  ││  │
│                    │  │  │   Chat   │  │   RAG Engine    │  ││  │
│                    │  │  │ Handler  │  │  (ChromaDB)     │  ││  │
│                    │  │  └────┬─────┘  └────────┬────────┘  ││  │
│                    │  │       │                  │           ││  │
│                    │  │       └────────┬─────────┘           ││  │
│                    │  │                │                     ││  │
│                    │  │         ┌──────▼──────┐              ││  │
│                    │  │         │   Ollama    │              ││  │
│                    │  │         │  (LLM API)  │              ││  │
│                    │  │         └─────────────┘              ││  │
│                    │  │                                      ││  │
│                    │  │  ┌──────────────────────────────┐   ││  │
│                    │  │  │         SQLite DB            │   ││  │
│                    │  │  │  - Chat history              │   ││  │
│                    │  │  │  - Sales data (imported)     │   ││  │
│                    │  │  │  - Audit logs                │   ││  │
│                    │  │  └──────────────────────────────┘   ││  │
│                    │  └─────────────────────────────────────┘│  │
│                    └─────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Ollama (LLM Inference)

**Purpose**: Run large language models locally for inference.

**Technology**: Ollama with llama3.1:8b (default) or mistral:7b (fallback)

**Interface**: HTTP API on localhost:11434

**Key endpoints used**:
- `POST /api/generate` - Single completion
- `POST /api/chat` - Chat completion with message history

**Configuration**:
```bash
# Default model
OLLAMA_MODEL=llama3.1:8b

# Pull model on first run
ollama pull llama3.1:8b
```

**Notes**:
- Pre-installed on system or install via: `curl -fsSL https://ollama.ai/install.sh | sh`
- Models cached in ~/.ollama/models
- GPU acceleration automatic if NVIDIA drivers present

---

### 2. FastAPI Backend

**Purpose**: Main application server handling API requests, RAG pipeline, and data queries.

**Technology**: Python 3.11+, FastAPI, uvicorn

**Interface**: HTTP API on localhost:8000

**Directory structure**:
```
/app
├── main.py              # FastAPI app entry point
├── config.py            # Configuration settings
├── routers/
│   ├── chat.py          # /api/chat endpoint
│   ├── documents.py     # /api/documents/* endpoints
│   ├── data.py          # /api/data/* endpoints
│   └── health.py        # /api/health endpoint
├── services/
│   ├── ollama.py        # Ollama API client
│   ├── rag.py           # RAG pipeline (ChromaDB)
│   ├── query_classifier.py  # Classify query type
│   └── data_query.py    # SQL query builder for data questions
├── models/
│   ├── database.py      # SQLAlchemy models
│   └── schemas.py       # Pydantic schemas
└── utils/
    ├── document_processor.py  # PDF/MD chunking
    └── embeddings.py          # Embedding generation
```

**Key dependencies**:
```
fastapi>=0.109.0
uvicorn>=0.27.0
sqlalchemy>=2.0.0
chromadb>=0.4.0
python-multipart>=0.0.6
PyPDF2>=3.0.0
httpx>=0.26.0
```

---

### 3. Web Frontend

**Purpose**: Simple chat interface for staff to interact with AI.

**Technology**: HTML5, vanilla JavaScript, Tailwind CSS (via CDN)

**Interface**: Served by FastAPI at /

**Structure**:
```
/static
├── index.html           # Main chat interface
├── js/
│   └── app.js           # Chat logic, API calls
└── css/
    └── custom.css       # Any custom styles (minimal)
```

**Features**:
- Chat message input
- Message history display
- Loading indicator during LLM response
- Document upload button
- Data import button (admin)

**No build step required** - plain files served directly.

---

### 4. ChromaDB (Vector Store)

**Purpose**: Store document embeddings for RAG retrieval.

**Technology**: ChromaDB in embedded mode (no separate server)

**Interface**: Python library

**Storage**: ./data/chroma/

**Configuration**:
```python
import chromadb

client = chromadb.PersistentClient(path="./data/chroma")
collection = client.get_or_create_collection(
    name="store_documents",
    metadata={"hnsw:space": "cosine"}
)
```

**Embedding model**: sentence-transformers/all-MiniLM-L6-v2 (runs locally)

**Notes**:
- Embeds with application, no separate process
- Backed by SQLite internally
- Easy to backup (copy ./data/chroma directory)

---

### 5. SQLite Database

**Purpose**: Store chat history, imported data, and audit logs.

**Technology**: SQLite via SQLAlchemy

**Location**: ./data/store-ai.db

**Tables**:

```sql
-- Chat messages
CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,  -- 'user' or 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Uploaded documents metadata
CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    chunk_count INTEGER NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit log
CREATE TABLE audit_log (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    query TEXT NOT NULL,
    query_type TEXT,  -- 'sop', 'data', 'general'
    response_preview TEXT,  -- First 200 chars
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Imported sales data
CREATE TABLE sales_data (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    category TEXT,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_chat_session ON chat_messages(session_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);
CREATE INDEX idx_sales_date ON sales_data(date);
```

---

## Data Flow

### Chat Request Flow

```
1. User types message in browser
   │
2. Frontend POSTs to /api/chat
   │  { "message": "How do we handle returns?", "session_id": "abc123" }
   │
3. Backend receives request
   │
4. Query Classifier analyzes message
   │  → Determines: "sop" (document query)
   │
5. RAG Engine retrieves relevant chunks
   │  → ChromaDB similarity search
   │  → Returns top 3 chunks from return policy doc
   │
6. Prompt Builder constructs LLM prompt
   │  → System prompt + context chunks + user question
   │
7. Ollama generates response
   │  → POST to localhost:11434/api/chat
   │  → Streams tokens back
   │
8. Backend logs to audit_log table
   │
9. Response returned to frontend
   │  { "response": "...", "sources": ["return-policy.pdf"], "query_type": "sop" }
   │
10. Frontend displays response
```

### Document Upload Flow

```
1. User selects file via upload button
   │
2. Frontend POSTs to /api/documents/upload
   │  → multipart/form-data with file
   │
3. Backend receives file
   │
4. Document Processor extracts text
   │  → PDF: PyPDF2
   │  → Markdown: direct read
   │
5. Text chunked into segments
   │  → ~500 tokens per chunk
   │  → 50 token overlap
   │
6. Embeddings generated for each chunk
   │  → sentence-transformers model
   │
7. Chunks + embeddings stored in ChromaDB
   │
8. Document metadata stored in SQLite
   │
9. Response returned
   │  { "document_id": "xyz", "chunks": 12 }
```

### Data Query Flow

```
1. User asks "What were sales last week?"
   │
2. Query Classifier detects: "data" query
   │
3. Data Query Builder parses intent
   │  → time_range: "last week"
   │  → metric: "sales"
   │  → aggregation: "sum"
   │
4. SQL query generated and executed
   │  → SELECT SUM(amount) FROM sales_data
   │    WHERE date BETWEEN ? AND ?
   │
5. Results formatted into context
   │  → "Sales from Jan 18-24: $12,450.00"
   │
6. LLM generates natural language response
   │  → "Last week's total sales were $12,450.00"
   │
7. Response returned to user
```

---

## Query Classification

The system classifies incoming queries into three types:

| Type | Trigger Keywords | Handling |
|------|------------------|----------|
| `sop` | "how do", "procedure", "policy", "steps" | RAG retrieval from documents |
| `data` | "sales", "revenue", "last week", "how many" | SQL query on imported data |
| `general` | Anything else | Direct LLM response |

Classification uses simple keyword matching for POC. Can upgrade to LLM-based classification later.

---

## Configuration

All configuration via environment variables or .env file:

```bash
# Server
HOST=0.0.0.0
PORT=8000

# Ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

# Database
DATABASE_URL=sqlite:///./data/store-ai.db

# ChromaDB
CHROMA_PATH=./data/chroma

# Embedding model
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

---

## Deployment

### Directory Structure (Final)

```
/home/zach-linux/store-ai-poc/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── routers/
│   ├── services/
│   ├── models/
│   └── utils/
├── static/
│   ├── index.html
│   └── js/
├── data/
│   ├── store-ai.db
│   └── chroma/
├── documents/          # Uploaded docs stored here
├── imports/            # CSV imports stored here
├── requirements.txt
├── .env
├── run.sh              # Startup script
└── README.md
```

### Startup

```bash
# run.sh
#!/bin/bash
cd /home/zach-linux/store-ai-poc

# Ensure Ollama is running
if ! pgrep -x "ollama" > /dev/null; then
    echo "Starting Ollama..."
    ollama serve &
    sleep 5
fi

# Pull model if not present
ollama pull llama3.1:8b 2>/dev/null

# Start FastAPI
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Systemd Service (Optional)

```ini
# /etc/systemd/system/store-ai.service
[Unit]
Description=Store AI POC
After=network.target

[Service]
Type=simple
User=zach
WorkingDirectory=/home/zach-linux/store-ai-poc
ExecStart=/home/zach-linux/store-ai-poc/run.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

## Security Notes (POC)

| Aspect | POC Approach | Production Upgrade |
|--------|--------------|-------------------|
| Authentication | None (trusted network) | Add JWT auth |
| HTTPS | None (localhost) | Add TLS cert |
| Input validation | Basic | Add comprehensive validation |
| Rate limiting | None | Add rate limits |
| Audit | Query logging | Add user attribution |

---

## Performance Expectations (POC)

| Operation | Expected Time |
|-----------|---------------|
| LLM response (no RAG) | 5-15 seconds |
| LLM response (with RAG) | 8-20 seconds |
| Document upload (10 pages) | 30-60 seconds |
| CSV import (1000 rows) | 5-10 seconds |
| Health check | <100ms |

These are acceptable for POC. Optimize in Phase 2 if needed.

---

## Next Steps for Implementer

See handoff document for prioritized implementation order:

1. Project structure + dependencies
2. Ollama integration
3. Basic chat endpoint
4. Web frontend
5. Document upload + RAG
6. CSV import + data queries
7. Audit logging
8. Health check

**Start with 1-4 to get basic chat working, then iterate.**

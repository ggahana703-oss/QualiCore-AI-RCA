
import os
import json
from typing import TypedDict

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from pypdf import PdfReader
from langgraph.graph import StateGraph, START, END
from sqlalchemy.orm import Session

from database import Base, engine, SessionLocal
from models import Investigation

# Load environment variables
ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(ENV_PATH)

API_KEY = os.getenv("GROQ_API_KEY")

# Create database tables
Base.metadata.create_all(bind=engine)

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


app = FastAPI(title="AI RCA Assistant")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://qualicore-ai-rca.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"message": "AI RCA Backend is Running"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/test-ai")
def test_ai():
    if not API_KEY:
        raise HTTPException(status_code=500, detail="Groq API key missing")

    client = Groq(api_key=API_KEY)

    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "user", "content": "Say AI RCA Assistant is ready."}
        ],
    )

    return {"response": response.choices[0].message.content}


class RCAState(TypedDict):
    incident_text: str
    analysis: dict


def analyze_incident(state: RCAState):
    if not API_KEY:
        raise ValueError("GROQ_API_KEY missing")

    client = Groq(api_key=API_KEY)

    prompt = f"""
You are an AI assistant supporting pharmaceutical manufacturing Root Cause Analysis (RCA).

Analyze this incident report:
{state["incident_text"]}

Return ONLY valid JSON with keys:
{{
  "incident_title": "short title",
  "incident_summary": "summary",
  "severity": "Low/Medium/High/Critical",
  "department": "department or Unknown",
  "problem_statement": "clear problem statement",
  "five_whys": [
    {{"why": 1, "question": "Why did it happen?", "answer": "Evidence-based answer"}},
    {{"why": 2, "question": "Why?", "answer": "Answer"}},
    {{"why": 3, "question": "Why?", "answer": "Answer"}},
    {{"why": 4, "question": "Why?", "answer": "Answer"}},
    {{"why": 5, "question": "Why?", "answer": "Answer"}}
  ],
  "fishbone": {{
    "Man": [],
    "Machine": [],
    "Method": [],
    "Material": [],
    "Measurement": [],
    "Environment": []
  }},
  "potential_root_causes": [
    {{"cause": "possible cause", "evidence": "supporting evidence", "confidence": "Low/Medium/High"}}
  ],
  "contributing_factors": [],
  "missing_evidence": [],
  "capa_recommendations": [
    {{"type": "Corrective/Preventive", "action": "action", "owner": "Suggested role", "priority": "High/Medium/Low"}}
  ],
  "human_review_required": true
}}

Never invent facts or evidence.
Identify assumptions and unknowns.
Root causes are hypotheses, not confirmed.
CAPA needs qualified human review.
Insufficient information must be listed in missing_evidence.
"""

    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "system", "content": "Return only valid JSON."},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )

    return {"analysis": json.loads(response.choices[0].message.content)}


# LangGraph workflow
graph_builder = StateGraph(RCAState)
graph_builder.add_node("analyze_incident", analyze_incident)
graph_builder.add_edge(START, "analyze_incident")
graph_builder.add_edge("analyze_incident", END)

rca_graph = graph_builder.compile()


@app.post("/api/analyze")
async def analyze_report(
    file: UploadFile | None = File(default=None),
    incident_text: str = Form(default=""),
):
    text = incident_text.strip()

    if file:
        filename = (file.filename or "").lower()

        if filename.endswith(".pdf"):
            try:
                reader = PdfReader(file.file)
                pdf_text = "\n".join(
                    page.extract_text() or "" for page in reader.pages
                )
                text += "\n" + pdf_text

            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"PDF extraction failed: {e}",
                )

        elif filename.endswith(".txt"):
            content = await file.read()
            text += "\n" + content.decode("utf-8", errors="ignore")

        else:
            raise HTTPException(
                status_code=400,
                detail="Upload a PDF or TXT file.",
            )

    if not text.strip():
        raise HTTPException(
            status_code=400,
            detail="Provide incident text or upload a file.",
        )

    try:
        result = rca_graph.invoke({
            "incident_text": text,
            "analysis": {},
        })

        return result["analysis"]

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"RCA analysis failed: {str(e)}",
        )


@app.post("/api/investigations")
def save_investigation(
    analysis: dict = Body(...),
    db: Session = Depends(get_db),
):
    try:
        item = Investigation(
            title=analysis.get("incident_title", "Untitled Investigation"),
            severity=analysis.get("severity", "Unknown"),
            status="Pending Review",
            analysis=analysis,
        )

        db.add(item)
        db.commit()
        db.refresh(item)

        return {
            "message": "Investigation saved successfully",
            "id": item.id,
            "title": item.title,
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save investigation: {str(e)}",
        )


@app.get("/api/investigations")
def get_investigations(db: Session = Depends(get_db)):
    records = (
        db.query(Investigation)
        .order_by(Investigation.created_at.desc())
        .all()
    )

    return [
        {
            "id": x.id,
            "title": x.title,
            "severity": x.severity,
            "status": x.status,
            "created_at": x.created_at,
        }
        for x in records
    ]


@app.get("/api/investigations/{investigation_id}")
def get_investigation(
    investigation_id: int,
    db: Session = Depends(get_db),
):
    item = (
        db.query(Investigation)
        .filter(Investigation.id == investigation_id)
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Investigation not found",
        )

    return item.analysis


@app.put("/api/investigations/{investigation_id}")
def update_investigation(
    investigation_id: int,
    analysis: dict = Body(...),
    db: Session = Depends(get_db),
):
    item = (
        db.query(Investigation)
        .filter(Investigation.id == investigation_id)
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Investigation not found",
        )

    item.title = analysis.get("incident_title", item.title)
    item.severity = analysis.get("severity", item.severity)
    item.analysis = analysis

    db.commit()
    db.refresh(item)

    return {
        "message": "Investigation updated successfully",
        "id": item.id,
        "title": item.title,
    }

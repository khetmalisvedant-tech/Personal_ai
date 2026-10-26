
from fastapi import FastAPI
from pydantic import BaseModel
from core import process_query

app = FastAPI(
    title="Personal AI API",
    description="Personal AI tutor powered by Gemma 4",
    version="1.0.0",
)


class QuestionRequest(BaseModel):
    question: str


@app.post("/ask")
async def ask(data: QuestionRequest):
    question = data.question.strip()

    if not question:
        return {"error": "No question provided"}

    return process_query(question)

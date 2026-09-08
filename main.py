from fastapi import FastAPI, WebSocket, Depends, HTTPException
from sqlalchemy.orm import Session
from database import engine, SessionLocal
import models, schemas

# Initialize database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="CST 315 Kahoot Clone")

# Dependency to safely open and close a database session per request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/quizzes/", response_model=schemas.Quiz)
def create_quiz(quiz: schemas.QuizCreate, db: Session = Depends(get_db)):
    # Hardcoding owner_id to 1 for now until we build the TA login system
    db_quiz = models.Quiz(title=quiz.title, owner_id=1) 
    db.add(db_quiz)
    db.commit()
    db.refresh(db_quiz)
    return db_quiz

@app.get("/quizzes/{quiz_id}", response_model=schemas.Quiz)
def read_quiz(quiz_id: int, db: Session = Depends(get_db)):
    db_quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if db_quiz is None:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return db_quiz

@app.post("/quizzes/{quiz_id}/questions/", response_model=schemas.Question)
def create_question_for_quiz(quiz_id: int, question: schemas.QuestionCreate, db: Session = Depends(get_db)):
    # Verify the quiz exists first
    db_quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if db_quiz is None:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Create the question and link it to the quiz_id
    db_question = models.Question(**question.model_dump(), quiz_id=quiz_id)
    db.add(db_question)
    db.commit()
    db.refresh(db_question)
    return db_question

@app.websocket("/ws/test")
async def websocket_test(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_text("WebSocket connection successful!")
    await websocket.close()
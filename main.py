from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from database import engine, SessionLocal
import models, schemas
from game_manager import manager

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

@app.websocket("/ws/host/{quiz_id}")
async def websocket_host(websocket: WebSocket, quiz_id: int):
    """Endpoint for the TA to start a game and host the lobby."""
    await websocket.accept()
    
    # Generate the 6-digit hex code
    room_code = manager.create_room(quiz_id, websocket)
    
    # Send the code back to the TA's screen so they can display it to the class
    await websocket.send_json({"event": "room_created", "room_code": room_code})
    
    try:
        while True:
            # The host connection stays open here waiting for TA commands (like "start_game")
            data = await websocket.receive_json()
            # We will add the game state machine logic here in the next step
    except WebSocketDisconnect:
        # If the TA closes the browser, we clean up the room
        if room_code in manager.active_rooms:
            del manager.active_rooms[room_code]


@app.websocket("/ws/student/{room_code}")
async def websocket_student(websocket: WebSocket, room_code: str, student_name: str):
    """Endpoint for students to join a room using the 6-digit code."""
    await websocket.accept()
    
    player_id = manager.add_student(room_code, student_name, websocket)
    
    if not player_id:
        await websocket.send_json({"error": "Invalid room code or room no longer exists."})
        await websocket.close()
        return

    # Acknowledge the connection and give the student their recovery ID
    await websocket.send_json({"event": "join_success", "player_id": player_id})
    
    # Instantly notify the TA's screen that a new student joined
    host_ws = manager.active_rooms[room_code]["host_ws"]
    await host_ws.send_json({"event": "player_joined", "student_name": student_name})
    
    try:
        while True:
            # The student connection stays open here waiting to submit answers
            data = await websocket.receive_json()
    except WebSocketDisconnect:
        # If the student's Wi-Fi drops, keep their score but mark them offline
        manager.mark_student_offline(room_code, player_id)
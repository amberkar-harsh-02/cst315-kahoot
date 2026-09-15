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
    room_code = manager.create_room(quiz_id, websocket)
    await websocket.send_json({"event": "room_created", "room_code": room_code})
    
    try:
        while True:
            data = await websocket.receive_json()
            event = data.get("event")
            room = manager.active_rooms.get(room_code)
            
            if event == "start_game":
                db = SessionLocal()
                quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
                
                if quiz and quiz.questions:
                    room["questions"] = [
                        {
                            "id": q.id,
                            "text": q.text,
                            "options": {
                                "red": q.option_red,
                                "blue": q.option_blue,
                                "yellow": q.option_yellow,
                                "green": q.option_green
                            },
                            "correct": q.correct_option,
                            "time_limit": q.time_limit_seconds
                        } for q in quiz.questions
                    ]
                    room["current_state"] = "question_active"
                    room["current_question_index"] = 0
                    
                    first_question = room["questions"][0]
                    
                    await manager.broadcast_to_students(room_code, {
                        "event": "show_question",
                        "question": {
                            "text": first_question["text"],
                            "options": first_question["options"],
                            "time_limit": first_question["time_limit"]
                        }
                    })
                db.close()
                
            elif event == "time_up":
                if room:
                    room["current_state"] = "time_up"
                    current_q_index = room["current_question_index"]
                    current_question = room["questions"][current_q_index]
                    
                    # Calculate how many students picked each color
                    distribution = {"red": 0, "blue": 0, "yellow": 0, "green": 0}
                    for student in room["students"].values():
                        if student.get("last_answered_index") == current_q_index:
                            # We need to peek at what they actually selected. 
                            # (Wait, we need to save their choice in the student dict in submit_answer!
                            # For now, let's just send the correct answer back).
                            pass 

                    # Notify Host
                    await websocket.send_json({
                        "event": "time_up_results",
                        "correct_option": current_question["correct"]
                    })
                    
                    # Notify Students
                    await manager.broadcast_to_students(room_code, {
                        "event": "time_up",
                        "correct_option": current_question["correct"]
                    })
                    
            elif event == "show_leaderboard":
                if room:
                    room["current_state"] = "leaderboard"
                    
                    # Sort students by score, descending
                    ranked_students = sorted(
                        room["students"].values(), 
                        key=lambda x: x["score"], 
                        reverse=True
                    )
                    
                    # Grab top 5
                    top_5 = [
                        {"name": s["name"], "score": s["score"]} 
                        for s in ranked_students[:5]
                    ]
                    
                    await websocket.send_json({
                        "event": "leaderboard",
                        "top_players": top_5
                    })

            elif event == "next_question":
                if room:
                    room["current_question_index"] += 1
                    current_q_index = room["current_question_index"]
                    
                    # Check if we have run out of questions
                    if current_q_index >= len(room["questions"]):
                        await websocket.send_json({"event": "quiz_finished"})
                    else:
                        room["current_state"] = "question_active"
                        next_question = room["questions"][current_q_index]
                        
                        await manager.broadcast_to_students(room_code, {
                            "event": "show_question",
                            "question": {
                                "text": next_question["text"],
                                "options": next_question["options"],
                                "time_limit": next_question["time_limit"]
                            }
                        })

            elif event == "end_game":
                if room:
                    db = SessionLocal()
                    
                    # 1. Create a permanent record of this game session
                    game_session = models.GameSession(quiz_id=quiz_id, room_code=room_code)
                    db.add(game_session)
                    db.commit()
                    db.refresh(game_session)
                    
                    # 2. Loop through all students in memory and save their final scores
                    for player_id, student in room["students"].items():
                        result = models.StudentResult(
                            session_id=game_session.id,
                            student_name=student["name"],
                            total_score=student["score"],
                            correct_answers=0 # We can calculate this later if needed
                        )
                        db.add(result)
                    
                    db.commit()
                    db.close()
                    
                    # 3. Tell all student devices the game is over and give them the session ID to download their report
                    await manager.broadcast_to_students(room_code, {
                        "event": "game_over",
                        "session_id": game_session.id
                    })
                    
                    # 4. Wipe the room from the server's live memory
                    del manager.active_rooms[room_code]

    except WebSocketDisconnect:
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

    await websocket.send_json({"event": "join_success", "player_id": player_id})
    
    # Notify Host
    host_ws = manager.active_rooms[room_code]["host_ws"]
    await host_ws.send_json({
        "event": "player_joined", 
        "student_name": student_name,
        "total_players": len(manager.active_rooms[room_code]["students"])
    })
    
    try:
        while True:
            data = await websocket.receive_json()
            event = data.get("event")
            
            if event == "submit_answer":
                room = manager.active_rooms.get(room_code)
                # Ignore if the game isn't actively taking answers
                if not room or room["current_state"] != "question_active":
                    continue
                
                student = room["students"][player_id]
                current_q_index = room["current_question_index"]
                
                # The Instant Lock: If they already answered this index, ignore new taps
                if student.get("last_answered_index") == current_q_index:
                    continue
                
                # Lock in their answer
                student["last_answered_index"] = current_q_index
                student["last_selected_option"] = selected_option
                selected_option = data.get("selected_option")
                time_remaining_ms = data.get("time_remaining_ms", 0)
                
                # Check correctness
                current_question = room["questions"][current_q_index]
                is_correct = (selected_option == current_question["correct"])
                
                # Scoring: 500 base points for correct + up to 500 speed bonus
                if is_correct:
                    time_limit_ms = current_question["time_limit"] * 1000
                    speed_bonus = int((time_remaining_ms / time_limit_ms) * 500)
                    # Ensure they don't get negative bonus if timing is slightly off
                    student["score"] += 500 + max(0, speed_bonus)
                
                # Tally total answers received for this specific question
                answers_in = sum(1 for s in room["students"].values() if s.get("last_answered_index") == current_q_index)
                
                # Push the updated count to the TA's screen
                await host_ws.send_json({
                    "event": "answer_received",
                    "answers_submitted": answers_in,
                    "total_players": len(room["students"])
                })
                
    except WebSocketDisconnect:
        manager.mark_student_offline(room_code, player_id)  
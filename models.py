from sqlalchemy import Boolean, Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

import datetime
from sqlalchemy import DateTime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_professor = Column(Boolean, default=False)

class Quiz(Base):
    """Stores the overarching quiz information."""
    __tablename__ = "quizzes"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    
    owner = relationship("User")
    questions = relationship("Question", back_populates="quiz", cascade="all, delete-orphan")

class Question(Base):
    """Stores individual questions and answers for a quiz."""
    __tablename__ = "questions"
    
    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"))
    text = Column(String)
    option_red = Column(String)
    option_blue = Column(String)
    option_yellow = Column(String)
    option_green = Column(String)
    correct_option = Column(String)  # Expected values: 'red', 'blue', 'yellow', 'green'
    time_limit_seconds = Column(Integer, default=30)
    
    quiz = relationship("Quiz", back_populates="questions")


class GameSession(Base):
    """Stores the record of a specific live quiz session."""
    __tablename__ = "game_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"))
    room_code = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    results = relationship("StudentResult", back_populates="session")

class StudentResult(Base):
    """Stores the final score for an individual student in a session."""
    __tablename__ = "student_results"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("game_sessions.id"))
    student_name = Column(String)
    total_score = Column(Integer)
    correct_answers = Column(Integer)
    
    session = relationship("GameSession", back_populates="results")

class StudentAnswer(Base):
    """Stores the specific answer a student gave for a single question."""
    __tablename__ = "student_answers"
    
    id = Column(Integer, primary_key=True, index=True)
    result_id = Column(Integer, ForeignKey("student_results.id"))
    question_id = Column(Integer, ForeignKey("questions.id"))
    selected_option = Column(String)
    is_correct = Column(Integer) # SQLite stores booleans as 1 (True) or 0 (False)
    
    # Establish a relationship back to the main student result
    result = relationship("StudentResult", backref="answers")
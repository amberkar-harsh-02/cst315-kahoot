from pydantic import BaseModel
from typing import List, Optional


class UserCreate(BaseModel):
    email: str
    password: str
    is_professor: bool = False

class UserResponse(BaseModel):
    id: int
    email: str
    is_professor: bool

    class Config:
        from_attributes = True

# --- Questions ---
class QuestionBase(BaseModel):
    text: str
    option_red: str
    option_blue: str
    option_yellow: str
    option_green: str
    correct_option: str
    time_limit_seconds: int = 30

class QuestionCreate(QuestionBase):
    pass

class Question(QuestionBase):
    id: int
    quiz_id: int

    class Config:
        from_attributes = True  # Tells Pydantic to read data from SQLAlchemy models

# --- Quizzes ---
class QuizBase(BaseModel):
    title: str

class QuizCreate(QuizBase):
    pass

class Quiz(QuizBase):
    id: int
    owner_id: int
    questions: List[Question] = []

class Config:
    from_attributes = True

class GoogleAuthRequest(BaseModel):
    token: str
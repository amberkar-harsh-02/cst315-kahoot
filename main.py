from fastapi import FastAPI, WebSocket
from database import engine
import models

# This command tells SQLAlchemy to create all tables defined in models.py
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="CST 315 Kahoot Clone")

@app.get("/")
async def root():
    return {"message": "Database and Server are running!"}

@app.websocket("/ws/test")
async def websocket_test(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_text("WebSocket connection successful!")
    await websocket.close()
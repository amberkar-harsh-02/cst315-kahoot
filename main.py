from fastapi import FastAPI, WebSocket

app = FastAPI(title="CST 315 Kahoot Clone")

@app.get("/")
async def root():
    return {"message": "Server is running!"}

@app.websocket("/ws/test")
async def websocket_test(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_text("WebSocket connection successful!")
    await websocket.close()
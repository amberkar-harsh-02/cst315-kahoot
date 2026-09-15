import uuid
from typing import Dict, Any
from fastapi import WebSocket

class GameManager:
    def __init__(self):
        # Maps a 6-digit hex room code to the live game state
        self.active_rooms: Dict[str, Dict[str, Any]] = {}

    def create_room(self, quiz_id: int, host_ws: WebSocket) -> str:
        """Generates a room and stores the TA/Professor's websocket."""
        room_code = uuid.uuid4().hex[:6].upper()
        self.active_rooms[room_code] = {
            "quiz_id": quiz_id,
            "host_ws": host_ws,
            "students": {},          # Maps player_id -> student data
            "current_state": "lobby", # States: lobby, question, leaderboard
            "current_question_index": 0
        }
        return room_code

    def add_student(self, room_code: str, student_name: str, websocket: WebSocket) -> str:
        """Adds a student to a room and returns their unique reconnection ID."""
        if room_code not in self.active_rooms:
            return None
        
        player_id = str(uuid.uuid4())
        self.active_rooms[room_code]["students"][player_id] = {
            "name": student_name,
            "ws": websocket,
            "score": 0,
            "status": "online" # We toggle this to offline if they disconnect
        }
        return player_id

    def mark_student_offline(self, room_code: str, player_id: str):
        """Preserves the student's score if their Wi-Fi drops."""
        if room_code in self.active_rooms and player_id in self.active_rooms[room_code]["students"]:
            self.active_rooms[room_code]["students"][player_id]["status"] = "offline"


    async def broadcast_to_students(self, room_code: str, message: dict):
        """Sends a JSON payload to all online students in a room."""
        if room_code in self.active_rooms:
            for player_id, student in self.active_rooms[room_code]["students"].items():
                if student["status"] == "online":
                    try:
                        await student["ws"].send_json(message)
                    except Exception:
                        # If the send fails, assume they dropped connection
                        student["status"] = "offline"

# Initialize a single global instance of the manager
manager = GameManager()
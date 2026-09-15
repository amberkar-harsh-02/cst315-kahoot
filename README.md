# CST 315 Real-Time Quiz App

A custom, real-time Kahoot alternative built for Introduction to Cybersecurity (CST 315). Built with FastAPI, WebSockets, and SQLite.

## How to Run Locally

1. **Install Dependencies:**
   Ensure you have Python installed, then run:
   \`\`\`bash
   pip install fastapi uvicorn sqlalchemy aiofiles
   \`\`\`

2. **Start the Server:**
   Run the following command in your terminal:
   \`\`\`bash
   uvicorn main:app --reload
   \`\`\`

3. **Access the App:**
   * **Host/Instructor Dashboard:** `http://127.0.0.1:8000/host.html`
   * **Student View:** `http://127.0.0.1:8000/index.html`
   * **API Docs (for making quizzes/questions):** `http://127.0.0.1:8000/docs`

## 🎨 UI Handoff Notes (Crucial for Styling)

The frontend is driven by Vanilla JavaScript and WebSockets. The JS relies on specific HTML `id` and `class` attributes to update the screen in real-time. **You can add as many new CSS classes, divs, and wrappers as you want, but please DO NOT change or remove the following IDs:**

### General Screen Logic
* **`.screen` (Class):** Applied to the main wrapper `div` of every distinct view. The JavaScript hides/shows these to swap screens. 

### Student View (`index.html`)
* `join_screen`, `waiting_screen`, `active_question_screen`, `end_screen` (Screen wrappers)
* `room_pin`, `student_name` (Inputs)
* `question_text`, `time_left` (Displays active data)
* `btn_red`, `btn_blue`, `btn_yellow`, `btn_green` (The interactive answer buttons)

### Host Dashboard (`host.html`)
* `setup_screen`, `host_lobby`, `host_active`, `host_analytics` (Screen wrappers)
* `quiz_id_input` (Input)
* `pin_display`, `student_list`, `student_count` (Lobby dynamic displays)
* `host_status`, `answer_count`, `total_active_players` (Active game dynamic displays)
* `analytics_content` (Where the final results table is injected)

## Database Reset
If you need to wipe the database and start fresh, simply delete the `kahoot.db` file from the folder and restart the server. SQLAlchemy will automatically rebuild an empty database.
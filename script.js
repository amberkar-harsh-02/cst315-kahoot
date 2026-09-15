let ws = null;
let roomCode = "";
let studentName = "";
let questionStartTime = 0;
let timeLimitMs = 30000; // Default 30s, gets updated when question loads

// Utility function to switch between screens
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.style.display = 'none';
    });
    document.getElementById(screenId).style.display = 'block';
}

// Triggered by the "Enter" button on the Join Screen
function joinGame() {
    roomCode = document.getElementById('room_code_input').value.toUpperCase();
    studentName = document.getElementById('student_name_input').value.trim();

    if (roomCode.length !== 6 || studentName.length === 0) {
        document.getElementById('join_error').innerText = "Please enter a valid 6-digit PIN and your name.";
        return;
    }

    // Connect to your FastAPI WebSocket route
    const wsUrl = `ws://127.0.0.1:8000/ws/student/${roomCode}?student_name=${encodeURIComponent(studentName)}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = function() {
        document.getElementById('join_error').innerText = "";
    };

    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);

        if (data.error) {
            document.getElementById('join_error').innerText = data.error;
            ws.close();
            return;
        }

        switch(data.event) {
            case "join_success":
                // Successfully connected, move to lobby
                showScreen('lobby_screen');
                break;
            
            case "show_question":
                // Hide lobby, show the game grid
                showScreen('game_screen');
                document.getElementById('question_banner').innerText = data.question.text;
                
                // Populate button texts
                document.getElementById('text_red').innerText = data.question.options.red;
                document.getElementById('text_yellow').innerText = data.question.options.yellow;
                document.getElementById('text_blue').innerText = data.question.options.blue;
                document.getElementById('text_green').innerText = data.question.options.green;
                
                // Reset button opacities in case they were dimmed from a previous question
                document.querySelectorAll('.button').forEach(btn => {
                    btn.style.opacity = '1';
                    btn.disabled = false;
                });
                
                // Start the internal timer for the score calculation
                questionStartTime = Date.now();
                timeLimitMs = data.question.time_limit * 1000;
                break;
            
            case "time_up":
                document.getElementById('question_banner').innerText = 
                    "Time's Up! Correct Answer: " + data.correct_option.toUpperCase();
                break;
            
            case "game_over":
                showScreen('end_screen');
                // Store the session ID on the button so we can fetch the CSV receipt later
                const receiptBtn = document.getElementById('download_receipt_btn');
                receiptBtn.style.display = "block";
                receiptBtn.dataset.sessionId = data.session_id;
                break;
        }
    };

    ws.onclose = function() {
        if (document.getElementById('join_screen').style.display === 'none') {
            alert("Connection lost. Please refresh and rejoin.");
        }
    };
}

// Triggered by clicking a color button
function submitAnswer(color) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    
    // Calculate how fast the student answered
    const timeTakenMs = Date.now() - questionStartTime;
    const timeRemainingMs = Math.max(0, timeLimitMs - timeTakenMs); 
    
    const payload = {
        event: "submit_answer",
        selected_option: color,
        time_remaining_ms: timeRemainingMs
    };
    
    ws.send(JSON.stringify(payload));
    
    // Visual feedback: dim the buttons and disable them so they know their answer locked in
    document.querySelectorAll('.button').forEach(btn => {
        if (btn.id !== `btn_${color}`) {
            btn.style.opacity = '0.4';
        }
        btn.disabled = true;
    });
    
    document.getElementById('question_banner').innerText = "Answer locked! Waiting for time to expire...";
}
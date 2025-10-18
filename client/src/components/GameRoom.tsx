import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { GameState } from '../App';
import './GameRoom.css';

interface GameRoomProps {
  gameState: GameState;
  socket: Socket;
  playerName: string;
  onLeaveGame: () => void;
}

interface Message {
  from: string;
  message: string;
  timestamp: number;
  role: 'responder' | 'caller';
}

const GameRoom: React.FC<GameRoomProps> = ({ gameState, socket, playerName, onLeaveGame }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isCallActive, setIsCallActive] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    socket.on('message-received', (messageData: Message) => {
      setMessages(prev => [...prev, messageData]);
    });

    socket.on('call-ended', (data: { reason: string }) => {
      setIsCallActive(false);
      alert(`Call ended: ${data.reason}`);
    });

    return () => {
      socket.off('message-received');
      socket.off('call-ended');
    };
  }, [socket]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentMessage.trim() && isCallActive) {
      const messageData = {
        gameId: gameState.gameId,
        message: currentMessage.trim(),
        timestamp: Date.now()
      };

      socket.emit('send-message', messageData);
      setCurrentMessage('');
    }
  };

  const handleEndCall = () => {
    socket.emit('end-call', { gameId: gameState.gameId, reason: 'Call ended by user' });
    onLeaveGame();
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="game-room">
      <div className="game-header">
        <div className="game-info">
          <h2>Security Incident Call</h2>
          <p>You are: <span className="role">{gameState.role === 'responder' ? 'SOCC Incident Responder' : 'Caller'}</span></p>
          <p>Opponent: {gameState.opponent}</p>
          <p>Scenario: {gameState.scenario.title}</p>
        </div>
        <button onClick={handleEndCall} className="end-call-button">
          End Call
        </button>
      </div>

      {gameState.role === 'caller' && (
        <div className="caller-script">
          <h3>Your Script:</h3>
          <p className="script-text">{gameState.scenario.callerScript}</p>
          <p className="false-info"><strong>False Info to Include:</strong> {gameState.scenario.falseInfo}</p>
        </div>
      )}

      {gameState.role === 'responder' && (
        <div className="responder-goals">
          <h3>Your Goals:</h3>
          <ul>
            {gameState.scenario.responderGoals.map((goal, index) => (
              <li key={index}>{goal}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="chat-container">
        <div className="messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.from === socket.id ? 'own' : 'other'}`}>
              <div className="message-header">
                <span className="sender">{msg.from === socket.id ? 'You' : gameState.opponent}</span>
                <span className="timestamp">{formatTime(msg.timestamp)}</span>
              </div>
              <div className="message-content">{msg.message}</div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {isCallActive && (
          <form onSubmit={handleSendMessage} className="message-form">
            <input
              type="text"
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              placeholder="Type your message..."
              disabled={!isCallActive}
              maxLength={500}
            />
            <button type="submit" disabled={!currentMessage.trim()}>
              Send
            </button>
          </form>
        )}

        {!isCallActive && (
          <div className="call-ended">
            <p>Call has ended. <button onClick={onLeaveGame} className="return-button">Return to Lobby</button></p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameRoom;
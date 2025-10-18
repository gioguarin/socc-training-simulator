import React, { useState } from 'react';
import './Lobby.css';

interface LobbyProps {
  onJoinLobby: (name: string) => void;
}

const Lobby: React.FC<LobbyProps> = ({ onJoinLobby }) => {
  const [playerName, setPlayerName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim()) {
      onJoinLobby(playerName.trim());
    }
  };

  return (
    <div className="lobby">
      <div className="lobby-card">
        <h2>Join Training Session</h2>
        <p>Enter your name to join the SOCC training lobby. You'll be matched with another player for a simulated security incident call.</p>

        <form onSubmit={handleSubmit} className="lobby-form">
          <div className="form-group">
            <label htmlFor="playerName">Your Name:</label>
            <input
              type="text"
              id="playerName"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              required
              maxLength={50}
            />
          </div>

          <button type="submit" className="join-button" disabled={!playerName.trim()}>
            Join Lobby
          </button>
        </form>

        <div className="lobby-info">
          <h3>How it works:</h3>
          <ul>
            <li>You'll be randomly matched with another player</li>
            <li>One player becomes the SOCC Incident Responder</li>
            <li>The other becomes a simulated caller with a security scenario</li>
            <li>Practice handling real-world security incidents</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
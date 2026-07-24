import { useData } from '../context/DataContext';

// Shown for the final 60 seconds before an inactivity logout.
// Uses the app's existing confirm-overlay styling.
export default function IdleWarning() {
  const { idleCountdown, stayLoggedIn, logout } = useData();

  if (idleCountdown === null || idleCountdown === undefined) return null;

  return (
    <div className="confirm-overlay show">
      <div className="confirm-box">
        <div className="confirm-icon"><i className="fa-solid fa-clock"></i></div>
        <h3>Still there?</h3>
        <p>
          You've been inactive for a while. For security you'll be signed out in{' '}
          <strong>{idleCountdown}</strong> second{idleCountdown === 1 ? '' : 's'}.
        </p>
        <div className="confirm-actions">
          <button className="btn btn-small btn-teal" onClick={stayLoggedIn}>
            <i className="fa-solid fa-arrow-rotate-left"></i> Stay logged in
          </button>
          <button className="btn btn-small btn-outline" onClick={logout}>
            Log out now
          </button>
        </div>
      </div>
    </div>
  );
}

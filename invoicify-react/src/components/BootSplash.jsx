/**
 * Branded splash shown while the app checks a saved login on startup/refresh.
 * Same for desktop and mobile — it's centered and responsive.
 */
export default function BootSplash() {
  return (
    <div className="boot-splash">
      <div className="boot-splash-inner">
        <div className="boot-logo"><i className="fa-solid fa-file-invoice-dollar"></i></div>
        <div className="boot-wordmark">Invoicify</div>
        <div className="boot-bar"><span></span></div>
      </div>
    </div>
  );
}

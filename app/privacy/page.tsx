export default function PrivacyPolicy() {
  return (
    <div className="card" style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1>Privacy Policy</h1>
      <p style={{ opacity: 0.7 }}>Last updated: February 2026</p>

      <h2>Overview</h2>
      <p>
        FindAGoodTime ("we", "our", or "the app") helps groups find mutual availability 
        by checking Google Calendar free/busy information. We take your privacy seriously 
        and only access the minimum data needed to provide this service.
      </p>

      <h2>Information We Access</h2>
      <p>When you connect your Google account, we access:</p>
      <ul>
        <li><strong>Your email address</strong> - to identify you as a meeting participant</li>
        <li><strong>Your name</strong> - for display purposes only</li>
        <li><strong>Calendar free/busy data</strong> - to determine when you're available (we do NOT see event titles, descriptions, or attendees)</li>
      </ul>

      <h2>Information We Store</h2>
      <ul>
        <li>Your email address and name</li>
        <li>OAuth tokens to access your calendar (encrypted)</li>
        <li>Meeting details you create (title, participants, time preferences)</li>
      </ul>

      <h2>Information We Do NOT Access or Store</h2>
      <ul>
        <li>Event titles or descriptions</li>
        <li>Event attendees or locations</li>
        <li>Any calendar data beyond free/busy status</li>
        <li>We do NOT create, modify, or delete any calendar events</li>
      </ul>

      <h2>How We Use Your Information</h2>
      <p>
        Your information is used solely to find overlapping free times among meeting 
        participants. We do not sell, share, or use your data for advertising or any 
        other purpose.
      </p>

      <h2>Data Retention</h2>
      <p>
        Your data is retained only as long as needed to facilitate meeting scheduling. 
        You can request deletion of your data at any time by contacting us.
      </p>

      <h2>Third-Party Services</h2>
      <p>
        We use Google OAuth for authentication and Google Calendar API for free/busy 
        lookups. Your use of these services is also subject to{' '}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
          Google's Privacy Policy
        </a>.
      </p>

      <h2>Security</h2>
      <p>
        We use industry-standard security measures including HTTPS encryption and secure 
        token storage. OAuth tokens are stored securely and are never exposed to other users.
      </p>

      <h2>Contact</h2>
      <p>
        For questions about this privacy policy or to request data deletion, please contact 
        us at: <a href="mailto:privacy@findagoodtime.com">privacy@findagoodtime.com</a>
      </p>

      <div style={{ marginTop: 32 }}>
        <a href="/">← Back to home</a>
      </div>
    </div>
  );
}

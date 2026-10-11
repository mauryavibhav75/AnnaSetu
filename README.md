# AnnaSetu — Live Server + Node.js Backend

## Start the project in VS Code Live Server

1. Open `annasetu-ready/frontend` in VS Code and run `index.html` with Live Server.
2. Use ONE hostname consistently in the browser: either `http://127.0.0.1:5500` or `http://localhost:5500`. Do not switch between them during a session.
3. In a second VS Code terminal:
   ```bash
   cd backend
   npm start
   (Dependencies are included in this ZIP; if npm reports a missing package, run `npm install` once.)
   ```
   Run the commands from the `annasetu-ready` folder. The backend API is on port 5000.
4. Verify MongoDB and the backend at `http://localhost:5000/api/health`. Expected JSON includes `"ok": true` and `"database": "connected"`.

## Authentication flow

- Start Donating and Start Seva open Login, which also offers Create Account.
- New users create an account; successful registration creates a login session and takes them to the requested page.
- Existing users log in with email and password. If their session is still valid, the login page forwards them automatically.
- Sessions use an HTTP-only cookie and MongoDB session storage. The cookie/session lifetime is 10 days and is refreshed with activity, so about 10 days without activity requires login again.
- Login and registration use `credentials: include` and the API hostname is matched to the Live Server hostname so the session cookie works across ports.

## Environment configuration

`backend/.env` contains local environment credentials. Do not publish or commit it. If MongoDB Atlas connection fails, check that the database username/password and cluster host are correct, percent-encode special characters in the password, and allow your current IP in Atlas Network Access. `backend/.env.example` is a template only.

## Security

The supplied `.env` is for local development. Rotate the MongoDB database password and `SESSION_SECRET` if they have been shared or exposed. Never upload `.env` to a public repository.

## Add-ons in this update

- Start Donating now uses the same Maharashtra state/city/area choices as Find Seva (Maharashtra is selected by default).
- Donors can explicitly request GPS location; if they do not, the selected locality/city supplies an approximate map point for nearby matching.
- Find Seva continues to sort LIVE donations by distance from the selected/current location.
- A volunteer's acceptance does not hide the donation. The donor can stop their own LIVE donation from Account History when it has been collected or is no longer available.
- Volunteer progress is tracked separately from the donor's LIVE listing status.
- Existing authentication, MongoDB session store and 10-day rolling session cookie settings are retained.

Run backend with `cd backend` then `npm start`. Open the frontend using VS Code Live Server. Use the same hostname consistently (`127.0.0.1` or `localhost`) for the Live Server tab and API host.

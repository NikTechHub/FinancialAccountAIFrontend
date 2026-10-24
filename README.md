# Tailwindadmin - Free Tailwind CSS & React JS Admin Dashboard Website Template
#### Preview

 - [Demo](https://themewagon.github.io/tailwindadmin/)

#### Download
 - [Download from ThemeWagon](https://themewagon.com/themes/tailwindadmin/)

## Getting Started

1. Clone Repository
```
git clone https://github.com/themewagon/tailwindadmin.git
```
2. Install Dependencies
```
npm i
```
3. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

## Frontend Integration

The frontend defaults to `/api/v1` and uses the Vite development proxy:

- Browser request: `/api/v1/...`
- Vite proxy: `/api` -> `http://localhost:8080`

Override the API base with `VITE_API_BASE_URL` in a local `.env` (never commit it). Start
from `.env.example`; leave the default relative path to keep using the proxy. An absolute
URL such as `http://localhost:8080/api/v1` bypasses the proxy and requires backend CORS.

```bash
npm run lint
npm test
npm run build
```

The API client lives in `src/lib/api`. Authentication contract notes are in
`docs/frontend-auth-contract.md`.

### Authentication

- Public routes: `/auth/auth2/login` and `/auth/auth2/register`.
- All application routes under `/` require an authenticated session.
- Login and registration call the real backend through the API client.
- The access token is kept in memory; the rotating refresh token is kept in
  `sessionStorage` for the current tab. On reload, the provider refreshes once.
- Concurrent 401 responses share a single refresh request; requests retry once.
- Logout is available in the profile menu and clears the local session only.
- The app uses the first organization returned by the backend. There is no organization
  switcher, and a missing organization shows an “Organization unavailable” state.

## Author 
```
Design and code is completely written by Tailwindadmin and development team. 
```

## License

 - Design and Code is Copyright &copy; <a href="https://tailwind-admin.com/" target="_blank">Tailwindadmin</a>
 - Licensed cover under [MIT]
 - Distributed by <a href="https://themewagon.com" target="_blank">ThemeWagon</a>

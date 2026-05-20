# ECM Frontend

Enterprise Content Management — React frontend (local auth & storage for now).

## Structure

```
src/
  pages/          Login, Signup, Home
  components/     Sidebar, FileUpload, FileSearch, FileList, ProtectedRoute
  utils/          auth.js (localStorage users/session), files.js (localStorage assets)
  App.jsx         Routes
  main.jsx        Entry
```

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Flow

1. **Sign up** — creates user in `localStorage` (`ecm_users`), logs in, redirects to `/home`
2. **Login** — validates against `ecm_users`, stores session in `ecm_session`
3. **Home** — upload assets (metadata in `ecm_files`), search by name / owner / date

Backend (S3, DynamoDB, Lambda) can replace `utils/files.js` and `utils/auth.js` later without changing page structure.

Bucket name : aaas-content-vault-2026
DynamoDB table : DocumentMetadata
IAM role for lambda : ecm-uploadfiles-role-641px569

generateurl function url : https://trloz5caellu5a4odhzeyesl3y0zwxet.lambda-url.us-east-1.on.aws/

savemetadata function url : https://sdnh3b56ojmfasqplglv6w2ddy0ozvce.lambda-url.us-east-1.on.aws/

https://aaas-content-vault-2026.s3.us-east-1.amazonaws.com/Archival/


CSV
 │
 ▼
Frontend
 │
 ├── Parse CSV
 ├── Send rows
 │
 ▼
Lambda
 │
 ├── Extract source key
 ├── Generate UUID
 ├── Create destination path
 ├── Copy S3 object
 └── Return UUID + new S3 path
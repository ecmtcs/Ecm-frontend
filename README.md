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

## AWS backend

| Resource | Value |
|----------|--------|
| S3 bucket | `aaas-content-vault-2026` |
| DynamoDB table | `DocumentMetadata` |
| GSI (search) | `SearchPK-index` (partition key: `SearchPK`) |
| Upload Lambda URL | `https://trloz5caellu5a4odhzeyesl3y0zwxet.lambda-url.us-east-1.on.aws/` |
| Search Lambda URL | `https://sdnh3b56ojmfasqplglv6w2ddy0ozvce.lambda-url.us-east-1.on.aws/` |

Deploy upload: zip `Perfect running upload.py` → upload Lambda Function URL.  
Deploy search: zip `search-lambdafunction.py` → search Lambda Function URL (`savemetadata`).

**Lambda Function URL settings (required for browser search):**
- Auth type: `NONE` (not AWS_IAM)
- CORS: allow origin `*`, methods `POST, OPTIONS`, headers `Content-Type`

Local dev uses a Vite proxy (`/api/search`) so CORS is not an issue when running `npm run dev`.

Search uses **GSI overloading**: each document gets `SearchPK` like `DOCTYPE#Contract` for `Query` on `SearchPK-index`.

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

 Now , i want to add functionality of searching those stored document using concept of GSI overloading , i have created index name searchPK-index for searching and made changes in my upload lambda function and search lambda function but i am unable to see the result in my frontend and its shows failed to search please fix there error . We are using GSI overloading because I have one table and many documentype where metadata are according to type of document so using these concept .
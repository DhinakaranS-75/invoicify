# Invoicify Backend API

Node.js + Express + MongoDB (Mongoose) REST API for the Invoicify app.

## Setup (one time)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create your `.env` file from the template:
   ```bash
   # Windows
   copy .env.example .env
   # Mac/Linux
   cp .env.example .env
   ```

3. Open `.env` and fill in:
   - `MONGODB_URI` — your MongoDB Atlas connection string (replace `<password>`
     with your real password, and add `/invoicify` before the `?` for the db name)
   - `JWT_SECRET` — any long random string

## Run

```bash
# Development (auto-restarts on file changes)
npm run dev

# Normal start
npm start
```

Server runs on **http://localhost:5000**. Open it in a browser — you should see:
```json
{ "message": "Invoicify API is running 🚀" }
```

## API Endpoints

### Auth
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | `/api/auth/register` | Create account | No |
| POST | `/api/auth/login` | Log in, get token | No |
| GET | `/api/auth/me` | Current user | Yes |
| PUT | `/api/auth/profile` | Update profile | Yes |
| PUT | `/api/auth/company` | Onboarding / company / prefs | Yes |

### Invoices / Customers / Items
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/invoices` | List all (company) |
| POST | `/api/invoices` | Create |
| PUT | `/api/invoices/:id` | Update |
| DELETE | `/api/invoices/:id` | Delete |

(Same pattern for `/api/customers` and `/api/items`.)

All data routes require an `Authorization: Bearer <token>` header.

## Folder structure

```
invoicify-backend/
├── server.js            # App entry point
├── config/db.js         # MongoDB connection
├── models/              # Mongoose schemas (User, Invoice, Customer, Item)
├── controllers/         # Business logic
├── routes/              # API endpoints
├── middleware/auth.js   # JWT protection
└── .env                 # Secrets (never commit)
```

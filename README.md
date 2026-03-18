# POS System Backend

NestJS + Prisma + PostgreSQL API for the POS (Point of Sale) frontend. All endpoints are under the `/api` prefix.

## Tech stack

- **Runtime**: Node.js (LTS)
- **Language**: TypeScript
- **Framework**: NestJS
- **Database**: PostgreSQL
- **ORM**: Prisma

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure database**

   Copy `.env.example` to `.env` and set `DATABASE_URL` to your PostgreSQL connection string:

   ```bash
   cp .env.example .env
   ```

   Example:

   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/pos_db?schema=public"
   ```

3. **Run migrations**

   ```bash
   npm run prisma:migrate
   ```

4. **(Optional) Seed a test employee + super admin for passcode login**

   ```bash
   npx prisma db seed
   ```

   Creates:
   - `Super Admin` (role `SUPER_ADMIN`) with passcode `8888`
   - `Alice` (role `EMPLOYEE`) with passcode `1234`

5. **Start the API**

   ```bash
   npm run start:dev
   ```

   API base URL: `http://localhost:3000/api`. Set `JWT_SECRET` in `.env` for production.

## API Endpoints

Base path: **`/api`**

### Products

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/products` | List all products. Query: `?active=true` for active only. |
| `GET` | `/products/:id` | Get one product by ID. |
| `POST` | `/products` | Create product. Body: `{ sku, name, price, isActive? }`. |
| `PATCH` | `/products/:id` | Update product (partial). |
| `DELETE` | `/products/:id` | Delete product. |

### Orders

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/orders` | Create order from draft. Body: `{ items: [{ productId, quantity }], paymentMethod }`. |
| `GET` | `/orders` | List orders. Query: `?limit=50&cursor=<id>` for pagination. |
| `GET` | `/orders/:id` | Get one order with items. |

### Auth (passcode login)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/passcode-login` | Body: `{ "passcode": "1234" }`. Returns `{ token, user: { id, name, role } }` or `401` (invalid passcode / lockout). Lockout after 5 failed attempts (15 min). |

### Employees / Time tracking

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/employees` | Create employee. Body: `{ name, passcode, role }` (`role`: `SUPER_ADMIN` \| `EMPLOYEE`). |
| `POST` | `/employees/change-passcode` | Body: `{ employeeId, newPasscode, superAdminPasscode }`. Returns `403` if super admin passcode is wrong. |
| `POST` | `/time/clock-in` | Body: `{ employeeId }`. Creates a new time entry (fails if already clocked in). |
| `POST` | `/time/clock-out` | Body: `{ entryId }`. Sets `clockOutAt` (fails if already clocked out). |
| `GET` | `/time/entries?employeeId=<id>` | Returns recent time entries for the employee. |

### Sales

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/sales/summary` | Sales summary. Query: `?date=YYYY-MM-DD` for one day, or omit for last 30 days (array). |

## Types (aligned with frontend)

- **Product**: `id`, `sku`, `name`, `price` (cents), `isActive`
- **Order**: `id`, `orderNumber`, `createdAt`, `status`, `subtotal`, `tax`, `total`, `paymentMethod`, `items[]`
- **OrderItem**: `id`, `productId`, `name`, `unitPrice`, `quantity`
- **DraftOrder**: `items: { productId, quantity }[]`, `paymentMethod` (`CASH` \| `CARD` \| `OTHER`)
- **SalesSummary**: `date`, `totalSales`, `totalOrders`, `averageTicket`

## Scripts

- `npm run start:dev` – run with watch mode
- `npm run build` – build for production
- `npm run start:prod` – run production build
- `npm run prisma:studio` – open Prisma Studio for the database

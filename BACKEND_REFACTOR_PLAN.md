# Backend-centric Refactor Plan

## Phase 1: Codebase Analysis

- **Frontend business logic identified**:
  - Sorting, filtering, and computing user statistics in `client/src/components/data-tables/UsersTable.tsx`.
  - Calculation of trial balance totals in `client/src/pages/financial-reports.tsx`.
  - Various data transformations during document upload and progress display.
- **Direct database connections**: None found in the client code; all data access occurs via REST API calls (`fetch('/api/...')`).
- **LLM integrations**: Only invoked on the backend in `server/services/aiServiceIntegration.ts` and `server/agents`.
- **Authentication**: Basic session/token handling occurs on the backend. Frontend simply forwards credentials.
- **Data flow pattern**: React components call `/api/*` endpoints exposed by Express. Backend handles file storage, classification, extraction, and DB persistence.

## Phase 2: Migration Tasks

1. **Move trial balance calculations to backend**
   - Create a backend endpoint `/api/reports/trial-balance/summary` that returns total debits, credits, and balance status.
   - Replace client-side `calculateTrialBalance` logic with a call to this endpoint.
2. **Users table filtering and sorting**
   - Implement query parameters on `/api/admin/users` for search, role/status filters, pagination, and sorting.
   - Move computation of user stats (active vs inactive counts) to backend response.
3. **Document processing and upload handling**
   - Ensure any intermediate data parsing or computation during upload is performed server-side in `fileProcessorService`.
4. **Remove leftover business logic from components**
   - Purge direct manipulations of financial numbers from React pages; rely on formatted values returned by the API.
5. **Centralize validation and security**
   - Verify that all validation currently done in forms is replicated on server routes using Zod schemas.

## Phase 3: Architecture Enforcement

- Frontend becomes a thin layer issuing API requests and rendering results.
- Backend modules (`server/services`, `server/routes`) provide all business functions, from LLM processing to financial computations and report generation.
- Use background workers (e.g., job queue) for heavy tasks like document classification/extraction.

## Phase 4: Testing and Verification

- Add integration tests covering document upload → classification → extraction → database storage → retrieval through API endpoints.
- Ensure frontend E2E tests verify that pages correctly display data returned from backend without performing extra calculations.


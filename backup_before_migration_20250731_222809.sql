Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "postgres", schemas "extensions, public" at "db.cvftwowputplnkskjbfx.supabase.co:5432"

- Introspecting based on datasource defined in prisma/schema.prisma
✔ Introspected 18 models and wrote them into prisma/schema.prisma in 2.08s
      
*** WARNING ***

These fields were enriched with `@map` information taken from the previous Prisma schema:
  - Model: "FaqReviewHistory", field: "faqId"
  - Model: "FaqReviewHistory", field: "reviewDate"
  - Model: "FaqReviewTriggers", field: "createdAt"
  - Model: "FaqReviewTriggers", field: "updatedAt"

These fields are not supported by Prisma Client, because Prisma currently does not support their types:
  - Model: "Knowledge", field: "embedding_vector", original data type: "vector"
  - Model: "FaqRaw", field: "embedding", original data type: "vector"
  - Model: "templates", field: "embedding", original data type: "vector"

These models were enriched with `@@map` information taken from the previous Prisma schema:
  - "FaqRaw"
  - "FaqReviewHistory"
  - "FaqReviewTriggers"
  - "FaqUsageStats"

These tables contain row level security, which is not yet fully supported. Read more: https://pris.ly/d/row-level-security
  - "selection_logs"
  - "templates"

Run prisma generate to generate Prisma Client.


# Contributing to Family Vault

Thank you for your interest in contributing to Family Vault! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce** the behavior
- **Expected vs actual behavior**
- **Screenshots** if applicable
- **Environment details** (OS, browser, Docker version, etc.)

### Suggesting Enhancements

Enhancement suggestions are welcome! Please provide:

- **Clear title and description**
- **Use case** - Why would this be useful?
- **Mockups or examples** if applicable

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the coding standards** outlined below
3. **Write tests** for new functionality
4. **Update documentation** if you're changing behavior
5. **Ensure tests pass** before submitting
6. **Write clear commit messages**

## Development Setup

### Prerequisites

- Docker and Docker Compose
- Node.js 22+
- Python 3.13+
- Git

### Getting Started

1. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/family-vault.git
   cd family-vault
   ```

2. Create a development environment:
   ```bash
   cp .env.example .env
   # Edit .env with your development settings
   ```

3. Start development services:
   ```bash
   docker-compose up -d postgres minio
   ```

4. Set up the backend:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   alembic upgrade head
   uvicorn app.main:app --reload
   ```

5. Set up the frontend (in a new terminal):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

6. Access the app at `http://localhost:3000`

## Project Structure

```
family-vault/
├── backend/              # Python FastAPI backend
│   ├── app/
│   │   ├── main.py       # FastAPI app entry point
│   │   ├── config.py     # Environment configuration
│   │   ├── database.py   # SQLAlchemy setup
│   │   ├── auth/         # Authentication module
│   │   ├── items/        # Items CRUD
│   │   ├── categories/   # Category definitions
│   │   ├── files/        # File upload/encryption
│   │   ├── reminders/    # Reminder system
│   │   └── ...           # Other modules
│   ├── alembic/          # Database migrations
│   └── requirements.txt  # Python dependencies
│
├── frontend/             # Next.js frontend
│   ├── src/
│   │   ├── app/          # Next.js App Router pages
│   │   ├── components/   # React components
│   │   │   ├── ui/       # shadcn/ui components
│   │   │   ├── layout/   # Layout components
│   │   │   └── items/    # Item-specific components
│   │   └── lib/          # Utilities and API client
│   └── package.json      # Node dependencies
│
├── docker-compose.yml    # Docker services
├── .env.example          # Environment template
└── README.md             # Main documentation
```

## Coding Standards

### Backend (Python)

- **Style**: Follow PEP 8
- **Type hints**: Use type hints for function signatures
- **Imports**: Organize imports (stdlib, third-party, local)
- **Docstrings**: Use docstrings for modules and complex functions

Example:
```python
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

def get_item(db: Session, item_id: str, org_id: str) -> Optional[Item]:
    """Fetch an item by ID if it belongs to the given org.

    Args:
        db: Database session
        item_id: UUID of the item
        org_id: UUID of the organization

    Returns:
        Item if found and belongs to org, None otherwise
    """
    return db.query(Item).filter(
        Item.id == item_id,
        Item.org_id == org_id
    ).first()
```

### Frontend (TypeScript/React)

- **Style**: Prettier + ES Lint configs
- **TypeScript**: Use strict mode, avoid `any`
- **Components**: Functional components with hooks
- **Naming**:
  - Components: PascalCase (`ItemCard.tsx`)
  - Utilities: camelCase (`formatDate.ts`)
  - Constants: UPPER_SNAKE_CASE

Example:
```typescript
interface ItemCardProps {
  item: Item;
  onClick: (id: string) => void;
}

export function ItemCard({ item, onClick }: ItemCardProps) {
  return (
    <Card onClick={() => onClick(item.id)}>
      <CardHeader>
        <CardTitle>{item.name}</CardTitle>
      </CardHeader>
    </Card>
  );
}
```

## Database Migrations

When changing the database schema:

1. Create a new migration:
   ```bash
   cd backend
   alembic revision -m "descriptive_name"
   ```

2. Edit the generated file in `backend/alembic/versions/`

3. Test the migration:
   ```bash
   alembic upgrade head  # Apply
   alembic downgrade -1  # Test rollback
   alembic upgrade head  # Reapply
   ```

4. Import new models in `backend/app/main.py` (in the lifespan function)

## Testing

### Backend Tests

```bash
cd backend
pytest
pytest tests/test_items.py  # Specific test file
pytest -v                    # Verbose output
```

### Frontend Tests

```bash
cd frontend
npm test
npm test -- --coverage  # With coverage report
```

## Adding a New Category

To add a new item category (e.g., "Medical Records"):

1. **Define the category** in `backend/app/categories/definitions.py`:
   ```python
   CATEGORIES["medical"] = {
       "key": "medical",
       "label": "Medical",
       "icon": "heartbeat",
       "description": "Medical records and health documents",
       "subcategories": {
           "prescription": {
               "key": "prescription",
               "label": "Prescription",
               "fields": [
                   {"key": "medication_name", "label": "Medication", "type": "text", "required": True},
                   {"key": "dosage", "label": "Dosage", "type": "text", "required": False},
                   # ... more fields
               ],
               "file_slots": ["prescription_image", "label_image"]
           }
       }
   }
   ```

2. **Add icon** in `frontend/src/components/items/SubcategoryIcon.tsx`:
   ```typescript
   // Add to SUBCATEGORY_ICONS:
   prescription: { icon: Pill, bgColor: "bg-green-100", iconColor: "text-green-600" },
   ```
   And add a category default to `CATEGORY_DEFAULTS` if it's a new top-level category.

3. **Create route** in `frontend/src/app/(app)/medical/`

4. **Add to sidebar** in `frontend/src/components/layout/Sidebar.tsx`

5. **Test thoroughly** with create/edit/delete operations

## Shared Utilities & Patterns

When contributing code, leverage existing shared utilities to avoid duplication:

### Backend

- **Org helpers**: Use `get_active_org_id(user, db)` from `app.orgs.service` instead of writing per-router helpers:
  ```python
  from app.orgs.service import get_active_org_id

  @router.get("/my-endpoint")
  def my_endpoint(user = Depends(get_current_user), db = Depends(get_db)):
      org_id = get_active_org_id(user, db)
  ```
  Use `get_active_org(user, db)` when you need the full org object (e.g., for encryption key access).

### Frontend

- **Formatting**: Import from `@/lib/format` instead of writing local helpers:
  ```typescript
  import { humanize, titleCase, formatDate, getFieldValue, repeatLabel } from "@/lib/format";
  ```

- **Icons**: Use `SubcategoryIcon` component instead of writing icon switch statements:
  ```tsx
  import { SubcategoryIcon } from "@/components/items/SubcategoryIcon";
  <SubcategoryIcon subcategory="auto_insurance" category="insurance" />
  ```

- **Reminders**: Use `ReminderCard` component with the appropriate variant:
  ```tsx
  import { ReminderCard } from "@/components/items/ReminderCard";
  <ReminderCard reminder={r} variant="compact" />   // RemindersPanel
  <ReminderCard reminder={r} variant="sidebar" />    // RightSidebar
  <ReminderCard reminder={r} />                      // Full page (default)
  ```

## Commit Message Guidelines

Use conventional commits format:

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(items): add passport selector for visa forms

fix(auth): resolve session token expiration issue

docs(readme): update deployment instructions
```

## Pull Request Process

1. **Update documentation** if you're changing functionality
2. **Add tests** for new features
3. **Ensure all tests pass**
4. **Update CHANGELOG.md** (if applicable)
5. **Request review** from maintainers
6. **Address feedback** promptly
7. **Squash commits** if requested before merging

### PR Title Format

Use conventional commits format:
```
feat(category): add vehicle selector to auto insurance
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe how you tested your changes

## Checklist
- [ ] Tests pass locally
- [ ] Code follows project style guidelines
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

## Community

- **Questions?** Open a [Discussion](https://github.com/yourusername/family-vault/discussions)
- **Bug reports** Use [Issues](https://github.com/yourusername/family-vault/issues)
- **Chat** Join our community chat (link TBD)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Family Vault! 🎉

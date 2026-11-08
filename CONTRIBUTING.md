# Contributing to RouteWise

Thank you for contributing to **RouteWise — AI-Powered Transport Fare & Route Optimization System**.

---

## Code of Conduct

1. Treat fellow contributors with respect.
2. Provide constructive, grounded feedback.
3. Keep code modular, strictly typed, and thoroughly tested.

---

## Development Workflow

1. **Fork and Clone**
   ```bash
   git clone https://github.com/<your-username>/routewise.git
   cd routewise
   ```

2. **Branching Strategy**
   - Create a feature branch from `main`:
     ```bash
     git checkout -b feature/your-feature-name
     ```

3. **Environment Setup**
   - Copy `.env.example` to `.env` and configure required keys.
   - Run `npm install` in the repository root.

4. **Testing Before Committing**
   - Run the automated test suite:
     ```bash
     npm test
     ```
   - Run the RAG evaluation benchmark:
     ```bash
     npm run test:rag
     ```
   - Verify frontend production build:
     ```bash
     npm run build
     ```

5. **Pull Request Guidelines**
   - Keep pull requests focused on a single responsibility.
   - Include test coverage for any new features or bug fixes.
   - Document any new environment variables in `.env.example`.
   - Ensure no credentials or API keys are committed.

```markdown
# maple-rental Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns, coding conventions, and workflows used in the `maple-rental` TypeScript codebase. The repository does not use a framework, favoring direct TypeScript for implementation. Testing is handled with Vitest, and code style is consistent across files for maintainability.

## Coding Conventions

### File Naming
- Use **PascalCase** for file names.
  - Example: `UserService.ts`, `RentalManager.ts`

### Import Style
- Use **relative imports** for modules within the project.
  - Example:
    ```typescript
    import { Rental } from './Rental';
    ```

### Export Style
- Both **named** and **default exports** are used, depending on context.
  - Named export:
    ```typescript
    export function calculateFee() { ... }
    ```
  - Default export:
    ```typescript
    export default class RentalManager { ... }
    ```

### Commit Patterns
- Commit messages are **freeform** (no enforced prefixes).
- Average commit message length: ~60 characters.

## Workflows

### Testing
**Trigger:** When you want to run the test suite.
**Command:** `/test`

1. Ensure you have dependencies installed (`npm install`).
2. Run the Vitest test suite:
   ```bash
   npx vitest
   ```
3. Review the output for test results.

### Adding a New Module
**Trigger:** When you need to add a new feature or module.
**Command:** `/add-module`

1. Create a new file using PascalCase (e.g., `NewFeature.ts`).
2. Use relative imports to include dependencies.
3. Export your module using either named or default export as appropriate.
4. Add corresponding tests in a file named `NewFeature.test.ts`.

### Writing Tests
**Trigger:** When you add or update functionality.
**Command:** `/write-test`

1. Create a test file with the pattern `*.test.ts` (e.g., `RentalManager.test.ts`).
2. Use Vitest's API for writing tests:
   ```typescript
   import { describe, it, expect } from 'vitest';
   import { calculateFee } from './calculateFee';

   describe('calculateFee', () => {
     it('calculates the correct fee', () => {
       expect(calculateFee(5)).toBe(50);
     });
   });
   ```
3. Run the test suite to ensure your tests pass.

## Testing Patterns

- All tests are placed in files matching `*.test.ts`.
- Vitest is used as the testing framework.
- Example test:
  ```typescript
  import { describe, it, expect } from 'vitest';
  import { Rental } from './Rental';

  describe('Rental', () => {
    it('should create a rental instance', () => {
      const rental = new Rental('Car', 3);
      expect(rental.type).toBe('Car');
      expect(rental.days).toBe(3);
    });
  });
  ```

## Commands
| Command      | Purpose                                |
|--------------|----------------------------------------|
| /test        | Run the Vitest test suite              |
| /add-module  | Add a new module following conventions |
| /write-test  | Create and run tests for new code      |
```
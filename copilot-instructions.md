# Copilot Instructions for this Repository

Purpose
-------
This file documents how an automated coding assistant (Copilot) should behave when contributing to this repository. Keep guidance concise and actionable.

Behavioral Guidelines
---------------------
- Be concise and direct. Prefer small, focused changes.
- Ask clarifying questions when intent is ambiguous.
- Do not add or modify unrelated files.
- Avoid making changes that can't be validated by the repository's tests or build steps.

Editing & Workflow
------------------
- Use the repository's standard tools and scripts for builds and tests.
- When editing files programmatically, prefer the repository's patch mechanism (human reviewers expect small diffs).
- If you (the assistant) make multiple edits, create a short plan and track progress in the project's TODO workflow.

Code Style & Practices
----------------------
- Follow existing code style and patterns visible in the repo.
- Keep functions small and focused; prefer descriptive names to one-letter variables.
- Add tests or update existing tests when changing behavior.

Commit Messages
---------------
- Use clear, conventional-style messages like `feat:`, `fix:`, `chore:` followed by a short description.

When Stuck
----------
- Ask for clarification rather than guessing large design decisions.
- If a change touches build, packaging, or release flows, request a human review.

Contact
-------
If you need repository-specific guidance, ping the maintainers or open a draft PR explaining the proposed approach.

---
This file was reinitialized to provide clear expectations for automated assistance in this project.

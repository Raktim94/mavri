# Contributing to NodeDR Invoice

Thank you for considering contributing to NodeDR Invoice! This document provides guidelines and information about contributing to this project.

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates.

When creating a bug report, include:

* A clear and descriptive title
* Steps to reproduce the issue
* Expected behavior vs actual behavior
* Your environment (OS, browser, app version)
* Any relevant screenshots or logs

### Suggesting Features

Feature requests are welcome. Please open an issue with:

* A clear description of the feature
* The motivation/use case
* Any implementation ideas

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Run linter (`npm run lint`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## Development Setup

```bash
git clone https://github.com/Raktim94/nodedr-invoice.git
cd nodedr-invoice
npm install
npm run dev
```

## Code Style

* Use TypeScript for all new code
* Follow the existing code style (ESLint + Prettier)
* Write meaningful commit messages
* Keep changes focused and minimal

## Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Keep the first line under 72 characters
* Reference issues and pull requests liberally

## License

By contributing, you agree that your contributions will be licensed under the
GNU Affero General Public License v3.0.

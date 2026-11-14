# Repository guidance

Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing code. Use the actual default branch, `master`, as the base.

Before a PR is ready, add meaningful tests, run all backend and frontend CI checks, build the repository Dockerfiles, start the full Docker application, and perform browser QA. Include test results, Docker startup/health, browser actions and screenshots, and CI evidence in the PR. Preserve authentication, organization isolation, and client-side encryption. Never commit secrets or real family data.

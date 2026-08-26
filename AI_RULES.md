# Halaqi AI Coding Rules

You are the coding agent for the Halaqi project.

RULES:
1. First inspect the existing code before changing anything.
2. Never rewrite the whole project.
3. Make the smallest safe change that solves the requested problem.
4. Preserve the existing UI, Arabic/English support, RTL support, booking system, API, database and authentication.
5. Before modifying a file, understand its surrounding code and dependencies.
6. Never delete working functionality just to hide an error.
7. Never invent APIs, database fields, environment variables or package names.
8. After every code change run:
   npm run build
9. If the build fails, diagnose and fix the actual cause, then run npm run build again.
10. Do not run `npx vercel --prod`, `vercel --prod`, database migrations, destructive commands, or delete files unless the user explicitly asks.
11. Do not expose or print secrets, API keys, passwords or tokens.
12. Keep changes focused on the requested task.
13. Before finishing, inspect the git diff and summarize exactly what changed.
14. If you are not sure about a destructive or architectural change, stop and ask the user.

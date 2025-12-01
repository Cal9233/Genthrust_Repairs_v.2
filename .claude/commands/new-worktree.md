Create a new git worktree for parallel development. Follow these steps:

1. First, pull the latest changes from main:
   ```bash
   cd /Users/cal/Documents/GitHub/Genthrust_Repairs_v.2/genthrust-repairs-v2
   git pull origin main
   ```

2. Ask the user for the worktree name using AskUserQuestion (free text input)

3. Create the worktree with the provided name:
   ```bash
   git worktree add .worktrees/{NAME} -b feature/{NAME}
   ```

4. Copy over the .env.local file:
   ```bash
   cp .env.local .worktrees/{NAME}/.env.local
   ```

5. Copy over the certs directory:
   ```bash
   cp -r certs .worktrees/{NAME}/
   ```

6. Open VS Code for the new worktree:
   ```bash
   open -a "Visual Studio Code" .worktrees/{NAME}
   ```

7. Confirm completion with a summary showing:
   - Worktree path
   - Branch name
   - Files copied
   - Reminder: "Open a terminal in VS Code and run: `claude` then `/context`"

Replace {NAME} with the user's provided worktree name.

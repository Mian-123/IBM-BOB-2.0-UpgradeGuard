---
name: upgrade-rehearsal
description: Investigate whether a single dependency version bump is safe, by applying the bump in an isolated git worktree, searching for affected call sites, running tests/build, and checking the changelog for breaking changes -- returning a SAFE / RISKY / DO NOT TOUCH verdict backed by evidence.
---

When asked to rehearse an upgrade for a dependency, follow these steps:

<Steps>
<Step>
Confirm an isolated git worktree already exists for this dependency at
.worktrees/dep-<NN>-<name>/ on branch upgrade/<name>. If not, create one
before continuing -- never edit dependency versions directly on the main
branch or in the main working directory.
</Step>

<Step>
Inside that worktree only: update the dependency to the target version in
package.json, then run npm install.
</Step>

<Step>
Search the codebase (within the worktree) for every call site that imports
or requires this dependency. Record file paths and a HIGH/MEDIUM/LOW tag
based on how central the usage is (middleware, error handling, and core
request/response handling are HIGH; a single isolated utility call is LOW).
</Step>

<Step>
Fetch the dependency's changelog, release notes, or migration guide (via
the npm registry API or its GitHub Releases page) and identify documented
breaking changes between the current and target version.
</Step>

<Step>
Run the full test suite, the build, and typecheck/lint if configured.
Record the before/after pass count and the specific tests that newly fail.
</Step>

<Step>
If tests failed, propose a migration patch for each affected call site
based on the breaking-change documentation. Apply it, then rerun the full
test suite, build, and typecheck to confirm the fix actually works --
never report a fix as successful without rerunning verification.
</Step>

<Step>
Return a verdict in exactly this format:

VERDICT: SAFE | RISKY | DO NOT TOUCH
Dependency: <name> <current> -> <target>
Usage locations: <count> (<file list with HIGH/MEDIUM/LOW tags>)
Breaking changes found: <list, or "none documented">
Tests: <before>/<total> passing before, <after>/<total> passing after
Fix applied: <yes/no, with diff summary if yes>
Reason: <one sentence citing the specific evidence above>
</Step>
</Steps>

Never report a verdict without the evidence lines above -- a bare
confidence percentage or an unverified "should be fine" is not acceptable
output for this skill.

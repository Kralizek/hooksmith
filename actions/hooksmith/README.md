# Hooksmith GitHub Action

The first-party GitHub Action is defined by the repository-level `action.yml`, so consumers can invoke it directly as `Kralizek/hooksmith@v0`.

```yaml
- uses: Kralizek/hooksmith@v0
  with:
    event: .hooksmith/event.yaml
```

The Action is intentionally a thin host over `@hooksmith/cli`. It installs Deno and runs the CLI version that matches the Action release. Event and configuration paths are resolved from the caller's workspace, preserving the same behavior as direct CLI usage.

Supported inputs are `event`, `config`, `format`, and `plan`.

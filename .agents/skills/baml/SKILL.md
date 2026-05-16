---
name: baml
description: Build, review, and maintain BAML prompt contracts, generated baml_client code, LLM client configuration, tests, and TypeScript/Python app integrations. Use when editing baml_src, BAML functions/classes/enums/tests, generator blocks, provider clients, streaming outputs, TypeBuilder usage, or generated client call sites.
compatibility: Requires the BAML CLI/runtime used by the project, typically installed from @boundaryml/baml, baml-py, or the language-specific BAML package.
allowed-tools: Bash(npm:*) Bash(npx:*) Bash(rg:*) Bash(sed:*) Bash(node:*) Read Edit
---

# Work With BAML

BAML keeps LLM prompt contracts in `baml_src/` and generates typed client code, usually named
`baml_client`, for the host application. Treat `.baml` files as the source of truth; generated
client files should be regenerated, not hand-edited.

## Start Here

1. Find the BAML source directory. It is normally `baml_src/`.
2. Read `generators.baml` before changing generated code. Confirm `output_type`, `output_dir`,
   `default_client_mode`, and `version` match the installed runtime package.
3. Read the host-language call sites that import `baml_client` before changing a function
   signature or return type.
4. Make schema and prompt changes in `.baml` files first, then run generation.
5. Re-run the smallest host-language typecheck or test that exercises the generated client.

## Project Setup

- Use the existing `baml_src/` directory if present. If there is no BAML project yet, initialize
  one with `baml-cli init` or create `baml_src/` with at least a generator, client, and function.
- Keep generated client code in the location configured by the generator `output_dir`.
- Keep the generator `version` aligned with the installed runtime package, such as
  `@boundaryml/baml` for TypeScript or `baml-py` for Python.
- Do not edit generated `baml_client` files unless explicitly debugging generated output. Fix the
  `.baml` source and regenerate instead.

## Common Commands

Use the local package when available:

```sh
npx baml-cli generate --from baml_src
npx baml-cli test --from baml_src
npx baml-cli test --from baml_src --include 'FunctionName::'
npx baml-cli fmt baml_src/*.baml
npx baml-cli serve --from baml_src --port 2024 --preview
npx baml-cli dev --from baml_src --port 2024 --preview
```

`baml-cli fmt` is beta and rewrites files in place. Use it only when formatting churn is
acceptable for the task.

## Editing Rules

- Keep BAML declarations narrow and explicit: `class`, `enum`, `type`, `client`, `function`,
  `test`, and `generator`.
- BAML functions must start with a capital letter and declare inputs, return type, `client`, and
  `prompt`.
- Include `{{ ctx.output_format }}` when the function should return structured data. If a local
  prompt intentionally omits it, verify that generated parsing still has enough instruction.
- Use block strings `#"` and `"#` for prompts and long test values. Use more `#` delimiters when the
  prompt itself must contain `"#`.
- BAML maps and test args use whitespace between keys and values, not JSON-style colons.
- Keep provider secrets as `env.NAME` in client options; never hard-code API keys.
- Preserve safety, refusal, and escalation rules in prompts when editing user-facing assistants.
- Add or update BAML `test` blocks for prompt contract changes when they can validate behavior
  without relying only on host-language tests.

## Generator Rules

Generator blocks control emitted client code:

```baml
generator target {
  output_type "typescript"
  output_dir "../"
  version "0.222.0"
  default_client_mode async
}
```

- Valid common output types include `typescript`, `typescript/react`, `python/pydantic`,
  `python/pydantic/v1`, `go`, `ruby/sorbet`, and `rest/openapi`.
- `output_dir` is relative to `baml_src/`.
- `version` should match the host runtime package, such as `@boundaryml/baml` for TypeScript.
- For Go generators, include `client_package_name` and an `on_generate` formatter command.

## Client Usage

Generated clients expose typed functions and types. Import from the generated output path used by
the project.

TypeScript:

```ts
import { b } from "./baml_client";
import type { Resume } from "./baml_client/types";

const resume: Resume = await b.ExtractResume(resumeText);
```

Python:

```python
from baml_client import b
from baml_client.types import Resume

resume: Resume = b.ExtractResume(resume_text)
```

## Load More When Needed

Read `references/baml-reference.md` when you need details on BAML syntax, clients, tests,
streaming, CLI options, TypeBuilder, or error handling. For current upstream documentation, start
from the BAML repository or official BAML docs and prefer those over stale generated examples.

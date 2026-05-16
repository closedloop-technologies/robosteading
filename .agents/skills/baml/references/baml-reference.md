# BAML Reference

## Source Layout

- `baml_src/` is the canonical source directory. BAML tooling discovers declarations across files
  in this directory, including nested files.
- `baml_client/` is generated code. It transforms BAML functions into typed host-language calls,
  handles LLM requests, parses and repairs model output, validates return types, and exposes
  generated types.
- `generators.baml` usually owns one or more `generator` blocks.
- `clients.baml` usually owns named LLM clients and provider settings.

## Core Syntax

Functions:

```baml
function ExtractResume(resume_text: string) -> Resume {
  client "openai-responses/gpt-5-mini"
  prompt #"
    Extract information from this resume.

    Resume:
    ---
    {{ resume_text }}
    ---

    {{ ctx.output_format }}
  "#
}
```

Classes and enums:

```baml
class Resume {
  name string
  skills string[]
  education Education[]
  seniority SeniorityLevel
}

enum SeniorityLevel {
  JUNIOR @description("0-2 years of experience")
  MID
  SENIOR
  STAFF
}
```

Common types:

- Primitives: `bool`, `int`, `float`, `string`, `null`
- Arrays: `Type[]`
- Maps: `map<string, int>`
- Literals: `"bug" | "enhancement"`, `true | false`, `1 | 2`
- Media: `image`, `audio`, `pdf`, `video`
- Optional: `Type?`
- Union: `TypeA | TypeB`

Rules and pitfalls:

- Function identifiers must start with a capital letter.
- Use `0.0` when a literal should be a `float`; `0` is an `int`.
- Inline strings use double quotes. Block strings use `#"` and `"#`.
- Unquoted strings cannot contain quotes, `@`, `{}`, `#`, parentheses, brackets, commas, or
  newlines.
- BAML maps and test args do not use colons between keys and values.
- Use `{{ _.role("user") }}` or related role helpers inside prompts when message role boundaries
  matter.

## Prompt Templates

BAML prompts use Jinja syntax:

```baml
prompt #"
  {% if include_context %}
    Context: {{ context }}
  {% endif %}

  {{ ctx.output_format }}
"#
```

Useful prompt variables:

- `ctx.output_format`: schema-specific output instructions for the function return type.
- `ctx.client`: selected client and model details.
- `_`: prompt helper object, including role helpers.

Reusable prompt snippets use `template_string`:

```baml
template_string PrintMessages(messages: Message[]) #"
  {% for m in messages %}
    {{ _.role(m.role) }}
    {{ m.message }}
  {% endfor %}
"#
```

## Clients

Short-form clients:

```baml
function MakeHaiku(topic: string) -> string {
  client "openai/gpt-5-mini"
  prompt #"Write a haiku about {{ topic }}."#
}
```

Named clients:

```baml
client<llm> MyClient {
  provider "openai"
  options {
    model "gpt-5-mini"
    api_key env.OPENAI_API_KEY
    temperature 0.0
    base_url "https://example.test/v1"
    headers {
      "x-custom-header" "value"
    }
  }
}
```

Provider and strategy notes:

- Use `env.NAME` for secrets and deploy-time values.
- OpenAI-compatible APIs can use `openai-generic`.
- Fallback, retry, and round-robin clients are represented as named clients with strategy
  providers/options.
- Environment variables are checked only when the selected function/client accesses them.

## Tests

Basic test:

```baml
test ClassifiesAccountIssue {
  functions [ClassifyMessage]
  args {
    input "I cannot access my account."
  }
  @@assert({{ this == "AccountIssue" }})
}
```

Complex args:

```baml
test ComplexMessage {
  functions [ProcessMessage]
  args {
    message {
      user "sam"
      content #"Hello
world"#
      metadata {
        priority "high"
      }
    }
  }
}
```

Test notes:

- `functions [FunctionName]` can list multiple functions only when they share the exact same
  parameters.
- `@@check(name, expression)` records a check; `@@assert(expression)` fails the test.
- Media args use `{ file "..." }`, `{ url "..." }`, or `{ base64 "..." media_type "..." }`.
  PDFs cannot be supplied by URL.
- Use `type_builder` in tests when validating dynamic type extensions.

## Streaming

Generated clients expose stream variants for streaming BAML functions.

TypeScript:

```ts
const stream = b.stream.ExtractReceiptInfo(receipt);

for await (const partial of stream) {
  console.log(partial.items?.length);
}

const final = await stream.getFinalResponse();
```

Python:

```python
stream = b.stream.ExtractReceiptInfo(receipt)

for partial in stream:
    print(len(partial.items or []))

final = stream.get_final_response()
```

Streaming attributes:

- `@stream.done`: only stream the type or field after it is complete.
- `@stream.not_null`: wait until the field is present before emitting the containing object.
- `@stream.with_state`: wrap field output with completion state metadata.

Return types are not changed by streaming attributes; generated partial types are changed.

## Dynamic Types And TypeBuilder

Use TypeBuilder when the host application needs to add dynamic fields or enum values at runtime.
Prefer static BAML classes and enums unless runtime extension is genuinely required.

Typical flow:

1. Mark BAML types dynamic where supported.
2. Build the runtime type extension with the generated TypeBuilder API in the host language.
3. Pass the builder through BAML call options.
4. Add tests that cover both the base schema and dynamic additions.

## Error Handling

Generated clients may raise language-specific errors for:

- BAML validation failures when model output cannot be coerced to the return type.
- Finish reason failures when the provider stops for an unacceptable reason.
- Abort/cancellation.
- Provider/network/rate-limit failures.

Handle expected provider failures around the generated call site. Keep prompt and schema failures
visible during development; do not silently downgrade malformed outputs unless the product behavior
explicitly calls for a fallback.

## CLI

Generate:

```sh
baml-cli generate --from baml_src
baml-cli generate --from baml_src --no-version-check
baml-cli generate --from baml_src --no-tests
```

Test:

```sh
baml-cli test --from baml_src
baml-cli test --from baml_src --list
baml-cli test --from baml_src --include 'FunctionName::TestName'
baml-cli test --from baml_src --exclude 'FunctionName::'
baml-cli test --from baml_src --parallel 4
```

Serve and dev:

```sh
baml-cli serve --from baml_src --port 2024 --preview
baml-cli dev --from baml_src --port 2024 --preview
```

HTTP server endpoints:

- `POST /call/:function_name`
- `POST /stream/:function_name`
- `GET /docs`
- `GET /openapi.json`
- `GET /_debug/ping`
- `GET /_debug/status`

Set `BAML_PASSWORD` to enable `x-baml-api-key` authentication for the server.

client<llm> Kimi {
  provider "openai-generic"
  options {
    base_url env.KIMI_BASE_URL
    api_key env.FIREWORKS_API_KEY
    model env.KIMI_MODEL
  }
}

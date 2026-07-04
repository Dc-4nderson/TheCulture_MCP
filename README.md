# The Culture MCP Server

MCP server for **The Culture** — a fashion-focused social media app. Exposes Supabase database operations and Hugging Face model inference as MCP tools for use in Claude Code, n8n agents, and the Larry orchestrator.

## Tools

### DB Tools (Supabase)
| Tool | Description |
|---|---|
| `get_user_context` | Profile + last 20 saves + last 20 likes with product_tags |
| `get_post_context` | Single post content, image_url, product_tags |
| `get_trending_posts` | Posts filtered by archetype, ordered by recency |
| `write_message` | Insert a DM into messages (used by Larry) |
| `update_product_tags` | Update a post's product_tags array |
| `get_community_context` | Community details, member count, recent posts |

### Model Tools (Hugging Face)
| Tool | Model | Task |
|---|---|---|
| `call_archetype_model` | `TheCulture-fashion-archetype-labeler` | Image → style archetype |
| `call_content_moderation` | `TheCulture-content-moderation-model` | Text → safe/unsafe + sub_category |
| `call_trend_forecaster` | `TheCulture-trend-forecasting-model` | Tabular → trend lifecycle stage |
| `call_ad_ctr_model` | `TheCulture-ad-ctr-model` | Tabular → click probability |
| `call_recommendation_engine` | `TheCulture-recommendation-engine` | User + posts → ranked affinity scores |

## Local setup (Claude Code / Claude Desktop)

```bash
npm install
npm run build
```

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "the-culture": {
      "command": "node",
      "args": ["/absolute/path/to/the-culture-mcp/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://vzqsgnyrrjxfzratmclo.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your_key",
        "HF_TOKEN": "your_token",
        "HF_USERNAME": "Dc-4nderson"
      }
    }
  }
}
```

## Notes
- Models not yet deployed to HF Inference Endpoints will return a 503 until deployed from their training notebooks.
- CTR model default threshold is 0.3 (not 0.5) due to the platform's ~2.5% base click rate.
- Recommendation engine requires user_id and post_ids that exist in the model's training data.

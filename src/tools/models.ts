import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callHFInference } from "../hf.js";

export function registerModelTools(server: McpServer) {

  server.tool(
    "call_archetype_model",
    "Classify the style archetype of a garment or outfit image using fashion-multitask-v1. Returns predicted archetype label(s) and confidence scores.",
    {
      image_url: z.string().url().describe("Publicly accessible URL of the garment or outfit image"),
    },
    async ({ image_url }) => {
      const result = await callHFInference("fashion-multitask-v1", { inputs: image_url });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "call_content_moderation",
    "Run the DistilBERT content moderation classifier on a text string. Returns label (safe/unsafe) and confidence score. If unsafe, also returns sub_category.",
    {
      text: z.string().min(1).describe("Post caption, comment, story text, or reel caption to moderate"),
    },
    async ({ text }) => {
      const result = await callHFInference(
        "the-culture-content-moderation-model",
        { inputs: text }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "call_trend_forecaster",
    "Predict the lifecycle stage of a fashion trend (emerging/growing/peak/stable/declining) using the XGBoost trend forecasting model.",
    {
      garment_type: z.string().describe("Type of garment e.g. jacket, boots, trousers, dress"),
      color: z.string().describe("Primary color of the item"),
      archetype_affinity: z.string().describe("Style archetype this trend is associated with"),
      season: z.string().describe("Season string e.g. Spring 2025, Fall 2025"),
      region: z.string().describe("Geographic region e.g. Northeast US, Southeast US, West Coast"),
      trend_velocity: z.enum(["slow", "moderate", "fast", "viral"]),
      price_tier: z.enum(["budget", "mid", "premium", "luxury"]),
      mention_count: z.number().int().min(0),
      save_count: z.number().int().min(0),
      search_volume_index: z.number().min(0).max(100),
      post_engagement_avg: z.number().min(0),
      week_over_week_growth_pct: z.number(),
      thrift_availability_score: z.number().min(0).max(1),
      influencer_adoption_score: z.number().min(0).max(1),
    },
    async (inputs) => {
      const result = await callHFInference(
        "the-culture-trend-forecasting-model",
        { inputs }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "call_ad_ctr_model",
    "Predict click probability for an ad impression using the XGBoost CTR model. Returns click_probability (0-1) and predicted_click boolean. Default threshold is 0.3 due to the platform's ~2.5% base click rate.",
    {
      ad_category: z.string(),
      ad_brand: z.string(),
      target_archetype: z.string(),
      target_age_range: z.string(),
      target_gender: z.string(),
      placement: z.string().describe("e.g. feed, explore, reel, profile"),
      user_archetype: z.string(),
      user_age_range: z.string(),
      user_gender: z.string(),
      day_of_week: z.string(),
      device_type: z.string(),
      archetype_match: z.boolean(),
      bid_amount_cents: z.number().int().min(0),
      user_session_number: z.number().int().min(1),
      time_of_day: z.string().describe("HH:MM format e.g. 14:30"),
      threshold: z.number().min(0).max(1).default(0.3),
    },
    async ({ threshold, ...inputs }) => {
      const result = await callHFInference(
        "the-culture-ad-ctr-model",
        { inputs, threshold }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "call_recommendation_engine",
    "Score a list of candidate posts for a given user using the two-tower neural collaborative filtering model. Returns posts ranked by predicted affinity score.",
    {
      user_id: z.string().describe("The user's ID as it appears in the recommendation model training data"),
      user_archetype: z.string(),
      candidate_posts: z.array(z.object({
        post_id: z.string(),
        post_archetype: z.string(),
      })).min(1).max(50),
    },
    async (inputs) => {
      const result = await callHFInference(
        "the-culture-recommendation-engine",
        { inputs }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}

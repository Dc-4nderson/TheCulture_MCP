import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerDbTools(server: McpServer) {

  server.tool(
    "get_user_context",
    "Fetch a user's profile (id, username, display_name, archetype) plus their last 20 saved posts and last 20 liked posts including product_tags. Use this before calling any model that needs user context.",
    {
      user_id: z.string().uuid().describe("User UUID from profiles.id"),
    },
    async ({ user_id }) => {
      const [
        { data: profile, error: pe },
        { data: saved, error: se },
        { data: liked, error: le },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, display_name, archetype")
          .eq("id", user_id)
          .maybeSingle(),
        supabase
          .from("saved_posts")
          .select("saved_at, collection_id, posts(id, content, image_url, product_tags)")
          .eq("user_id", user_id)
          .not("post_id", "is", null)
          .order("saved_at", { ascending: false })
          .limit(20),
        supabase
          .from("likes")
          .select("created_at, posts(id, content, image_url, product_tags)")
          .eq("user_id", user_id)
          .not("post_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (pe) throw new Error(`profiles: ${pe.message}`);
      if (se) throw new Error(`saved_posts: ${se.message}`);
      if (le) throw new Error(`likes: ${le.message}`);
      if (!profile) throw new Error(`user ${user_id} not found`);

      const savedPosts = (saved ?? []).filter(s => s.posts).map(s => ({
        saved_at: s.saved_at,
        collection_id: s.collection_id,
        post: s.posts,
      }));

      const likedPosts = (liked ?? []).filter(l => l.posts).map(l => ({
        liked_at: l.created_at,
        post: l.posts,
      }));

      const result = {
        user: profile,
        saved_posts: savedPosts,
        liked_posts: likedPosts,
        engagement_summary: {
          total_saves: savedPosts.length,
          total_likes: likedPosts.length,
          saved_product_tags: [
            ...new Set(savedPosts.flatMap(s => (s.post as any)?.product_tags ?? [])),
          ],
          liked_product_tags: [
            ...new Set(likedPosts.flatMap(l => (l.post as any)?.product_tags ?? [])),
          ],
        },
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_post_context",
    "Fetch a single post's content, image_url, and product_tags by post ID.",
    {
      post_id: z.string().uuid().describe("Post UUID from posts.id"),
    },
    async ({ post_id }) => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, user_id, content, image_url, product_tags, created_at")
        .eq("id", post_id)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) throw new Error(`post ${post_id} not found`);

      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_trending_posts",
    "Fetch posts from users whose profile archetype matches the given archetype, ordered by recency. Useful for surfacing trending content for a given style community.",
    {
      archetype: z.string().describe("Style archetype e.g. Streetwear, Gorpcore, Y2K, Minimalist, Vintage"),
      limit: z.number().int().min(1).max(50).default(20).describe("Max number of posts to return"),
    },
    async ({ archetype, limit }) => {
      const { data: profiles, error: pe } = await supabase
        .from("profiles")
        .select("id")
        .eq("archetype", archetype);

      if (pe) throw new Error(pe.message);

      const userIds = (profiles ?? []).map(p => p.id);
      if (userIds.length === 0) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ posts: [], archetype }) }] };
      }

      const { data: posts, error } = await supabase
        .from("posts")
        .select("id, user_id, content, image_url, product_tags, created_at")
        .in("user_id", userIds)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw new Error(error.message);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ archetype, total: posts?.length ?? 0, posts: posts ?? [] }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "write_message",
    "Insert a DM into the messages table. Used by Larry and the messaging agent to deliver outfit recommendations and AI-generated content to users.",
    {
      sender_id: z.string().uuid().describe("UUID of the sender (e.g. the Larry system user ID)"),
      recipient_id: z.string().uuid().describe("UUID of the recipient user"),
      content: z.string().min(1).describe("Message body — outfit recommendation, links, or other content"),
    },
    async ({ sender_id, recipient_id, content }) => {
      const { data, error } = await supabase
        .from("messages")
        .insert({ sender_id, recipient_id, content, read: false })
        .select("id, created_at")
        .single();

      if (error) throw new Error(error.message);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ success: true, message_id: data.id, created_at: data.created_at }),
        }],
      };
    }
  );

  server.tool(
    "update_product_tags",
    "Update a post's product_tags array. Called after outfit completion to tag identified garment items on the post.",
    {
      post_id: z.string().uuid().describe("Post UUID to update"),
      product_tags: z.array(z.string()).describe("Array of product tag strings to set"),
    },
    async ({ post_id, product_tags }) => {
      const { error } = await supabase
        .from("posts")
        .update({ product_tags, updated_at: new Date().toISOString() })
        .eq("id", post_id);

      if (error) throw new Error(error.message);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ success: true, post_id, product_tags }),
        }],
      };
    }
  );

  server.tool(
    "get_community_context",
    "Fetch a community's details, member count, and recent posts. Useful for challenge generation and community-aware recommendations.",
    {
      community_id: z.string().uuid().describe("Community UUID from communities.id"),
    },
    async ({ community_id }) => {
      const [
        { data: community, error: ce },
        { data: members, error: me },
        { data: posts, error: pope },
      ] = await Promise.all([
        supabase
          .from("communities")
          .select("id, name, description, archetype, created_at")
          .eq("id", community_id)
          .maybeSingle(),
        supabase
          .from("community_members")
          .select("user_id, role, joined_at")
          .eq("community_id", community_id),
        supabase
          .from("community_posts")
          .select("id, user_id, content, image_url, created_at")
          .eq("community_id", community_id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (ce) throw new Error(`communities: ${ce.message}`);
      if (me) throw new Error(`community_members: ${me.message}`);
      if (pope) throw new Error(`community_posts: ${pope.message}`);
      if (!community) throw new Error(`community ${community_id} not found`);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            community,
            member_count: members?.length ?? 0,
            recent_posts: posts ?? [],
          }, null, 2),
        }],
      };
    }
  );
}

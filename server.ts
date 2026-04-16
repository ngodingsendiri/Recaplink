import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  
  // Endpoint to fetch comments from Meta Graph API
  // Endpoint to fetch recent posts and their comments automatically
  app.post("/api/meta/fetch-recent", async (req, res) => {
    try {
      const { date, token: clientToken } = req.body;
      const token = clientToken || process.env.META_API_TOKEN;
      
      if (!token) {
        return res.status(401).json({ error: "Token Meta API tidak ditemukan." });
      }

      // Memeriksa apakah postingan berada dalam rentang 15:00 WIB (H-1) hingga 15:00 WIB (Hari H)
      const isWithinCustomWindow = (utcDateStr: string, targetDateStr: string) => {
        const postTime = new Date(utcDateStr).getTime();
        // targetDateStr adalah "YYYY-MM-DD"
        // 15:00 WIB sama dengan 08:00 UTC
        const endDate = new Date(`${targetDateStr}T08:00:00Z`);
        const endTime = endDate.getTime();
        // Start time adalah 24 jam sebelum end time (H-1 jam 15:00 WIB)
        const startTime = endTime - (24 * 60 * 60 * 1000);
        return postTime >= startTime && postTime <= endTime;
      };

      let fbPosts: any[] = [];
      let igPosts: any[] = [];
      let pageToken = token;
      let pageId = "me";

      // Try to get pages if it's a user token
      try {
        const accountsRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${token}`);
        const accountsData = await accountsRes.json();
        if (accountsData.data && accountsData.data.length > 0) {
          // Use the first page
          pageId = accountsData.data[0].id;
          pageToken = accountsData.data[0].access_token;
        } else {
          // Fallback: Check debug_token for granular scopes (New Pages Experience)
          const debugRes = await fetch(`https://graph.facebook.com/v19.0/debug_token?input_token=${token}&access_token=${token}`);
          const debugData = await debugRes.json();
          if (debugData.data && debugData.data.granular_scopes) {
            const scope = debugData.data.granular_scopes.find((s: any) => s.scope === 'pages_show_list' || s.scope === 'pages_read_engagement' || s.scope === 'pages_manage_posts');
            if (scope && scope.target_ids && scope.target_ids.length > 0) {
              pageId = scope.target_ids[0];
              // Fetch the actual Page Access Token
              const pageRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=access_token&access_token=${token}`);
              const pageData = await pageRes.json();
              if (pageData.access_token) {
                pageToken = pageData.access_token;
              }
            }
          }
        }
      } catch (e) {
        console.log("Not a user token or failed to fetch accounts, continuing with original token.");
      }

      // 1. Fetch FB Posts
      const fbPostsRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/posts?fields=id,created_time,permalink_url&access_token=${pageToken}&limit=50`);
      const fbPostsData = await fbPostsRes.json();
      
      let latestFbPostDate = null;
      if (!fbPostsData.error && fbPostsData.data) {
        if (fbPostsData.data.length > 0) {
          latestFbPostDate = fbPostsData.data[0].created_time;
        }
        fbPosts = fbPostsData.data.filter((p: any) => isWithinCustomWindow(p.created_time, date));
      } else {
        console.error("FB Posts Error:", fbPostsData.error);
      }

      // 2. Fetch IG Account ID
      const igAccRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${pageToken}`);
      const igAccData = await igAccRes.json();
      const igAccountId = igAccData.instagram_business_account?.id;

      if (igAccountId) {
        // 3. Fetch IG Posts
        const igPostsRes = await fetch(`https://graph.facebook.com/v19.0/${igAccountId}/media?fields=id,timestamp,permalink&access_token=${pageToken}&limit=50`);
        const igPostsData = await igPostsRes.json();
        if (!igPostsData.error && igPostsData.data) {
          igPosts = igPostsData.data.filter((p: any) => isWithinCustomWindow(p.timestamp, date));
        } else {
          console.error("IG Posts Error:", igPostsData.error);
        }
      }

      if (fbPostsData.error && !igAccountId) {
        return res.status(400).json({ error: fbPostsData.error?.message || "Gagal mengakses data Page/Instagram." });
      }

      const allCommenters: any[] = [];
      const fbLinks = fbPosts.map((p: any) => p.permalink_url).filter(Boolean);
      const igLinks = igPosts.map((p: any) => p.permalink).filter(Boolean);

      // Fetch IG comments (FB comments are skipped due to API privacy limitations)
      for (const post of igPosts) {
        const commentsRes = await fetch(`https://graph.facebook.com/v19.0/${post.id}/comments?fields=id,text,username,timestamp&access_token=${pageToken}&limit=100`);
        const commentsData = await commentsRes.json();
        (commentsData.data || []).forEach((c: any) => {
          allCommenters.push({ platform: 'ig', username: c.username || "Unknown", text: c.text });
        });
      }

      res.json({ 
        success: true, 
        commenters: allCommenters, 
        fbLinks, 
        igLinks, 
        fbPostCount: fbPosts.length, 
        igPostCount: igPosts.length,
        debug: {
          igLinked: !!igAccountId,
          latestFbPostDate
        }
      });
    } catch (error: any) {
      console.error("Failed to fetch recent Meta data:", error);
      res.status(500).json({ error: "Gagal mengambil data postingan dari Meta API." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

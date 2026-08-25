import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/lib/encryption";

// GET /api/user/workspace - Fetch logged-in user's workspace, code snippets, preferences, and AI settings
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    const db = getDb();

    // 1. Snippets per language
    const snippets = db.prepare(`
      SELECT languageId, code, stdin, updatedAt
      FROM user_snippets
      WHERE userId = ?
    `).all(currentUser.id) as Array<{
      languageId: number;
      code: string;
      stdin: string;
      updatedAt: number;
    }>;

    // 2. Workspace Layout & Editor Preferences
    const preferences = db.prepare(`
      SELECT selectedLanguageId, theme, mode, editorSplitPercent, panel1Percent, panel2Percent, isAiPanelOpen
      FROM user_preferences
      WHERE userId = ?
    `).get(currentUser.id) as {
      selectedLanguageId: number;
      theme: string;
      mode: string;
      editorSplitPercent: number;
      panel1Percent: number;
      panel2Percent: number;
      isAiPanelOpen: number;
    } | undefined;

    // 3. AI Settings & Credentials
    const aiRow = db.prepare(`
      SELECT provider, customBaseUrl, modelsJson, encryptedKeysJson, chatHistoryJson
      FROM user_ai_settings
      WHERE userId = ?
    `).get(currentUser.id) as {
      provider: string;
      customBaseUrl: string;
      modelsJson: string;
      encryptedKeysJson: string;
      chatHistoryJson: string;
    } | undefined;

    // Decrypt API keys for user's secure session
    const decryptedKeys: Record<string, string> = {};
    if (aiRow?.encryptedKeysJson) {
      try {
        const rawMap = JSON.parse(aiRow.encryptedKeysJson);
        for (const [prov, enc] of Object.entries(rawMap)) {
          if (typeof enc === "string" && enc) {
            decryptedKeys[prov] = decryptSecret(enc);
          }
        }
      } catch {}
    }

    let parsedModels: Record<string, string> = {};
    if (aiRow?.modelsJson) {
      try {
        parsedModels = JSON.parse(aiRow.modelsJson);
      } catch {}
    }

    let parsedChatHistory: any[] = [];
    if (aiRow?.chatHistoryJson) {
      try {
        parsedChatHistory = JSON.parse(aiRow.chatHistoryJson);
      } catch {}
    }

    return NextResponse.json({
      authenticated: true,
      user: currentUser,
      snippets: snippets || [],
      preferences: preferences
        ? {
            ...preferences,
            isAiPanelOpen: Boolean(preferences.isAiPanelOpen),
          }
        : null,
      aiSettings: aiRow
        ? {
            provider: aiRow.provider,
            customBaseUrl: aiRow.customBaseUrl,
            models: parsedModels,
            apiKeys: decryptedKeys,
            chatHistory: parsedChatHistory,
          }
        : null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load workspace" }, { status: 500 });
  }
}

// POST /api/user/workspace - Save/Sync snippets, preferences, or AI settings to SQLite DB
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { snippet, preferences, aiSettings } = body;
    const db = getDb();
    const now = Date.now();

    // 1. Sync Code Snippet
    if (snippet && typeof snippet.languageId === "number") {
      db.prepare(`
        INSERT INTO user_snippets (userId, languageId, code, stdin, updatedAt)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(userId, languageId) DO UPDATE SET
          code = excluded.code,
          stdin = excluded.stdin,
          updatedAt = excluded.updatedAt
      `).run(
        currentUser.id,
        snippet.languageId,
        snippet.code || "",
        snippet.stdin || "",
        now
      );
    }

    // 2. Sync Preferences
    if (preferences) {
      const existing = db.prepare("SELECT userId FROM user_preferences WHERE userId = ?").get(currentUser.id);
      if (existing) {
        db.prepare(`
          UPDATE user_preferences SET
            selectedLanguageId = COALESCE(?, selectedLanguageId),
            theme = COALESCE(?, theme),
            mode = COALESCE(?, mode),
            editorSplitPercent = COALESCE(?, editorSplitPercent),
            panel1Percent = COALESCE(?, panel1Percent),
            panel2Percent = COALESCE(?, panel2Percent),
            isAiPanelOpen = COALESCE(?, isAiPanelOpen),
            updatedAt = ?
          WHERE userId = ?
        `).run(
          preferences.selectedLanguageId ?? null,
          preferences.theme ?? null,
          preferences.mode ?? null,
          preferences.editorSplitPercent ?? null,
          preferences.panel1Percent ?? null,
          preferences.panel2Percent ?? null,
          typeof preferences.isAiPanelOpen === "boolean" ? (preferences.isAiPanelOpen ? 1 : 0) : null,
          now,
          currentUser.id
        );
      } else {
        db.prepare(`
          INSERT INTO user_preferences (
            userId, selectedLanguageId, theme, mode, editorSplitPercent, panel1Percent, panel2Percent, isAiPanelOpen, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          currentUser.id,
          preferences.selectedLanguageId ?? 71,
          preferences.theme ?? "vs-dark",
          preferences.mode ?? "interactive",
          preferences.editorSplitPercent ?? 50,
          preferences.panel1Percent ?? 36,
          preferences.panel2Percent ?? 32,
          preferences.isAiPanelOpen ? 1 : 0,
          now
        );
      }
    }

    // 3. Sync AI Settings & Encrypted Credentials
    if (aiSettings) {
      const existingAi = db.prepare("SELECT * FROM user_ai_settings WHERE userId = ?").get(currentUser.id) as {
        encryptedKeysJson?: string;
        modelsJson?: string;
        chatHistoryJson?: string;
      } | undefined;

      // Merge API Keys with AES-256 encryption
      let encryptedKeysMap: Record<string, string> = {};
      if (existingAi?.encryptedKeysJson) {
        try {
          encryptedKeysMap = JSON.parse(existingAi.encryptedKeysJson);
        } catch {}
      }

      if (aiSettings.apiKeys && typeof aiSettings.apiKeys === "object") {
        for (const [prov, rawKey] of Object.entries(aiSettings.apiKeys)) {
          if (typeof rawKey === "string") {
            if (rawKey.trim()) {
              encryptedKeysMap[prov] = encryptSecret(rawKey.trim());
            } else {
              delete encryptedKeysMap[prov];
            }
          }
        }
      }

      // Merge Models
      let modelsMap: Record<string, string> = {};
      if (existingAi?.modelsJson) {
        try {
          modelsMap = JSON.parse(existingAi.modelsJson);
        } catch {}
      }
      if (aiSettings.models && typeof aiSettings.models === "object") {
        modelsMap = { ...modelsMap, ...aiSettings.models };
      }

      const modelsJson = JSON.stringify(modelsMap);
      const encryptedKeysJson = JSON.stringify(encryptedKeysMap);
      const chatHistoryJson = aiSettings.chatHistory ? JSON.stringify(aiSettings.chatHistory) : existingAi?.chatHistoryJson || "[]";

      if (existingAi) {
        db.prepare(`
          UPDATE user_ai_settings SET
            provider = COALESCE(?, provider),
            customBaseUrl = COALESCE(?, customBaseUrl),
            modelsJson = ?,
            encryptedKeysJson = ?,
            chatHistoryJson = ?,
            updatedAt = ?
          WHERE userId = ?
        `).run(
          aiSettings.provider ?? null,
          aiSettings.customBaseUrl ?? null,
          modelsJson,
          encryptedKeysJson,
          chatHistoryJson,
          now,
          currentUser.id
        );
      } else {
        db.prepare(`
          INSERT INTO user_ai_settings (
            userId, provider, customBaseUrl, modelsJson, encryptedKeysJson, chatHistoryJson, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          currentUser.id,
          aiSettings.provider || "gemini",
          aiSettings.customBaseUrl || "",
          modelsJson,
          encryptedKeysJson,
          chatHistoryJson,
          now
        );
      }
    }

    return NextResponse.json({ success: true, message: "Workspace synced successfully." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to sync workspace" }, { status: 500 });
  }
}

# Telegram Bot Setup

Telegram is now wired as an adapter around the existing Bee2Bee negotiation flow.
It does not replace `run_negotiation_agent()`, Socket.IO, or the dashboard test reply box.

## Environment Variables

Set these in `backend/.env`:

```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_API_BASE_URL=https://api.telegram.org
```

## 1. Create A Bot

1. Open Telegram and chat with `@BotFather`.
2. Run `/newbot`.
3. Choose a bot name and username.
4. Copy the bot token.
5. Put the token into `TELEGRAM_BOT_TOKEN` in `backend/.env`.

## 2. Start A Chat With The Bot

1. Open your new bot in Telegram.
2. Press `Start`.
3. Send a short test message so Telegram creates the chat session.

## 3. Get The Telegram Chat ID

You can get the `chat_id` by temporarily inspecting webhook payloads or by calling the Telegram `getUpdates` endpoint while the webhook is not set.

Example:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates
```

Look for:

```json
{
  "message": {
    "chat": {
      "id": 123456789
    }
  }
}
```

Use that `id` value as the supplier's `telegram_chat_id`.

## 4. Add The Chat ID To A Supplier

Run the DB migration, then update the supplier row:

```sql
UPDATE suppliers
SET telegram_chat_id = '123456789'
WHERE id = 'sup-my-001';
```

## 5. Run The DB Migration

Apply the new migration that adds `suppliers.telegram_chat_id`:

```powershell
cd backend
npm run db:init
```

Migration added:

- `backend/supabase/migrations/20260613_supplier_telegram_chat_id.sql`

## 6. Start The Backend

From the repo root:

```powershell
npm run backend:dev
```

Or from `backend/`:

```powershell
npm run dev
```

## 7. Start ngrok

Expose the backend so Telegram can reach the webhook:

```powershell
ngrok http 8000
```

Copy the HTTPS forwarding URL from ngrok.

## 8. Register The Webhook

Register the webhook with Telegram:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://your-ngrok-url/api/v1/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

Recommended:

- keep `TELEGRAM_WEBHOOK_SECRET` long and random
- use the same secret in both Telegram webhook registration and `backend/.env`

## 9. How To Test

1. Start a negotiation in Bee2Bee.
2. Open the conversation workspace.
3. Let the backend call `POST /api/v1/negotiation/start`.
4. Confirm the AI supplier-facing message appears in Telegram.
5. Reply to the bot from Telegram.
6. Confirm the dashboard updates in real time through Socket.IO.
7. Confirm the AI continues negotiation and sends the next reply back to Telegram.
8. Send a PDF document to the bot.
9. Confirm the dashboard receives the PDF message and the existing invoice/negotiation path stays stable.

## 10. PDF Handling Notes

- Only Telegram `application/pdf` documents are supported right now.
- The file is downloaded into the existing backend `uploads/` folder.
- The webhook then reuses the existing supplier reply/file flow.
- The AI or invoice logic decides what to do with the PDF metadata next.
- Current implementation logs a TODO for any deeper invoice pipeline hookup beyond the existing negotiation path.

## Manual Steps Needed

- Create the Telegram bot with BotFather.
- Put the bot token into `backend/.env`.
- Set `TELEGRAM_ENABLED=true`.
- Set `TELEGRAM_WEBHOOK_SECRET`.
- Run the DB migration.
- Add `telegram_chat_id` to the target supplier row.
- Start the backend.
- Start ngrok.
- Register the Telegram webhook.
- Keep both the backend and ngrok running during local testing.

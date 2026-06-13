# WhatsApp Cloud API Manual Setup

1. Create a Meta Developer App and add the WhatsApp product.
2. Generate a temporary or permanent access token.
3. Copy the WhatsApp Phone Number ID from the Meta dashboard.
4. Set these environment variables in `backend/.env` or `backend/.env.local`:
   - `WHATSAPP_ENABLED=true`
   - `WHATSAPP_ACCESS_TOKEN=...`
   - `WHATSAPP_PHONE_NUMBER_ID=...`
   - `WHATSAPP_VERIFY_TOKEN=...`
   - `WHATSAPP_GRAPH_API_VERSION=v20.0`
5. Expose your local FastAPI server over HTTPS using ngrok or Cloudflare Tunnel.
6. In Meta Webhooks, set the callback URL to:
   - `https://<your-public-url>/api/v1/whatsapp/webhook`
7. Use the same verify token value from `WHATSAPP_VERIFY_TOKEN`.
8. Subscribe the app to the `messages` webhook field.
9. Add each supplier WhatsApp number in the `suppliers.whatsapp_number` field.

Notes:
- Store supplier numbers in international format, for example `60123456789`.
- Incoming WhatsApp messages are matched to suppliers by normalized phone number.
- If a supplier has multiple active conversations, the newest active conversation is used for now.

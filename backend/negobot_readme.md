

*

### 🧹 Phase 0: The Reset (Do this in your Database Client)
You still need to run this quick SQL script in DBeaver/TablePlus to wipe the slate clean before you start the sequence.

delete everything in messages table

```sql
DELETE FROM public.invoices WHERE file_url = 'invoice.pdf';
DELETE FROM public.submitted_orders WHERE restock_request_id = 'rr-7e0bb43161d6';
UPDATE public.conversations SET state = 'new_input', latest_message = NULL WHERE id = 'conv-1004';
```

---

### 🚀 Phase 1: The Kickoff (Use the `/start` Endpoint)
1. Open `http://localhost:8000/docs` in your browser.
2. Click on the **`POST /api/v1/negotiation/start`** endpoint to expand it.
3. Click the **"Try it out"** button.
4. In the Request body, paste this:
   ```json
   {
     "conversation_id": "conv-1004",
     "restock_request_id": "rr-7e0bb43161d6"
   }
   ```
5. Click **Execute**. You should see the bot draft its opening offer in the response!

---

### 🛑 Phase 2: The Haggle (Use the `/webhook` Endpoint)
1. Scroll down to the **`POST /api/v1/negotiation/webhook`** endpoint.
2. Click **"Try it out"**.
3. In the Request body, paste the supplier pushing back:
   ```json
   {
     "conversation_id": "conv-1004",
     "supplier_message": "Shipping costs are high right now. I can only do $12.00 per unit for the 100 units."
   }
   ```
4. Click **Execute**. Watch the bot reject $12.00 and counter-offer.

---

### 🤝 Phase 3: The Close (Still in `/webhook`)
1. Stay right there on the `/webhook` endpoint.
2. Change the Request body to the supplier agreeing:
   ```json
   {
     "conversation_id": "conv-1004",
     "supplier_message": "Alright, you drive a hard bargain. We can meet in the middle at $9.00 per unit."
   }
   ```
3. Click **Execute**. The bot will recognize the win and trigger the `create_final_order` tool.

---

### 📄 Phase 4: The Invoice Drop (Still in `/webhook`)
1. Change the Request body one last time to drop the file:
   ```json
   {
     "conversation_id": "conv-1004",
     "supplier_message": "Pleasure doing business. Here is the invoice: https://dummy-storage.com/invoice.pdf"
   }
   ```
2. Click **Execute**. Because you added the "Memory Fix," the bot will check its database context, see the `accepted` state, see the `existing_order_id`, and perfectly execute the `record_invoice` tool!

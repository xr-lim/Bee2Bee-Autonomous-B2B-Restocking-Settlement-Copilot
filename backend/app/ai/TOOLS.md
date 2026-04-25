# LangChain Tools

This file documents the backend AI tools exposed from `backend/app/ai/tools.py`, what each one is for, and a simple way to test it.

## Setup For Testing

The tools load `backend/.env.local` and `backend/.env` automatically, so the main requirement is that the database URL is available as `DATABASE_URL` or `SUPABASE_DB_URL`.

Run tests from the `backend` folder:

```powershell
python -c "from app.ai.tools import get_product_stock_and_target_price; print(get_product_stock_and_target_price.invoke({'sku': 'SKU-ALM-8842'}))"
```

If that succeeds, the module can connect to the database and execute tool calls.

## Tool List

| Tool | Purpose | Simple Test |
| --- | --- | --- |
| `get_product_stock_and_target_price` | Returns the current product stock, threshold values, and target price band for one SKU. | `python -c "from app.ai.tools import get_product_stock_and_target_price; print(get_product_stock_and_target_price.invoke({'sku': 'SKU-ALM-8842'}))"` |
| `request_reorder_threshold_update` | Creates a threshold review request for a product when the AI or user wants a new reorder threshold approved. | `python -c "from app.ai.tools import request_reorder_threshold_update; print(request_reorder_threshold_update.invoke({'sku': 'SKU-ALM-8842','proposed_threshold': 500,'reason_type': 'demand_spike','reason_summary': 'Recent demand is rising faster than inventory replenishment.'}))"` |
| `get_supplier_info` | Fetches supplier details and the products linked to that supplier. | `python -c "from app.ai.tools import get_supplier_info; print(get_supplier_info.invoke({'product_sku': 'SKU-ALM-8842'}))"` |
| `get_product_stock_demand_trend` | Returns month-by-month stock and demand trend information for a SKU. | `python -c "from app.ai.tools import get_product_stock_demand_trend; print(get_product_stock_demand_trend.invoke({'sku': 'SKU-ALM-8842'}))"` |
| `get_last_supplier_conversation_messages` | Returns the latest messages in a supplier conversation thread. | `python -c "from app.ai.tools import get_last_supplier_conversation_messages; print(get_last_supplier_conversation_messages.invoke({'supplier_id': 'REPLACE_WITH_SUPPLIER_ID'}))"` |
| `get_receipt_info` | Returns a compact receipt or invoice summary, including workflow and validation context. | `python -c "from app.ai.tools import get_receipt_info; print(get_receipt_info.invoke({'invoice_number': 'REPLACE_WITH_INVOICE_NUMBER'}))"` |
| `record_invoice_validation_result` | Stores a validation result for an invoice and updates the invoice validation status. | `python -c "from app.ai.tools import record_invoice_validation_result; print(record_invoice_validation_result.invoke({'invoice_number': 'REPLACE_WITH_INVOICE_NUMBER','check_name': 'bank_details_match_supplier','result': 'passed'}))"` |
| `get_product_operational_context` | Returns the minimal decision context for a product before changing workflows, thresholds, or invoice state. | `python -c "from app.ai.tools import get_product_operational_context; print(get_product_operational_context.invoke({'sku': 'SKU-ALM-8842'}))"` |
| `list_threshold_change_requests_for_sku` | Lists threshold review requests for a SKU, optionally filtered by status. | `python -c "from app.ai.tools import list_threshold_change_requests_for_sku; print(list_threshold_change_requests_for_sku.invoke({'sku': 'SKU-ALM-8842'}))"` |
| `record_invoice_action` | Writes an audit trail entry for an invoice action such as parsed, validated, or flagged. | `python -c "from app.ai.tools import record_invoice_action; print(record_invoice_action.invoke({'invoice_number': 'REPLACE_WITH_INVOICE_NUMBER','action_type': 'validated','note': 'Invoice passed core checks and is ready for review.','actor_type': 'ai'}))"` |
| `get_restock_context` | Fetches context for a restock request including target prices and product details. | `python -c "from app.ai.tools import get_restock_context; print(get_restock_context.invoke({'request_id': 'REPLACE_WITH_REQUEST_ID'}))"` |
| `update_conversation_state` | Updates the state and latest message of a conversation during negotiation. | `python -c "from app.ai.tools import update_conversation_state; print(update_conversation_state.invoke({'conversation_id': 'REPLACE_WITH_CONVERSATION_ID','new_state': 'accepted','message': 'Order confirmed at final price.'}))"` |
| `create_final_order` | Creates a final confirmed order after successful negotiation with a supplier. | `python -c "from app.ai.tools import create_final_order; print(create_final_order.invoke({'restock_request_id': 'REPLACE_WITH_REQUEST_ID','supplier_id': 'REPLACE_WITH_SUPPLIER_ID','final_price': 15.50,'final_qty': 100}))"` |
| `record_invoice` | Records a new invoice from an uploaded file, linking it to an order for validation. | `python -c "from app.ai.tools import record_invoice; print(record_invoice.invoke({'order_id': 'REPLACE_WITH_ORDER_ID','amount': 1550.00,'invoice_number': 'INV-2024-001','file_url': 'https://example.com/invoice.pdf'}))"` |

## Recommended Smoke Test Order

1. Test `get_product_stock_and_target_price` first to confirm database access.
2. Test `get_product_stock_demand_trend` next to confirm the trend table is available.
3. Test `get_supplier_info` and `get_receipt_info` to confirm relational joins work.
4. Test the write tools last: `request_reorder_threshold_update`, `record_invoice_validation_result`, and `record_invoice_action`.
5. Test the new negotiation tools: `get_restock_context`, `update_conversation_state`, `create_final_order`, and `record_invoice`.

## Notes

- Use real IDs or invoice numbers from the database for the invoice and conversation tools.
- The tool outputs are intentionally compact and return only the fields needed for decisions.
- If a test fails with a database error, confirm `backend/.env` contains the correct Supabase connection string and rerun the command from the `backend` directory.
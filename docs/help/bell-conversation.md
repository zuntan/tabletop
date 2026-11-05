# Bell and short desk-side exchanges (experimental helper)

The bell and simple messages are optional extras. They do not replace ordinary chat or imply continuous monitoring.

## Uses

- Ask the human to select a card and wait for that action to finish.
- Send a short request or reply from the device operating the desk, such as a tablet, without returning to a PC keyboard.
- Keep complex discussions, long explanations and essential information in ordinary chat.

Specify the target `deskId` in each call. Bells, messages and wait cursors are independent per desk. AI decides whether to wait on multiple desks; there is no aggregate wait tool.

## Example bounded wait

1. Tell the human: “Select the target cards and press the bell when ready. I will wait for30 seconds.”
2. If needed, first call `desk_bell_wait` with `timeoutMs:0` to inspect existing notifications and the current epoch/sequence. Use that cursor for the new wait.
3. Call `desk_bell_wait` once with, for example, `timeoutMs:30000`, within the announced deadline and below the host tool's timeout.
4. On `status:bell`, inspect ids and text captured at the press. Do not silently substitute the current selection.
5. Reply briefly with `desk_message`, such as “Received,” then inspect and work within the human request. Receiving a notification does not mean the work is complete.
6. On timeout, stop waiting and tell the human in chat if appropriate. Do not restart without agreement, create unlimited loops or leave a resident subagent.

AI may propose this bounded interaction within the human's agreement. There is no need to insert a wait into every task just because it seems convenient.

## Limits and indicators

- The bell does not wake an AI outside an active wait. Notifications are retrieved when the corresponding tool is called.
- A press outside a wait is retained as the latest single notification. This is not guaranteed delivery, response or chat history.
- Text entered through the optional message control is optional. Retrieval clears only the draft that has not been changed since the press.
- The yellow LED clears on the next non-bell-wait communication addressed to that desk. Shared tools such as the connection list or Help, and communication with another desk, do not clear it. It does not guarantee receipt, understanding or completion.
- `desk_message` is a simple display with info, success, warning, question or hint icons. Only one is shown; a later message replaces it. Default duration is8 seconds; `durationMs:0` remains until dismissed. Also keep important information in chat.
- This manual grants no additional permission. Ask about unclear wording as usual.

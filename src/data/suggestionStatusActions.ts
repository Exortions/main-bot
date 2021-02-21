import { SuggestionStatus } from "../entities/Suggestion"

export default {
    "approved": "Approved",
    "denied": "Denied",
    "duplicate": "Marked as duplicate",
    "forwarded": "Forwarded to the respective team",
    "in-progress": "Marked as in progress",
    "information": "Marked as needing more information",
    "invalid": "Invalidated"
} as Record<SuggestionStatus, string>

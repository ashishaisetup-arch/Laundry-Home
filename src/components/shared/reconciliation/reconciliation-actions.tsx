import { useState } from "react";
import { MoreHorizontal, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { ReconciliationFinding } from "@/lib/types";

export type LifecycleAction = "acknowledge" | "resolve" | "reopen";

export const ACTION_LABELS: Record<LifecycleAction, string> = {
  acknowledge: "Acknowledge",
  resolve: "Resolve",
  reopen: "Reopen",
};

export const MAX_NOTE_LEN = 500;

// Server transition matrix (frozen 3B-5a contract) — impossible actions are
// hidden rather than shown disabled:
//   open         -> acknowledge (idempotent on repeat), resolve
//   acknowledged -> resolve only
//   resolved     -> reopen only
export function actionsForStatus(status: ReconciliationFinding["status"]): LifecycleAction[] {
  if (status === "open") return ["acknowledge", "resolve"];
  if (status === "acknowledged") return ["resolve"];
  if (status === "resolved") return ["reopen"];
  return [];
}

interface FindingActionsMenuProps {
  finding: ReconciliationFinding;
  pending: boolean;
  onAction: (finding: ReconciliationFinding, action: LifecycleAction) => void;
}

export function FindingActionsMenu({ finding, pending, onAction }: FindingActionsMenuProps) {
  const actions = actionsForStatus(finding.status);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={pending}
          aria-label={`Actions for finding ${finding.id.slice(0, 8)}`}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action}
            disabled={pending}
            onSelect={() => onAction(finding, action)}
          >
            {ACTION_LABELS[action]}…
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface LifecycleDialogProps {
  finding: ReconciliationFinding;
  action: LifecycleAction;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (note: string) => void;
}

const DIALOG_COPY: Record<LifecycleAction, { title: string; description: string; placeholder: string }> = {
  acknowledge: {
    title: "Acknowledge finding",
    description: "Records that this finding has been reviewed. Repeat acknowledgements keep the original attribution.",
    placeholder: "Optional note",
  },
  resolve: {
    title: "Resolve finding",
    description:
      "Marks the finding resolved with a note. If the condition is detected again, the finding automatically reopens.",
    placeholder: "Why is this finding resolved? (required)",
  },
  reopen: {
    title: "Reopen finding",
    description:
      "Returns the finding to open and clears acknowledgement and resolution attribution. First detected time and occurrence count are preserved.",
    placeholder: "Optional note",
  },
};

export function LifecycleDialog({ finding, action, pending, onCancel, onSubmit }: LifecycleDialogProps) {
  const [note, setNote] = useState("");
  const copy = DIALOG_COPY[action];
  const trimmed = note.trim();
  const resolveRequired = action === "resolve";
  const canSubmit = !pending && note.length <= MAX_NOTE_LEN && (!resolveRequired || trimmed.length > 0);

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground break-words">
            <span className="font-mono text-xs text-foreground">{finding.checkCode}</span>
            {" · "}
            {finding.summary}
          </p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={copy.placeholder}
            maxLength={MAX_NOTE_LEN}
            rows={3}
            aria-label={`${copy.title} note`}
          />
          <p className="text-[11px] text-muted-foreground text-right" data-testid="note-counter">
            {note.length}/{MAX_NOTE_LEN}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(note)} disabled={!canSubmit} data-testid="lifecycle-submit">
            {pending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {ACTION_LABELS[action]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

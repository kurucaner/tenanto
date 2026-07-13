import Link from "@tiptap/extension-link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Link2, List, ListOrdered, Redo2, Undo2 } from "lucide-react";
import { memo, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ITenantEmailRichTextEditorProps {
  className?: string;
  disabled?: boolean;
  onChange: (html: string) => void;
  value: string;
}

interface IEditorToolbarButtonProps {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}

const EditorToolbarButton = memo(
  ({ active, disabled, label, onClick }: IEditorToolbarButtonProps) => (
    <Button
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      size="icon-sm"
      title={label}
      type="button"
      variant={active ? "secondary" : "ghost"}
    >
      {label === "Bold" && <Bold />}
      {label === "Italic" && <Italic />}
      {label === "Bullet list" && <List />}
      {label === "Numbered list" && <ListOrdered />}
      {label === "Link" && <Link2 />}
      {label === "Undo" && <Undo2 />}
      {label === "Redo" && <Redo2 />}
    </Button>
  )
);
EditorToolbarButton.displayName = "EditorToolbarButton";

export const TenantEmailRichTextEditor = memo(
  ({ className, disabled = false, onChange, value }: ITenantEmailRichTextEditorProps) => {
    const editor = useEditor({
      content: value,
      editable: !disabled,
      extensions: [
        StarterKit,
        Link.configure({
          autolink: true,
          defaultProtocol: "https",
          openOnClick: false,
        }),
      ],
      onUpdate: ({ editor: currentEditor }) => {
        onChange(currentEditor.getHTML());
      },
    });

    useEffect(() => {
      if (editor == null) {
        return;
      }
      editor.setEditable(!disabled);
    }, [disabled, editor]);

    useEffect(() => {
      if (editor == null) {
        return;
      }
      const currentHtml = editor.getHTML();
      if (currentHtml !== value) {
        editor.commands.setContent(value, { emitUpdate: false });
      }
    }, [editor, value]);

    const handleSetLink = () => {
      if (editor == null) {
        return;
      }

      const previousUrl = editor.getAttributes("link").href as string | undefined;
      const url = globalThis.prompt("Enter URL", previousUrl ?? "https://");
      if (url == null) {
        return;
      }

      if (url.trim() === "") {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
        return;
      }

      editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
    };

    return (
      <div
        className={cn("overflow-hidden rounded-lg border border-input bg-background", className)}
      >
        <div className="flex flex-wrap items-center gap-1 border-b border-input px-2 py-1.5">
          <EditorToolbarButton
            active={editor?.isActive("bold") ?? false}
            disabled={disabled || editor == null}
            label="Bold"
            onClick={() => editor?.chain().focus().toggleBold().run()}
          />
          <EditorToolbarButton
            active={editor?.isActive("italic") ?? false}
            disabled={disabled || editor == null}
            label="Italic"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          />
          <EditorToolbarButton
            active={editor?.isActive("bulletList") ?? false}
            disabled={disabled || editor == null}
            label="Bullet list"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          />
          <EditorToolbarButton
            active={editor?.isActive("orderedList") ?? false}
            disabled={disabled || editor == null}
            label="Numbered list"
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          />
          <EditorToolbarButton
            active={editor?.isActive("link") ?? false}
            disabled={disabled || editor == null}
            label="Link"
            onClick={handleSetLink}
          />
          <EditorToolbarButton
            disabled={disabled || editor == null || !editor.can().chain().focus().undo().run()}
            label="Undo"
            onClick={() => editor?.chain().focus().undo().run()}
          />
          <EditorToolbarButton
            disabled={disabled || editor == null || !editor.can().chain().focus().redo().run()}
            label="Redo"
            onClick={() => editor?.chain().focus().redo().run()}
          />
        </div>
        <EditorContent
          className="min-h-40 px-3 py-2 text-sm [&_.ProseMirror]:min-h-36 [&_.ProseMirror]:outline-none [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
          editor={editor}
        />
      </div>
    );
  }
);
TenantEmailRichTextEditor.displayName = "TenantEmailRichTextEditor";

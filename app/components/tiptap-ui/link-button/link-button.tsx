"use client"

import * as React from "react"
import { type Editor } from "@tiptap/react"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { LinkIcon } from "@/components/tiptap-icons/link-icon"
import { Button, ButtonProps } from "@/components/tiptap-ui-primitive/button"

export interface LinkButtonProps extends Omit<ButtonProps, "type"> {
  editor?: Editor | null
}

export const LinkButton = React.forwardRef<HTMLButtonElement, LinkButtonProps>(
  ({ editor: providedEditor, className = "", onClick, ...props }, ref) => {
    const editor = useTiptapEditor(providedEditor)

    const setLink = React.useCallback(() => {
      if (!editor) return

      const previousUrl = editor.getAttributes("link").href
      const url = window.prompt("URL", previousUrl)

      // cancelled
      if (url === null) {
        return
      }

      // empty
      if (url === "") {
        editor.chain().focus().extendMarkRange("link").unsetLink().run()
        return
      }

      // update link
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
    }, [editor])

    if (!editor || !editor.isEditable) {
      return null
    }

    const isActive = editor.isActive("link")

    return (
      <Button
        type="button"
        className={className}
        data-active-state={isActive ? "on" : "off"}
        tooltip="Enlace"
        onClick={(e) => {
          onClick?.(e)
          if (!e.defaultPrevented) setLink()
        }}
        {...props}
        ref={ref}
      >
        <LinkIcon className="tiptap-button-icon" />
      </Button>
    )
  }
)

LinkButton.displayName = "LinkButton"

export default LinkButton

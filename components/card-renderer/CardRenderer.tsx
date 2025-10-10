'use client'

import { memo, useMemo } from "react"

import type { SafeCard } from "@/types/data"

export interface CardRendererProps {
  card: SafeCard
  templateHtml: string
  styles: string
}

const placeholderPattern = /{{\s*([\w-]+)\s*}}/g

const CardRendererComponent = ({ card, templateHtml, styles }: CardRendererProps) => {
  const replacements = useMemo(() => {
    return card.fieldValues.reduce<Record<string, string>>((acc, value, index) => {
      const normalized =
        typeof value === "string" ? value : value === null || value === undefined ? "" : JSON.stringify(value)

      acc[index.toString()] = normalized
      acc[`field${index}`] = normalized
      acc[`Field${index}`] = normalized
      acc[`field-${index}`] = normalized
      return acc
    }, {})
  }, [card.fieldValues])

  const renderedHtml = useMemo(() => {
    return templateHtml.replace(placeholderPattern, (_, token: string) => {
      return token in replacements ? replacements[token] : ""
    })
  }, [replacements, templateHtml])

  return (
    <article className="card-renderer space-y-4">
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
    </article>
  )
}

export const CardRenderer = memo(CardRendererComponent)

export default CardRenderer

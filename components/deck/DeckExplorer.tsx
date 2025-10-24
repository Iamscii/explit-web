"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { DeckType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  Card as UiCard,
  CardContent as UiCardContent,
  CardDescription as UiCardDescription,
  CardHeader as UiCardHeader,
  CardTitle as UiCardTitle,
} from "@/components/ui/card";
import { buildTemplateGroups } from "@/lib/templates/groups";
import { mapFieldValuesById } from "@/lib/templates/card-values";
import { useAppSelector } from "@/redux/hooks";

interface DeckExplorerProps {
  selectedDeckId: string | null;
}

export const DeckExplorer = ({ selectedDeckId }: DeckExplorerProps) => {
  const t = useTranslations("study.deckExplorer");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const deckItems = useAppSelector((state) => state.deck.items);
  const deckStatus = useAppSelector((state) => state.deck.status);
  const cardIds = useAppSelector((state) => state.card.allIds);
  const cardsById = useAppSelector((state) => state.card.byId);
  const cardStatus = useAppSelector((state) => state.card.status);
  const templatesById = useAppSelector((state) => state.template.byId);
  const fieldById = useAppSelector((state) => state.field.byId);
  const fieldIdsByTemplate = useAppSelector(
    (state) => state.field.idsByTemplate
  );
  const fieldPreferencesById = useAppSelector(
    (state) => state.fieldPreference.byId
  );
  const fieldPreferenceIdsByTemplate = useAppSelector(
    (state) => state.fieldPreference.idsByTemplate
  );

  const searchParamsString = searchParams.toString();
  const decks = deckItems.filter((deck) => deck.type !== DeckType.ALL);
  const sortedDecks = [...decks].sort((a, b) => a.name.localeCompare(b.name));
  const deckMap = sortedDecks.reduce<Record<string, (typeof decks)[number]>>(
    (acc, deck) => {
      acc[deck.id] = deck;
      return acc;
    },
    {}
  );
  const selectedDeck = selectedDeckId ? deckMap[selectedDeckId] ?? null : null;

  const cardsByDeck = cardIds.reduce<Record<string, number>>((acc, id) => {
    const card = cardsById[id];
    if (!card?.primaryDeckId) {
      return acc;
    }
    acc[card.primaryDeckId] = (acc[card.primaryDeckId] ?? 0) + 1;
    return acc;
  }, {});

  const cardsForDeck = selectedDeckId
    ? cardIds
        .map((id) => cardsById[id])
        .filter(
          (card): card is NonNullable<(typeof cardsById)[string]> =>
            Boolean(card) && card.primaryDeckId === selectedDeckId
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .map((card, index) => {
          const groups = buildTemplateGroups(
            card.templateId,
            fieldById,
            fieldIdsByTemplate,
            fieldPreferencesById,
            fieldPreferenceIdsByTemplate
          );
          const values = mapFieldValuesById(card, groups.orderedIds);
          const firstFieldId = groups.orderedIds[0];
          const preview = firstFieldId ? values[firstFieldId] : "";
          return {
            card,
            index,
            preview,
            templateName:
              templatesById[card.templateId]?.name ?? t("unknownTemplate"),
          };
        })
    : [];

  const isLoading =
    deckStatus === "idle" ||
    deckStatus === "loading" ||
    cardStatus === "idle" ||
    cardStatus === "loading";

  const updateCategory = (deckId: string | null) => {
    const next = new URLSearchParams(searchParamsString);
    if (deckId) {
      next.set("category", deckId);
    } else {
      next.delete("category");
    }
    const queryString = next.toString();
    const target = queryString ? `${pathname}?${queryString}` : pathname;
    router.push(target, { scroll: false });
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 md:flex-row">
      <aside className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto border border-border/60 bg-card/40 p-4 md:w-64 md:rounded-xl">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("sidebarLabel")}
          </span>
          {selectedDeckId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => updateCategory(null)}
            >
              {t("clearSelection")}
            </Button>
          )}
        </div>

        {isLoading ? (
          <p className="py-4 text-sm text-muted-foreground">{t("loading")}</p>
        ) : sortedDecks.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            {t("emptyDecks")}
          </p>
        ) : (
          sortedDecks.map((deck) => {
            const isActive = deck.id === selectedDeckId;
            const count = cardsByDeck[deck.id] ?? deck.cardCount ?? 0;
            return (
              <Button
                key={deck.id}
                variant={isActive ? "secondary" : "ghost"}
                className="justify-start"
                onClick={() => updateCategory(deck.id)}
              >
                <span className="truncate">{deck.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {count}
                </span>
              </Button>
            );
          })
        )}
      </aside>

      <section className="flex-1 space-y-6">
        {isLoading ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            {t("loading")}
          </div>
        ) : !selectedDeckId ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <h2 className="text-xl font-semibold tracking-tight">
              {t("heading")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("subheading")}
            </p>
          </div>
        ) : !selectedDeck ? (
          <div className="rounded-xl border border-destructive p-10 text-center">
            <h2 className="text-lg font-semibold">{t("missingDeck")}</h2>
          </div>
        ) : (
          <>
            <header className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">
                {selectedDeck.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {selectedDeck.description ?? t("deckDescriptionFallback")}
              </p>
              <p className="text-sm font-medium">
                {t("cardCount", { count: cardsForDeck.length })}
              </p>
            </header>

            {cardsForDeck.length === 0 ? (
              <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                {t("noCards")}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {cardsForDeck.map(({ card, index, preview, templateName }) => (
                  <UiCard
                    key={card.id}
                    className="flex h-full flex-col justify-between"
                  >
                    <UiCardHeader>
                      <UiCardTitle className="text-base font-semibold">
                        {preview || t("noPreview")}
                      </UiCardTitle>
                      <UiCardDescription className="text-xs">
                        {templateName}
                      </UiCardDescription>
                    </UiCardHeader>
                    <UiCardContent className="flex items-center justify-between gap-2 pt-0">
                      <span className="text-xs text-muted-foreground">
                        {t("cardIndex", { index: index + 1 })}
                      </span>
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/deck?deckId=${card.primaryDeckId}&cardIndex=${index}`}
                        >
                          {t("openCard")}
                        </Link>
                      </Button>
                    </UiCardContent>
                  </UiCard>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default DeckExplorer;
